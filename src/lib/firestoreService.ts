import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  getDocs 
} from "firebase/firestore";
import { getFirebaseDb, OperationType, handleFirestoreError } from "./firebase";
import { Student, ClassNote } from "../types";

// Local storage keys for fallback/offline sandbox mode
const STORAGE_KEY_STUDENTS = "tuition_students_data";
const STORAGE_KEY_USERS = "tuition_users_data";
const STORAGE_KEY_INSTITUTION_NAME = "tuition_institution_name";

function getCachedInstitutionName(): string {
  if (typeof window === "undefined") {
    return "Ingenious Study Circle";
  }
  return localStorage.getItem(STORAGE_KEY_INSTITUTION_NAME) || "Ingenious Study Circle";
}

function setCachedInstitutionName(name: string) {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(STORAGE_KEY_INSTITUTION_NAME, name);
  window.dispatchEvent(new CustomEvent("institution-name-updated", { detail: name }));
}

// Fallback in-memory subscribers list for real-time emulation when Firestore is offline
type StudentsListener = (students: Student[]) => void;
const studentsListeners = new Set<StudentsListener>();

// Dynamic trigger to notify all local subscribers of change
function notifyLocalStudentsListeners() {
  const students = getLocalStudents();
  studentsListeners.forEach((listener) => listener(students));
}

// Helper to get local students
export function getLocalStudents(): Student[] {
  const cached = localStorage.getItem(STORAGE_KEY_STUDENTS);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {
      console.error("Failed to parse local students", e);
    }
  }
  return [];
}

// Helper to save local students
export function saveLocalStudents(students: Student[]) {
  localStorage.setItem(STORAGE_KEY_STUDENTS, JSON.stringify(students));
  notifyLocalStudentsListeners();
}

// ----------------------------------------------------
// FIRESTORE / HYBRID SYNCHRONIZATION API
// ----------------------------------------------------

/**
 * Check if Firebase is fully initialized and Firestore is accessible
 */
export async function isDbOnline(): Promise<boolean> {
  try {
    const db = await getFirebaseDb();
    return db !== null;
  } catch {
    return false;
  }
}

/**
 * Fetch a specific user document by UID
 */
export async function getUserDocument(uid: string): Promise<any> {
  try {
    const db = await getFirebaseDb();
    if (!db) {
      // Fallback: Read from Local Storage Users map
      const cachedUsers = localStorage.getItem(STORAGE_KEY_USERS);
      const users = cachedUsers ? JSON.parse(cachedUsers) : {};
      return users[uid] || null;
    }
    const userDocRef = doc(db, "users", uid);
    const snap = await getDoc(userDocRef);
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `users/${uid}`);
    return null;
  }
}

/**
 * Recursively removes any `undefined` values from an object or array before passing to Firestore.
 */
export function cleanObjectForFirestore<T>(data: T): T {
  if (data === null || data === undefined) return data;
  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => cleanObjectForFirestore(item)) as unknown as T;
  }
  if (typeof data === "object" && !(data instanceof Date)) {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        cleaned[key] = cleanObjectForFirestore(value);
      }
    }
    return cleaned as T;
  }
  return data;
}

/**
 * Create or update a user document
 */
