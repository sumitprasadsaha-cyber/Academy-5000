import { ParsedAssessmentQuestion, TopicPracticeTest, TestAttemptRecord } from "../types";

export interface ParseResult {
  success: boolean;
  questions: ParsedAssessmentQuestion[];
  errors: string[];
}

const TESTS_STORAGE_KEY = "tuition_topic_practice_tests_bank";
const ATTEMPTS_STORAGE_KEY = "tuition_student_test_attempts";

/**
 * Normalizes test ID for topic practice tests
 */
export function buildTopicTestId(
  classGrade: string,
  subject: string,
  chapterNo: number,
  topicName: string
): string {
  const normClass = classGrade.toLowerCase().replace(/\s+/g, "_");
  const normSubj = subject.toLowerCase().replace(/\s+/g, "_");
  const normTopic = topicName.toLowerCase().replace(/[^a-z0-9]/g, "_");
  return `${normClass}__${normSubj}__ch${chapterNo}__${normTopic}`;
}

/**
 * Parses raw pasted text into structured MCQ and True/False questions.
 */
export function parseAssessmentText(
  rawText: string,
  context: {
    classGrade: string;
    subject: string;
    chapterNo: number;
    chapterName: string;
    topicName: string;
  }
): ParseResult {
  const errors: string[] = [];
  const questions: ParsedAssessmentQuestion[] = [];

  const text = rawText.trim();
  if (!text) {
    return {
      success: false,
      questions: [],
      errors: ["Please enter or paste questions text into the editor."]
    };
  }

  // Split into raw lines
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) {
    return {
      success: false,
      questions: [],
      errors: ["No valid text lines found in input."]
    };
  }

  let currentSection: "mcq" | "true_false" | "unknown" = "unknown";
  const blocks: string[][] = [];
  let currentBlock: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();

    // Section header check
    if (
      lower.includes("multiple choice") ||
      lower === "mcqs" ||
      lower === "mcq" ||
      lower.startsWith("multiple choice questions")
    ) {
      currentSection = "mcq";
      if (currentBlock.length > 0) {
        blocks.push(currentBlock);
        currentBlock = [];
      }
      continue;
    }

    if (
      lower === "true or false" ||
      lower === "true/false" ||
      lower === "t/f" ||
      lower === "true or false questions"
    ) {
      currentSection = "true_false";
      if (currentBlock.length > 0) {
        blocks.push(currentBlock);
        currentBlock = [];
      }
      continue;
    }

    // Check if line starts a new question (e.g., "1.", "2)", "Q1.", "1. The Earth...")
    const isNumberedQuestion = /^(?:\d+[\.\)]|Q\d+[\.:\)])\s+/i.test(line);

    if (isNumberedQuestion && currentBlock.length > 0) {
      blocks.push(currentBlock);
      currentBlock = [line];
    } else {
      currentBlock.push(line);
    }
  }

  if (currentBlock.length > 0) {
    blocks.push(currentBlock);
  }

  // Process each block
  blocks.forEach((blockLines, index) => {
    const fullBlockText = blockLines.join("\n");
    const firstLine = blockLines[0];

    // Determine if this block is MCQ or True/False
    const hasMCQOptions = blockLines.some((l) => /^[A-D][\.\)]\s+/i.test(l));
    const isTFPattern =
      !hasMCQOptions &&
      (fullBlockText.includes("True") ||
        fullBlockText.includes("False") ||
        fullBlockText.includes("— True") ||
        fullBlockText.includes("— False") ||
        fullBlockText.includes("✅") ||
        fullBlockText.includes("❌"));

    let isMCQ = hasMCQOptions;
    let isTF = isTFPattern;

    if (!isMCQ && !isTF) {
      if (currentSection === "mcq") isMCQ = true;
      else if (currentSection === "true_false") isTF = true;
    }

    if (isMCQ) {
      // Find where Option A starts
      const firstOptIdx = blockLines.findIndex((l) => /^[A-D][\.\)]\s+/i.test(l));

      if (firstOptIdx < 0) {
        errors.push(
          `Question #${index + 1}: Could not find MCQ options (A, B, C, D) for line:\n"${firstLine.substring(0, 50)}..."`
        );
        return;
      }

      let qText = blockLines
        .slice(0, firstOptIdx)
        .join(" ")
        .replace(/^(?:\d+[\.\)]|Q\d+[\.:\)])\s+/i, "")
        .trim();

      if (!qText) {
        qText = `Question ${index + 1}`;
      }

      const optionLines = blockLines.slice(firstOptIdx);
      const options: string[] = [];
      let correctAnswerLetter = "";

      optionLines.forEach((optLine) => {
        const match = optLine.match(/^([A-D])[\.\)]\s+(.*)$/i);
        if (match) {
          const letter = match[1].toUpperCase();
          let optVal = match[2].trim();

          const hasCheck = optVal.includes("✅");
          optVal = optVal.replace(/[✅❌]/g, "").trim();

          if (hasCheck) {
            correctAnswerLetter = letter;
          }

          options.push(`${letter}. ${optVal}`);
        }
      });

      if (options.length < 2) {
        errors.push(
          `MCQ Question "${qText.substring(0, 40)}...": Must have at least 2 options (found ${options.length}).`
        );
        return;
      }

      if (!correctAnswerLetter) {
        errors.push(
          `MCQ Question "${qText.substring(0, 40)}...": Missing correct answer marker ✅ in options.`
        );
        return;
      }

      questions.push({
        id: `q_mcq_${index + 1}_${Math.random().toString(36).substring(2, 7)}`,
        classGrade: context.classGrade,
        subject: context.subject,
        chapterNo: context.chapterNo,
        chapterName: context.chapterName,
        topicName: context.topicName,
        type: "mcq",
        question: qText,
        options,
        correctAnswer: correctAnswerLetter,
        rawText: fullBlockText
      });
    } else if (isTF) {
      let rawStatement = blockLines
        .join(" ")
        .replace(/^(?:\d+[\.\)]|Q\d+[\.:\)])\s+/i, "")
        .trim();

      let correctAnswer = "";
      const lowerStmt = rawStatement.toLowerCase();

      if (
        rawStatement.includes("True ✅") ||
        rawStatement.includes("— True") ||
        rawStatement.includes("- True") ||
        (rawStatement.includes("True") && rawStatement.includes("✅"))
      ) {
        correctAnswer = "True";
      } else if (
        rawStatement.includes("False ❌") ||
        rawStatement.includes("— False") ||
        rawStatement.includes("- False") ||
        (rawStatement.includes("False") && (rawStatement.includes("❌") || rawStatement.includes("✅")))
      ) {
        correctAnswer = "False";
      } else if (lowerStmt.endsWith("true")) {
        correctAnswer = "True";
      } else if (lowerStmt.endsWith("false")) {
        correctAnswer = "False";
      }

      let cleanQuestion = rawStatement
        .replace(/—\s*(True|False)\s*[✅❌]?/gi, "")
        .replace(/-\s*(True|False)\s*[✅❌]?/gi, "")
        .replace(/\b(True|False)\s*[✅❌]/gi, "")
        .replace(/[✅❌]/g, "")
        .trim();

      if (!cleanQuestion) {
        cleanQuestion = rawStatement.replace(/[✅❌]/g, "").trim();
      }

      if (!correctAnswer) {
        errors.push(
          `True/False Question "${rawStatement.substring(0, 40)}...": Could not detect correct answer (True ✅ or False ❌).`
        );
        return;
      }

      questions.push({
        id: `q_tf_${index + 1}_${Math.random().toString(36).substring(2, 7)}`,
        classGrade: context.classGrade,
        subject: context.subject,
        chapterNo: context.chapterNo,
        chapterName: context.chapterName,
        topicName: context.topicName,
        type: "true_false",
        question: cleanQuestion,
        options: ["True", "False"],
        correctAnswer,
        rawText: fullBlockText
      });
    } else {
      errors.push(
        `Question Block #${index + 1}: Unrecognized format for line:\n"${firstLine.substring(0, 50)}..."`
      );
    }
  });

  return {
    success: errors.length === 0,
    questions,
    errors
  };
}

