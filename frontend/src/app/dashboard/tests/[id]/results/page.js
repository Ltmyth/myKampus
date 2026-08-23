'use client';

import { useState, useEffect, use } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { useRouter, useSearchParams } from 'next/navigation';

export default function TestResultsPage({ params }) {
  const unwrappedParams = use(params);
  const testId = unwrappedParams.id;
  const searchParams = useSearchParams();
  const attemptId = searchParams.get('attemptId');

  const { user } = useAuth();
  const router = useRouter();

  const [resultData, setResultData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetchResults();
  }, [testId, attemptId]);

  async function fetchResults() {
    try {
      setLoading(true);
      if (!attemptId) {
        // Fetch student's latest attempt for this test
        const attempts = await api.get('/test-attempts/').catch(() => []);
        const match = attempts.find(a => a.test === parseInt(testId) && a.completed_at);
        if (match) {
          const res = await api.get(`/test-attempts/${match.id}/results/`);
          setResultData(res);
        } else {
          setErrorMsg('No completed attempt found for this test.');
        }
      } else {
        const res = await api.get(`/test-attempts/${attemptId}/results/`);
        setResultData(res);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to retrieve test scorecard.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <div className="w-10 h-10 border-4 border-brand-light/20 border-t-brand-light rounded-full animate-spin"></div>
        <p className="text-xs text-slate-500 font-semibold">Generating Academic Scorecard...</p>
      </div>
    );
  }

  if (errorMsg || !resultData) {
    return (
      <div className="max-w-lg mx-auto py-20 text-center space-y-4">
        <div className="p-6 bg-red-50 border-l-4 border-red-500 rounded-2xl text-red-700 text-xs font-semibold">
          {errorMsg || 'Unable to load test result scorecard.'}
        </div>
        <button
          onClick={() => router.push('/dashboard/tests')}
          className="px-4 py-2 bg-brand-light hover:bg-brand-medium text-white text-xs font-bold rounded-xl"
        >
          Return to Test Portal
        </button>
      </div>
    );
  }

  const { attempt, questions } = resultData;
  const isPassed = attempt.passed;

  return (
    <div className="space-y-8 max-w-4xl mx-auto animate-fade-in">
      
      {/* Score Header Card */}
      <div className={`rounded-3xl p-8 border shadow-sm text-center relative overflow-hidden ${isPassed ? 'bg-gradient-to-br from-emerald-900 to-brand-dark text-white border-brand-light/30' : 'bg-gradient-to-br from-red-950 to-slate-900 text-white border-red-900/30'}`}>
        
        <span className={`inline-block px-3 py-1 rounded-full text-xs font-extrabold tracking-wider uppercase border mb-3 ${isPassed ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-red-500/20 text-red-300 border-red-500/30'}`}>
          {isPassed ? '🎉 TEST PASSED' : '⚠️ TEST FAILED'}
        </span>

        <h2 className="text-2xl font-black">{attempt.test_title}</h2>
        <p className="text-xs text-white/70 font-medium mt-1">Course Code: {attempt.test_course_code} · Attempt #{attempt.attempt_number}</p>

        {/* Big Score Number */}
        <div className="my-6">
          <span className="text-6xl font-black tracking-tight">{attempt.score}%</span>
          <p className="text-xs text-white/60 font-semibold mt-1">Pass Mark Target: {attempt.pass_percentage}%</p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-black/20 p-4 rounded-2xl border border-white/10 max-w-2xl mx-auto text-xs">
          <div>
            <span className="text-white/50 text-[10px] uppercase font-bold block">Status</span>
            <span className="font-extrabold text-white">{isPassed ? 'PASSED' : 'FAILED'}</span>
          </div>
          <div>
            <span className="text-white/50 text-[10px] uppercase font-bold block">Tab Switches</span>
            <span className="font-extrabold text-amber-300">{attempt.tab_switches_count}</span>
          </div>
          <div>
            <span className="text-white/50 text-[10px] uppercase font-bold block">Submitted</span>
            <span className="font-extrabold text-white">{new Date(attempt.completed_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
          </div>
          <div>
            <span className="text-white/50 text-[10px] uppercase font-bold block">Security Log</span>
            <span className="font-semibold text-white/90 truncate">{attempt.auto_submitted_reason || 'Clean Submission'}</span>
          </div>
        </div>

      </div>

      {/* Detailed Question Review */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
        <h3 className="text-sm font-bold text-slate-850 uppercase tracking-wider">Detailed Answer Breakdown & Explanations</h3>

        <div className="space-y-4">
          {questions.map((q, idx) => {
            const studentAns = strVal(attempt.answers[strVal(q.id)]);
            const correctAns = strVal(q.correct_answer);
            const isCorrect = studentAns.toUpperCase() === correctAns.toUpperCase();

            return (
              <div key={q.id} className={`p-4 rounded-2xl border transition-all ${isCorrect ? 'bg-emerald-50/50 border-emerald-200' : 'bg-red-50/50 border-red-200'}`}>
                
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                      Q{idx + 1} ({q.question_type.toUpperCase()} · {q.points} Point{q.points > 1 ? 's' : ''})
                    </span>
                    <h4 className="font-bold text-slate-850 text-sm">{q.question_text}</h4>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded text-[10px] font-extrabold border ${isCorrect ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-red-100 text-red-800 border-red-300'}`}>
                    {isCorrect ? '✓ CORRECT' : '✗ INCORRECT'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-3 text-xs">
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Your Answer</span>
                    <span className={`font-bold ${isCorrect ? 'text-emerald-700' : 'text-red-600'}`}>
                      {studentAns || '(No Answer)'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Correct Answer Key</span>
                    <span className="font-bold text-emerald-700">{correctAns}</span>
                  </div>
                </div>

                {q.explanation && (
                  <div className="mt-3 p-3 bg-white/80 rounded-xl border border-slate-200 text-xs text-slate-650 space-y-0.5">
                    <span className="font-bold text-brand-medium text-[10px] uppercase block">💡 Lecturer Explanation:</span>
                    <p className="italic">{q.explanation}</p>
                  </div>
                )}

              </div>
            );
          })}
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={() => router.push('/dashboard/tests')}
          className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition-all"
        >
          ← Return to Test Portal
        </button>

        <button
          onClick={() => router.push(`/dashboard/tests/${testId}`)}
          className="px-5 py-2.5 bg-brand-light hover:bg-brand-medium text-white font-bold text-xs rounded-xl shadow-sm transition-all"
        >
          Retake Test →
        </button>
      </div>

    </div>
  );
}

function strVal(val) {
  if (val === undefined || val === null) return '';
  return String(val).trim();
}
