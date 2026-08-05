import React, { useState, useEffect } from "react";
import { 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  Sparkles, 
  Eye, 
  Trash2, 
  ListChecks, 
  History, 
  HelpCircle,
  Copy
} from "lucide-react";
import { TopicPracticeTest, TestAttemptRecord } from "../types";
import { 
  parseAssessmentText, 
  getTopicPracticeTest, 
  saveTopicPracticeTest, 
  deleteTopicPracticeTest, 
  buildTopicTestId,
  getAllTestAttempts
} from "../utils/assessmentParser";

interface AdminPracticeTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  classGrade: string;
  subject: string;
  chapterNo: number;
  chapterName: string;
  topicName: string;
  onSaved?: () => void;
}

const SAMPLE_TEST_TEXT = `Multiple Choice Questions (MCQs)
1. The Earth's surface is mainly shaped by:
A. Plants and animals
B. Internal and external forces ✅
C. The Sun only
D. Human activities only

2. Forces that originate inside the Earth are called:
A. External forces
B. Weathering forces
C. Internal (Endogenic) forces ✅
D. Erosional forces

True or False
1. The Earth's surface is always changing. — True ✅
2. Internal forces act on the Earth's surface from outside. — False ❌
3. Earthquakes are caused by internal forces. — True ✅`;