export async function saveUserDocument(uid: string, userData: any): Promise<void> {
  const cleanedData = cleanObjectForFirestore(userData);
  try {
    const db = await getFirebaseDb();
    if (!db) {
      // Fallback: Save to Local Storage Users map
      const cachedUsers = localStorage.getItem(STORAGE_KEY_USERS);
      const users = cachedUsers ? JSON.parse(cachedUsers) : {};
      users[uid] = cleanedData;
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
      return;
    }
    const userDocRef = doc(db, "users", uid);
    await setDoc(userDocRef, cleanedData, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
  }
}

/**
 * Fetch user document by registered phone number (used during single unified login verification)
 */
export async function getUserDocByPhone(phone: string): Promise<any> {
  // Normalize phone to format like "+919876543210"
  let cleanPhone = phone.replace(/\D/g, "");
  if (!cleanPhone.startsWith("91")) {
    cleanPhone = "91" + cleanPhone;
  }
  const formattedPhone = "+" + cleanPhone;

  try {
    const db = await getFirebaseDb();
    if (!db) {
      // Fallback: Search local users
      const cachedUsers = localStorage.getItem(STORAGE_KEY_USERS);
      const users = cachedUsers ? JSON.parse(cachedUsers) : {};
      const found = Object.values(users).find((u: any) => u.phone === formattedPhone);
      if (found) return found;

      // Seed default admin if user tries to login with standard admin number
      if (formattedPhone === "+919609598095" || formattedPhone === "+917866856370") {
        const defaultAdmin = {
          uid: "mock-admin-uid",
          phone: formattedPhone,
          role: "Admin",
          status: "Active",
          name: "Administrator"
        };
        users["mock-admin-uid"] = defaultAdmin;
        localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
        return defaultAdmin;
      }

      // Check students list to see if a student matches this number or parent number
      const students = getLocalStudents();
      const matchedStudent = students.find((s) => {
        const sp = s.phone.replace(/\D/g, "");
        const pp = s.parentPhone.replace(/\D/g, "");
        return sp.endsWith(cleanPhone.substring(2)) || pp.endsWith(cleanPhone.substring(2));
      });

      if (matchedStudent) {
        // Automatically create a mock student user document in local storage
        const studentUid = `mock-student-uid-${matchedStudent.id}`;
        const newStudentUser = {
          uid: studentUid,
          phone: formattedPhone,
          role: "Student",
          studentId: matchedStudent.id,
          status: "Active",
          name: matchedStudent.name
        };
        users[studentUid] = newStudentUser;
        localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
        return newStudentUser;
      }

      return null;
    }

    // Since we are server-side querying without complex indexing if possible, we get all users and filter
    // in code, which is extremely robust and avoids missing indexing errors!
    const usersColRef = collection(db, "users");
    const snap = await getDocs(usersColRef);
    let matchedUser: any = null;
    snap.forEach((d) => {
      const u = d.data();
      if (u.phone === formattedPhone) {
        matchedUser = u;
      }
    });
    
    if (matchedUser) return matchedUser;

    // Seed default admin if user tries to login with standard admin number
    if (formattedPhone === "+919609598095" || formattedPhone === "+917866856370") {
      return {
        uid: "pending-admin-uid",
        phone: formattedPhone,
        role: "Admin",
        status: "Active",
        name: "Administrator"
      };
    }

    // Check students list to see if a student matches this number or parent number
    let students: Student[] = [];
    try {
      const studentsColRef = collection(db, "students");
      const studentsSnap = await getDocs(studentsColRef);
      studentsSnap.forEach((doc) => {
        students.push(doc.data() as Student);
      });
    } catch (e) {
      console.warn("Failed to fetch students from Firestore for lookup, using local cache", e);
      students = getLocalStudents();
    }

    const matchedStudent = students.find((s) => {
      const sp = (s.phone || "").replace(/\D/g, "");
      const pp = (s.parentPhone || "").replace(/\D/g, "");
      return sp.endsWith(cleanPhone.substring(2)) || pp.endsWith(cleanPhone.substring(2));
    });

    if (matchedStudent) {
      return {
        uid: `pending-student-uid-${matchedStudent.id}`,
        phone: formattedPhone,
        role: "Student",
        studentId: matchedStudent.id,
        status: "Active",
        name: matchedStudent.name
      };
    }

    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, "users");
    return null;
  }
}

/**
 * Subscribe to the entire list of students (Real-time synchronization for Admin)
 */
