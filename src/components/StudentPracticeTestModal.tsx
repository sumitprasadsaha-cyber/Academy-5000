import React, { useState, useEffect, useRef } from "react";
import { 
  X, 
  CheckCircle2, 
  XCircle, 
  Award, 
  Clock, 
  RotateCcw, 
  ChevronRight, 
  ChevronLeft, 
  Send,
  HelpCircle,
  Trophy,
  Sparkles,
  BookOpen,
  FileCheck
} from "lucide-react";
import { ParsedAssessmentQuestion, TestAttemptRecord } from "../types";
import { 
  getTopicPracticeTest, 
  getFullChapterQuestions, 
  saveTestAttempt, 
  getStudentNextAttemptNumber,
  getStudentTestAttempts
} from "../utils/assessmentParser";

interface StudentPracticeTestModalProps {
  isOpen?: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
  classGrade: string;
  subject: string;
  chapterNo: number;
  chapterName: string;
  topicName: string; // Specific topic name OR "Full Chapter Test"
  testType: "topic" | "full_chapter";
}

export default function StudentPracticeTestModal({
  isOpen,
  onClose,
  studentId,
  studentName,
  classGrade,
  subject,
  chapterNo,
  chapterName,
  topicName,
  testType
}: StudentPracticeTestModalProps) {
  // Test State
  const [questions, setQuestions] = useState<ParsedAssessmentQuestion[]>([]);
  const [testStage, setTestStage] = useState<"intro" | "active" | "result">("intro");
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  
  // Timer State
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Result & Attempt record state
  const [lastAttemptRecord, setLastAttemptRecord] = useState<TestAttemptRecord | null>(null);
  const [attemptCount, setAttemptCount] = useState(1);

  // Load questions when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let qList: ParsedAssessmentQuestion[] = [];
    if (testType === "topic") {
      const topicTest = getTopicPracticeTest(classGrade, subject, chapterNo, topicName);
      if (topicTest && topicTest.questions) {
        qList = topicTest.questions;
      }
    } else {
      // Full Chapter Test
      qList = getFullChapterQuestions(classGrade, subject, chapterNo);
    }

    setQuestions(qList);
    setTestStage("intro");
    setCurrentQuestionIdx(0);
    setUserAnswers({});
    setElapsedSeconds(0);
    setLastAttemptRecord(null);

    // Calculate next attempt number
    const nextNum = getStudentNextAttemptNumber(
      studentId,
      classGrade,
      subject,
      chapterNo,
      topicName,
      testType
    );
    setAttemptCount(nextNum);
  }, [isOpen, studentId, classGrade, subject, chapterNo, topicName, testType]);

  // Timer loop
  useEffect(() => {
    if (testStage === "active") {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [testStage]);

  if (!isOpen) return null;

  const handleStartTest = () => {
    if (questions.length === 0) return;
    setTestStage("active");
    setCurrentQuestionIdx(0);
    setUserAnswers({});
    setElapsedSeconds(0);
  };

  const handleSelectAnswer = (questionId: string, answerKey: string) => {
    setUserAnswers((prev) => ({
      ...prev,
      [questionId]: answerKey
    }));
  };

  const handleSubmitTest = () => {
    if (timerRef.current) clearInterval(timerRef.current);

    let correctCount = 0;
    let wrongCount = 0;

    questions.forEach((q) => {
      const studentAns = userAnswers[q.id];
      if (!studentAns) {
        wrongCount++;
        return;
      }

      if (q.type === "mcq") {
        // q.correctAnswer is e.g. "B" or "1. B"
        // studentAns is option letter e.g. "B" or full string
        if (studentAns.toLowerCase().startsWith(q.correctAnswer.toLowerCase())) {
          correctCount++;
        } else {
          wrongCount++;
        }
      } else {
        // True / False
        if (studentAns.toLowerCase().trim() === q.correctAnswer.toLowerCase().trim()) {
          correctCount++;
        } else {
          wrongCount++;
        }
      }
    });

    const totalQuestions = questions.length;
    const score = correctCount;
    const percentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

    const formattedDate = new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });

    const attemptRecord: TestAttemptRecord = {
      id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      studentId,
      studentName,
      classGrade,
      subject,
      chapterNo,
      chapterName,
      topicName: testType === "full_chapter" ? "🏆 Full Chapter Test" : topicName,
      testType,
      attemptNumber: attemptCount,
      date: formattedDate,
      timestamp: Date.now(),
      timeTakenSeconds: elapsedSeconds,
      score,
      totalQuestions,
      percentage,
      correctAnswersCount: correctCount,
      wrongAnswersCount: wrongCount,
      userAnswers
    };

    saveTestAttempt(attemptRecord);
    setLastAttemptRecord(attemptRecord);
    setTestStage("result");
  };

  const formatTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const currentQuestion = questions[currentQuestionIdx];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-700 via-blue-700 to-sky-700 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 shrink-0">
              {testType === "full_chapter" ? (
                <Trophy className="w-5 h-5 text-amber-300" />
              ) : (
                <BookOpen className="w-5 h-5 text-sky-200" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-200">
                {testType === "full_chapter" ? "Full Chapter Test" : "Topic Practice Test"}
              </p>
              <h2 className="text-base font-black truncate">
                {testType === "full_chapter" ? `🏆 Chapter ${chapterNo}: ${chapterName}` : topicName}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {testStage === "active" && (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-white/10 backdrop-blur-md rounded-xl text-xs font-mono font-bold border border-white/20">
                <Clock className="w-3.5 h-3.5 text-amber-300" />
                <span>{formatTime(elapsedSeconds)}</span>
              </div>
            )}
            <button
              onClick={onClose}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer shrink-0"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          
          {/* INTRO STAGE */}
          {testStage === "intro" && (
            <div className="text-center py-6 space-y-6 max-w-lg mx-auto">
              <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 rounded-full w-20 h-20 mx-auto flex items-center justify-center border border-indigo-200 dark:border-indigo-800 shadow-sm">
                {testType === "full_chapter" ? (
                  <Trophy className="w-10 h-10 text-amber-500" />
                ) : (
                  <FileCheck className="w-10 h-10 text-indigo-600 dark:text-indigo-400" />
                )}
              </div>

              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
                  Ready to test your knowledge?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  [{classGrade}] {subject} • Ch {chapterNo}: {chapterName}
                </p>
              </div>

              {questions.length === 0 ? (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-800 dark:text-amber-300 text-xs font-semibold">
                  No practice questions have been uploaded by the tutor for this test yet.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Questions</p>
                      <p className="text-lg font-black text-slate-900 dark:text-slate-100">{questions.length}</p>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Attempt</p>
                      <p className="text-lg font-black text-blue-600 dark:text-blue-400">#{attemptCount}</p>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col justify-center">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Attempts</p>
                      <p className="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400 truncate mt-0.5">Unlimited</p>
                    </div>
                  </div>

                  <button
                    onClick={handleStartTest}
                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 active:scale-98 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-blue-900/30 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>Start Test Now</span>
                    <ChevronRight className="w-4 h-4 stroke-[3]" />
                  </button>
                </>
              )}
            </div>
          )}

          {/* ACTIVE TEST STAGE */}
          {testStage === "active" && currentQuestion && (
            <div className="space-y-6">
              
              {/* Question Navigation Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2.5 py-1 rounded-lg">
                    Question {currentQuestionIdx + 1} of {questions.length}
                  </span>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                    {currentQuestion.type === "mcq" ? "MCQ" : "True or False"}
                  </span>
                </div>

                <div className="text-xs font-bold text-slate-400">
                  {Object.keys(userAnswers).length} / {questions.length} Answered
                </div>
              </div>

              {/* Question Statement */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-relaxed">
                  {currentQuestion.question}
                </h3>
              </div>

              {/* Options Section */}
              <div className="space-y-2.5">
                {(() => {
                  const studentAns = userAnswers[currentQuestion.id];
                  const hasAnswered = studentAns !== undefined && studentAns !== null;

                  const isOptionCorrect = (optValue: string) => {
                    const corrNorm = currentQuestion.correctAnswer.trim().toLowerCase();
                    const optNorm = optValue.trim().toLowerCase();
                    const optChar = optNorm.charAt(0);
                    const corrChar = corrNorm.charAt(0);
                    return optChar === corrChar || optNorm.startsWith(corrNorm) || corrNorm.startsWith(optNorm);
                  };

                  const isStudentCorrect = hasAnswered && isOptionCorrect(studentAns);

                  return (
                    <>
                      {currentQuestion.type === "mcq" ? (
                        currentQuestion.options.map((opt, oIdx) => {
                          const letter = opt.charAt(0);
                          const isThisSelected = studentAns === letter;
                          const isThisCorrect = isOptionCorrect(letter);

                          let btnStyle = "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800";
                          let badge = null;

                          if (hasAnswered) {
                            if (isThisSelected) {
                              if (isThisCorrect) {
                                btnStyle = "bg-emerald-50 dark:bg-emerald-950/70 border-emerald-500 text-emerald-900 dark:text-emerald-200 font-bold ring-2 ring-emerald-500/30";
                                badge = (
                                  <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1 shrink-0">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                    <span>Correct!</span>
                                  </span>
                                );
                              } else {
                                btnStyle = "bg-rose-50 dark:bg-rose-950/70 border-rose-500 text-rose-900 dark:text-rose-200 font-bold ring-2 ring-rose-500/30";
                                badge = (
                                  <span className="text-xs font-black text-rose-600 dark:text-rose-400 flex items-center gap-1 shrink-0">
                                    <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                                    <span>Your Answer (Incorrect)</span>
                                  </span>
                                );
                              }
                            } else if (isThisCorrect) {
                              btnStyle = "bg-emerald-50/90 dark:bg-emerald-950/60 border-emerald-500 text-emerald-900 dark:text-emerald-200 font-bold ring-2 ring-emerald-500/30 animate-pulse";
                              badge = (
                                <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1 shrink-0">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                  <span>Correct Answer</span>
                                </span>
                              );
                            } else {
                              btnStyle = "opacity-40 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400";
                            }
                          }

                          return (
                            <button
                              key={oIdx}
                              onClick={() => handleSelectAnswer(currentQuestion.id, letter)}
                              className={`w-full p-4 rounded-xl text-left text-xs font-bold transition-all border flex items-center justify-between cursor-pointer ${btnStyle}`}
                            >
                              <span>{opt}</span>
                              {badge ? (
                                badge
                              ) : (
                                <div className="w-5 h-5 rounded-full border border-slate-300 dark:border-slate-600 flex items-center justify-center shrink-0" />
                              )}
                            </button>
                          );
                        })
                      ) : (
                        <div className="grid grid-cols-2 gap-3 pt-2">
                          {["True", "False"].map((tfVal) => {
                            const isThisSelected = studentAns === tfVal;
                            const isThisCorrect = isOptionCorrect(tfVal);

                            let btnStyle = "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800";
                            let icon = null;

                            if (hasAnswered) {
                              if (isThisSelected) {
                                if (isThisCorrect) {
                                  btnStyle = "bg-emerald-600 text-white border-emerald-600 shadow-md font-extrabold scale-102";
                                  icon = <CheckCircle2 className="w-4 h-4 text-white shrink-0" />;
                                } else {
                                  btnStyle = "bg-rose-600 text-white border-rose-600 shadow-md font-extrabold scale-102";
                                  icon = <XCircle className="w-4 h-4 text-white shrink-0" />;
                                }
                              } else if (isThisCorrect) {
                                btnStyle = "bg-emerald-100 dark:bg-emerald-950/80 border-emerald-500 text-emerald-800 dark:text-emerald-200 font-extrabold ring-2 ring-emerald-500/40 animate-pulse";
                                icon = <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />;
                              } else {
                                btnStyle = "opacity-40 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400";
                              }
                            }

                            return (
                              <button
                                key={tfVal}
                                onClick={() => handleSelectAnswer(currentQuestion.id, tfVal)}
                                className={`p-5 rounded-xl font-black text-sm transition-all border flex items-center justify-center gap-2 cursor-pointer ${btnStyle}`}
                              >
                                <span>{tfVal}</span>
                                {icon}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Instant Answer Feedback Callout Banner */}
                      {hasAnswered && (
                        <div className={`p-3.5 rounded-xl border flex items-center gap-3 font-bold text-xs mt-3 ${
                          isStudentCorrect
                            ? "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
                            : "bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200"
                        }`}>
                          {isStudentCorrect ? (
                            <>
                              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              <div>
                                <p className="font-extrabold text-sm text-emerald-700 dark:text-emerald-300">Correct!</p>
                                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Great job! You selected the right answer.</p>
                              </div>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
                              <div>
                                <p className="font-extrabold text-sm text-rose-700 dark:text-rose-300">Incorrect</p>
                                <p className="text-xs text-rose-700 dark:text-rose-300 font-medium">
                                  Correct Answer: <span className="font-black underline">{currentQuestion.correctAnswer}</span>
                                </p>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Bottom Navigation Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  disabled={currentQuestionIdx === 0}
                  onClick={() => setCurrentQuestionIdx((prev) => prev - 1)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>

                {currentQuestionIdx < questions.length - 1 ? (
                  <button
                    onClick={() => setCurrentQuestionIdx((prev) => prev + 1)}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Next Question</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={handleSubmitTest}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-900/30 transition-all cursor-pointer flex items-center gap-2 animate-bounce"
                  >
                    <Send className="w-4 h-4" />
                    <span>Submit Test</span>
                  </button>
                )}
              </div>

            </div>
          )}

          {/* RESULT STAGE */}
          {testStage === "result" && lastAttemptRecord && (
            <div className="space-y-6">
              
              {/* Score Header Card */}
              <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-950 text-white text-center shadow-xl border border-indigo-800/40 relative overflow-hidden">
                <div className="p-3 bg-amber-500/20 rounded-full w-14 h-14 mx-auto mb-3 flex items-center justify-center border border-amber-400/30">
                  <Award className="w-8 h-8 text-amber-300" />
                </div>

                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-300">Topic Result</p>

                {/* Score & Percentage Display */}
                <div className="my-2">
                  <div className="text-4xl font-black tracking-tight text-white">
                    Score: {lastAttemptRecord.score} / {lastAttemptRecord.totalQuestions}
                  </div>
                  <div className="text-2xl font-black text-amber-300 mt-1">
                    {lastAttemptRecord.percentage}%
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 mt-4 text-xs font-bold text-slate-300 border-t border-white/10 pt-4">
                  <div className="px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-lg border border-emerald-500/30">
                    Correct : {lastAttemptRecord.correctAnswersCount}
                  </div>
                  <div className="px-3 py-1 bg-rose-500/20 text-rose-300 rounded-lg border border-rose-500/30">
                    Wrong : {lastAttemptRecord.wrongAnswersCount}
                  </div>
                  <div className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-lg border border-blue-500/30">
                    Attempt Number : {lastAttemptRecord.attemptNumber}
                  </div>
                </div>
              </div>

              {/* Question-by-Question Review */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Detailed Answer Review
                </h4>

                <div className="space-y-3">
                  {questions.map((q, idx) => {
                    const userAns = userAnswers[q.id];
                    let isCorrect = false;

                    if (userAns) {
                      if (q.type === "mcq") {
                        isCorrect = userAns.toLowerCase().startsWith(q.correctAnswer.toLowerCase());
                      } else {
                        isCorrect = userAns.toLowerCase().trim() === q.correctAnswer.toLowerCase().trim();
                      }
                    }

                    return (
                      <div
                        key={q.id}
                        className={`p-4 rounded-xl border space-y-2 ${
                          isCorrect
                            ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60"
                            : "bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/60"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-slate-700 dark:text-slate-300">
                            Q{idx + 1}. {q.question}
                          </span>
                          {isCorrect ? (
                            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                              <CheckCircle2 className="w-4 h-4" /> Correct
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-rose-600 flex items-center gap-1">
                              <XCircle className="w-4 h-4" /> Wrong
                            </span>
                          )}
                        </div>

                        <div className="text-xs space-y-1 pt-1 font-semibold">
                          <p className="text-slate-600 dark:text-slate-400">
                            Your Choice: <strong className={isCorrect ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}>{userAns || "No answer submitted"}</strong>
                          </p>
                          <p className="text-emerald-700 dark:text-emerald-300">
                            Correct Answer: <strong>{q.correctAnswer}</strong>
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  onClick={handleStartTest}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Re-attempt Test</span>
                </button>

                <button
                  onClick={onClose}
                  className="px-5 py-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Close & Return
                </button>
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
}
