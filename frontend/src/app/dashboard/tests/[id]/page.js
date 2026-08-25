'use client';

import { useState, useEffect, useRef, use } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function TestRunnerPage({ params }) {
  const unwrappedParams = use(params);
  const testId = unwrappedParams.id;
  const { user } = useAuth();
  const router = useRouter();

  const [testObj, setTestObj] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [activeAttempt, setActiveAttempt] = useState(null);
  const [proctoringSetting, setProctoringSetting] = useState({ is_proctoring_enabled: true });
  const [loading, setLoading] = useState(true);

  // Runner state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [flagged, setFlagged] = useState({});
  const [tabSwitches, setTabSwitches] = useState(0);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(0);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [securityNotice, setSecurityNotice] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const autoSubmittedRef = useRef(false);

  useEffect(() => {
    initTestRunner();
  }, [testId]);

  async function initTestRunner() {
    try {
      setLoading(true);
      const [testData, qData, attemptData, procData] = await Promise.all([
        api.get(`/tests/${testId}/`),
        api.get(`/tests/${testId}/questions/`),
        api.post(`/tests/${testId}/start_attempt/`),
        api.get('/proctoring-settings/').catch(() => ({ is_proctoring_enabled: true }))
      ]);

      setTestObj(testData);
      setQuestions(qData || []);
      setActiveAttempt(attemptData);
      setProctoringSetting(procData || { is_proctoring_enabled: true });

      // Load saved local draft if present
      const draftKey = `ciu_test_draft_${testId}_${user.id}`;
      const savedDraft = localStorage.getItem(draftKey);
      if (savedDraft) {
        try {
          const parsed = JSON.parse(savedDraft);
          setAnswers(parsed.answers || {});
          setFlagged(parsed.flagged || {});
        } catch (e) {}
      }

      // Calculate initial timer value (in seconds)
      const durationSecs = (testData.duration_minutes || 30) * 60;
      const startedAt = new Date(attemptData.started_at).getTime();
      const elapsedSecs = Math.floor((Date.now() - startedAt) / 1000);
      const remainingSecs = Math.max(0, durationSecs - elapsedSecs);

      setTimeLeftSeconds(remainingSecs);
    } catch (err) {
      setSecurityNotice(err.message || 'Unable to launch test session.');
    } finally {
      setLoading(false);
    }
  }

  // 1. Timer Countdown Effect
  useEffect(() => {
    if (loading || !activeAttempt || timeLeftSeconds <= 0) return;

    const timerInterval = setInterval(() => {
      setTimeLeftSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timerInterval);
          handleAutoSubmit('Countdown Timer Expired');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [loading, activeAttempt, timeLeftSeconds]);

  // 2. Security Tab Switch & Focus Blur Monitoring
  useEffect(() => {
    if (loading || !activeAttempt) return;

    const handleVisibilityChange = () => {
      if (document.hidden && !autoSubmittedRef.current) {
        setTabSwitches((prevCount) => {
          const newCount = prevCount + 1;
          if (newCount >= 3) {
            handleAutoSubmit('Security Lockdown: Exceeded maximum allowed tab switches (3/3).');
          } else {
            setSecurityNotice(`⚠️ Security Warning (${newCount}/3): Leaving the test window is prohibited and tracked.`);
          }
          return newCount;
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [loading, activeAttempt]);

  // 3. LocalStorage Auto-Sync Backup
  useEffect(() => {
    if (!testId || !user) return;
    const draftKey = `ciu_test_draft_${testId}_${user.id}`;
    localStorage.setItem(draftKey, JSON.stringify({ answers, flagged }));
  }, [answers, flagged, testId, user]);

  const handleSelectAnswer = (qId, optionVal) => {
    setAnswers((prev) => ({
      ...prev,
      [qId]: optionVal
    }));
  };

  const toggleFlagQuestion = (qId) => {
    setFlagged((prev) => ({
      ...prev,
      [qId]: !prev[qId]
    }));
  };

  const handleManualSubmit = async () => {
    setShowConfirmModal(false);
    await handleAutoSubmit('Student Submitted');
  };

  const handleAutoSubmit = async (reason) => {
    if (autoSubmittedRef.current) return;
    autoSubmittedRef.current = true;
    setSubmitting(true);

    try {
      await api.post(`/test-attempts/${activeAttempt.id}/submit/`, {
        answers,
        tab_switches: tabSwitches,
        auto_submitted_reason: reason
      });

      // Clear local draft backup
      const draftKey = `ciu_test_draft_${testId}_${user.id}`;
      localStorage.removeItem(draftKey);

      router.push(`/dashboard/tests/${testId}/results?attemptId=${activeAttempt.id}`);
    } catch (err) {
      setSecurityNotice(err.message || 'Auto-submit failed. Retrying...');
      autoSubmittedRef.current = false;
      setSubmitting(false);
    }
  };

  const formatTime = (totalSecs) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <div className="w-10 h-10 border-4 border-brand-light/20 border-t-brand-light rounded-full animate-spin"></div>
        <p className="text-xs text-slate-500 font-semibold">Initiating Security Lockdown & Test Workspace...</p>
      </div>
    );
  }

  if (securityNotice && !activeAttempt) {
    return (
      <div className="max-w-lg mx-auto py-20 animate-fade-in">
        <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-2xl shadow-sm space-y-4 text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto text-red-600 font-extrabold text-lg">
            🔒
          </div>
          <h3 className="font-bold text-red-900 text-lg">Assessment Security Lockout</h3>
          <p className="text-xs text-red-700 font-medium leading-relaxed">{securityNotice}</p>
          <button
            onClick={() => router.push('/dashboard/tests')}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-all"
          >
            Return to Test Portal
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const totalQuestions = questions.count || questions.length;
  const progressPercent = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
      
      {/* Live Proctoring Banner */}
      {proctoringSetting.is_proctoring_enabled && (
        <div className="bg-red-950 text-white p-3 rounded-2xl border border-red-800 shadow-md flex items-center justify-between text-xs animate-pulse">
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-red-500 animate-ping"></span>
            <span className="font-bold">🔴 LIVE AI & WEBCAM PROCTORING ACTIVE</span>
            <span className="hidden md:inline text-red-300">| Camera stream and tab focus are being monitored by the System Admin</span>
          </div>
          <span className="bg-red-900 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border border-red-700">
            Anti-Cheat ON
          </span>
        </div>
      )}

      {/* Sticky Security Header Bar */}
      <div className="sticky top-0 z-30 bg-white border border-slate-200 p-4 rounded-2xl shadow-md flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-bold text-slate-850 text-base">{testObj?.title}</h2>
          <p className="text-xs text-slate-500 font-medium">Course: {testObj?.course_code} · Question {currentIndex + 1} of {totalQuestions}</p>
        </div>

        {/* Security Alerts & Timer */}
        <div className="flex items-center space-x-4">
          <div className="px-3 py-1.5 bg-red-50 text-red-700 border border-red-100 rounded-xl flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
            <span className="font-mono font-bold text-sm">{formatTime(timeLeftSeconds)}</span>
          </div>

          <div className="text-right hidden sm:block">
            <span className="text-[10px] text-slate-400 font-bold block uppercase">Tab Switches</span>
            <span className={`text-xs font-extrabold ${tabSwitches > 0 ? 'text-red-600' : 'text-slate-700'}`}>
              {tabSwitches} / 3 Max
            </span>
          </div>

          <button
            onClick={() => setShowConfirmModal(true)}
            disabled={submitting}
            className="px-4 py-2 bg-brand-light hover:bg-brand-medium text-white text-xs font-bold rounded-xl shadow-sm transition-all"
          >
            {submitting ? 'Submitting...' : 'Finish & Submit Test'}
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
        <div className="bg-brand-emerald h-1.5 transition-all duration-300" style={{ width: `${progressPercent}%` }}></div>
      </div>

      {/* Security Toast Notice */}
      {securityNotice && (
        <div className="p-3 bg-amber-50 border-l-4 border-amber-500 rounded text-amber-900 text-xs font-bold flex items-center justify-between">
          <span>{securityNotice}</span>
          <button onClick={() => setSecurityNotice('')} className="text-amber-700 font-bold text-xs ml-2">Dismiss</button>
        </div>
      )}

      {/* Main Runner Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left/Center: Active Question View */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6 min-h-[420px] flex flex-col justify-between">
          
          {currentQuestion ? (
            <div className="space-y-6">
              
              {/* Question Header & Flag Toggle */}
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-extrabold text-brand-light uppercase tracking-wider bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                    Question #{currentIndex + 1} ({currentQuestion.points} Point{currentQuestion.points > 1 ? 's' : ''})
                  </span>
                  <h3 className="font-bold text-slate-850 text-base leading-snug">{currentQuestion.question_text}</h3>
                </div>

                <button
                  onClick={() => toggleFlagQuestion(currentQuestion.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center space-x-1 shrink-0 ${flagged[currentQuestion.id] ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}
                >
                  <span>{flagged[currentQuestion.id] ? '🚩 Flagged' : '🏳️ Flag for Review'}</span>
                </button>
              </div>

              {/* MCQ Options */}
              {currentQuestion.question_type === 'mcq' && (
                <div className="space-y-3">
                  {[
                    { key: 'A', val: currentQuestion.option_a },
                    { key: 'B', val: currentQuestion.option_b },
                    { key: 'C', val: currentQuestion.option_c },
                    { key: 'D', val: currentQuestion.option_d }
                  ].map((opt) => {
                    const isSelected = answers[currentQuestion.id] === opt.key;
                    return (
                      <button
                        key={opt.key}
                        onClick={() => handleSelectAnswer(currentQuestion.id, opt.key)}
                        className={`w-full p-4 rounded-xl border text-left text-xs font-medium transition-all flex items-center space-x-3 ${isSelected ? 'bg-emerald-50 border-brand-emerald text-brand-dark shadow-sm ring-1 ring-brand-emerald' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'}`}
                      >
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${isSelected ? 'bg-brand-light text-white' : 'bg-slate-200 text-slate-600'}`}>
                          {opt.key}
                        </span>
                        <span className="flex-1 font-semibold">{opt.val}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* True / False Options */}
              {currentQuestion.question_type === 'tf' && (
                <div className="grid grid-cols-2 gap-4 pt-4">
                  {['True', 'False'].map((tfVal) => {
                    const isSelected = answers[currentQuestion.id] === tfVal;
                    return (
                      <button
                        key={tfVal}
                        onClick={() => handleSelectAnswer(currentQuestion.id, tfVal)}
                        className={`p-6 rounded-2xl border text-center font-bold text-sm transition-all ${isSelected ? 'bg-emerald-50 border-brand-emerald text-brand-dark ring-2 ring-brand-emerald shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'}`}
                      >
                        {tfVal}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Short Answer Input */}
              {currentQuestion.question_type === 'short' && (
                <div className="pt-2 space-y-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase">Type your answer below:</label>
                  <input
                    type="text"
                    value={answers[currentQuestion.id] || ''}
                    onChange={(e) => handleSelectAnswer(currentQuestion.id, e.target.value)}
                    placeholder="Enter answer key..."
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-light"
                  />
                </div>
              )}

            </div>
          ) : (
            <p className="text-center text-slate-400 text-xs py-12">No questions available in this test paper.</p>
          )}

          {/* Navigation Controls */}
          <div className="flex items-center justify-between pt-6 border-t border-slate-100">
            <button
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl disabled:opacity-40 transition-all"
            >
              ← Previous Question
            </button>

            <span className="text-xs font-semibold text-slate-500">
              {currentIndex + 1} of {totalQuestions}
            </span>

            <button
              onClick={() => setCurrentIndex((prev) => Math.min(totalQuestions - 1, prev + 1))}
              disabled={currentIndex === totalQuestions - 1}
              className="px-4 py-2 bg-brand-light hover:bg-brand-medium text-white font-bold text-xs rounded-xl disabled:opacity-40 transition-all"
            >
              Next Question →
            </button>
          </div>

        </div>

        {/* Right Side: Question Drawer Navigator */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4 h-fit">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Question Navigator</h3>
          
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
            {questions.map((q, idx) => {
              const isAnswered = Boolean(answers[q.id]);
              const isCurrent = idx === currentIndex;
              const isFlagged = Boolean(flagged[q.id]);

              let stateClass = 'bg-slate-100 text-slate-600 border-slate-200';
              if (isFlagged) {
                stateClass = 'bg-amber-100 text-amber-900 border-amber-300 font-extrabold';
              } else if (isAnswered) {
                stateClass = 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold';
              }

              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentIndex(idx)}
                  className={`p-2.5 rounded-xl text-xs font-bold border transition-all relative ${stateClass} ${isCurrent ? 'ring-2 ring-brand-light ring-offset-1' : ''}`}
                >
                  {idx + 1}
                  {isFlagged && <span className="absolute -top-1 -right-1 text-[8px]">🚩</span>}
                </button>
              );
            })}
          </div>

          <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-500 space-y-1.5">
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300"></span>
              <span>Answered ({answeredCount})</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded bg-amber-100 border border-amber-300"></span>
              <span>Flagged for Review ({Object.values(flagged).filter(Boolean).length})</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded bg-slate-100 border border-slate-200"></span>
              <span>Unanswered ({totalQuestions - answeredCount})</span>
            </div>
          </div>
        </div>

      </div>

      {/* Confirmation Submit Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-fade-in p-4">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xl max-w-md w-full space-y-4">
            <h3 className="font-bold text-base text-slate-850">Confirm Test Submission</h3>
            <p className="text-xs text-slate-600">Are you sure you want to finish and submit your test?</p>
            
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs space-y-1">
              <p>Total Questions: <span className="font-bold">{totalQuestions}</span></p>
              <p>Answered: <span className="font-bold text-emerald-700">{answeredCount}</span></p>
              <p>Unanswered: <span className="font-bold text-slate-500">{totalQuestions - answeredCount}</span></p>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-200"
              >
                Continue Answering
              </button>
              <button
                onClick={handleManualSubmit}
                disabled={submitting}
                className="px-4 py-2 bg-brand-light hover:bg-brand-medium text-white font-bold text-xs rounded-xl shadow-sm"
              >
                {submitting ? 'Submitting...' : 'Confirm Submission'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
