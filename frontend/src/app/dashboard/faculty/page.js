'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

export default function FacultyManagementPage() {
  const { user } = useAuth();
  const [faculties, setFaculties] = useState([]);
  const [courses, setCourses] = useState([]);
  const [courseUnits, setCourseUnits] = useState([]);
  const [lecturers, setLecturers] = useState([]);
  const [deans, setDeans] = useState([]);
  const [secretaries, setSecretaries] = useState([]);
  const [classTimetables, setClassTimetables] = useState([]);
  const [loading, setLoading] = useState(true);

  // Active Tab: 'timetables', 'faculties', 'assignments'
  const [activeTab, setActiveTab] = useState('timetables');

  // Form State (Assign Lecturer to Unit)
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [selectedLecturerId, setSelectedLecturerId] = useState('');

  // Form State (Create/Edit Faculty)
  const [showFacultyModal, setShowFacultyModal] = useState(false);
  const [editingFaculty, setEditingFaculty] = useState(null);
  const [facultyFormData, setFacultyFormData] = useState({
    name: '',
    code: '',
    description: '',
    dean: '',
    secretary: ''
  });

  // CSV Import State
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [csvText, setCsvText] = useState('');
  const [csvTargetCourse, setCsvTargetCourse] = useState('');

  // Form State (Create Class Timetable)
  const [showTimetableModal, setShowTimetableModal] = useState(false);
  const [ttFormData, setTtFormData] = useState({
    faculty: '',
    course: '',
    course_unit: '',
    lecturer: '',
    day_of_week: 'Monday',
    start_time: '09:00',
    end_time: '11:00',
    room: 'Lecture Hall A',
    class_type: 'lecture'
  });
  
  // Filtering
  const [selectedDayFilter, setSelectedDayFilter] = useState('All');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState('All');
  
  // UI Messages
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = user?.role === 'admin';
  const isSecretaryOrStaff = ['faculty_admin', 'admin', 'dean', 'dvc'].includes(user?.role);
  const isStudent = user?.role === 'student';
  const canAssignLecturer = ['admin', 'faculty_admin'].includes(user?.role);

  useEffect(() => {
    loadFacultyData();
  }, []);

  async function loadFacultyData() {
    try {
      setLoading(true);
      const [facs, crs, units, users, timetables] = await Promise.all([
        api.get('/faculties/').catch(() => []),
        api.get('/courses/').catch(() => []),
        api.get('/course-units/').catch(() => []),
        api.get('/admin/users/').catch(() => []),
        api.get('/class-timetables/').catch(() => [])
      ]);
      setFaculties(facs || []);
      setCourses(crs || []);
      setCourseUnits(units || []);
      const userList = users || [];
      setLecturers(userList.filter(u => u.role === 'lecturer'));
      setDeans(userList.filter(u => u.role === 'dean'));
      setSecretaries(userList.filter(u => u.role === 'faculty_admin'));
      setClassTimetables(timetables || []);
      
      if (facs.length > 0 && !ttFormData.faculty) {
        setTtFormData(prev => ({ ...prev, faculty: facs[0].id }));
      }
      if (crs.length > 0 && !csvTargetCourse) {
        setCsvTargetCourse(crs[0].code);
      }
    } catch (err) {
      setErrorMsg('Failed to load faculty datasets.');
    } finally {
      setLoading(false);
    }
  }

  // --- CSV Upload Handler ---
  const handleUploadCsvUnits = async (e) => {
    e.preventDefault();
    if (!csvFile && !csvText.trim()) {
      setErrorMsg('Please select a CSV file or paste CSV unit data.');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      const formData = new FormData();
      if (csvFile) {
        formData.append('file', csvFile);
      } else {
        formData.append('csv_text', csvText);
      }
      if (csvTargetCourse) {
        formData.append('course_code', csvTargetCourse);
      }

      const res = await api.post('/course-units/upload_csv/', formData);
      setSuccessMsg(res.detail || 'Course units imported from CSV successfully!');
      setShowCsvModal(false);
      setCsvFile(null);
      setCsvText('');
      loadFacultyData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to import CSV course units.');
    } finally {
      setSubmitting(false);
    }
  };

  const downloadSampleCsv = (type = 'curriculum') => {
    let sample = '';
    let filename = '';
    if (type === 'curriculum') {
      sample = "Year,Semester,Course Code,Course Name,Credit Units\nYear 1,Semester 1,BML 1101-T,ENGLISH LANGUAGE AND SCIENTIFIC WRITING,3\nYear 1,Semester 1,BML 1102-T,HUMAN ANATOMY I,3\nYear 1,Semester 1,BML 1103-T,MEDICAL PHYSIOLOGY I,3\nYear 1,Semester 1,BML 1104-T,MEDICAL BIOCHEMISTRY I,4";
      filename = "sample_curriculum_units.csv";
    } else {
      sample = "code,name,credit_units,course_code\nBIT2104,Cloud Infrastructure Systems,4,BIT2026\nBIT2105,Cybersecurity & Cryptography Principles,3,BIT2026\nBSE2203,DevOps & Continuous Integration,4,BSE2026\nBSN1103,Pharmacology & Medical Admin,4,BSN2026";
      filename = "sample_course_units.csv";
    }
    const blob = new Blob([sample], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  };

  // --- Faculty CRUD Handlers (Admin) ---
  const handleOpenFacultyModal = (fac = null) => {
    setErrorMsg('');
    setSuccessMsg('');
    if (fac) {
      setEditingFaculty(fac);
      setFacultyFormData({
        name: fac.name,
        code: fac.code,
        description: fac.description || '',
        dean: fac.dean || '',
        secretary: fac.secretary || ''
      });
    } else {
      setEditingFaculty(null);
      setFacultyFormData({
        name: '',
        code: '',
        description: '',
        dean: '',
        secretary: ''
      });
    }
    setShowFacultyModal(true);
  };

  const handleSaveFaculty = async (e) => {
    e.preventDefault();
    if (!facultyFormData.name || !facultyFormData.code) {
      setErrorMsg('Faculty Name and Code are required.');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      const payload = {
        name: facultyFormData.name,
        code: facultyFormData.code,
        description: facultyFormData.description,
        dean: facultyFormData.dean ? parseInt(facultyFormData.dean) : null,
        secretary: facultyFormData.secretary ? parseInt(facultyFormData.secretary) : null
      };

      if (editingFaculty) {
        await api.patch(`/faculties/${editingFaculty.id}/`, payload);
        setSuccessMsg(`Faculty ${facultyFormData.code} updated successfully!`);
      } else {
        await api.post('/faculties/', payload);
        setSuccessMsg(`Faculty ${facultyFormData.code} created successfully!`);
      }
      setShowFacultyModal(false);
      loadFacultyData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save faculty details.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteFaculty = async (facultyId, facultyCode) => {
    if (!confirm(`Are you sure you want to delete Faculty ${facultyCode}?`)) return;
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await api.delete(`/faculties/${facultyId}/`);
      setSuccessMsg(`Faculty ${facultyCode} deleted successfully.`);
      loadFacultyData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to delete faculty.');
    }
  };

  const handleAssignDeanAction = async (facultyId, deanId) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await api.post(`/faculties/${facultyId}/assign_dean/`, {
        dean_id: deanId ? parseInt(deanId) : null
      });
      setSuccessMsg(res.detail || 'Dean assignment updated.');
      loadFacultyData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update Dean assignment.');
    }
  };

  const handleAssignSecretaryAction = async (facultyId, secretaryId) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await api.post(`/faculties/${facultyId}/assign_secretary/`, {
        secretary_id: secretaryId ? parseInt(secretaryId) : null
      });
      setSuccessMsg(res.detail || 'Faculty Secretary assignment updated.');
      loadFacultyData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update Faculty Secretary assignment.');
    }
  };

  // --- Lecturer Assignment & Timetable Handlers ---
  const handleAssignLecturer = async (e) => {
    e.preventDefault();
    if (!selectedUnit || !selectedLecturerId) {
      setErrorMsg('Please select a course unit and a lecturer.');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      const res = await api.post(`/course-units/${selectedUnit.id}/assign_lecturer/`, {
        lecturer_id: parseInt(selectedLecturerId),
        action: 'assign'
      });
      setSuccessMsg(res.detail || 'Lecturer assigned successfully!');
      setSelectedUnit(null);
      setSelectedLecturerId('');
      loadFacultyData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to assign lecturer.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnassignLecturer = async (unitId, lecturerId) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await api.post(`/course-units/${unitId}/assign_lecturer/`, {
        lecturer_id: parseInt(lecturerId),
        action: 'unassign'
      });
      setSuccessMsg(res.detail || 'Lecturer unassigned.');
      loadFacultyData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to unassign lecturer.');
    }
  };

  const handleCreateTimetable = async (e) => {
    e.preventDefault();
    if (!ttFormData.faculty || !ttFormData.course || !ttFormData.lecturer) {
      setErrorMsg('Faculty, Course, and Lecturer are required for timetabling.');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      const payload = {
        faculty: parseInt(ttFormData.faculty),
        course: parseInt(ttFormData.course),
        course_unit: ttFormData.course_unit ? parseInt(ttFormData.course_unit) : null,
        lecturer: parseInt(ttFormData.lecturer),
        day_of_week: ttFormData.day_of_week,
        start_time: ttFormData.start_time.length === 5 ? `${ttFormData.start_time}:00` : ttFormData.start_time,
        end_time: ttFormData.end_time.length === 5 ? `${ttFormData.end_time}:00` : ttFormData.end_time,
        room: ttFormData.room,
        class_type: ttFormData.class_type
      };

      await api.post('/class-timetables/', payload);
      setSuccessMsg('Class timetable slot published successfully!');
      setShowTimetableModal(false);
      loadFacultyData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create class timetable slot.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTimetable = async (id) => {
    if (!confirm('Are you sure you want to delete this timetable entry?')) return;
    try {
      await api.delete(`/class-timetables/${id}/`);
      setSuccessMsg('Class timetable slot removed.');
      loadFacultyData();
    } catch (err) {
      setErrorMsg('Failed to delete timetable slot.');
    }
  };

  // Filter timetables according to day filter and course filter
  const filteredTimetables = classTimetables.filter(tt => {
    if (selectedDayFilter !== 'All' && tt.day_of_week !== selectedDayFilter) return false;
    if (selectedCourseFilter !== 'All' && tt.course_code !== selectedCourseFilter) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-brand-light/20 border-t-brand-light rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-850">
            {isStudent ? 'My Course Class Timetable' : 'Faculty & Class Timetabling Portal'}
          </h2>
          <p className="text-slate-500 text-xs font-medium">
            {isStudent ? 'Weekly schedule for your designated course program.' : 'Faculty Administration, Course assignments, Leadership allocation, and timetable management.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isSecretaryOrStaff && (
            <button
              onClick={() => setShowCsvModal(true)}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
            >
              📤 Upload CSV Units Package
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => handleOpenFacultyModal(null)}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
            >
              + Create New Faculty
            </button>
          )}
          {isSecretaryOrStaff && (
            <button
              onClick={() => setShowTimetableModal(true)}
              className="px-4 py-2 bg-brand-light hover:bg-brand-medium text-white text-xs font-bold rounded-xl shadow-sm transition-all"
            >
              + Create Class Timetable Slot
            </button>
          )}
          <div className="bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-xl text-xs text-indigo-800 font-bold uppercase">
            {user.role.replace('_', ' ')}
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 bg-red-50 border-l-4 border-red-500 rounded-xl text-red-800 text-xs font-bold flex items-center justify-between shadow-sm animate-slide-up">
          <div className="flex items-center space-x-2">
            <span>⚠️ {errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-red-600 hover:text-red-900 font-bold text-xs">✕</button>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border-l-4 border-emerald-500 rounded-xl text-emerald-800 text-xs font-bold flex items-center justify-between shadow-sm animate-slide-up">
          <div className="flex items-center space-x-2">
            <span>✅ {successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-600 hover:text-emerald-900 font-bold text-xs">✕</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 space-x-4">
        <button
          onClick={() => setActiveTab('timetables')}
          className={`pb-3 text-xs font-bold border-b-2 transition-all ${activeTab === 'timetables' ? 'border-brand-light text-brand-dark' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          📅 Class Timetables ({filteredTimetables.length})
        </button>
        <button
          onClick={() => setActiveTab('faculties')}
          className={`pb-3 text-xs font-bold border-b-2 transition-all ${activeTab === 'faculties' ? 'border-brand-light text-brand-dark' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          🏛️ Faculties & Leadership ({faculties.length})
        </button>
        <button
          onClick={() => setActiveTab('assignments')}
          className={`pb-3 text-xs font-bold border-b-2 transition-all ${activeTab === 'assignments' ? 'border-brand-light text-brand-dark' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          👨‍🏫 Course Units & Lecturers ({courseUnits.length})
        </button>
      </div>

      {/* TAB 1: CLASS TIMETABLES */}
      {activeTab === 'timetables' && (
        <div className="space-y-6">
          
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-500 uppercase">Day:</span>
                {['All', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day) => (
                  <button
                    key={day}
                    onClick={() => setSelectedDayFilter(day)}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${selectedDayFilter === day ? 'bg-brand-dark text-white shadow-sm' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                  >
                    {day}
                  </button>
                ))}
              </div>

              {/* Course Program Filter Dropdown */}
              <div className="flex items-center space-x-2 border-l border-slate-200 pl-4">
                <span className="text-xs font-bold text-slate-500 uppercase">Course Program:</span>
                <select
                  value={selectedCourseFilter}
                  onChange={(e) => setSelectedCourseFilter(e.target.value)}
                  className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                >
                  <option value="All">All Course Programs</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.code}>[{c.code}] {c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="text-xs text-slate-400 font-medium">
              Showing <span className="font-bold text-slate-800">{filteredTimetables.length}</span> schedule entries
            </div>
          </div>

          {/* Timetable Cards / Grid */}
          {filteredTimetables.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
              <p className="text-slate-400 text-sm font-medium">No class timetables scheduled for this day or course selection.</p>
              {isSecretaryOrStaff && (
                <button
                  onClick={() => setShowTimetableModal(true)}
                  className="mt-4 px-4 py-2 bg-brand-light text-white text-xs font-bold rounded-xl"
                >
                  + Add First Schedule Entry
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTimetables.map((tt) => (
                <div key={tt.id} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-3 relative flex flex-col justify-between hover:shadow-md transition-all">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase bg-brand-emerald/10 text-brand-dark border border-brand-emerald/20">
                        {tt.day_of_week}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {tt.class_type}
                      </span>
                    </div>

                    <h4 className="font-bold text-slate-850 text-base leading-tight">{tt.course_code}: {tt.course_name}</h4>
                    {tt.course_unit_name && (
                      <p className="text-xs text-brand-medium font-semibold pt-1">Unit: {tt.course_unit_name}</p>
                    )}

                    <div className="pt-3 space-y-1 text-xs text-slate-600 font-medium">
                      <p className="flex items-center space-x-1.5">
                        <span>⏰ Time:</span>
                        <span className="font-bold text-slate-800">{tt.start_time} - {tt.end_time}</span>
                      </p>
                      <p className="flex items-center space-x-1.5">
                        <span>📍 Room / Venue:</span>
                        <span className="font-bold text-slate-800">{tt.room}</span>
                      </p>
                      <p className="flex items-center space-x-1.5">
                        <span>👨‍🏫 Lecturer:</span>
                        <span className="font-bold text-slate-800">{tt.lecturer_name || 'Assigned Lecturer'}</span>
                      </p>
                      <p className="flex items-center space-x-1.5">
                        <span>🏛️ Faculty:</span>
                        <span className="font-bold text-slate-800">{tt.faculty_code}</span>
                      </p>
                    </div>
                  </div>

                  {isSecretaryOrStaff && (
                    <div className="pt-3 border-t border-slate-100 flex justify-end">
                      <button
                        onClick={() => handleDeleteTimetable(tt.id)}
                        className="px-2.5 py-1 text-red-600 bg-red-50 hover:bg-red-100 text-[10px] font-bold rounded-lg transition-all"
                      >
                        Delete Slot
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

        </div>
      )}

      {/* TAB 2: FACULTIES & LEADERSHIP */}
      {activeTab === 'faculties' && (
        <div className="space-y-6">
          {isAdmin && (
            <div className="flex justify-between items-center bg-purple-50 p-4 rounded-2xl border border-purple-100">
              <div>
                <h3 className="font-bold text-purple-900 text-sm">System Admin Faculty Controls</h3>
                <p className="text-purple-700 text-xs">Create, update, and delete faculties or allocate Faculty Deans and Faculty Secretaries.</p>
              </div>
              <button
                onClick={() => handleOpenFacultyModal(null)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
              >
                + Create New Faculty
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {faculties.map((fac) => (
              <div key={fac.id} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between hover:shadow-md transition-all">
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase bg-brand-light/10 text-brand-dark border border-brand-light/20">
                      {fac.code}
                    </span>
                    {isAdmin && (
                      <div className="flex space-x-1">
                        <button
                          onClick={() => handleOpenFacultyModal(fac)}
                          className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteFaculty(fac.id, fac.code)}
                          className="px-2 py-0.5 text-[10px] font-bold bg-red-50 hover:bg-red-100 text-red-600 rounded"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>

                  <h3 className="font-bold text-base text-slate-850 leading-tight">{fac.name}</h3>
                  <p className="text-xs text-slate-500 line-clamp-2">{fac.description || 'No description provided.'}</p>
                  
                  {/* Leadership Info */}
                  <div className="pt-2 text-xs space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Faculty Dean</span>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="font-bold text-slate-800">{fac.dean_name || 'Unassigned'}</span>
                      </div>
                    </div>

                    <div className="pt-1 border-t border-slate-200/60">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Faculty Secretary</span>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="font-bold text-slate-800">{fac.secretary_name || 'Unassigned'}</span>
                      </div>
                    </div>
                  </div>

                  {/* System Admin Quick Assignment Dropdowns */}
                  {isAdmin && (
                    <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Assign / Change Dean</label>
                        <select
                          value={fac.dean || ''}
                          onChange={(e) => handleAssignDeanAction(fac.id, e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                        >
                          <option value="">-- Unassigned --</option>
                          {deans.map(d => (
                            <option key={d.id} value={d.id}>{d.first_name || d.username} {d.last_name} ({d.email})</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Assign / Change Faculty Secretary</label>
                        <select
                          value={fac.secretary || ''}
                          onChange={(e) => handleAssignSecretaryAction(fac.id, e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                        >
                          <option value="">-- Unassigned --</option>
                          {secretaries.map(s => (
                            <option key={s.id} value={s.id}>{s.first_name || s.username} {s.last_name} ({s.email})</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: COURSE UNITS & LECTURERS */}
      {activeTab === 'assignments' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Course Units Table */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-850 uppercase tracking-wider">Faculty Course Units & Assigned Lecturers</h3>
              {isSecretaryOrStaff && (
                <button
                  onClick={() => setShowCsvModal(true)}
                  className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-xs font-bold rounded-lg transition-all"
                >
                  📤 Upload CSV Package
                </button>
              )}
            </div>

            {courseUnits.length === 0 ? (
              <p className="text-slate-400 text-xs py-8 text-center">No course units registered yet.</p>
            ) : (
              <div className="overflow-x-auto custom-scrollbar border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                      <th className="px-4 py-3">Code</th>
                      <th className="px-4 py-3">Unit Name</th>
                      <th className="px-4 py-3">Course Program</th>
                      <th className="px-4 py-3 text-center">Credits</th>
                      <th className="px-4 py-3">Assigned Lecturers</th>
                      {canAssignLecturer && <th className="px-4 py-3 text-center">Action</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {courseUnits.map((unit) => (
                      <tr key={unit.id} className="hover:bg-slate-50 transition-all">
                        <td className="px-4 py-3 font-extrabold text-brand-dark">{unit.code}</td>
                        <td className="px-4 py-3 font-bold text-slate-850">{unit.name}</td>
                        <td className="px-4 py-3">{unit.course_code}</td>
                        <td className="px-4 py-3 text-center font-bold">{unit.credit_units} CU</td>
                        <td className="px-4 py-3">
                          {unit.lecturer_details && unit.lecturer_details.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {unit.lecturer_details.map(l => (
                                <span key={l.id} className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center space-x-1">
                                  <span>{l.first_name || l.username} {l.last_name}</span>
                                  {canAssignLecturer && (
                                    <button
                                      onClick={() => handleUnassignLecturer(unit.id, l.id)}
                                      className="text-emerald-700 hover:text-red-600 font-bold ml-1"
                                      title="Unassign lecturer"
                                    >
                                      ✕
                                    </button>
                                  )}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Unassigned</span>
                          )}
                        </td>
                        {canAssignLecturer && (
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => setSelectedUnit(unit)}
                              className="px-2.5 py-1 bg-brand-light text-white text-[10px] font-bold rounded hover:bg-brand-medium"
                            >
                              Assign
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Assign Lecturer Form Modal/Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4 h-fit">
            <h3 className="text-sm font-bold text-slate-850 uppercase tracking-wider">Assign Lecturer to Unit</h3>
            
            {canAssignLecturer ? (
              selectedUnit ? (
                <form onSubmit={handleAssignLecturer} className="space-y-4 animate-slide-up">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1">
                    <p className="font-bold text-slate-800">Unit: {selectedUnit.name}</p>
                    <p className="text-slate-500">Code: {selectedUnit.code} · Program: {selectedUnit.course_code}</p>
                  </div>

                  <div>
                    <label className="block text-slate-700 text-xs font-bold uppercase mb-1">Select Lecturer</label>
                    <select
                      value={selectedLecturerId}
                      onChange={(e) => setSelectedLecturerId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      required
                    >
                      <option value="">Select Lecturer...</option>
                      {lecturers.map((lec) => (
                        <option key={lec.id} value={lec.id}>
                          {lec.first_name || lec.username} {lec.last_name} ({lec.email})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => setSelectedUnit(null)}
                      className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-4 py-1.5 bg-brand-light hover:bg-brand-medium text-white text-xs font-bold rounded-lg shadow-sm"
                    >
                      {submitting ? 'Assigning...' : 'Confirm Assignment'}
                    </button>
                  </div>
                </form>
              ) : (
                <p className="text-slate-400 text-xs text-center py-10">
                  Select a Course Unit from the list on the left to assign a Lecturer.
                </p>
              )
            ) : (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500 font-medium">
                🔒 Lecturer assignments are managed exclusively by System Administrators and Faculty Secretaries.
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: UPLOAD CSV COURSE UNITS */}
      {showCsvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-850">Upload Course Units CSV Package</h3>
              <button onClick={() => setShowCsvModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleUploadCsvUnits} className="space-y-4 text-xs">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2 text-emerald-800">
                <p className="font-bold">Supported CSV Header Formats:</p>
                <div className="space-y-1 font-mono text-[11px]">
                  <code className="block bg-white px-2 py-0.5 rounded border border-emerald-200">Year,Semester,Course Code,Course Name,Credit Units</code>
                  <code className="block bg-white px-2 py-0.5 rounded border border-emerald-200">code,name,credit_units,course_code</code>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1">Target Course Program (If missing from CSV)</label>
                <select
                  value={csvTargetCourse}
                  onChange={(e) => setCsvTargetCourse(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-xs"
                >
                  {courses.map(c => (
                    <option key={c.id} value={c.code}>[{c.code}] {c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1">Select CSV File</label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setCsvFile(e.target.files[0])}
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-brand-light/10 file:text-brand-dark hover:file:bg-brand-light/20"
                />
              </div>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-3 text-slate-400 text-[10px] uppercase font-bold">Or Paste Raw CSV</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              <div>
                <textarea
                  rows={4}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder="Year,Semester,Course Code,Course Name,Credit Units&#10;Year 1,Semester 1,BML 1101-T,ENGLISH LANGUAGE AND SCIENTIFIC WRITING,3"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px] resize-none"
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => downloadSampleCsv('curriculum')}
                    className="text-brand-light hover:text-brand-medium text-[11px] font-bold underline"
                  >
                    📥 Sample Curriculum CSV
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => downloadSampleCsv('standard')}
                    className="text-brand-light hover:text-brand-medium text-[11px] font-bold underline"
                  >
                    📥 Standard CSV
                  </button>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowCsvModal(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md"
                  >
                    {submitting ? 'Importing...' : 'Upload & Import Units'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE / EDIT FACULTY (ADMIN) */}
      {showFacultyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-850">
                {editingFaculty ? `Edit Faculty: ${editingFaculty.code}` : 'Create New Faculty'}
              </h3>
              <button onClick={() => setShowFacultyModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleSaveFaculty} className="space-y-4 text-xs">
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Faculty Code</label>
                  <input
                    type="text"
                    value={facultyFormData.code}
                    onChange={(e) => setFacultyFormData({ ...facultyFormData, code: e.target.value })}
                    placeholder="e.g. FoST, FHS"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold uppercase"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Faculty Name</label>
                  <input
                    type="text"
                    value={facultyFormData.name}
                    onChange={(e) => setFacultyFormData({ ...facultyFormData, name: e.target.value })}
                    placeholder="Faculty of Science & Technology"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1">Description</label>
                <textarea
                  rows={3}
                  value={facultyFormData.description}
                  onChange={(e) => setFacultyFormData({ ...facultyFormData, description: e.target.value })}
                  placeholder="Optional description of the faculty..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Assign Faculty Dean</label>
                  <select
                    value={facultyFormData.dean}
                    onChange={(e) => setFacultyFormData({ ...facultyFormData, dean: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="">-- Unassigned --</option>
                    {deans.map(d => (
                      <option key={d.id} value={d.id}>{d.first_name || d.username} {d.last_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Assign Faculty Secretary</label>
                  <select
                    value={facultyFormData.secretary}
                    onChange={(e) => setFacultyFormData({ ...facultyFormData, secretary: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="">-- Unassigned --</option>
                    {secretaries.map(s => (
                      <option key={s.id} value={s.id}>{s.first_name || s.username} {s.last_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowFacultyModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-md"
                >
                  {submitting ? 'Saving...' : editingFaculty ? 'Save Changes' : 'Create Faculty'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE CLASS TIMETABLE */}
      {showTimetableModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-850">Publish Class Timetable Slot</h3>
              <button onClick={() => setShowTimetableModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleCreateTimetable} className="space-y-4 text-xs">
              
              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1">Faculty</label>
                <select
                  value={ttFormData.faculty}
                  onChange={(e) => setTtFormData({ ...ttFormData, faculty: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  required
                >
                  <option value="">Select Faculty...</option>
                  {faculties.map(f => (
                    <option key={f.id} value={f.id}>{f.code} - {f.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Course Program</label>
                  <select
                    value={ttFormData.course}
                    onChange={(e) => setTtFormData({ ...ttFormData, course: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                    required
                  >
                    <option value="">Select Course...</option>
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Course Unit (Optional)</label>
                  <select
                    value={ttFormData.course_unit}
                    onChange={(e) => setTtFormData({ ...ttFormData, course_unit: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="">Select Unit...</option>
                    {courseUnits.map(u => (
                      <option key={u.id} value={u.id}>{u.code} - {u.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1">Assigned Lecturer</label>
                <select
                  value={ttFormData.lecturer}
                  onChange={(e) => setTtFormData({ ...ttFormData, lecturer: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  required
                >
                  <option value="">Select Lecturer...</option>
                  {lecturers.map(l => (
                    <option key={l.id} value={l.id}>{l.first_name || l.username} {l.last_name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Day of Week</label>
                  <select
                    value={ttFormData.day_of_week}
                    onChange={(e) => setTtFormData({ ...ttFormData, day_of_week: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Start Time</label>
                  <input
                    type="time"
                    value={ttFormData.start_time}
                    onChange={(e) => setTtFormData({ ...ttFormData, start_time: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">End Time</label>
                  <input
                    type="time"
                    value={ttFormData.end_time}
                    onChange={(e) => setTtFormData({ ...ttFormData, end_time: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Room / Venue</label>
                  <input
                    type="text"
                    value={ttFormData.room}
                    onChange={(e) => setTtFormData({ ...ttFormData, room: e.target.value })}
                    placeholder="e.g. Hall A, Lab 2"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Class Type</label>
                  <select
                    value={ttFormData.class_type}
                    onChange={(e) => setTtFormData({ ...ttFormData, class_type: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="lecture">Lecture</option>
                    <option value="tutorial">Tutorial</option>
                    <option value="lab">Practical Lab</option>
                    <option value="workshop">Workshop</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowTimetableModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-brand-light hover:bg-brand-medium text-white font-bold rounded-xl shadow-md"
                >
                  {submitting ? 'Publishing...' : 'Publish Timetable Slot'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
