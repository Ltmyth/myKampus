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

  // 3-Minute Network Grace Period State (Duration Expired)
  const [inGracePeriod, setInGracePeriod] = useState(false);
  const [graceTimeLeft, setGraceTimeLeft] = useState(180); // 3 minutes = 180 seconds

  // Ugandan Local Time & Clock Skew Tracking
  const [serverTimeEAT, setServerTimeEAT] = useState('');
  const [clockSkewMs, setClockSkewMs] = useState(0);
  const [showSkewWarning, setShowSkewWarning] = useState(false);

  // Network & Draft Resilience
  const [isOffline, setIsOffline] = useState(typeof window !== 'undefined' ? !navigator.onLine : false);
  const [submissionFailed, setSubmissionFailed] = useState(false);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showLateStartWarning, setShowLateStartWarning] = useState(false);
  const [securityNotice, setSecurityNotice] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [submitError, setSubmitError] = useState('');

  // Late submission tracking
  const [isLate, setIsLate] = useState(false);
  const [lateReason, setLateReason] = useState('');
  const [dueRemainingSeconds, setDueRemainingSeconds] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const autoSubmittedRef = useRef(false);
  const activeAttemptRef = useRef(null);
  const testObjRef = useRef(null);
  const tabSwitchesRef = useRef(0);

  // Webcam Proctoring Refs & States
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);

  useEffect(() => {
    activeAttemptRef.current = activeAttempt;
  }, [activeAttempt]);

  useEffect(() => {
    testObjRef.current = testObj;
  }, [testObj]);

  useEffect(() => {
    tabSwitchesRef.current = tabSwitches;
  }, [tabSwitches]);

  // Live Kampala EAT Clock Updater
  useEffect(() => {
    const updateEAT = () => {
      try {
        const d = new Date(Date.now() + clockSkewMs);
        setServerTimeEAT(d.toLocaleTimeString('en-GB', { timeZone: 'Africa/Kampala', hour12: false }));
      } catch (_) {
        setServerTimeEAT(new Date().toLocaleTimeString());
      }
    };
    updateEAT();
    const interval = setInterval(updateEAT, 1000);
    return () => clearInterval(interval);
  }, [clockSkewMs]);

  // Offline / Online Connectivity Listener
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    initTestRunner();
  }, [testId]);

  async function initTestRunner() {
    try {
      setLoading(true);
      // Fetch test details, questions, start attempt, proctoring, and official Kampala server time
      const [testData, qData, attemptData, procData, serverTime] = await Promise.all([
        api.get(`/tests/${testId}/`),
        api.get(`/tests/${testId}/questions/`),
        api.post(`/tests/${testId}/start_attempt/`),
        api.get('/proctoring-settings/').catch(() => ({ is_proctoring_enabled: true })),
        api.get('/server-time/').catch(() => null)
      ]);

      if (serverTime?.iso_timestamp) {
        const sNow = new Date(serverTime.iso_timestamp).getTime();
        const cNow = Date.now();
        const diff = sNow - cNow;
        setClockSkewMs(diff);
        if (Math.abs(diff) > 120000) { // > 2 minutes drift
          setShowSkewWarning(true);
        }
      }

      setTestObj(testData);
      setQuestions(qData || []);
      setActiveAttempt(attemptData);
      setProctoringSetting(procData || { is_proctoring_enabled: true });

      if (attemptData.completed_at) {
        router.push(`/dashboard/tests/${testId}/results?attemptId=${attemptData.id}`);
        return;
      }

      // Check for late start (> 1/3 of set duration)
      if (testData.scheduled_start) {
        const scheduledStartMs = new Date(testData.scheduled_start).getTime();
        const durationMs = (testData.duration_minutes || 30) * 60 * 1000;
        const oneThirdDurationMs = durationMs / 3;
        const nowEAT = Date.now() + (serverTime?.iso_timestamp ? (new Date(serverTime.iso_timestamp).getTime() - Date.now()) : 0);
        const delayFromStart = nowEAT - scheduledStartMs;
        if (delayFromStart > oneThirdDurationMs) {
          setShowLateStartWarning(true);
        }
      }

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

      // Calculate initial timer value (in seconds) synchronized with server time
      const now = Date.now() + (serverTime?.iso_timestamp ? (new Date(serverTime.iso_timestamp).getTime() - Date.now()) : 0);
      const startedAt = new Date(attemptData.started_at || attemptData.start_time || now).getTime();
      const allottedEndTime = startedAt + (testData.duration_minutes || 30) * 60 * 1000;
      const dueTimestamp = testData.due_date ? new Date(testData.due_date).getTime() : null;
      const effectiveEndTime = dueTimestamp ? Math.min(allottedEndTime, dueTimestamp) : allottedEndTime;
      const remainingSecs = Math.floor((effectiveEndTime - now) / 1000);

      const GRACE_PERIOD_SECONDS = 180; // 3 minutes

      if (remainingSecs <= -GRACE_PERIOD_SECONDS) {
        setTimeLeftSeconds(0);
        setInGracePeriod(false);
        handleAutoSubmit('Test Window Closed: Final Due Date & Grace Period Expired', null, 'system');
        return;
      } else if (remainingSecs <= 0) {
        setTimeLeftSeconds(0);
        setInGracePeriod(true);
        setGraceTimeLeft(Math.max(1, GRACE_PERIOD_SECONDS + remainingSecs));
      } else {
        setTimeLeftSeconds(remainingSecs);
        setInGracePeriod(false);
      }
    } catch (err) {
      setSecurityNotice(err.message || 'Unable to launch test session.');
    } finally {
      setLoading(false);
    }
  }

  // Live Webcam Stream Capture Effect
  useEffect(() => {
    if (loading || !activeAttempt || !proctoringSetting.is_proctoring_enabled) return;

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
              test_id: testId,
              tab_switches: tabSwitchesRef.current || tabSwitches,
              is_camera_active: true
            }).catch(() => {});
          }
        }, 10000);
      } catch (err) {
        setCameraActive(false);
        setSecurityNotice('⚠️ Camera Access Notice: Live proctoring requires video camera stream.');
      }
    }

    startCamera();

    return () => {
      if (captureInterval) clearInterval(captureInterval);
      if (streamObj) {
        streamObj.getTracks().forEach(track => track.stop());
      }
    };
  }, [loading, activeAttempt, proctoringSetting.is_proctoring_enabled, testId, tabSwitches]);

  // 1. Regular Timer Countdown
  useEffect(() => {
    if (loading || !activeAttempt || inGracePeriod) return;

    if (timeLeftSeconds > 0) {
      const timerInterval = setInterval(() => {
        setTimeLeftSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(timerInterval);
            // Transition into 3-minute network grace period!
            setInGracePeriod(true);
            setGraceTimeLeft(180);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timerInterval);
    } else if (timeLeftSeconds <= 0 && activeAttempt && !autoSubmittedRef.current && !inGracePeriod) {
      setInGracePeriod(true);
      setGraceTimeLeft(180);
    }
  }, [loading, activeAttempt, timeLeftSeconds, inGracePeriod]);

  // 2. 3-Minute Network Grace Period Countdown
  useEffect(() => {
    if (loading || !inGracePeriod || autoSubmittedRef.current) return;

    const graceTimer = setInterval(() => {
      setGraceTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(graceTimer);
          handleAutoSubmit('Test Duration Timeout (3-Minute Network Grace Period Expired): Auto-submitted with accurate student progress.', null, 'system');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(graceTimer);
  }, [loading, inGracePeriod]);

  // 3. Security Tab Switch & Focus Blur Monitoring with real-time audit logging
  useEffect(() => {
    if (loading || !activeAttempt) return;

    const handleVisibilityChange = () => {
      if (document.hidden && !autoSubmittedRef.current) {
        setTabSwitches((prevCount) => {
          const newCount = prevCount + 1;
          tabSwitchesRef.current = newCount;

          // Real-time security event logging to backend proctoring monitor
          if (activeAttemptRef.current?.id || testId) {
            api.post('/proctoring-monitor/log_tab_switch/', {
              test_id: parseInt(testId),
              attempt_id: activeAttemptRef.current?.id,
              tab_switches: newCount,
              title: testObjRef.current?.title || 'Test'
            }).catch(err => {
              console.warn('Proctoring log tab switch error:', err);
            });
          }

          if (newCount >= 3) {
            handleAutoSubmit('Security Lockdown: Exceeded maximum allowed tab switches (3/3).', null, 'security logs');
          } else {
            setSecurityNotice(`⚠️ Security Warning (${newCount}/3): Leaving the test window is prohibited and tracked.`);
          }
          return newCount;
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [loading, activeAttempt, testId]);

  // 4. LocalStorage Auto-Sync Backup
  useEffect(() => {
    if (!testId || !user) return;
    const draftKey = `ciu_test_draft_${testId}_${user.id}`;
    localStorage.setItem(draftKey, JSON.stringify({ answers, flagged }));
  }, [answers, flagged, testId, user]);

  const handleSelectAnswer = (qId, optionVal) => {
    if (inGracePeriod) return; // Inputs locked during 3-minute grace period
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
    await handleAutoSubmit('Student Submitted', null, 'manual');
  };

  const handleAutoSubmit = async (reason, customLateReason = null, explicitSubmissionType = null) => {
    if (autoSubmittedRef.current) return;
    const finalAtt = activeAttemptRef.current || activeAttempt;
    if (!finalAtt || !finalAtt.id) return; // Strict guard: no attempt launched = no auto-submission
    autoSubmittedRef.current = true;
    setSubmitting(true);
    setSubmitError('');
    setSubmitSuccess('');
    setSubmissionFailed(false);

    let subType = explicitSubmissionType;
    if (!subType) {
      if (reason && (reason.toLowerCase().includes('security') || reason.toLowerCase().includes('tab switch') || reason.toLowerCase().includes('lockdown') || reason.toLowerCase().includes('blur'))) {
        subType = 'security logs';
      } else if (reason && (reason.toLowerCase().includes('duration') || reason.toLowerCase().includes('timeout') || reason.toLowerCase().includes('window closed') || reason.toLowerCase().includes('deadline') || reason.toLowerCase().includes('end time') || reason.toLowerCase().includes('grace'))) {
        subType = 'system';
      } else {
        subType = 'manual';
      }
    }

    try {
      const nowIso = new Date().toISOString();
      await api.post(`/test-attempts/${finalAtt.id}/submit/`, {
        answers,
        tab_switches: tabSwitchesRef.current || tabSwitches,
        auto_submitted_reason: reason,
        late_submission_reason: customLateReason || lateReason,
        submission_type: subType,
        start_time: finalAtt?.started_at || finalAtt?.start_time || null,
        submission_time: nowIso
      });

      const draftKey = `ciu_test_draft_${testId}_${user.id}`;
      localStorage.removeItem(draftKey);

      setSubmitSuccess('✅ Test submitted successfully! Redirecting to your scorecard...');
      setTimeout(() => {
        router.push(`/dashboard/tests/${testId}/results?attemptId=${finalAtt.id}`);
      }, 700);
    } catch (err) {
      const msg = err.message || 'Test submission failed due to network interruption. Your answers are safely backed up locally. Click "Retry Submission" below.';
      setSubmitError(`⚠️ Submission Error: ${msg}`);
      setSecurityNotice(msg);
      setSubmissionFailed(true);
      autoSubmittedRef.current = false; // Allow retry!
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
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto relative pb-20">
      
      {/* Live Proctoring Banner & Camera Feed Overlay */}
      {proctoringSetting.is_proctoring_enabled && (
        <div className="bg-red-950 text-white p-3 rounded-2xl border border-red-800 shadow-md flex items-center justify-between text-xs animate-pulse">
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-red-500 animate-ping"></span>
            <span className="font-bold">🔴 LIVE WEBCAM PROCTORING ACTIVE</span>
            <span className="hidden md:inline text-red-300">| Camera stream and tab switches are monitored in real time</span>
          </div>
          <span className="bg-red-900 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border border-red-700">
            {cameraActive ? 'Camera Connected 🟢' : 'Camera Disconnected 🔴'}
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

      {/* Offline Connectivity Warning */}
      {isOffline && (
        <div className="bg-red-600 text-white p-3.5 rounded-2xl flex items-center justify-between text-xs font-bold animate-pulse shadow-md">
          <div className="flex items-center space-x-2">
            <span className="text-base">📡</span>
            <span>OFFLINE WARNING: Internet connection lost. All your answers are safely cached locally in your browser. Do not reload or close this tab. Reconnect to submit.</span>
          </div>
          <span className="bg-black/30 px-2 py-0.5 rounded text-[10px]">Saved to Local Draft</span>
        </div>
      )}

      {/* Clock Skew Warning */}
      {showSkewWarning && (
        <div className="bg-amber-500 text-slate-950 p-3 rounded-2xl flex items-center justify-between text-xs font-bold shadow-md animate-fade-in">
          <div className="flex items-center space-x-2">
            <span className="text-base">⏰</span>
            <span>
              DEVICE CLOCK DRIFT: Your computer clock differs from Ugandan Official Time (Kampala EAT UTC+3) by ~{Math.round(Math.abs(clockSkewMs)/60000)} min. Assessment timing is locked to official university server time.
            </span>
          </div>
          <button onClick={() => setShowSkewWarning(false)} className="px-2 py-0.5 bg-black/20 hover:bg-black/30 rounded text-[11px] cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* 3-Minute Network Grace Period Active Banner */}
      {inGracePeriod && (
        <div className="bg-amber-50 border-2 border-amber-500 text-amber-950 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg animate-pulse">
          <div className="flex items-center space-x-3">
            <span className="text-3xl">⏳</span>
            <div>
              <p className="font-extrabold text-sm uppercase text-amber-950">
                Regular Test Duration Ended · 3-Minute Network Grace Period Active
              </p>
              <p className="text-xs text-amber-800 font-medium">
                Questions are locked. Please submit your answers now. The system will automatically record and finalize all your answered progress in <span className="font-mono font-extrabold text-red-600 text-sm">{formatTime(graceTimeLeft)}</span>.
              </p>
            </div>
          </div>
          <button
            onClick={() => handleAutoSubmit('Submitted during 3-Minute Network Grace Period', null, 'manual')}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all shrink-0 cursor-pointer"
          >
            ⚡ Submit Test Now ({formatTime(graceTimeLeft)})
          </button>
        </div>
      )}

      {/* Submission Failure / Retry Banner */}
      {submissionFailed && (
        <div className="bg-red-50 border-2 border-red-500 text-red-950 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-bold text-xs text-red-900">{submitError}</p>
              <p className="text-[11px] text-red-700">All your answers are safely preserved in browser local storage. Click below to retry submission now.</p>
            </div>
          </div>
          <button
            onClick={() => handleAutoSubmit('Retried Submission after Network Interruption', null, 'manual')}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow transition-all shrink-0 cursor-pointer"
          >
            🔄 Retry Submission Now
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
                You entered this test after more than one-third (1/3) of the scheduled duration had passed. Duration is strictly enforced to the dot and will auto-submit when the countdown expires.
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

      {/* Sticky Security Header Bar */}
      <div className="sticky top-0 z-30 bg-white border border-slate-200 p-4 rounded-2xl shadow-md flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-bold text-slate-850 text-base">{testObj?.title}</h2>
          <p className="text-xs text-slate-500 font-medium">Course: {testObj?.course_code} · Question {currentIndex + 1} of {totalQuestions}</p>
        </div>

        {/* Security Alerts & Timer */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="hidden sm:flex items-center space-x-1.5 px-3 py-2 bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-mono font-bold shadow-sm">
            <span>🇺🇬 Kampala EAT:</span>
            <span>{serverTimeEAT || '00:00:00'}</span>
          </div>

          <div className={`px-3 py-1.5 rounded-xl flex items-center space-x-2 border ${inGracePeriod ? 'bg-amber-600 text-white border-amber-300 animate-pulse' : (isLate ? 'bg-amber-100 text-amber-900 border-amber-300 font-extrabold' : 'bg-red-50 text-red-700 border-red-100')}`}>
            <span className={`w-2 h-2 rounded-full ${inGracePeriod ? 'bg-white' : (isLate ? 'bg-amber-500' : 'bg-red-500')} animate-ping`}></span>
            <span className="font-mono font-bold text-sm">
              {inGracePeriod ? `Grace: ${formatTime(graceTimeLeft)}` : (isLate ? (dueRemainingSeconds !== null ? `Due: ${formatTime(dueRemainingSeconds)}` : 'OVERTIME') : formatTime(timeLeftSeconds))}
            </span>
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

      {/* Late Submission Notice Banner */}
      {isLate && (
        <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl flex items-center space-x-3 text-amber-900 text-xs font-semibold shadow-sm animate-fade-in">
          <span className="text-2xl">⚠️</span>
          <div>
            <p className="font-extrabold text-amber-950 uppercase tracking-wide">Late Test Submission Window Active</p>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              Standard test duration has ended. You may continue attempting and submit your responses before the final due date{testObj?.due_date ? ` (${new Date(testObj.due_date).toLocaleString()})` : ''}. A comment stating the reason for late submission is required upon submission.
            </p>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
        <div className="bg-brand-emerald h-1.5 transition-all duration-300" style={{ width: `${progressPercent}%` }}></div>
      </div>

      {/* Submission Success & Error Feedback Banners */}
      {submitSuccess && (
        <div className="p-4 bg-emerald-50 border-l-4 border-emerald-500 rounded-xl text-emerald-800 text-xs font-bold flex items-center justify-between shadow-sm animate-slide-up">
          <span>{submitSuccess}</span>
        </div>
      )}

      {submitError && (
        <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-xl text-red-800 text-xs font-bold flex items-center justify-between shadow-sm animate-slide-up">
          <span>{submitError}</span>
          <button onClick={() => setSubmitError('')} className="text-red-700 font-bold text-xs ml-2">Dismiss</button>
        </div>
      )}

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
                        disabled={inGracePeriod}
                        onClick={() => handleSelectAnswer(currentQuestion.id, opt.key)}
                        title={inGracePeriod ? 'Answers locked during 3-minute grace period' : ''}
                        className={`w-full p-4 rounded-xl border text-left text-xs font-medium transition-all flex items-center space-x-3 ${inGracePeriod ? 'cursor-not-allowed opacity-80 ' : ''}${isSelected ? 'bg-emerald-50 border-brand-emerald text-brand-dark shadow-sm ring-1 ring-brand-emerald' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'}`}
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
                        disabled={inGracePeriod}
                        onClick={() => handleSelectAnswer(currentQuestion.id, tfVal)}
                        title={inGracePeriod ? 'Answers locked during 3-minute grace period' : ''}
                        className={`p-6 rounded-2xl border text-center font-bold text-sm transition-all ${inGracePeriod ? 'cursor-not-allowed opacity-80 ' : ''}${isSelected ? 'bg-emerald-50 border-brand-emerald text-brand-dark ring-2 ring-brand-emerald shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'}`}
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
                    disabled={inGracePeriod}
                    value={answers[currentQuestion.id] || ''}
                    onChange={(e) => handleSelectAnswer(currentQuestion.id, e.target.value)}
                    placeholder={inGracePeriod ? 'Locked during 3-minute grace period' : 'Enter answer key...'}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-light disabled:opacity-80 disabled:cursor-not-allowed"
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

            {/* Late Submission Comments */}
            {isLate && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5 text-xs text-left">
                <label className="block text-amber-900 font-bold uppercase text-[10.5px]">
                  Comments on Late Submission <span className="text-red-650">*</span>
                </label>
                <textarea
                  rows={2}
                  value={lateReason}
                  onChange={(e) => setLateReason(e.target.value)}
                  placeholder="Explain reason for late submission (e.g. network disconnect, power interruption)..."
                  className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-xl text-xs text-slate-800 resize-none font-medium focus:ring-1 focus:ring-amber-500"
                  required
                />
                {!lateReason.trim() && (
                  <p className="text-[10px] text-amber-700 italic">* Explanation comment is required prior to submitting late attempts.</p>
                )}
              </div>
            )}

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-200"
              >
                Continue Answering
              </button>
              <button
                onClick={handleManualSubmit}
                disabled={submitting || (isLate && !lateReason.trim())}
                className="px-4 py-2 bg-brand-light hover:bg-brand-medium text-white font-bold text-xs rounded-xl shadow-sm disabled:opacity-50 disabled:pointer-events-none"
              >
                {submitting ? 'Submitting...' : 'Confirm Submission'}
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
                I Understand & Acknowledge — Proceed to Test
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