export default function AdminPracticeTestModal({
  isOpen,
  onClose,
  classGrade,
  subject,
  chapterNo,
  chapterName,
  topicName,
  onSaved
}: AdminPracticeTestModalProps) {
  const [activeTab, setActiveTab] = useState<"editor" | "preview" | "attempts">("editor");
  const [rawText, setRawText] = useState("");
  const [validationErrorMsg, setValidationErrorMsg] = useState<string[]>([]);
  const [validationSuccess, setValidationSuccess] = useState<string | null>(null);
  const [savedTest, setSavedTest] = useState<TopicPracticeTest | null>(null);
  const [attemptsList, setAttemptsList] = useState<TestAttemptRecord[]>([]);

  // Load existing saved test or attempts on mount/open
  useEffect(() => {
    if (!isOpen) return;

    const existing = getTopicPracticeTest(classGrade, subject, chapterNo, topicName);
    if (existing) {
      setSavedTest(existing);
      setRawText(existing.rawText || "");
      setValidationSuccess(`Practice Test active: ${existing.questions.length} questions parsed.`);
    } else {
      setSavedTest(null);
      setRawText("");
      setValidationSuccess(null);
    }

    setValidationErrorMsg([]);

    // Load attempts
    const allAttempts = getAllTestAttempts();
    const testAttempts = allAttempts.filter(
      (a) =>
        a.classGrade.toLowerCase() === classGrade.toLowerCase() &&
        a.subject.toLowerCase() === subject.toLowerCase() &&
        a.chapterNo === chapterNo &&
        a.topicName.toLowerCase() === topicName.toLowerCase()
    );
    setAttemptsList(testAttempts);
  }, [isOpen, classGrade, subject, chapterNo, topicName]);

  if (!isOpen) return null;

  const handlePasteSample = () => {
    setRawText(SAMPLE_TEST_TEXT);
    setValidationErrorMsg([]);
    setValidationSuccess(null);
  };

  const handleValidateAndSave = () => {
    setValidationErrorMsg([]);
    setValidationSuccess(null);

    const parseRes = parseAssessmentText(rawText, {
      classGrade,
      subject,
      chapterNo,
      chapterName,
      topicName
    });

    if (!parseRes.success || parseRes.questions.length === 0) {
      setValidationErrorMsg(
        parseRes.errors.length > 0
          ? parseRes.errors
          : ["Failed to parse any valid questions from text."]
      );
      return;
    }

    const testId = buildTopicTestId(classGrade, subject, chapterNo, topicName);
    const newTest: TopicPracticeTest = {
      id: testId,
      classGrade,
      subject,
      chapterNo,
      chapterName,
      topicName,
      rawText,
      questions: parseRes.questions,
      createdAt: savedTest?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      uploadedBy: "Admin"
    };

    saveTopicPracticeTest(newTest);
    setSavedTest(newTest);

    const mcqCount = parseRes.questions.filter((q) => q.type === "mcq").length;
    const tfCount = parseRes.questions.filter((q) => q.type === "true_false").length;

    setValidationSuccess(
      `Successfully saved practice test! Total ${parseRes.questions.length} Questions (${mcqCount} MCQs, ${tfCount} True/False).`
    );

    if (onSaved) onSaved();
  };

  const handleDeleteTest = () => {
    if (!savedTest) return;
    if (confirm("Are you sure you want to delete this topic practice test?")) {
      deleteTopicPracticeTest(savedTest.id);
      setSavedTest(null);
      setRawText("");
      setValidationSuccess(null);
      setValidationErrorMsg([]);
      if (onSaved) onSaved();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 shrink-0">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-200">Smart Assessment Editor</p>
              <h2 className="text-base font-black truncate">
                Practice Test: {topicName}
              </h2>
              <p className="text-xs text-blue-100/90 truncate">
                [{classGrade}] {subject} • Ch {chapterNo}: {chapterName}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer shrink-0"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 px-6 pt-2 shrink-0 gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab("editor")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition cursor-pointer ${
              activeTab === "editor"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Paste & Parse Editor</span>
          </button>

          <button
            onClick={() => setActiveTab("preview")}
            disabled={!savedTest}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              activeTab === "preview"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Eye className="w-4 h-4" />
            <span>Parsed Questions ({savedTest?.questions.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab("attempts")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition cursor-pointer ${
              activeTab === "attempts"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <History className="w-4 h-4" />
            <span>Student Attempts ({attemptsList.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin">
          
          {/* TAB 1: Editor */}
          {activeTab === "editor" && (
            <div className="space-y-4">
              {/* Instructions banner */}
              <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <HelpCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-700 dark:text-slate-300">
                    <p className="font-bold text-slate-900 dark:text-slate-100 mb-0.5">Automatic Question Parsing Format</p>
                    <p>Paste questions text below. Mark correct option with <span className="font-bold text-emerald-600">✅</span> symbol. True/False questions are detected automatically with <span className="font-bold">True ✅</span> or <span className="font-bold">False ❌</span>.</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handlePasteSample}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow-xs transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Paste Sample Format
                </button>
              </div>

              {/* Validation Success Message */}
              {validationSuccess && (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>{validationSuccess}</span>
                </div>
              )}

              {/* Validation Error Message */}
              {validationErrorMsg.length > 0 && (
                <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-300 text-xs space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-rose-900 dark:text-rose-200">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Parsing Validation Issues ({validationErrorMsg.length}):</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 pl-1 font-mono text-[11px] max-h-32 overflow-y-auto">
                    {validationErrorMsg.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Editor Textarea */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Pasted Questions Content:
                  </label>
                  <span className="text-[10px] text-slate-400 font-semibold">
                    {rawText.length} characters
                  </span>
                </div>
                
                <textarea
                  value={rawText}
                  onChange={(e) => {
                    setRawText(e.target.value);
                    setValidationErrorMsg([]);
                    setValidationSuccess(null);
                  }}
                  rows={14}
                  placeholder={`Multiple Choice Questions (MCQs)\n1. What is the formula for area of a circle?\nA. 2πr\nB. πr² ✅\nC. 2πr²\nD. πd\n\nTrue or False\n1. Earth revolves around the Sun. — True ✅\n2. Light travels slower than sound. — False ❌`}
                  className="w-full p-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-y"
                />
              </div>
            </div>
          )}

          {/* TAB 2: Parsed Question Preview */}
          {activeTab === "preview" && savedTest && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                  Total Parsed Questions: <strong className="text-slate-900 dark:text-slate-100">{savedTest.questions.length}</strong>
                </p>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 px-2.5 py-1 rounded-lg">
                  Published & Active
                </span>
              </div>

              <div className="space-y-3">
                {savedTest.questions.map((q, idx) => (
                  <div
                    key={q.id}
                    className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded">
                          Q{idx + 1}
                        </span>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded">
                          {q.type === "mcq" ? "MCQ" : "True / False"}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        Correct: {q.correctAnswer}
                      </span>
                    </div>

                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                      {q.question}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {q.options.map((opt, oIdx) => {
                        const optLetter = opt.charAt(0);
                        const isCorrect = q.type === "mcq" ? optLetter === q.correctAnswer : opt === q.correctAnswer;

                        return (
                          <div
                            key={oIdx}
                            className={`p-2.5 rounded-lg text-xs font-semibold border flex items-center justify-between ${
                              isCorrect
                                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 font-bold"
                                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                            }`}
                          >
                            <span>{opt}</span>
                            {isCorrect && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: Student Attempts */}
          {activeTab === "attempts" && (
            <div className="space-y-4">
              {attemptsList.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                  <ListChecks className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-400">No student attempts recorded yet.</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Student attempts will automatically be recorded here after students submit the practice test.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-xs font-bold text-slate-500">
                    Showing <strong className="text-slate-900 dark:text-slate-100">{attemptsList.length}</strong> total attempt(s)
                  </div>
                  <div className="space-y-2">
                    {attemptsList.map((att) => (
                      <div
                        key={att.id}
                        className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-black text-slate-900 dark:text-slate-100">
                              {att.studentName}
                            </h4>
                            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded">
                              Attempt #{att.attemptNumber}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {att.date} • Time taken: {Math.floor(att.timeTakenSeconds / 60)}m {att.timeTakenSeconds % 60}s
                          </p>
                        </div>

                        <div className="text-right">
                          <span className={`text-sm font-black ${
                            att.percentage >= 80
                              ? "text-emerald-600 dark:text-emerald-400"
                              : att.percentage >= 50
                              ? "text-blue-600 dark:text-blue-400"
                              : "text-amber-600 dark:text-amber-400"
                          }`}>
                            {att.score} / {att.totalQuestions} ({att.percentage}%)
                          </span>
                          <p className="text-[10px] text-slate-400">
                            Correct: {att.correctAnswersCount} | Wrong: {att.wrongAnswersCount}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div>
            {savedTest && (
              <button
                type="button"
                onClick={handleDeleteTest}
                className="px-3 py-2 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition cursor-pointer flex items-center gap-1.5 border border-rose-200/60 dark:border-rose-900/40"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Test</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>

            {activeTab === "editor" && (
              <button
                type="button"
                onClick={handleValidateAndSave}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-98 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-blue-900/30 transition-all cursor-pointer flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>Validate & Save Test</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
