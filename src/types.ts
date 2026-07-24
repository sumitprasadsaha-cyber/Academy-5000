export interface ClassNote {
  id: string;
  classGrade: string; // e.g. "Class 6", "Class 7", "Class 8", "Class 9", "Class 10"
  subject: string; // e.g. "Mathematics", "Science", "English", "Computer Science", "Indian Heritage and Culture", "Economics"
  chapterNo: number;
  chapterName: string;
  partLabel?: string; // e.g. "Part 1", "Part 2", or empty
  pdfUrl: string;
  pdfFileName: string;
  storagePath?: string;
  bucket?: string;
  createdAt: string;
  updatedAt?: string;
  uploadedBy?: string;

  // Student Access Control metadata
  accessType?: "all" | "selected";
  allowedStudentIds?: string[];
}

export interface ChapterNote {
  id: string;
  chapterNo: number; // Only number!
  chapterName: string; // Chapter name
  partLabel?: string; // Optional part label, e.g. Part 1, Part 2
  pdfUrl: string; // Base64 PDF content or URL
  pdfFileName: string; // Original PDF filename
  isCompleted?: boolean; // For tracking revision progress
  remark?: string; // Specific tutor remark on student's performance/difficulty
  createdAt: string;

  // Student Access Control metadata
  accessType?: "all" | "selected";
  allowedStudentIds?: string[];

  // Supabase storage metadata
  storageProvider?: "supabase";
  bucket?: string;
  storagePath?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  uploadedAt?: string;
  uploadedBy?: string;
  downloadUrl?: string;
}

export interface ChapterProgressData {
  studentId: string;
  subjectId: string;
  chapterId: string;
  selectedStatus: string;
  calculatedProgress: number;
  remarks?: string;
  updatedAt: string;
}

export interface StudentReport {
  id: string;
  storageProvider: "supabase";
  bucket: string;
  storagePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
  uploadedBy: string;
  downloadUrl: string;
}

export interface TestMarkRecord {
  id: string;
  subject: string;
  testName: string;
  marksObtained: number;
  totalMarks: number;
  date: string;
}

export interface HomeworkRecord {
  id: string;
  date: string;
  subject: string;
  title: string;
  completed: boolean;
  remark?: string;
}

export interface StudyMaterialUsageRecord {
  subject: string;
  chaptersViewed: number;
  totalChapters: number;
}

export interface Student {
  id: string;
  uid?: string; // Firebase Auth UID for deleting account
  rollNo?: string | number;
  name: string;
  classGrade: string; // "Class 8", "Class 9", "Class 10"
  phone: string;
  parentPhone: string;
  monthlyFee: number;
  feePaidThisMonth: boolean; // Legacy fallback
  registrationDate?: string; // YYYY-MM-DD joining date
  feeMonths?: Record<string, "paid" | "unpaid" | "na">; // e.g. {"June 2026": "unpaid", "July 2026": "paid"}
  feeMonthsList?: string[]; // e.g. ["March 2026", "April 2026"]
  feePaymentDates?: Record<string, string>; // e.g. {"June 2026": "2026-06-15"}
  enrolledSubjects: string[]; // e.g. ["Computer Science", "English", "Mathematics", "Science"]
  avatarUrl?: string; // custom image url
  avatarColor?: string; // fallback background color
  avatarStorageProvider?: "supabase";
  avatarBucket?: string;
  avatarStoragePath?: string;
  notes: Record<string, ChapterNote[]>; // subject -> list of pdf notes
  attendance: Record<string, boolean | "na">; // date (YYYY-MM-DD) -> present (true), absent (false), or N/A ("na")
  email?: string;
  password?: string;
  reports?: StudentReport[];
  chapterProgress?: Record<string, ChapterProgressData>; // key: `${subjectId}_${chapterId}` or `${chapterId}`
  lastActiveAt?: string; // ISO timestamp of last app activity
  
  // AI Analysis additional dimensions
  testMarks?: TestMarkRecord[];
  homeworkRecords?: HomeworkRecord[];
  adminNotes?: string;
  studyMaterialUsage?: StudyMaterialUsageRecord[];
  syllabusProgress?: Record<string, number>;
}

export type AIReportType =
  | "institution_overview"
  | "student_performance"
  | "class_report"
  | "attendance_insights"
  | "fee_insights"
  | "test_performance"
  | "homework_analytics"
  | "syllabus_insights"
  | "parent_communication"
  | "recommendations"
  | "monthly_report"
  | "ask_ai";

export interface AICachedReport {
  reportType: AIReportType;
  key: string;
  markdown: string;
  updatedAt: string;
}


export interface TuitionStats {
  totalEnrolled: number;
  presentToday: number;
  activeClassesCount: number;
  feesPendingCount: number;
  totalRevenue: number;
  monthlyTarget: number;
  monthlyCollected: number;
  subjectProgress: Record<string, number>; // subject -> progress %
}