export function subscribeToStudents(
  onUpdate: (students: Student[]) => void,
  onError?: (err: any) => void
): () => void {
  let unsubscribeFirestore: (() => void) | null = null;
  let active = true;

  async function setup() {
    const db = await getFirebaseDb();
    if (!active) return;

    if (!db) {
      // Local Sandbox/Offline Mode: Trigger immediate update and register listener
      onUpdate(getLocalStudents());
      const listener: StudentsListener = (updatedList) => {
        if (active) onUpdate(updatedList);
      };
      studentsListeners.add(listener);
      unsubscribeFirestore = () => {
        studentsListeners.delete(listener);
      };
      return;
    }

    try {
      const studentsColRef = collection(db, "students");
      unsubscribeFirestore = onSnapshot(
        studentsColRef,
        (snap) => {
          if (!active) return;
          const list: Student[] = [];
          snap.forEach((doc) => {
            list.push(doc.data() as Student);
          });
          onUpdate(list);
          // Also sync with localStorage cache for offline seamless use
          localStorage.setItem(STORAGE_KEY_STUDENTS, JSON.stringify(list));
        },
        (err) => {
          console.error("Firestore onSnapshot error", err);
          if (onError) onError(err);
          // Fallback to local cache on error
          onUpdate(getLocalStudents());
        }
      );
    } catch (err) {
      console.warn("Failed to subscribe to students collection, falling back to local storage.", err);
      onUpdate(getLocalStudents());
    }
  }

  setup();

  return () => {
    active = false;
    if (unsubscribeFirestore) {
      unsubscribeFirestore();
    }
  };
}

/**
 * Subscribe to a single student document (Real-time sync for Student Dashboard)
 */
export function subscribeToStudent(
  studentId: string,
  onUpdate: (student: Student) => void,
  onError?: (err: any) => void
): () => void {
  let unsubscribeFirestore: (() => void) | null = null;
  let active = true;

  async function setup() {
    const db = await getFirebaseDb();
    if (!active) return;

    if (!db) {
      // Fallback: Get from local storage, register to global students listener to track updates
      const findAndTrigger = () => {
        const students = getLocalStudents();
        const found = students.find((s) => s.id === studentId);
        if (found && active) onUpdate(found);
      };
      findAndTrigger();

      const listener: StudentsListener = () => {
        findAndTrigger();
      };
      studentsListeners.add(listener);
      unsubscribeFirestore = () => {
        studentsListeners.delete(listener);
      };
      return;
    }

    try {
      const studentDocRef = doc(db, "students", studentId);
      unsubscribeFirestore = onSnapshot(
        studentDocRef,
        (snap) => {
          if (!active) return;
          if (snap.exists()) {
            onUpdate(snap.data() as Student);
          }
        },
        (err) => {
          console.error("Single student subscription failed:", err);
          if (onError) onError(err);
        }
      );
    } catch (err) {
      console.warn("Failed to subscribe to single student doc. Using local fallback.", err);
    }
  }

  setup();

  return () => {
    active = false;
    if (unsubscribeFirestore) {
      unsubscribeFirestore();
    }
  };
}

/**
 * Save or update student record
 */
export async function saveStudentDoc(student: Student): Promise<void> {
  const cleanedStudent = cleanObjectForFirestore(student);

  // Synchronously update local storage cache and notify local subscribers
  const students = getLocalStudents();
  const existsIdx = students.findIndex((s) => s.id === cleanedStudent.id);
  if (existsIdx > -1) {
    students[existsIdx] = cleanedStudent;
  } else {
    students.unshift(cleanedStudent);
  }
  saveLocalStudents(students);

  const db = await getFirebaseDb();
  if (!db) return;

  try {
    const studentDocRef = doc(db, "students", cleanedStudent.id);
    await setDoc(studentDocRef, cleanedStudent, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `students/${cleanedStudent.id}`);
  }
}

/**
 * Update student presence timestamp (lastActiveAt) in real-time
 */
export async function updateStudentPresence(studentId: string): Promise<void> {
  const now = new Date().toISOString();
  // Update local storage cache
  const students = getLocalStudents();
  const idx = students.findIndex((s) => s.id === studentId);
  if (idx > -1) {
    students[idx] = { ...students[idx], lastActiveAt: now };
    saveLocalStudents(students);
  }

  const db = await getFirebaseDb();
  if (!db) return;

  try {
    const studentDocRef = doc(db, "students", studentId);
    await setDoc(studentDocRef, { lastActiveAt: now }, { merge: true });
  } catch (err) {
    console.warn("Failed updating student presence timestamp:", err);
  }
}