// ----------------------------------------------------
// LOCAL STORAGE & PERSISTENCE HELPERS
// ----------------------------------------------------

export function getAllPracticeTests(): Record<string, TopicPracticeTest> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(TESTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.error("Failed to read practice tests bank:", err);
    return {};
  }
}

export function getTopicPracticeTest(
  classGrade: string,
  subject: string,
  chapterNo: number,
  topicName: string
): TopicPracticeTest | null {
  const all = getAllPracticeTests();
  const testId = buildTopicTestId(classGrade, subject, chapterNo, topicName);
  return all[testId] || null;
}

export function saveTopicPracticeTest(test: TopicPracticeTest): void {
  const all = getAllPracticeTests();
  all[test.id] = test;
  if (typeof window !== "undefined") {
    localStorage.setItem(TESTS_STORAGE_KEY, JSON.stringify(all));
    window.dispatchEvent(new CustomEvent("practice-tests-updated"));
  }
}

export function deleteTopicPracticeTest(testId: string): void {
  const all = getAllPracticeTests();
  delete all[testId];
  if (typeof window !== "undefined") {
    localStorage.setItem(TESTS_STORAGE_KEY, JSON.stringify(all));
    window.dispatchEvent(new CustomEvent("practice-tests-updated"));
  }
}

/**
 * Dynamically aggregates ALL published questions across all topics of a given Chapter
 */
