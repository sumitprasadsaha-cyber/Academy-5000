import { ChapterNote, ChapterProgressData } from "../types";

export interface ProgressStatusConfig {
  label: string;
  percent: number;
  emoji: string;
  badgeClass: string;
  category: "completed" | "in_progress" | "need_revision";
}

export const REMOVED_STATUS_MAPPING: Record<string, string> = {
  "Started Reading": "Reading",
  "Half Completed": "Reading",
  "Almost Completed": "Completed First Reading",
  "MCQs Solved": "PYQs Solved",
  "Revision Pending": "Completed First Reading",
  "Need Revision": "Completed First Reading",
  "Difficult Chapter": "Completed First Reading",
  "Doubts Remaining": "Completed First Reading",
};

export function normalizeStatusLabel(statusLabel?: string | null): string {
  if (!statusLabel || statusLabel.trim() === "") {
    return "Not Started";
  }
  const clean = statusLabel.trim();
  if (REMOVED_STATUS_MAPPING[clean]) {
    return REMOVED_STATUS_MAPPING[clean];
  }
  return clean;
}

export const PROGRESS_STATUS_MAPPING: ProgressStatusConfig[] = [
  {
    label: "Not Started",
    percent: 0,
    emoji: "⚪",
    badgeClass: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
    category: "in_progress"
  },
  {
    label: "Reading",
    percent: 25,
    emoji: "🔵",
    badgeClass: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-900",
    category: "in_progress"
  },
  {
    label: "Completed First Reading",
    percent: 50,
    emoji: "🟢",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900",
    category: "in_progress"
  },
  {
    label: "First Revision Completed",
    percent: 65,
    emoji: "🔷",
    badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-900",
    category: "in_progress"
  },
  {
    label: "Second Revision Completed",
    percent: 80,
    emoji: "💜",
    badgeClass: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-900",
    category: "in_progress"
  },
  {
    label: "Third Revision Completed",
    percent: 90,
    emoji: "⭐",
    badgeClass: "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-900",
    category: "in_progress"
  },
  {
    label: "PYQs Solved",
    percent: 95,
    emoji: "🟣",
    badgeClass: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-950/50 dark:text-fuchsia-300 dark:border-fuchsia-900",
    category: "in_progress"
  },
  {
    label: "Fully Prepared",
    percent: 100,
    emoji: "🏆",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
    category: "completed"
  }
];

export function getStatusConfig(statusLabel?: string | null): ProgressStatusConfig {
  const normalized = normalizeStatusLabel(statusLabel);
  const found = PROGRESS_STATUS_MAPPING.find((s) => s.label === normalized);
  if (found) return found;
  return {
    label: normalized,
    percent: 0,
    emoji: "⚪",
    badgeClass: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
    category: "in_progress"
  };
}

export function getChapterProgressRecord(
  noteId: string,
  subject: string,
  chapterProgressMap?: Record<string, ChapterProgressData>
): ChapterProgressData | null {
  if (!chapterProgressMap) return null;
  const subjClean = (subject || "").trim();
  const keyClean = `${subjClean}_${noteId}`;
  const keyRaw = `${subject}_${noteId}`;
  return chapterProgressMap[keyClean] || chapterProgressMap[keyRaw] || chapterProgressMap[noteId] || null;
}

import { filterClassNotesForStudent } from "./classNoteHelper";
import { filterNotesForStudent, isNoteAccessibleToStudent } from "./noteAccessHelper";
import { groupAndSortChapterNotes } from "./chapterNotesHelper";
import { ClassNote, Student } from "../types";

export interface SubjectChapterSummary {
  chapterNo: number;
  chapterName: string;
  notes: ChapterNote[];
  isCompleted: boolean;
  statusLabel: string;
  percent: number;
  remark: string;
}

export interface SubjectProgressSummary {
  subject: string;
  total: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  rate: number;
  chapters: SubjectChapterSummary[];
}

/**
 * Calculates chapter-wise progress for a subject and student.
 * Uses central classNotes + student.notes (deduplicated) and groups by umbrella Chapter.
 * Excludes Parts from chapter totals and completed counts.
 */
export function calculateSubjectProgress(
  subject: string,
  student: Student,
  allClassNotes: ClassNote[] = [],
  isAdmin: boolean = false
): SubjectProgressSummary {
  const subjClean = (subject || "").trim().toLowerCase();

  // 1. Get central class notes matching student class & subject
  const studentCentral = filterClassNotesForStudent(allClassNotes, student)
    .filter((n) => (n.subject || "").trim().toLowerCase() === subjClean)
    .filter((n) => isNoteAccessibleToStudent(n, student.id, isAdmin))
    .map((cn) => ({
      id: cn.id,
      chapterNo: cn.chapterNo,
      chapterName: cn.chapterName,
      partLabel: cn.partLabel,
      pdfUrl: cn.pdfUrl,
      pdfFileName: cn.pdfFileName,
      storagePath: cn.storagePath,
      bucket: cn.bucket,
      createdAt: cn.createdAt,
      subject: cn.subject,
    }));

  // 2. Get legacy notes directly under student.notes
  const legacyRaw = ((student.notes?.[subject] || student.notes?.[subjClean] || []) as ChapterNote[]);
  const legacyFiltered = filterNotesForStudent(legacyRaw, student.id, isAdmin);

  // 3. Combine & deduplicate notes
  const combinedNotes: ChapterNote[] = [...studentCentral];
  for (const leg of legacyFiltered) {
    if (!combinedNotes.some((c) => c.id === leg.id || (leg.storagePath && c.storagePath === leg.storagePath))) {
      combinedNotes.push(leg);
    }
  }

  // 4. Group by Chapter Number into umbrella Chapters
  const chapterGroups = groupAndSortChapterNotes(combinedNotes);

  const chaptersSummary: SubjectChapterSummary[] = chapterGroups.map((group) => {
    const chapterNotes = group.notes;
    let completedParts = 0;
    let startedParts = 0;
    let mainRemark = "";

    chapterNotes.forEach((n) => {
      const progRecord = getChapterProgressRecord(n.id, subject, student.chapterProgress);
      const statusConfig = progRecord ? getStatusConfig(progRecord.selectedStatus) : null;
      const isPartCompleted = (statusConfig && statusConfig.category === "completed") || !!n.isCompleted;
      const isPartStarted = isPartCompleted || (statusConfig && statusConfig.label !== "Not Started" && statusConfig.label !== "");
      const remark = progRecord?.remarks || n.remark || "";

      if (isPartCompleted) completedParts++;
      if (isPartStarted) startedParts++;
      if (remark && !mainRemark) mainRemark = remark;
    });

    const isCompleted = chapterNotes.length > 0 && completedParts === chapterNotes.length;
    let statusLabel = "Not Started";
    let percent = 0;

    if (isCompleted) {
      statusLabel = "Completed";
      percent = 100;
    } else if (startedParts > 0 || completedParts > 0) {
      statusLabel = "In Progress";
      percent = 50;
    }

    return {
      chapterNo: group.chapterNo,
      chapterName: group.chapterName,
      notes: chapterNotes,
      isCompleted,
      statusLabel,
      percent,
      remark: mainRemark,
    };
  });

  const total = chaptersSummary.length;
  const completed = chaptersSummary.filter((c) => c.isCompleted).length;
  const inProgress = chaptersSummary.filter((c) => c.statusLabel === "In Progress").length;
  const notStarted = chaptersSummary.filter((c) => c.statusLabel === "Not Started").length;
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

  return {
    subject,
    total,
    completed,
    inProgress,
    notStarted,
    rate,
    chapters: chaptersSummary,
  };
}