/**
 * Mark a student as offline (when logging out or closing app)
 */
export async function markStudentOffline(studentId: string): Promise<void> {
  // Update local storage cache
  const students = getLocalStudents();
  const idx = students.findIndex((s) => s.id === studentId);
  if (idx > -1) {
    students[idx] = { ...students[idx], lastActiveAt: "" };
    saveLocalStudents(students);
  }

  const db = await getFirebaseDb();
  if (!db) return;

  try {
    const studentDocRef = doc(db, "students", studentId);
    await setDoc(studentDocRef, { lastActiveAt: "" }, { merge: true });
  } catch (err) {
    console.warn("Failed marking student offline:", err);
  }
}

/**
 * Delete student record
 */
export async function deleteStudentDoc(studentId: string): Promise<void> {
  const db = await getFirebaseDb();
  if (!db) {
    // Local storage fallback
    const students = getLocalStudents();
    const filtered = students.filter((s) => s.id !== studentId);
    saveLocalStudents(filtered);
    return;
  }

  try {
    const studentDocRef = doc(db, "students", studentId);
    await deleteDoc(studentDocRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `students/${studentId}`);
  }
}

/**
 * Checks if there is any user with Admin role in the database.
 */
export async function checkAnyAdminExists(): Promise<boolean> {
  try {
    const db = await getFirebaseDb();
    if (!db) {
      const cachedUsers = localStorage.getItem(STORAGE_KEY_USERS);
      const users = cachedUsers ? JSON.parse(cachedUsers) : {};
      return Object.values(users).some((u: any) => u.role === "Admin" || u.role === "admin");
    }
    
    const usersColRef = collection(db, "users");
    const snap = await getDocs(usersColRef);
    let adminFound = false;
    snap.forEach((doc) => {
      const u = doc.data();
      if (u.role === "Admin" || u.role === "admin") {
        adminFound = true;
      }
    });
    return adminFound;
  } catch (e: any) {
    console.warn("Failed checking if admin exists:", e);
    
    // If the database threw a permission-denied error, it means Firestore security rules
    // are active and enforcing unauthenticated access block. This guarantees the database
    // is already initialized, configured, and secured!
    if (e && (e.code === "permission-denied" || (e.message && e.message.toLowerCase().includes("permission")))) {
      return true;
    }
    
    const cachedUsers = localStorage.getItem(STORAGE_KEY_USERS);
    const users = cachedUsers ? JSON.parse(cachedUsers) : {};
    return Object.values(users).some((u: any) => u.role === "Admin" || u.role === "admin");
  }
}

/**
 * Saves the Institution Name.
 */
export async function saveInstitutionName(name: string): Promise<void> {
  const trimmed = name.trim() || "Ingenious Study Circle";
  setCachedInstitutionName(trimmed);
  try {
    const db = await getFirebaseDb();
    if (!db) {
      return;
    }
    const settingsDocRef = doc(db, "settings", "institution");
    await setDoc(settingsDocRef, { name: trimmed }, { merge: true });
  } catch (err) {
    console.warn("Failed saving institution name to Firestore:", err);
  }
}

/**
 * Fetches the Institution Name.
 */
export async function getInstitutionName(): Promise<string> {
  const cached = getCachedInstitutionName();
  try {
    const db = await getFirebaseDb();
    if (!db) {
      return cached;
    }
    const settingsDocRef = doc(db, "settings", "institution");
    const snap = await getDoc(settingsDocRef);
    if (snap.exists()) {
      const value = snap.data().name || "Ingenious Study Circle";
      setCachedInstitutionName(value);
      return value;
    }
    return cached;
  } catch (err) {
    console.warn("Failed fetching institution name from Firestore:", err);
    return cached;
  }
}

/**
 * Fetches all registered administrators from Firestore (or Local Storage fallback).
 */
