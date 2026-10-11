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

  const isExecutiveReadOnly = ['dvc', 'vc', 'dean'].includes(user?.role);
  const isLecturer = ['lecturer', 'admin'].includes(user?.role) && !isExecutiveReadOnly;

  // Filter assigned courses for Lecturers & Students
  const assignedCourses = user?.role === 'lecturer'
    ? courses.filter(c => courseUnits.some(u => u.course_code === c.code && u.lecturer_details?.some(l => l.id === user.id)))
    : user?.role === 'student'
    ? courses.filter(c => (user?.assigned_courses || []).includes(c.id) || (user?.assigned_course_codes || []).includes(c.code) || (!user?.assigned_courses?.length && (c.faculty === user?.faculty || c.faculty_code === user?.faculty_code)))
    : courses;

  const filteredContents = user?.role === 'student'
    ? contents.filter(item => {
        const assignedIds = user?.assigned_courses || [];
        const assignedCodes = user?.assigned_course_codes || [];
        if (assignedIds.length > 0 || assignedCodes.length > 0) {
          return assignedIds.includes(item.course) || assignedCodes.includes(item.course_code);
        }
        return true;
      })
    : contents;

  const handleUploadContent = async (e) => {
    e.preventDefault();
    if (isExecutiveReadOnly) return;
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
    if (isExecutiveReadOnly) return;
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
    if (isExecutiveReadOnly) return;
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

  return (
    <div className="space-y-8 animate-fade-in max-w-6xl mx-auto">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Classroom Lecture Resources</h2>
          <p className="text-slate-500 text-xs font-medium">Access lecture materials, syllabus files, and course resources for your assigned programs.</p>
        </div>
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

      {/* Classroom Attendance Temporary Suspension Notice */}
      <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl flex items-center space-x-3 text-amber-900 text-xs font-semibold">
        <span className="text-xl">ℹ️</span>
        <div>
          <span className="font-extrabold block uppercase tracking-wider text-[11px]">Classroom Attendance Notice</span>
          <span>Classroom attendance tracking features have been temporarily suspended until restored by university administration. Lecture reading resources remain fully operational below.</span>
        </div>
      </div>

      {/* Grid panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: Materials List */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Class Materials List */}
          <div className="green-card rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Lecture Resources & Files</h3>
            
            {filteredContents.length === 0 ? (
              <p className="text-slate-400 text-xs py-8 text-center">No reading resources posted yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredContents.map((item) => (
                  <div key={item.id} className="p-4 bg-gradient-to-br from-white to-emerald-50/20 rounded-xl border border-emerald-200/80 flex flex-col justify-between space-y-3 hover:border-emerald-300 transition-all">
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
                        className="w-full text-center py-2 bg-white hover:bg-emerald-50 text-brand-light hover:text-brand-medium text-xs font-bold rounded-lg border border-emerald-200 transition-all block shadow-sm"
                      >
                        Open Resource Link
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Upload Resource File */}
        <div className="space-y-8">
          {isLecturer && !isExecutiveReadOnly && (
            <div className="green-card rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Upload Course Resource</h3>
              
              <form onSubmit={handleUploadContent} className="space-y-3">
                <div>
                  <label className="block text-slate-700 text-xs font-bold uppercase mb-1">Target Course</label>
                  <select
                    value={selectedCourse}
                    onChange={(e) => setSelectedCourse(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                    required
                  >
                    <option value="">Select Course...</option>
                    {assignedCourses.map((c) => (
                      <option key={c.id} value={c.id}>[{c.code}] {c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 text-xs font-bold uppercase mb-1">Resource Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Week 4 Lecture Notes: Data Structures"
                    value={contentTitle}
                    onChange={(e) => setContentTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 text-xs font-bold uppercase mb-1">Attachment URL / Link</label>
                  <input
                    type="url"
                    placeholder="https://drive.google.com/... or https://..."
                    value={contentLink}
                    onChange={(e) => setContentLink(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 text-xs font-bold uppercase mb-1">Description</label>
                  <textarea
                    rows={3}
                    placeholder="Brief notes for students..."
                    value={contentDesc}
                    onChange={(e) => setContentDesc(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2 bg-brand-light hover:bg-brand-medium text-white text-xs font-bold rounded-lg shadow-sm transition-all"
                >
                  {submitting ? 'Uploading...' : 'Publish Resource'}
                </button>
              </form>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
