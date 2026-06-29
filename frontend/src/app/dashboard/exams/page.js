'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function ExamsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [exams, setExams] = useState([]);
  const [courses, setCourses] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [allAttempts, setAllAttempts] = useState([]); // Lecturer: see all attempts
  const [loading, setLoading] = useState(true);

  // Form states (Lecturer create Exam)
  const [examTitle, setExamTitle] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [duration, setDuration] = useState(30);
  
  // Manage Questions states (Lecturer)
  const [selectedExam, setSelectedExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [qText, setQText] = useState('');
  const [optA, setOptA] = useState('');
  const [optB, setOptB] = useState('');
  const [optC, setOptC] = useState('');
  const [optD, setOptD] = useState('');
  const [correctOpt, setCorrectOpt] = useState('A');

  // UI notifications
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadExamData();
  }, []);

  async function loadExamData() {
    try {
      setLoading(true);
      const [examsData, coursesData, attemptsData] = await Promise.all([
        api.get('/exams/').catch(() => []),
        api.get('/courses/').catch(() => []),
        api.get('/attempts/').catch(() => [])
      ]);
      setExams(examsData);
      setCourses(coursesData);
      
      if (user.role === 'student') {
        setAttempts(attemptsData);
      } else {
        setAllAttempts(attemptsData);
      }
    } catch (err) {
      setErrorMsg('Failed to load exams data.');
    } finally {
      setLoading(false);
    }
  }

  const handleCreateExam = async (e) => {
    e.preventDefault();
    if (!examTitle || !selectedCourse) {
      setErrorMsg('Please specify an assessment title and select a course.');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      await api.post('/exams/', {
        title: examTitle,
        course: selectedCourse,
        duration_minutes: duration
      });
      setSuccessMsg('Exam assessment created successfully!');
      setExamTitle('');
      setSelectedCourse('');
      setDuration(30);
      loadExamData();
    } catch (err) {
      setErrorMsg(err.message || 'Exam creation failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (exam) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const updated = await api.patch(`/exams/${exam.id}/`, {
        is_active: !exam.is_active
      });
      setSuccessMsg(`Exam status updated to: ${updated.is_active ? 'ACTIVE' : 'DRAFT'}`);
      loadExamData();
    } catch (err) {
      setErrorMsg(err.message || 'Status toggle failed.');
    }
  };

  // Fetch questions for edit (Lecturer)
  const handleSelectExamForQuestions = async (exam) => {
    setSelectedExam(exam);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const qData = await api.get(`/exams/${exam.id}/questions/`);
      setQuestions(qData);
    } catch (err) {
      setErrorMsg('Failed to fetch exam questions.');
    }
  };

  const handleAddQuestion = async (e) => {
    e.preventDefault();
    if (!qText || !optA || !optB || !optC || !optD) {
      setErrorMsg('Please fill in question text and all 4 options.');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      await api.post(`/exams/${selectedExam.id}/questions/`, {
        question_text: qText,
        option_a: optA,
        option_b: optB,
        option_c: optC,
        option_d: optD,
        correct_option: correctOpt
      });
      setSuccessMsg('Question added successfully!');
      setQText('');
      setOptA('');
      setOptB('');
      setOptC('');
      setOptD('');
      setCorrectOpt('A');
      
      // refresh questions list
      const qData = await api.get(`/exams/${selectedExam.id}/questions/`);
      setQuestions(qData);
      loadExamData(); // updates question count count
    } catch (err) {
      setErrorMsg(err.message || 'Failed to append question.');
    } finally {
      setSubmitting(false);
    }
  };

  const startStudentExam = async (examId) => {
    setErrorMsg('');
    try {
      const data = await api.post(`/exams/${examId}/start_attempt/`);
      router.push(`/dashboard/exams/${examId}`);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to start exam.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-brand-light/20 border-t-brand-light rounded-full animate-spin"></div>
      </div>
    );
  }

  const isLecturer = ['lecturer', 'admin'].includes(user.role);

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold text-slate-800">My Kampus Examination Board</h2>
        <p className="text-slate-500 text-xs font-medium">Create assessments, edit questionnaire papers, and review autograded exam sheets.</p>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded text-red-700 text-xs font-semibold">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 border-l-4 border-brand-emerald rounded text-brand-medium text-xs font-semibold">
          {successMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: Exam List & Submissions */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Exam listings */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Exam Papers</h3>
            
            {exams.length === 0 ? (
              <p className="text-slate-400 text-xs py-8 text-center">No exams registered in course syllabus.</p>
            ) : (
              <div className="space-y-4">
                {exams.map((ex) => {
                  // Find student's attempt if they are a student
                  const studentAttempt = attempts.find(att => att.exam === ex.id);
                  return (
                    <div key={ex.id} className="p-4 bg-slate-50 rounded-xl border border-slate-150 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-bold text-sm text-slate-800">{ex.title}</h4>
                          <span className="text-xs text-slate-400">({ex.course_code})</span>
                        </div>
                        <p className="text-xs text-slate-550">Duration: {ex.duration_minutes} minutes · By {ex.lecturer_name} · Questions: <span className="font-semibold text-slate-700">{ex.questions_count}</span></p>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-center">
                        {isLecturer ? (
                          <>
                            <button
                              onClick={() => handleSelectExamForQuestions(ex)}
                              className="px-3 py-1.5 bg-white hover:bg-slate-100 text-brand-light text-xs font-bold rounded-lg border border-slate-200 transition-all"
                            >
                              Edit Questions
                            </button>
                            <button
                              onClick={() => handleToggleActive(ex)}
                              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${ex.is_active ? 'bg-red-50 hover:bg-red-100 text-red-600' : 'bg-brand-light hover:bg-brand-medium text-white'}`}
                            >
                              {ex.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                          </>
                        ) : (
                          /* Student Actions */
                          studentAttempt ? (
                            studentAttempt.completed_at ? (
                              <div className="text-right">
                                <span className="text-[10px] text-slate-400 block font-semibold">Grade Score</span>
                                <span className={`inline-block px-2.5 py-0.5 rounded text-xs font-bold border ${studentAttempt.score >= 50 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                                  {studentAttempt.score}%
                                </span>
                              </div>
                            ) : (
                              <button
                                onClick={() => router.push(`/dashboard/exams/${ex.id}`)}
                                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-650 text-white text-xs font-bold rounded-lg shadow-sm transition-all"
                              >
                                Resume Taking
                              </button>
                            )
                          ) : (
                            <button
                              onClick={() => startStudentExam(ex.id)}
                              disabled={ex.questions_count === 0}
                              className="px-4 py-1.5 bg-brand-light hover:bg-brand-medium text-white text-xs font-bold rounded-lg shadow-sm transition-all disabled:opacity-50 disabled:pointer-events-none"
                            >
                              Start Exam
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Graded Attempts Spreadsheet (Visible to Lecturers/Staff) */}
          {isLecturer && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Student Graded Submissions</h3>
              
              {allAttempts.length === 0 ? (
                <p className="text-slate-400 text-xs py-8 text-center">No student attempt files registered yet.</p>
              ) : (
                <div className="overflow-x-auto custom-scrollbar border border-slate-100 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-slate-450 uppercase font-semibold">
                        <th className="px-4 py-3">Student</th>
                        <th className="px-4 py-3">Exam Paper</th>
                        <th className="px-4 py-3">Course</th>
                        <th className="px-4 py-3">Submission Date</th>
                        <th className="px-4 py-3 text-center">Auto-Grade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-650">
                      {allAttempts.map((att) => (
                        <tr key={att.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3.5 font-bold text-slate-800">{att.student_name}</td>
                          <td className="px-4 py-3.5">{att.exam_title}</td>
                          <td className="px-4 py-3.5">{att.exam_course_code}</td>
                          <td className="px-4 py-3.5">
                            {att.completed_at ? new Date(att.completed_at).toLocaleString() : 'In Progress'}
                          </td>
                          <td className="px-4 py-3.5 text-center flex justify-center items-center space-x-2">
                            {att.completed_at ? (
                              <>
                                <span className={`px-2 py-0.5 rounded font-bold border ${att.score >= 50 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                                  {att.score}%
                                </span>
                                <button
                                  onClick={() => router.push(`/dashboard/exams/${att.exam}/results?attemptId=${att.id}`)}
                                  className="text-brand-light hover:text-brand-medium font-bold text-[10px] underline ml-2"
                                >
                                  View Scorecard
                                </button>
                              </>
                            ) : (
                              <span className="text-slate-400 italic">Incomplete</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Right Side Control Panel */}
        <div className="space-y-6">
          
          {isLecturer ? (
            /* Lecturer: Create Exam and Manage Questions */
            <>
              {/* Question Editor */}
              {selectedExam ? (
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4 animate-slide-up">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <div>
                      <h4 className="font-bold text-sm text-slate-800">Add Questions</h4>
                      <p className="text-[10px] text-slate-500">Exam: {selectedExam.title}</p>
                    </div>
                    <button
                      onClick={() => setSelectedExam(null)}
                      className="text-xs text-slate-400 hover:text-slate-600 font-semibold"
                    >
                      Close Editor
                    </button>
                  </div>

                  {/* Questionnaire List */}
                  <div className="space-y-2 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                    {questions.length === 0 ? (
                      <p className="text-slate-400 text-center text-[10px] py-4">No questions added yet.</p>
                    ) : (
                      questions.map((q, idx) => (
                        <div key={q.id} className="p-2 bg-slate-50 rounded border border-slate-100 text-[11px] space-y-1">
                          <p className="font-semibold text-slate-800">Q{idx + 1}: {q.question_text}</p>
                          <p className="text-slate-500 font-medium">A: {q.option_a} | B: {q.option_b} | C: {q.option_c} | D: {q.option_d}</p>
                          <span className="font-bold text-brand-medium">Correct Option: {q.correct_option}</span>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add Question Form */}
                  <form onSubmit={handleAddQuestion} className="space-y-3 pt-2 border-t border-slate-100">
                    <div>
                      <label className="block text-slate-700 text-[10px] font-bold uppercase tracking-wider mb-0.5">Question Text</label>
                      <input
                        type="text"
                        value={qText}
                        onChange={(e) => setQText(e.target.value)}
                        placeholder="Type question text..."
                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-brand-light focus:border-brand-light"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-slate-700 text-[10px] font-bold uppercase tracking-wider mb-0.5">Option A</label>
                        <input
                          type="text"
                          value={optA}
                          onChange={(e) => setOptA(e.target.value)}
                          placeholder="Option A"
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-brand-light focus:border-brand-light"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 text-[10px] font-bold uppercase tracking-wider mb-0.5">Option B</label>
                        <input
                          type="text"
                          value={optB}
                          onChange={(e) => setOptB(e.target.value)}
                          placeholder="Option B"
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-brand-light focus:border-brand-light"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 text-[10px] font-bold uppercase tracking-wider mb-0.5">Option C</label>
                        <input
                          type="text"
                          value={optC}
                          onChange={(e) => setOptC(e.target.value)}
                          placeholder="Option C"
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-brand-light focus:border-brand-light"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 text-[10px] font-bold uppercase tracking-wider mb-0.5">Option D</label>
                        <input
                          type="text"
                          value={optD}
                          onChange={(e) => setOptD(e.target.value)}
                          placeholder="Option D"
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-brand-light focus:border-brand-light"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-700 text-[10px] font-bold uppercase tracking-wider mb-0.5">Correct Option</label>
                      <select
                        value={correctOpt}
                        onChange={(e) => setCorrectOpt(e.target.value)}
                        className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-brand-light focus:border-brand-light"
                      >
                        <option value="A">Option A</option>
                        <option value="B">Option B</option>
                        <option value="C">Option C</option>
                        <option value="D">Option D</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-1.5 bg-brand-light hover:bg-brand-medium text-white text-xs font-bold rounded transition-all"
                    >
                      {submitting ? 'Adding...' : 'Add Question'}
                    </button>
                  </form>
                </div>
              ) : (
                /* Create Exam Card */
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Create Course Exam</h3>
                  <form onSubmit={handleCreateExam} className="space-y-3">
                    <div>
                      <label className="block text-slate-700 text-xs font-semibold uppercase tracking-wider mb-1">Select Course</label>
                      <select
                        value={selectedCourse}
                        onChange={(e) => setSelectedCourse(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-brand-light/30 focus:border-brand-light transition-all"
                      >
                        <option value="">Select Course...</option>
                        {courses.map((c) => (
                          <option key={c.id} value={c.id}>[{c.code}] {c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-700 text-xs font-semibold uppercase tracking-wider mb-1">Exam Title</label>
                      <input
                        type="text"
                        value={examTitle}
                        onChange={(e) => setExamTitle(e.target.value)}
                        placeholder="e.g. Mid-Semester Assessment"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-850 text-xs focus:outline-none focus:ring-2 focus:ring-brand-light/30 focus:border-brand-light transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 text-xs font-semibold uppercase tracking-wider mb-1">Duration (Minutes)</label>
                      <input
                        type="number"
                        min={10}
                        max={180}
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-850 text-xs focus:outline-none focus:ring-2 focus:ring-brand-light/30 focus:border-brand-light transition-all"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-2 bg-brand-light hover:bg-brand-medium text-white text-xs font-bold rounded-lg transition-all"
                    >
                      {submitting ? 'Creating...' : 'Create Exam'}
                    </button>
                  </form>
                </div>
              )}
            </>
          ) : (
            /* Student: Quick Instructions */
            <div className="bg-gradient-to-br from-[#0d3d24]/5 to-[#1a5c38]/5 rounded-2xl p-6 border border-[#1a5c38]/10 space-y-4">
              <h3 className="text-sm font-bold text-brand-dark uppercase tracking-wider">Exam Honor Code</h3>
              <div className="text-xs text-slate-650 space-y-3 leading-relaxed">
                <p>1. **No External Assistance**: You must complete the exam entirely by yourself without looking up answers.</p>
                <p>2. **Auto-Submit & Timer**: The exam features an active timer. Once launched, you must complete it before the countdown finishes. If the time expires, your answers will auto-submit.</p>
                <p>3. **Tab Tracking & Page Locking**: Avoid switching browser tabs or minimizing the window during examinations. Security tracking is enabled.</p>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