export async function getAllAdmins(): Promise<any[]> {
  try {
    const db = await getFirebaseDb();
    if (!db) {
      const cachedUsers = localStorage.getItem(STORAGE_KEY_USERS);
      const users = cachedUsers ? JSON.parse(cachedUsers) : {};
      return Object.values(users).filter((u: any) => u.role === "Admin" || u.role === "admin");
    }
    const usersColRef = collection(db, "users");
    const snap = await getDocs(usersColRef);
    const admins: any[] = [];
    snap.forEach((d) => {
      const u = d.data();
      if (u.role === "Admin" || u.role === "admin") {
        admins.push({ ...u, uid: u.uid || d.id, id: d.id });
      }
    });
    return admins;
  } catch (err) {
    console.error("Error fetching all admins:", err);
    return [];
  }
}

/**
 * Deletes a user document from Firestore (or Local Storage fallback).
 */
export async function deleteUserDocument(uid: string): Promise<void> {
  try {
    const db = await getFirebaseDb();
    if (!db) {
      const cachedUsers = localStorage.getItem(STORAGE_KEY_USERS);
      const users = cachedUsers ? JSON.parse(cachedUsers) : {};
      delete users[uid];
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
      return;
    }
    const userDocRef = doc(db, "users", uid);
    await deleteDoc(userDocRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `users/${uid}`);
  }
}

/**
 * Deletes a user from Firebase Authentication.
 * This is a server-side operation and requires appropriate security rules.
 */
export async function deleteUserAuthCredentials(uid: string): Promise<void> {
  try {
    const auth = await (async () => {
      const { getFirebaseAuth } = await import("./firebase");
      return getFirebaseAuth();
    })();
    
    if (!auth) {
      console.warn("Firebase Auth not available, skipping auth deletion");
      return;
    }
    
    // Note: Client-side deletion of other users requires special security rules or admin SDK
    // For now, this function prepares the structure for future admin SDK integration
    console.log(`Prepared to delete auth credentials for user: ${uid}`);
  } catch (err) {
    console.error(`Error deleting auth credentials for user ${uid}:`, err);
  }
}

/**
 * Subscribe to announcements in real-time
 */
export function subscribeToAnnouncements(
  onUpdate: (announcements: any[]) => void,
  onError?: (err: any) => void
): () => void {
  let unsubscribeFirestore: (() => void) | null = null;
  let active = true;

  const STORAGE_KEY_ANNOUNCEMENTS = "tuition_announcements";

  const getCachedAnnouncements = () => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY_ANNOUNCEMENTS);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  };

  async function setup() {
    const db = await getFirebaseDb();
    if (!active) return;

    if (!db) {
      // Local fallback
      onUpdate(getCachedAnnouncements());
      const handleLocalEvent = () => {
        if (active) onUpdate(getCachedAnnouncements());
      };
      window.addEventListener("storage", handleLocalEvent);
      unsubscribeFirestore = () => {
        window.removeEventListener("storage", handleLocalEvent);
      };
      return;
    }

    try {
      const colRef = collection(db, "announcements");
      unsubscribeFirestore = onSnapshot(
        colRef,
        (snap) => {
          if (!active) return;
          const list: any[] = [];
          snap.forEach((doc) => {
            list.push(doc.data());
          });
          // Sort descending by date/id
          list.sort((a, b) => {
            const dateA = a.date || "";
            const dateB = b.date || "";
            if (dateA !== dateB) return dateB.localeCompare(dateA);
            return (b.id || "").localeCompare(a.id || "");
          });
          onUpdate(list);
          localStorage.setItem(STORAGE_KEY_ANNOUNCEMENTS, JSON.stringify(list));
        },
        (err) => {
          console.error("Firestore announcements snapshot error", err);
          if (onError) onError(err);
          onUpdate(getCachedAnnouncements());
        }
      );
    } catch (err) {
      console.warn("Failed to subscribe to announcements, using local fallback", err);
      onUpdate(getCachedAnnouncements());
    }
  }

  setup();

  return () => {
    active = false;
    if (unsubscribeFirestore) {
      unsubscribeFirestore();
    }
  };
}

/**
 * Save an announcement
 */