export function getFullChapterQuestions(
  classGrade: string,
  subject: string,
  chapterNo: number
): ParsedAssessmentQuestion[] {
  const all = getAllPracticeTests();
  const aggregated: ParsedAssessmentQuestion[] = [];

  const normClass = classGrade.toLowerCase().trim();
  const normSubj = subject.toLowerCase().trim();

  Object.values(all).forEach((test) => {
    if (
      test.classGrade.toLowerCase().trim() === normClass &&
      test.subject.toLowerCase().trim() === normSubj &&
      test.chapterNo === chapterNo
    ) {
      if (Array.isArray(test.questions)) {
        aggregated.push(...test.questions);
      }
    }
  });

  return aggregated;
}

// ----------------------------------------------------
// TEST ATTEMPTS HELPERS
// ----------------------------------------------------

export function getAllTestAttempts(): TestAttemptRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ATTEMPTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error("Failed to read test attempts:", err);
    return [];
  }
}

export function saveTestAttempt(attempt: TestAttemptRecord): void {
  const all = getAllTestAttempts();
  all.push(attempt);
  if (typeof window !== "undefined") {
    localStorage.setItem(ATTEMPTS_STORAGE_KEY, JSON.stringify(all));
    window.dispatchEvent(new CustomEvent("test-attempts-updated"));
  }
}

export function getStudentTestAttempts(
  studentId: string,
  classGrade: string,
  subject: string,
  chapterNo: number,
  topicName: string,
  testType: "topic" | "full_chapter"
): TestAttemptRecord[] {
  const all = getAllTestAttempts();
  const normClass = classGrade.toLowerCase().trim();
  const normSubj = subject.toLowerCase().trim();
  const normTopic = topicName.toLowerCase().trim();

  return all.filter((a) => {
    if (a.studentId !== studentId) return false;
    if (a.testType !== testType) return false;
    if (a.classGrade.toLowerCase().trim() !== normClass) return false;
    if (a.subject.toLowerCase().trim() !== normSubj) return false;
    if (a.chapterNo !== chapterNo) return false;
    if (testType === "topic") {
      return a.topicName.toLowerCase().trim() === normTopic;
    }
    return true;
  });
}

export function getStudentNextAttemptNumber(
  studentId: string,
  classGrade: string,
  subject: string,
  chapterNo: number,
  topicName: string,
  testType: "topic" | "full_chapter"
): number {
  const existing = getStudentTestAttempts(
    studentId,
    classGrade,
    subject,
    chapterNo,
    topicName,
    testType
  );
  return existing.length + 1;
}
