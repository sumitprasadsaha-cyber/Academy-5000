import { ChapterNote } from "../types";

export interface ChapterPartNote extends ChapterNote {
  partNumber: number;
  partLabel: string;
}

export interface ChapterGroup {
  chapterNo: number;
  chapterName: string; // Clean parent title
  notes: ChapterPartNote[];
}

/**
 * Strips part indicators like "(Part 1)", "Part 1", "- Part 1", ": Part 1", "Pt. 1"
 * from chapter titles to get the clean umbrella chapter name.
 */
export function getCleanChapterTitle(title: string): string {
  if (!title) return "";
  let clean = title
    .replace(/[\(\[\{-]?\s*(?:part|pt)\.?\s*\d+\s*[\)\]\}]?/gi, "")
    .replace(/\s*-\s*$/g, "")
    .replace(/\s*:\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return clean || title;
}

/**
 * Parses a note to determine its part number and part label.
 */
export function parseNotePartInfo(note: ChapterNote, fallbackIndex: number): { partNumber: number; partLabel: string } {
  const nameToSearch = `${note.chapterName || ""} ${note.pdfFileName || ""}`;
  const partMatch = nameToSearch.match(/(?:part|pt)\.?\s*(\d+)/i);
  
  let partNumber = fallbackIndex + 1;
  if (partMatch && partMatch[1]) {
    partNumber = parseInt(partMatch[1], 10);
  }

  const partLabel = `Part ${partNumber}`;

  return {
    partNumber,
    partLabel,
  };
}

/**
 * Groups notes by Chapter Number in ascending order,
 * cleans parent chapter names, and sorts child parts numerically.
 */
export function groupAndSortChapterNotes(notes: ChapterNote[]): ChapterGroup[] {
  const groupsMap = new Map<number, ChapterGroup>();

  for (const note of notes) {
    const chNo = Number(note.chapterNo) || 0;
    const cleanTitle = getCleanChapterTitle(note.chapterName) || `Chapter ${chNo}`;

    if (!groupsMap.has(chNo)) {
      groupsMap.set(chNo, {
        chapterNo: chNo,
        chapterName: cleanTitle,
        notes: [],
      });
    }

    const group = groupsMap.get(chNo)!;
    if (cleanTitle && (!group.chapterName || group.chapterName.startsWith("Chapter"))) {
      group.chapterName = cleanTitle;
    }

    const { partNumber, partLabel } = parseNotePartInfo(note, group.notes.length);
    group.notes.push({
      ...note,
      partNumber,
      partLabel,
    });
  }

  // Sort parent chapters by Chapter Number in ascending order
  const result = Array.from(groupsMap.values()).sort((a, b) => a.chapterNo - b.chapterNo);

  // Within each chapter, sort Parts numerically
  for (const group of result) {
    group.notes.sort((a, b) => a.partNumber - b.partNumber);
  }

  return result;
}