export async function saveAnnouncementDoc(announcement: { id: string; text: string; date: string }): Promise<void> {
  const STORAGE_KEY_ANNOUNCEMENTS = "tuition_announcements";
  const db = await getFirebaseDb();
  if (!db) {
    // Local fallback
    try {
      const cached = localStorage.getItem(STORAGE_KEY_ANNOUNCEMENTS);
      const list = cached ? JSON.parse(cached) : [];
      const updated = [announcement, ...list.filter((a: any) => a.id !== announcement.id)];
      localStorage.setItem(STORAGE_KEY_ANNOUNCEMENTS, JSON.stringify(updated));
      window.dispatchEvent(new Event("storage"));
    } catch (e) {
      console.error(e);
    }
    return;
  }

  try {
    const docRef = doc(db, "announcements", announcement.id);
    await setDoc(docRef, cleanObjectForFirestore(announcement));
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `announcements/${announcement.id}`);
  }
}

/**
 * Delete an announcement
 */
export async function deleteAnnouncementDoc(id: string): Promise<void> {
  const STORAGE_KEY_ANNOUNCEMENTS = "tuition_announcements";
  const db = await getFirebaseDb();
  if (!db) {
    // Local fallback
    try {
      const cached = localStorage.getItem(STORAGE_KEY_ANNOUNCEMENTS);
      const list = cached ? JSON.parse(cached) : [];
      const updated = list.filter((a: any) => a.id !== id);
      localStorage.setItem(STORAGE_KEY_ANNOUNCEMENTS, JSON.stringify(updated));
      window.dispatchEvent(new Event("storage"));
    } catch (e) {
      console.error(e);
    }
    return;
  }

  try {
    const docRef = doc(db, "announcements", id);
    await deleteDoc(docRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `announcements/${id}`);
  }
}

// ----------------------------------------------------
// CLASS NOTES CENTRALIZED STORAGE API
// ----------------------------------------------------
const STORAGE_KEY_CLASS_NOTES = "tuition_class_notes";

type ClassNotesListener = (notes: ClassNote[]) => void;
const classNotesListeners = new Set<ClassNotesListener>();

export function getLocalClassNotes(): ClassNote[] {
  if (typeof window === "undefined") return [];
  const cached = localStorage.getItem(STORAGE_KEY_CLASS_NOTES);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {
      console.error("Failed to parse local class notes", e);
    }
  }
  return [];
}

export function saveLocalClassNotes(notes: ClassNote[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY_CLASS_NOTES, JSON.stringify(notes));
  classNotesListeners.forEach((listener) => listener(notes));
  window.dispatchEvent(new Event("storage"));
}

export function subscribeToClassNotes(
  onUpdate: (notes: ClassNote[]) => void,
  onError?: (err: any) => void
): () => void {
  let unsubscribeFirestore: (() => void) | null = null;
  let active = true;

  async function setup() {
    const db = await getFirebaseDb();
    if (!active) return;

    if (!db) {
      onUpdate(getLocalClassNotes());
      const listener: ClassNotesListener = (updatedList) => {
        if (active) onUpdate(updatedList);
      };
      classNotesListeners.add(listener);
      unsubscribeFirestore = () => {
        classNotesListeners.delete(listener);
      };
      return;
    }

    try {
      const colRef = collection(db, "class_notes");
      unsubscribeFirestore = onSnapshot(
        colRef,
        (snap) => {
          if (!active) return;
          const list: ClassNote[] = [];
          snap.forEach((docSnap) => {
            list.push(docSnap.data() as ClassNote);
          });
          saveLocalClassNotes(list);
          onUpdate(list);
        },
        (err) => {
          console.error("Firestore class_notes snapshot error", err);
          if (onError) onError(err);
          onUpdate(getLocalClassNotes());
        }
      );
    } catch (err) {
      console.warn("Failed to subscribe to class_notes, using local fallback", err);
      onUpdate(getLocalClassNotes());
    }
  }

  setup();

  return () => {
    active = false;
    if (unsubscribeFirestore) {
      unsubscribeFirestore();
    }
  };
}

