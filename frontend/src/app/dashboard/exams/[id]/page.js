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
  const [proctoringSetting, setProctoringSetting] = useState({ is_proctoring_enabled: true });
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
  const [successMsg, setSuccessMsg] = useState('');
  const [showLateStartWarning, setShowLateStartWarning] = useState(false);

  // Late submission tracking
  const [isLate, setIsLate] = useState(false);
  const [lateReason, setLateReason] = useState('');
  const [dueRemainingSeconds, setDueRemainingSeconds] = useState(null);

  const timerRef = useRef(null);
  const autoSubmittedRef = useRef(false);
  const attemptRef = useRef(null);
  const examRef = useRef(null);
  const tabSwitchesRef = useRef(0);

  // Webcam Proctoring Refs & States
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);

  useEffect(() => {
    attemptRef.current = attempt;
  }, [attempt]);

  useEffect(() => {
    examRef.current = exam;
  }, [exam]);

  useEffect(() => {
    tabSwitchesRef.current = tabSwitches;
  }, [tabSwitches]);

  useEffect(() => {
    if (examId) {
      loadExamAttempt();
    }

    // Security Tab tracking with real-time audit logging
    const handleVisibilityChange = () => {
      if (document.hidden && !autoSubmittedRef.current) {
        setTabSwitches(prev => {
          const updated = prev + 1;
          tabSwitchesRef.current = updated;
          setShowSecurityWarning(true);

          // Real-time security event logging to backend proctoring monitor
          if (attemptRef.current?.id || examId) {
            api.post('/proctoring-monitor/log_tab_switch/', {
              exam_id: parseInt(examId),
              attempt_id: attemptRef.current?.id,
              tab_switches: updated,
              title: examRef.current?.title || 'Examination'
            }).catch(err => {
              console.warn('Proctoring log tab switch error:', err);
            });
          }

          if (updated >= 3) {
            autoSubmitExam(attemptRef.current?.id, null, updated, 'Security Lockdown: Exceeded maximum allowed tab switches (3/3).', 'security logs');
          }
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

  // Live Webcam Stream Capture Effect
  useEffect(() => {
    if (loading || !attempt || !proctoringSetting.is_proctoring_enabled) return;

    let streamObj = null;
    let captureInterval = null;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } });
        streamObj = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCameraActive(true);

        captureInterval = setInterval(() => {
          if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = 320;
            canvas.height = 240;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, 320, 240);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.5);

            api.post('/proctoring-monitor/stream_snapshot/', {
              image_data: dataUrl,
              exam_id: parseInt(examId),
              tab_switches: tabSwitchesRef.current || tabSwitches,
              is_camera_active: true
            }).catch(() => {});
          }
        }, 10000);
      } catch (err) {
        setCameraActive(false);
      }
    }

    startCamera();

    return () => {
      if (captureInterval) clearInterval(captureInterval);
      if (streamObj) {
        streamObj.getTracks().forEach(track => track.stop());
      }
    };
  }, [loading, attempt, proctoringSetting.is_proctoring_enabled, examId, tabSwitches]);

  // Timer countdown hook (strictly followed to the dot: auto-submit upon reaching 0)
  useEffect(() => {
    if (timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            autoSubmitExam(null, null, tabSwitchesRef.current, 'Exam End Time Reached: Assessment duration or scheduled cutoff reached.', 'system');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (timeLeft <= 0 && attempt && !autoSubmittedRef.current && !loading) {
      autoSubmitExam(null, null, tabSwitchesRef.current, 'Exam End Time Reached: Assessment duration or scheduled cutoff reached.', 'system');
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timeLeft, attempt, loading]);

  async function loadExamAttempt() {
    try {
      setLoading(true);
      // Fetch exam details, start attempt, and proctoring setting
      const [examData, attemptData, qData, procData] = await Promise.all([
        api.get(`/exams/${examId}/`),
        api.post(`/exams/${examId}/start_attempt/`),
        api.get(`/exams/${examId}/questions/`),
        api.get('/proctoring-settings/').catch(() => ({ is_proctoring_enabled: true }))
      ]);

      setExam(examData);
      setProctoringSetting(procData || { is_proctoring_enabled: true });

      if (attemptData.completed_at) {
        // Already finished
        router.push(`/dashboard/exams/${examId}/results`);
        return;
      }
      setAttempt(attemptData);
      setAnswers(attemptData.answers || {});
      setQuestions(qData || []);

      // Check for late start (> 1/3 of set duration)
      if (examData.scheduled_start) {
        const scheduledStartMs = new Date(examData.scheduled_start).getTime();
        const durationMs = (examData.duration_minutes || 60) * 60 * 1000;
        const oneThirdDurationMs = durationMs / 3;
        const delayFromStart = Date.now() - scheduledStartMs;
        if (delayFromStart > oneThirdDurationMs) {
          setShowLateStartWarning(true);
        }
      }

      // Calculate time remaining based on duration, start time, and hard due_date cutoff
      const startTime = new Date(attemptData.started_at || attemptData.start_time || Date.now()).getTime();
      const allottedEndTime = startTime + (examData.duration_minutes || 60) * 60 * 1000;
      const now = Date.now();
      const dueTimestamp = examData.due_date ? new Date(examData.due_date).getTime() : null;
      // Late start allowed before due_date, but exam end time is strictly followed to the dot for auto-submission
      const effectiveEndTime = dueTimestamp ? Math.min(allottedEndTime, dueTimestamp) : allottedEndTime;
      const remainingSeconds = Math.max(0, Math.floor((effectiveEndTime - now) / 1000));

      if (dueTimestamp && now >= dueTimestamp) {
        setTimeLeft(0);
        autoSubmitExam(attemptData.id, attemptData.answers, 0, 'Assessment Window Closed: Final Due Date Reached', 'system');
        return;
      }

      if (remainingSeconds <= 0) {
        setTimeLeft(0);
        autoSubmitExam(attemptData.id, attemptData.answers, 0, 'Duration Timeout: The allocated examination duration has expired.', 'system');
        return;
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

  const autoSubmitExam = async (attId = null, currentAnswers = null, switches = null, reason = 'Duration Timeout: The allocated examination duration has expired.', explicitSubmissionType = null) => {
    if (autoSubmittedRef.current) return;
    const finalAttId = attId || attemptRef.current?.id || attempt?.id;
    if (!finalAttId) return; // Strict guard: no attempt launched = no auto-submission
    autoSubmittedRef.current = true;
    const finalAnswers = currentAnswers || answers;
    const finalSwitches = switches !== null ? switches : (tabSwitchesRef.current || tabSwitches);

    performSubmit(finalAttId, finalAnswers, finalSwitches, reason, explicitSubmissionType);
  };

  const performSubmit = async (attId, answersPayload, switches = tabSwitches, reason = null, explicitSubmissionType = null) => {
    try {
      setLoading(true);
      setErrorMsg('');
      setSuccessMsg('✅ Exam paper submitted successfully! Redirecting to results...');

      let subType = explicitSubmissionType;
      if (!subType) {
        if (reason && (reason.toLowerCase().includes('security') || reason.toLowerCase().includes('tab switch') || reason.toLowerCase().includes('lockdown') || reason.toLowerCase().includes('blur'))) {
          subType = 'security logs';
        } else if (reason && (reason.toLowerCase().includes('duration') || reason.toLowerCase().includes('timeout') || reason.toLowerCase().includes('window closed') || reason.toLowerCase().includes('deadline') || reason.toLowerCase().includes('end time'))) {
          subType = 'system';
        } else {
          subType = 'manual';
        }
      }

      const nowIso = new Date().toISOString();
      await api.post(`/attempts/${attId}/submit/`, {
        answers: answersPayload,
        tab_switches: switches,
        auto_submitted_reason: reason,
        late_submission_reason: lateReason,
        submission_type: subType,
        start_time: attempt?.started_at || attempt?.start_time || null,
        submission_time: nowIso
      });
      setTimeout(() => {
        router.push(`/dashboard/exams/${examId}/results?attemptId=${attId}`);
      }, 700);
    } catch (err) {
      setErrorMsg(err.message || '⚠️ Failed to submit exam paper. Please check network connection and contact your lecturer.');
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
      
      {/* Live Proctoring Banner */}
      {proctoringSetting.is_proctoring_enabled && (
        <div className="bg-red-950 text-white p-3 rounded-2xl border border-red-800 shadow-md flex items-center justify-between text-xs animate-pulse">
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-red-500 animate-ping"></span>
            <span className="font-bold">🔴 LIVE AI & WEBCAM PROCTORING ACTIVE</span>
            <span className="hidden md:inline text-red-300">| Final Examination stream monitored by Academic Registrar & System Admin</span>
          </div>
          <span className="bg-red-900 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border border-red-700">
            {cameraActive ? 'Camera Connected 🟢' : 'Anti-Cheat ON'}
          </span>
        </div>
      )}

      {/* Floating Proctor Webcam Box */}
      {proctoringSetting.is_proctoring_enabled && (
        <div className="fixed bottom-4 right-4 z-40 w-40 h-28 bg-slate-900 border-2 border-red-600 rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          <canvas ref={canvasRef} className="hidden" />
          <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/80 text-white text-[9px] font-bold rounded flex items-center space-x-1">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping"></span>
            <span>PROCTOR</span>
          </div>
        </div>
      )}

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

      {/* Late Start Warning Alert (1/3 duration exceeded) */}
      {showLateStartWarning && (
        <div className="p-4 bg-amber-50 border-2 border-amber-400 rounded-2xl flex items-center justify-between text-amber-900 text-xs shadow-sm animate-fade-in">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-extrabold text-amber-950 uppercase tracking-wide">Late Assessment Entry Warning</p>
              <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                You entered this examination after more than one-third (1/3) of the scheduled duration had passed. Duration is strictly enforced to the dot and will auto-submit when the countdown expires.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowLateStartWarning(false)}
            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs transition-all shrink-0 ml-3 cursor-pointer"
          >
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
        <div className={`flex items-center space-x-3 px-5 py-3 rounded-xl shadow-md border self-start md:self-center ${isLate ? 'bg-amber-950 text-white border-amber-600/40' : 'bg-brand-dark text-white border-white/5'}`}>
          <svg xmlns="http://www.w3.org/2000/svg" className={`w-5 h-5 ${isLate ? 'text-amber-400 animate-bounce' : 'text-brand-emerald animate-pulse-slow'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <span className="text-[9px] text-white/60 block font-bold uppercase tracking-wider">
              {isLate ? '⚠️ Overtime (Late Window)' : 'Time Remaining'}
            </span>
            <span className={`font-mono text-lg font-extrabold tracking-wider ${isLate ? 'text-amber-300' : ''}`}>
              {isLate ? (dueRemainingSeconds !== null ? `Due: ${formatTime(dueRemainingSeconds)}` : 'OVERTIME') : formatTime(timeLeft)}
            </span>
          </div>
        </div>
      </div>

      {/* Late Submission Notice Banner */}
      {isLate && (
        <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl flex items-center space-x-3 text-amber-900 text-xs font-semibold shadow-sm animate-fade-in">
          <span className="text-2xl">⚠️</span>
          <div>
            <p className="font-extrabold text-amber-950 uppercase tracking-wide">Late Submission Mode Active</p>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              The standard duration or scheduled stop time has expired. You may still complete and submit your paper before the hard due date{exam?.due_date ? ` (${new Date(exam.due_date).toLocaleString()})` : ''}. A comment explaining the reason for late submission is required.
            </p>
          </div>
        </div>
      )}

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
              <h3 className="text-base font-bold text-slate-880 leading-relaxed">
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

            {/* Late Submission Comments */}
            {isLate && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl space-y-1.5 text-xs text-left">
                <label className="block text-amber-900 font-bold uppercase text-[10.5px]">
                  Comments on Late Submission <span className="text-red-650">*</span>
                </label>
                <textarea
                  rows={2}
                  value={lateReason}
                  onChange={(e) => setLateReason(e.target.value)}
                  placeholder="Provide brief explanation for late submission (e.g. system connectivity interruption, power outage)..."
                  className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-xl text-xs text-slate-800 resize-none font-medium focus:ring-1 focus:ring-amber-500"
                  required
                />
                {!lateReason.trim() && (
                  <p className="text-[10px] text-amber-700 italic">* Explanation comment is required prior to submitting late attempts.</p>
                )}
              </div>
            )}

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
                disabled={!confirmCheckbox || (isLate && !lateReason.trim())}
                onClick={() => {
                  setShowSubmitModal(false);
                  performSubmit(attempt.id, answers, tabSwitches, 'Student Submitted', 'manual');
                }}
                className="flex-1 py-2.5 bg-brand-emerald disabled:opacity-50 disabled:pointer-events-none text-brand-dark text-xs font-extrabold rounded-xl transition-all shadow hover:bg-brand-emerald/90"
              >
                Confirm & Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Late Start Warning Modal (1/3 of set duration) */}
      {showLateStartWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-fade-in p-4">
          <div className="bg-white rounded-2xl p-6 border-2 border-amber-400 shadow-2xl max-w-md w-full space-y-4">
            <div className="flex items-center space-x-3 text-amber-600">
              <span className="text-3xl">⚠️</span>
              <div>
                <h3 className="font-extrabold text-base text-slate-900">Late Assessment Entry Warning</h3>
                <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  Entry past 1/3 of duration
                </span>
              </div>
            </div>
            
            <p className="text-xs text-slate-700 leading-relaxed">
              You are starting this assessment after more than <strong>one-third (1/3)</strong> of the scheduled duration has passed.
            </p>
            
            <div className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1.5 font-medium">
              <p>⏱️ <strong>Strict Duration Policy:</strong> The assessment timer is enforced strictly to the dot.</p>
              <p>⚡ <strong>Automatic Submission:</strong> All answered and in-progress questions will be automatically finalized and submitted as soon as the countdown timer reaches zero (00:00:00).</p>
            </div>

            <div className="flex items-center justify-end pt-2">
              <button
                onClick={() => setShowLateStartWarning(false)}
                className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
              >
                I Understand & Acknowledge — Proceed to Exam
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
