'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

export default function ExamResultsPage() {
  const { id: examId } = useParams();
  const { user } = useAuth();
  const router = useRouter();

  const [attempt, setAttempt] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (examId) {
      loadResults();
    }
  }, [examId]);

  async function loadResults() {
    try {
      setLoading(true);
      let targetAttemptId = null;

      // Extract attemptId from query parameters
      if (typeof window !== 'undefined') {
        const searchParams = new URLSearchParams(window.location.search);
        targetAttemptId = searchParams.get('attemptId');
      }

      if (!targetAttemptId) {
        // Fetch user's attempts to find the one for this exam
        const attemptsData = await api.get('/attempts/').catch(() => []);
        const userAttempt = attemptsData.find(att => att.exam === parseInt(examId));

        if (!userAttempt) {
          setErrorMsg('No graded attempt found for this exam.');
          return;
        }

        if (!userAttempt.completed_at) {
          // Not completed, redirect to take exam
          router.push(`/dashboard/exams/${examId}`);
          return;
        }
        targetAttemptId = userAttempt.id;
      }

      // Fetch results details (includes questions and correct options)
      const data = await api.get(`/attempts/${targetAttemptId}/results/`);
      if (data.is_results_released === false) {
        setErrorMsg(data.detail || 'Examination results are currently withheld by the Academic Registrar / Dean and will be visible once released.');
        setAttempt(data.attempt);
        setQuestions([]);
        return;
      }
      setAttempt(data.attempt);
      setQuestions(data.questions || []);

    } catch (err) {
      setErrorMsg(err.message || 'Failed to load results.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="w-10 h-10 border-4 border-brand-light/20 border-t-brand-light rounded-full animate-spin"></div>
        <p className="text-slate-500 font-semibold text-sm">Grading answers and loading scorecard...</p>
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

  const passed = attempt.score >= 50.0;

  return (
    <div className="space-y-8 max-w-4xl mx-auto animate-fade-in">
      
      {/* Top Banner Overview */}
      <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <span className="text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
            Exam Graded Sheet
          </span>
          <h2 className="text-xl md:text-2xl font-extrabold text-slate-800">{attempt.exam_title} ({attempt.exam_course_code})</h2>
          {attempt.student_name && (user?.username !== attempt.student_name) && (
            <p className="text-xs text-brand-medium font-bold uppercase tracking-wider">
              Student: <span className="text-slate-850 font-bold">{attempt.student_name}</span>
            </p>
          )}
          <p className="text-xs text-slate-500 font-medium">Completed at: {new Date(attempt.completed_at).toLocaleString()}</p>
        </div>

        {/* Score indicator */}
        <div className="flex items-center space-x-4 self-start md:self-center">
          <div className="text-right">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Percentage Grade</span>
            <span className={`text-3xl md:text-4xl font-black ${passed ? 'text-brand-light' : 'text-red-650'}`}>
              {attempt.score}%
            </span>
          </div>
          <div className={`px-4 py-2 rounded-2xl border font-bold text-sm tracking-wide uppercase ${passed ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-750 border-red-150'}`}>
            {passed ? 'Passed' : 'Failed'}
          </div>
        </div>
      </div>

      {/* Questions list analysis */}
      <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-100 space-y-6">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-3">
          Questionnaire Breakdown & Performance
        </h3>

        <div className="space-y-6 divide-y divide-slate-150">
          {questions.map((q, idx) => {
            const studentAns = attempt.answers[q.id.toString()];
            const correctAns = q.correct_option;
            const isCorrect = studentAns && studentAns.toUpperCase() === correctAns.toUpperCase();

            return (
              <div key={q.id} className="pt-6 first:pt-0 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <h4 className="text-sm font-bold text-slate-800 leading-relaxed">
                    Q{idx + 1}: {q.question_text}
                  </h4>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 uppercase tracking-wider ${isCorrect ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                    {isCorrect ? 'Correct' : 'Incorrect'}
                  </span>
                </div>

                {/* Options mapping */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-semibold text-slate-700">
                  {[
                    { label: 'A', text: q.option_a },
                    { label: 'B', text: q.option_b },
                    { label: 'C', text: q.option_c },
                    { label: 'D', text: q.option_d },
                  ].map((opt) => {
                    const isStudentChoice = studentAns === opt.label;
                    const isCorrectChoice = correctAns === opt.label;

                    let bgStyle = 'bg-slate-50 border-slate-200';
                    let labelStyle = 'bg-white border-slate-300 text-slate-500';

                    if (isCorrectChoice) {
                      bgStyle = 'bg-emerald-50 border-emerald-300 text-emerald-900';
                      labelStyle = 'bg-emerald-600 border-emerald-600 text-white';
                    } else if (isStudentChoice && !isCorrect) {
                      bgStyle = 'bg-red-50 border-red-300 text-red-950';
                      labelStyle = 'bg-red-650 border-red-650 text-white';
                    }

                    return (
                      <div
                        key={opt.label}
                        className={`px-4 py-2.5 rounded-xl border flex items-center space-x-2.5 ${bgStyle}`}
                      >
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] border ${labelStyle}`}>
                          {opt.label}
                        </span>
                        <span>{opt.text}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
                  <div className={`p-3 rounded-xl border ${isCorrect ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Student Selected Answer</span>
                    <span className={`font-bold text-sm block mt-0.5 ${isCorrect ? 'text-emerald-800' : 'text-red-700'}`}>
                      {formatExamAnswerText(q, studentAns)}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-100/60 border border-emerald-300">
                    <span className="text-[10px] text-emerald-900 font-bold uppercase block">✓ Official Correct Answer Key</span>
                    <span className="font-bold text-sm text-emerald-950 block mt-0.5">
                      {formatExamAnswerText(q, correctAns)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="text-center">
        <button
          onClick={() => router.push('/dashboard/exams')}
          className="px-6 py-2.5 bg-brand-light hover:bg-brand-medium text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-[0.98]"
        >
          Return to Exams Portal
        </button>
      </div>

    </div>
  );
}

function formatExamAnswerText(q, key) {
  if (!key) return '(No Answer Provided)';
  const k = String(key).trim().toUpperCase();
  if (k === 'A' && q.option_a) return `Option A: ${q.option_a}`;
  if (k === 'B' && q.option_b) return `Option B: ${q.option_b}`;
  if (k === 'C' && q.option_c) return `Option C: ${q.option_c}`;
  if (k === 'D' && q.option_d) return `Option D: ${q.option_d}`;
  return k;
}