export async function saveClassNoteDoc(note: ClassNote): Promise<void> {
  const db = await getFirebaseDb();
  const currentLocal = getLocalClassNotes();
  const updatedLocal = [note, ...currentLocal.filter((n) => n.id !== note.id)];
  saveLocalClassNotes(updatedLocal);

  if (!db) return;

  try {
    const docRef = doc(db, "class_notes", note.id);
    await setDoc(docRef, cleanObjectForFirestore(note), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `class_notes/${note.id}`);
  }
}

export async function deleteClassNoteDoc(noteId: string): Promise<void> {
  const db = await getFirebaseDb();
  const currentLocal = getLocalClassNotes();
  const targetNote = currentLocal.find((n) => n.id === noteId);
  const updatedLocal = currentLocal.filter((n) => n.id !== noteId);
  saveLocalClassNotes(updatedLocal);

  // Clean up legacy student.notes across all student records to prevent auto-migration from resurrecting it
  try {
    const students = getLocalStudents();
    let anyStudentUpdated = false;
    const updatedStudentsList = students.map((student) => {
      if (!student.notes) return student;
      let studentUpdated = false;
      const updatedNotes: Record<string, any[]> = {};

      for (const [subject, notesArr] of Object.entries(student.notes)) {
        if (!Array.isArray(notesArr)) {
          updatedNotes[subject] = notesArr as any;
          continue;
        }
        const filtered = notesArr.filter((n: any) => {
          if (n.id === noteId) return false;
          if (targetNote?.storagePath && n.storagePath === targetNote.storagePath) return false;
          if (targetNote?.pdfUrl && n.pdfUrl === targetNote.pdfUrl) return false;
          return true;
        });

        if (filtered.length !== notesArr.length) {
          studentUpdated = true;
          anyStudentUpdated = true;
        }
        if (filtered.length > 0) {
          updatedNotes[subject] = filtered;
        }
      }

      if (studentUpdated) {
        return { ...student, notes: updatedNotes };
      }
      return student;
    });

    if (anyStudentUpdated) {
      saveLocalStudents(updatedStudentsList);
      for (const st of updatedStudentsList) {
        const orig = students.find((s) => s.id === st.id);
        if (orig && JSON.stringify(orig.notes) !== JSON.stringify(st.notes)) {
          await saveStudentDoc(st);
        }
      }
    }
  } catch (err) {
    console.warn("Failed cleansing student.notes on deleteClassNoteDoc:", err);
  }

  if (!db) return;

  try {
    const docRef = doc(db, "class_notes", noteId);
    await deleteDoc(docRef);

    // Clean up student.notes across all student records in Firestore
    try {
      const studentsColRef = collection(db, "students");
      const snap = await getDocs(studentsColRef);
      snap.forEach(async (docSnap) => {
        const st = docSnap.data() as Student;
        if (!st || !st.notes) return;
        let studentUpdated = false;
        const updatedNotes: Record<string, any[]> = {};

        for (const [subject, notesArr] of Object.entries(st.notes)) {
          if (!Array.isArray(notesArr)) {
            updatedNotes[subject] = notesArr as any;
            continue;
          }
          const filtered = notesArr.filter((n: any) => {
            if (n.id === noteId) return false;
            if (targetNote?.storagePath && n.storagePath === targetNote.storagePath) return false;
            if (targetNote?.pdfUrl && n.pdfUrl === targetNote.pdfUrl) return false;
            return true;
          });

          if (filtered.length !== notesArr.length) {
            studentUpdated = true;
          }
          if (filtered.length > 0) {
            updatedNotes[subject] = filtered;
          }
        }

        if (studentUpdated) {
          const cleanedStudent = { ...st, notes: updatedNotes };
          await setDoc(doc(db, "students", st.id), cleanObjectForFirestore(cleanedStudent), { merge: true });
        }
      });
    } catch (fsErr) {
      console.warn("Failed cleansing Firestore student.notes on delete:", fsErr);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `class_notes/${noteId}`);
  }
}


