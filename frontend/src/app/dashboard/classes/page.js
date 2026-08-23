'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

export default function ClassesPage() {
  const { user } = useAuth();
  const [contents, setContents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [courseUnits, setCourseUnits] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form states (Lecturer upload content)
  const [contentTitle, setContentTitle] = useState('');
  const [contentDesc, setContentDesc] = useState('');
  const [contentLink, setContentLink] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  
  // Form states (Lecturer open attendance)
  const [attendanceCourse, setAttendanceCourse] = useState('');
  const [openedCode, setOpenedCode] = useState('');
  
  // Form states (Student check-in)
  const [checkInSession, setCheckInSession] = useState('');
  const [checkInCode, setCheckInCode] = useState('');

  // UI notifications
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadClassroomData();
  }, []);

  async function loadClassroomData() {
    try {
      setLoading(true);
      const [contentsData, coursesData, unitsData, sessionsData] = await Promise.all([
        api.get('/contents/').catch(() => []),
        api.get('/courses/').catch(() => []),
        api.get('/course-units/').catch(() => []),
        api.get('/attendance/sessions/').catch(() => [])
      ]);
      setContents(contentsData || []);
      setCourses(coursesData || []);
      setCourseUnits(unitsData || []);
      setSessions(sessionsData || []);
    } catch (err) {
      setErrorMsg('Failed to load classroom files and sessions.');
    } finally {
      setLoading(false);
    }
  }

  // Filter assigned courses for Lecturers
  const assignedCourses = user?.role === 'lecturer'
    ? courses.filter(c => courseUnits.some(u => u.course_code === c.code && u.lecturer_details?.some(l => l.id === user.id)))
    : courses;

  const handleUploadContent = async (e) => {
    e.preventDefault();
    if (!contentTitle || !selectedCourse) {
      setErrorMsg('Please specify a title and select a course.');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      await api.post('/contents/', {
        title: contentTitle,
        description: contentDesc,
        attachment_url: contentLink,
        course: parseInt(selectedCourse)
      });
      setSuccessMsg('Class content uploaded successfully!');
      setContentTitle('');
      setContentDesc('');
      setContentLink('');
      setSelectedCourse('');
      loadClassroomData();
    } catch (err) {
      setErrorMsg(err.message || 'Content upload failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartAttendance = async (e) => {
    e.preventDefault();
    if (!attendanceCourse) {
      setErrorMsg('Please select a course to log attendance.');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      const session = await api.post('/attendance/sessions/', {
        course: parseInt(attendanceCourse)
      });
      setOpenedCode(session.code);
      setSuccessMsg(`Attendance window opened successfully! Code: ${session.code}`);
      setAttendanceCourse('');
      loadClassroomData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to start attendance session.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStudentCheckIn = async (e) => {
    e.preventDefault();
    if (!checkInSession || !checkInCode) {
      setErrorMsg('Please select a class session and enter the verification code.');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      await api.post('/attendance/sessions/check_in/', {
        session_id: parseInt(checkInSession),
        code: checkInCode
      });
      setSuccessMsg('Attendance checked in successfully! Marked present.');
      setCheckInSession('');
      setCheckInCode('');
      loadClassroomData();
    } catch (err) {
      setErrorMsg(err.message || 'Check-in failed. Please verify the code.');
    } finally {
      setSubmitting(false);
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
        <h2 className="text-xl font-bold text-slate-800">Classroom Content & Attendance</h2>
        <p className="text-slate-500 text-xs font-medium">Access lecture materials and verify daily attendance for your assigned courses.</p>
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

      {/* Grid panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: Materials & Session List */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Class Materials List */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Lecture Resources & Files</h3>
            
            {contents.length === 0 ? (
              <p className="text-slate-400 text-xs py-8 text-center">No reading resources posted yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {contents.map((item) => (
                  <div key={item.id} className="p-4 bg-slate-50 rounded-xl border border-slate-150 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] bg-brand-light/10 text-brand-medium font-bold px-2 py-0.5 rounded border border-brand-light/20">
                          {item.course_code}
                        </span>
                        <span className="text-[10px] text-slate-400">{new Date(item.created_at).toLocaleDateString()}</span>
                      </div>
                      <h4 className="font-bold text-slate-800 text-sm mt-2">{item.title}</h4>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-3">{item.description}</p>
                    </div>
                    {item.attachment_url && (
                      <a
                        href={item.attachment_url}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full text-center py-2 bg-white hover:bg-slate-100 text-brand-light hover:text-brand-medium text-xs font-bold rounded-lg border border-slate-200 transition-all block"
                      >
                        Open Resource Link
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Attendance Sessions (Lecturers/Staff list) */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Attendance Register Sessions</h3>
            
            {sessions.length === 0 ? (
              <p className="text-slate-400 text-xs py-8 text-center">No attendance sessions registered.</p>
            ) : (
              <div className="space-y-3">
                {sessions.map((sess) => (
                  <div key={sess.id} className="p-3 bg-slate-50 border border-slate-150 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <h5 className="font-bold text-slate-850">Class Session - {sess.course_code}</h5>
                      <p className="text-slate-450 text-[10px] mt-0.5">Lecturer: {sess.lecturer_name} · Date: {new Date(sess.created_at).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center space-x-3">
                      {isLecturer && (
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block">Attendance Code</span>
                          <strong className="text-sm font-mono text-brand-medium bg-white px-2 py-0.5 rounded border border-slate-200">{sess.code}</strong>
                        </div>
                      )}
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${sess.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-100 animate-pulse-slow' : 'bg-slate-200 text-slate-500 border-slate-350'}`}>
                        {sess.is_active ? 'Active' : 'Closed'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Right Side Control Panel */}
        <div className="space-y-6">
          
          {isLecturer ? (
            /* Lecturer Forms: Share Content & Open Attendance */
            <>
              {/* Start Attendance Card */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Open Attendance Code</h3>
                
                {user.role === 'lecturer' && assignedCourses.length === 0 && (
                  <div className="p-3 bg-amber-50 border-l-4 border-amber-500 rounded text-amber-800 text-xs font-semibold">
                    Notice: You are not assigned to any course units. Contact your Faculty Secretary for assignment.
                  </div>
                )}

                <form onSubmit={handleStartAttendance} className="space-y-4">
                  <div>
                    <label className="block text-slate-700 text-xs font-semibold uppercase tracking-wider mb-1">Select Course Program</label>
                    <select
                      value={attendanceCourse}
                      onChange={(e) => setAttendanceCourse(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-brand-light/30 focus:border-brand-light transition-all"
                      required
                    >
                      <option value="">Select Course...</option>
                      {assignedCourses.map((c) => (
                        <option key={c.id} value={c.id}>[{c.code}] {c.name}</option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2 bg-brand-light hover:bg-brand-medium text-white text-xs font-bold rounded-lg transition-all"
                  >
                    {submitting ? 'Creating...' : 'Open Session'}
                  </button>
                </form>

                {openedCode && (
                  <div className="p-4 bg-brand-light/5 border border-brand-light/20 rounded-xl text-center space-y-1">
                    <span className="text-[10px] text-brand-medium font-semibold uppercase tracking-wider">Class Verification Code</span>
                    <h4 className="text-3xl font-extrabold font-mono text-brand-dark tracking-widest">{openedCode}</h4>
                    <p className="text-[9px] text-slate-450">Display this code to students present in the classroom lecture.</p>
                  </div>
                )}
              </div>

              {/* Upload Content Card */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Share Lecture Resources</h3>
                <form onSubmit={handleUploadContent} className="space-y-3">
                  <div>
                    <label className="block text-slate-700 text-xs font-semibold uppercase tracking-wider mb-1">Course Program</label>
                    <select
                      value={selectedCourse}
                      onChange={(e) => setSelectedCourse(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-brand-light/30 focus:border-brand-light transition-all"
                      required
                    >
                      <option value="">Select Course...</option>
                      {assignedCourses.map((c) => (
                        <option key={c.id} value={c.id}>[{c.code}] {c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 text-xs font-semibold uppercase tracking-wider mb-1">Material Title</label>
                    <input
                      type="text"
                      value={contentTitle}
                      onChange={(e) => setContentTitle(e.target.value)}
                      placeholder="e.g. Lecture Notes 1 - Intro"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-850 text-xs focus:outline-none focus:ring-2 focus:ring-brand-light/30 focus:border-brand-light transition-all"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 text-xs font-semibold uppercase tracking-wider mb-1">Resource Link / PDF URL</label>
                    <input
                      type="url"
                      value={contentLink}
                      onChange={(e) => setContentLink(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-850 text-xs focus:outline-none focus:ring-2 focus:ring-brand-light/30 focus:border-brand-light transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 text-xs font-semibold uppercase tracking-wider mb-1">Notes / Description</label>
                    <textarea
                      rows={3}
                      value={contentDesc}
                      onChange={(e) => setContentDesc(e.target.value)}
                      placeholder="Optional details..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-805 text-xs focus:outline-none focus:ring-2 focus:ring-brand-light/30 focus:border-brand-light transition-all resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2 bg-brand-light hover:bg-brand-medium text-white text-xs font-bold rounded-lg transition-all"
                  >
                    Upload File
                  </button>
                </form>
              </div>
            </>
          ) : (
            /* Student Form: Verify Attendance */
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Log Lecture Attendance</h3>
              <form onSubmit={handleStudentCheckIn} className="space-y-4">
                <div>
                  <label className="block text-slate-700 text-xs font-semibold uppercase tracking-wider mb-1">Active Lecture Session</label>
                  <select
                    value={checkInSession}
                    onChange={(e) => setCheckInSession(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-brand-light/30 focus:border-brand-light transition-all"
                  >
                    <option value="">Select current lecture...</option>
                    {sessions.filter(s => s.is_active).map((s) => (
                      <option key={s.id} value={s.id}>
                        Class session for {s.course_code}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 text-xs font-semibold uppercase tracking-wider mb-1">Verification Code</label>
                  <input
                    type="text"
                    maxLength={6}
                    value={checkInCode}
                    onChange={(e) => setCheckInCode(e.target.value)}
                    placeholder="4-digit code"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-850 text-center font-bold text-lg font-mono focus:outline-none focus:ring-2 focus:ring-brand-light/30 focus:border-brand-light transition-all tracking-widest"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 bg-brand-light hover:bg-brand-medium text-white text-xs font-bold rounded-lg shadow-sm transition-all"
                >
                  Verify check-in
                </button>
              </form>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
