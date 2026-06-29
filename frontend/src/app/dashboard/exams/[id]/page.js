'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

export default function TakeExamPage() {
  const { id: examId } = useParams();
  const { user } = useAuth();
  const router = useRouter();

  const [exam, setExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [attempt, setAttempt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Wizard state
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({}); // { question_id: 'A/B/C/D' }
  const [timeLeft, setTimeLeft] = useState(0); // seconds remaining
  
  // Security log warnings
  const [tabSwitches, setTabSwitches] = useState(0);
  const [showSecurityWarning, setShowSecurityWarning] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [confirmCheckbox, setConfirmCheckbox] = useState(false);

  const timerRef = useRef(null);

  useEffect(() => {
    if (examId) {
      loadExamAttempt();
    }

    // Security Tab tracking
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabSwitches(prev => {
          const updated = prev + 1;
          setShowSecurityWarning(true);
          return updated;
        });
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [examId]);

  // Timer countdown hook
  useEffect(() => {
    if (timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            autoSubmitExam();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timeLeft]);

  async function loadExamAttempt() {
    try {
      setLoading(true);
      // Get exam details
      const examData = await api.get(`/exams/${examId}/`);
      setExam(examData);

      // Start/Retrieve attempt
      const attemptData = await api.post(`/exams/${examId}/start_attempt/`);
      if (attemptData.completed_at) {
        // Already finished
        router.push(`/dashboard/exams/${examId}/results`);
        return;
      }
      setAttempt(attemptData);
      setAnswers(attemptData.answers || {});

      // Load questions (correct options hidden)
      const qData = await api.get(`/exams/${examId}/questions/`);
      setQuestions(qData);

      // Calculate time remaining based on duration and start time
      const startTime = new Date(attemptData.started_at).getTime();
      const endTime = startTime + examData.duration_minutes * 60 * 1000;
      const now = new Date().getTime();
      const remainingSeconds = Math.max(0, Math.floor((endTime - now) / 1000));
      
      if (remainingSeconds <= 0) {
        autoSubmitExam(attemptData.id, attemptData.answers);
      } else {
        setTimeLeft(remainingSeconds);
      }

    } catch (err) {
      setErrorMsg(err.message || 'Failed to load exam paper.');
    } finally {
      setLoading(false);
    }
  }

  const selectOption = (qId, option) => {
    setAnswers(prev => ({
      ...prev,
      [qId]: option
    }));
  };

  const submitExam = () => {
    setShowSubmitModal(true);
    setConfirmCheckbox(false);
  };

  const autoSubmitExam = async (attId = null, currentAnswers = null) => {
    const finalAttId = attId || attempt?.id;
    const finalAnswers = currentAnswers || answers;
    if (!finalAttId) return;

    alert('Time has expired! Submitting answers automatically.');
    performSubmit(finalAttId, finalAnswers);
  };

  const performSubmit = async (attId, answersPayload) => {
    try {
      setLoading(true);
      await api.post(`/attempts/${attId}/submit/`, {
        answers: answersPayload
      });
      router.push(`/dashboard/exams/${examId}/results`);
    } catch (err) {
      setErrorMsg('Failed to submit exam paper. Please contact lecturer.');
      setLoading(false);
    }
  };

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="w-10 h-10 border-4 border-brand-light/20 border-t-brand-light rounded-full animate-spin"></div>
        <p className="text-slate-500 font-semibold text-sm">Validating exam attempt and loading questions...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 text-red-700 text-sm font-semibold rounded-xl">
        {errorMsg}
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="p-6 bg-white rounded-xl border border-slate-100 text-center text-slate-500 text-sm font-medium">
        This exam paper has no questions yet. Please inform the lecturer.
      </div>
    );
  }

  const currentQ = questions[currentIdx];
  const isLast = currentIdx === questions.length - 1;

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in relative">
      
      {/* Security Warning Modal banner */}
      {showSecurityWarning && (
        <div className="p-4 bg-red-100 border-l-4 border-red-600 rounded-xl text-red-800 text-xs font-semibold flex items-center justify-between animate-pulse">
          <div className="flex items-center space-x-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-red-700 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>SECURITY WARNING: Tab switching or page blur detected! Tab changes recorded: <strong className="text-sm">{tabSwitches}</strong>. Switching tabs may result in automatic disqualification.</span>
          </div>
          <button onClick={() => setShowSecurityWarning(false)} className="text-red-700 hover:text-red-950 font-bold px-2 py-1 hover:bg-red-200 rounded">
            Acknowledge
          </button>
        </div>
      )}

      {/* Top Banner: Timer and title */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold bg-brand-light/10 text-brand-light border border-brand-light/10 px-2 py-0.5 rounded uppercase">
            Active Exam Assessment
          </span>
          <h2 className="text-lg font-bold text-slate-800 mt-1">{exam.title} ({exam.course_code})</h2>
          <p className="text-xs text-slate-500 font-medium">Logged Student: <span className="font-semibold text-slate-700">{user.username}</span></p>
        </div>

        {/* Timer Box */}
        <div className="flex items-center space-x-3 bg-brand-dark text-white px-5 py-3 rounded-xl shadow-md border border-white/5 self-start md:self-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-brand-emerald animate-pulse-slow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <span className="text-[9px] text-white/50 block font-bold uppercase tracking-wider">Time Remaining</span>
            <span className="font-mono text-lg font-extrabold tracking-wider">{formatTime(timeLeft)}</span>
          </div>
        </div>
      </div>

      {/* Main wizard grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Left Side: Active Question Panel */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 min-h-[300px] flex flex-col justify-between">
            
            {/* Question Text */}
            <div className="space-y-4">
              <div className="flex justify-between items-center text-xs text-slate-400 font-semibold border-b border-slate-100 pb-3">
                <span>Question {currentIdx + 1} of {questions.length}</span>
                <span>Value: 1 Mark</span>
              </div>
              <h3 className="text-base font-bold text-slate-800 leading-relaxed">
                {currentQ.question_text}
              </h3>

              {/* Options */}
              <div className="space-y-3 pt-2">
                {[
                  { label: 'A', text: currentQ.option_a },
                  { label: 'B', text: currentQ.option_b },
                  { label: 'C', text: currentQ.option_c },
                  { label: 'D', text: currentQ.option_d },
                ].map((opt) => {
                  const isSelected = answers[currentQ.id] === opt.label;
                  return (
                    <button
                      key={opt.label}
                      onClick={() => selectOption(currentQ.id, opt.label)}
                      className={`w-full text-left px-5 py-3.5 rounded-xl border text-xs font-semibold transition-all flex items-center space-x-3 active:scale-[0.99] ${isSelected ? 'bg-brand-light/5 border-brand-light text-brand-dark shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'}`}
                    >
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs border ${isSelected ? 'bg-brand-light text-white border-brand-light' : 'bg-white border-slate-300 text-slate-500'}`}>
                        {opt.label}
                      </span>
                      <span>{opt.text}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-6 mt-6">
              <button
                onClick={() => setCurrentIdx(prev => Math.max(0, prev - 1))}
                disabled={currentIdx === 0}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-650 text-xs font-semibold rounded-lg transition-all disabled:opacity-30 disabled:pointer-events-none"
              >
                Previous
              </button>

              {isLast ? (
                <button
                  onClick={submitExam}
                  className="px-5 py-2 bg-brand-emerald text-brand-dark font-extrabold text-xs rounded-lg shadow hover:bg-brand-emerald/90 transition-all"
                >
                  Submit Assessment
                </button>
              ) : (
                <button
                  onClick={() => setCurrentIdx(prev => Math.min(questions.length - 1, prev + 1))}
                  className="px-5 py-2 bg-brand-light hover:bg-brand-medium text-white text-xs font-semibold rounded-lg shadow transition-all"
                >
                  Next Question
                </button>
              )}
            </div>

          </div>
        </div>

        {/* Right Side: Questions Navigator Map */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Assessment Map</h3>
            
            {/* Answered indicator block */}
            <div className="grid grid-cols-2 gap-2 text-[10px] border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-1.5 font-medium text-slate-500">
                <span className="w-2.5 h-2.5 bg-brand-light rounded-full"></span>
                <span>Answered</span>
              </div>
              <div className="flex items-center space-x-1.5 font-medium text-slate-500">
                <span className="w-2.5 h-2.5 bg-slate-200 rounded-full"></span>
                <span>Unanswered</span>
              </div>
            </div>

            {/* Jump circles */}
            <div className="grid grid-cols-4 gap-2">
              {questions.map((q, idx) => {
                const isCurrent = idx === currentIdx;
                const isAnswered = !!answers[q.id];
                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIdx(idx)}
                    className={`h-9 w-9 rounded-xl flex items-center justify-center font-bold text-xs transition-all border ${isCurrent ? 'ring-2 ring-brand-light border-brand-light' : ''} ${isAnswered ? 'bg-brand-light text-white border-brand-light' : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            {/* Quick stats details */}
            <div className="pt-2 border-t border-slate-100 flex justify-between text-[11px] font-medium text-slate-500">
              <span>Answered: <strong className="text-slate-700">{Object.keys(answers).length}</strong></span>
              <span>Remaining: <strong className="text-slate-700">{questions.length - Object.keys(answers).length}</strong></span>
            </div>

            <button
              onClick={submitExam}
              className="w-full py-2.5 bg-red-650 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow transition-all active:scale-[0.98]"
            >
              Force Submit
            </button>
          </div>
        </div>

      </div>

      {/* Submit Confirmation Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-slate-100 space-y-6 relative animate-scale-up">
            <button
              onClick={() => setShowSubmitModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-650 rounded-lg"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="text-center space-y-2">
              <div className="mx-auto flex items-center justify-center w-12 h-12 rounded-full bg-brand-light/10 text-brand-light">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-800">Confirm Submission</h3>
              <p className="text-xs text-slate-500 font-medium">Please review your answer coverage before submitting for autograding.</p>
            </div>

            {/* Answer coverage breakdown */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-150 space-y-2.5 text-xs font-semibold text-slate-600">
              <div className="flex justify-between">
                <span>Total Assessment Questions:</span>
                <span className="text-slate-800 font-bold">{questions.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Answered:</span>
                <span className="text-brand-medium font-bold">{Object.keys(answers).length}</span>
              </div>
              <div className="flex justify-between">
                <span>Unanswered / Skipped:</span>
                <span className={questions.length - Object.keys(answers).length > 0 ? 'text-red-650 font-bold' : 'text-slate-850 font-bold'}>
                  {questions.length - Object.keys(answers).length}
                </span>
              </div>

              {questions.length - Object.keys(answers).length > 0 && (
                <div className="mt-3 p-3 bg-red-50 border-l-4 border-red-500 rounded text-red-700 text-[11px] font-semibold leading-relaxed">
                  ⚠️ Caution: You have left {questions.length - Object.keys(answers).length} question(s) unanswered. Submit anyway?
                </div>
              )}
            </div>

            {/* Confirmation checkbox */}
            <label className="flex items-start space-x-2.5 text-slate-650 cursor-pointer select-none text-[11px] font-semibold leading-relaxed">
              <input
                type="checkbox"
                checked={confirmCheckbox}
                onChange={(e) => setConfirmCheckbox(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-brand-light focus:ring-brand-light"
              />
              <span>I confirm that I have verified my answers and wish to finalize and submit my exam. I understand this action cannot be undone.</span>
            </label>

            <div className="flex space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
              >
                Back to Exam
              </button>
              <button
                type="button"
                disabled={!confirmCheckbox}
                onClick={() => {
                  setShowSubmitModal(false);
                  performSubmit(attempt.id, answers);
                }}
                className="flex-1 py-2.5 bg-brand-emerald disabled:opacity-50 disabled:pointer-events-none text-brand-dark text-xs font-extrabold rounded-xl transition-all shadow hover:bg-brand-emerald/90"
              >
                Confirm & Submit
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
