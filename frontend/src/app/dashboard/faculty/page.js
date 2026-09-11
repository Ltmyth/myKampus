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
  const [students, setStudents] = useState([]);
  const [classTimetables, setClassTimetables] = useState([]);
  const [loading, setLoading] = useState(true);

  // Active Tab: 'timetables', 'faculties', 'assignments', 'students'
  const [activeTab, setActiveTab] = useState('timetables');

  // Form State (Assign Lecturer to Unit)
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [selectedLecturerId, setSelectedLecturerId] = useState('');
  const [showAssignModal, setShowAssignModal] = useState(false);

  // Student Enrollment Form State
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [targetFacultyId, setTargetFacultyId] = useState('');
  const [targetCourseIds, setTargetCourseIds] = useState([]);
  const [targetYearOfStudy, setTargetYearOfStudy] = useState(1);
  const [selectedStudentAllocIds, setSelectedStudentAllocIds] = useState([]);
  const [showSingleAllocModal, setShowSingleAllocModal] = useState(false);
  const [showBulkAllocModal, setShowBulkAllocModal] = useState(false);
  const [bulkAllocFacultyId, setBulkAllocFacultyId] = useState('');
  const [bulkAllocYearOfStudy, setBulkAllocYearOfStudy] = useState(1);
  const [bulkAllocCourseIds, setBulkAllocCourseIds] = useState([]);

  // Student Directory Filter & Pagination State
  const [studentSearch, setStudentSearch] = useState('');
  const [studentFacultyFilter, setStudentFacultyFilter] = useState('All');
  const [studentYearFilter, setStudentYearFilter] = useState('All');
  const [studentPage, setStudentPage] = useState(1);
  const [studentPageSize, setStudentPageSize] = useState(10);

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

  // Form State (Create/Edit Course)
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [courseFormData, setCourseFormData] = useState({
    faculty: '',
    name: '',
    code: '',
    description: '',
    department: '',
    duration_years: 3
  });

  // Form State (Create/Edit Course Unit)
  const [showCourseUnitModal, setShowCourseUnitModal] = useState(false);
  const [editingCourseUnit, setEditingCourseUnit] = useState(null);
  const [unitFormData, setUnitFormData] = useState({
    course: '',
    name: '',
    code: '',
    credit_units: 3,
    year_of_study: 1,
    lecturers: []
  });
  const [selectedUnitYearFilter, setSelectedUnitYearFilter] = useState('All');

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
    class_date: '',
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

  const isExecutiveReadOnly = ['dvc', 'vc', 'dean'].includes(user?.role);
  const isAdmin = user?.role === 'admin' && !isExecutiveReadOnly;
  const isSecretaryOrStaff = ['faculty_admin', 'admin'].includes(user?.role) && !isExecutiveReadOnly;
  const isStudent = user?.role === 'student';
  const isLecturer = user?.role === 'lecturer';
  const canAssignLecturer = ['admin', 'faculty_admin'].includes(user?.role) && !isExecutiveReadOnly;

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
      setStudents(userList.filter(u => u.role === 'student'));
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

  const handleAssignStudentToFaculty = async (e) => {
    e.preventDefault();
    if (!selectedStudentId || !targetFacultyId) {
      setErrorMsg('Please select a student and a target faculty.');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      const res = await api.post(`/faculties/${targetFacultyId}/assign_student/`, {
        student_id: parseInt(selectedStudentId),
        course_ids: targetCourseIds.map(id => parseInt(id)),
        year_of_study: parseInt(targetYearOfStudy || 1)
      });
      setSuccessMsg(res.detail || 'Student assigned to faculty, year of study, and courses successfully!');
      setShowSingleAllocModal(false);
      setSelectedStudentId('');
      setTargetCourseIds([]);
      setTargetYearOfStudy(1);
      loadFacultyData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to assign student to faculty.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkStudentAllocSubmit = async (e) => {
    e.preventDefault();
    if (selectedStudentAllocIds.length === 0) {
      setErrorMsg('Please select at least one student user account.');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      const res = await api.post('/admin/users/bulk_assign_year_and_courses/', {
        user_ids: selectedStudentAllocIds,
        year_of_study: parseInt(bulkAllocYearOfStudy || 1),
        faculty_id: bulkAllocFacultyId ? parseInt(bulkAllocFacultyId) : null,
        course_ids: bulkAllocCourseIds ? bulkAllocCourseIds.map(id => parseInt(id)) : []
      });
      setSuccessMsg(res.detail || `Bulk student allocation completed for ${selectedStudentAllocIds.length} accounts!`);
      setShowBulkAllocModal(false);
      setSelectedStudentAllocIds([]);
      loadFacultyData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to apply bulk student allocation.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveStudentFromFaculty = async (facultyId, studentId) => {
    if (!confirm('Are you sure you want to remove this student from the faculty?')) return;
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await api.post(`/faculties/${facultyId}/remove_student/`, {
        student_id: parseInt(studentId)
      });
      setSuccessMsg(res.detail || 'Student removed from faculty.');
      loadFacultyData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to remove student from faculty.');
    }
  };

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

  // --- Course CRUD Handlers ---
  const handleOpenCourseModal = (crs = null) => {
    setErrorMsg('');
    setSuccessMsg('');
    if (crs) {
      setEditingCourse(crs);
      setCourseFormData({
        faculty: crs.faculty || (faculties[0]?.id || ''),
        name: crs.name,
        code: crs.code,
        description: crs.description || '',
        department: crs.department || '',
        duration_years: crs.duration_years || 3
      });
    } else {
      setEditingCourse(null);
      setCourseFormData({
        faculty: faculties[0]?.id || '',
        name: '',
        code: '',
        description: '',
        department: '',
        duration_years: 3
      });
    }
    setShowCourseModal(true);
  };

  const handleSaveCourse = async (e) => {
    e.preventDefault();
    if (!courseFormData.name || !courseFormData.code || !courseFormData.faculty) {
      setErrorMsg('Faculty, Course Name, and Course Code are required.');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      const payload = {
        faculty: parseInt(courseFormData.faculty),
        name: courseFormData.name,
        code: courseFormData.code,
        description: courseFormData.description,
        department: courseFormData.department,
        duration_years: parseInt(courseFormData.duration_years || 3)
      };

      if (editingCourse) {
        await api.patch(`/courses/${editingCourse.id}/`, payload);
        setSuccessMsg(`Course ${courseFormData.code} updated successfully!`);
      } else {
        await api.post('/courses/', payload);
        setSuccessMsg(`Course ${courseFormData.code} created successfully!`);
      }
      setShowCourseModal(false);
      loadFacultyData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save course details.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCourse = async (courseId, courseCode) => {
    if (!confirm(`Are you sure you want to delete Course ${courseCode}? This will also delete all linked course units.`)) return;
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await api.delete(`/courses/${courseId}/`);
      setSuccessMsg(`Course ${courseCode} deleted successfully.`);
      loadFacultyData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to delete course.');
    }
  };

  // --- Course Unit CRUD Handlers ---
  const handleOpenCourseUnitModal = (unit = null) => {
    setErrorMsg('');
    setSuccessMsg('');
    if (unit) {
      setEditingCourseUnit(unit);
      setUnitFormData({
        course: unit.course || (courses[0]?.id || ''),
        name: unit.name,
        code: unit.code,
        credit_units: unit.credit_units || 3,
        year_of_study: unit.year_of_study || 1,
        lecturers: unit.lecturers || (unit.lecturer_details ? unit.lecturer_details.map(l => l.id) : [])
      });
    } else {
      setEditingCourseUnit(null);
      setUnitFormData({
        course: courses[0]?.id || '',
        name: '',
        code: '',
        credit_units: 3,
        year_of_study: 1,
        lecturers: []
      });
    }
    setShowCourseUnitModal(true);
  };

  const handleSaveCourseUnit = async (e) => {
    e.preventDefault();
    if (!unitFormData.name || !unitFormData.code || !unitFormData.course) {
      setErrorMsg('Target Course, Unit Name, and Unit Code are required.');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      const payload = {
        course: parseInt(unitFormData.course),
        name: unitFormData.name,
        code: unitFormData.code,
        credit_units: parseInt(unitFormData.credit_units || 3),
        year_of_study: parseInt(unitFormData.year_of_study || 1),
        lecturers: unitFormData.lecturers ? unitFormData.lecturers.map(id => parseInt(id)) : []
      };

      if (editingCourseUnit) {
        await api.patch(`/course-units/${editingCourseUnit.id}/`, payload);
        setSuccessMsg(`Course Unit ${unitFormData.code} updated successfully!`);
      } else {
        await api.post('/course-units/', payload);
        setSuccessMsg(`Course Unit ${unitFormData.code} created successfully!`);
      }
      setShowCourseUnitModal(false);
      loadFacultyData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save course unit details.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCourseUnit = async (unitId, unitCode) => {
    if (!confirm(`Are you sure you want to delete Course Unit ${unitCode}?`)) return;
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await api.delete(`/course-units/${unitId}/`);
      setSuccessMsg(`Course Unit ${unitCode} deleted successfully.`);
      loadFacultyData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to delete course unit.');
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
      setShowAssignModal(false);
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
        class_date: ttFormData.class_date || null,
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
    if (isStudent && user?.faculty_code && tt.faculty_code && tt.faculty_code !== user.faculty_code) return false;
    return true;
  });

  // Students ONLY see their designated faculty & leadership
  const visibleFaculties = isStudent
    ? faculties.filter(fac => {
        if (user?.faculty && fac.id === user.faculty) return true;
        if (user?.faculty_code && fac.code === user.faculty_code) return true;
        if (user?.faculty_name && fac.name === user.faculty_name) return true;
        return fac.code === 'SOBAT' || fac.code === 'FHS';
      }).slice(0, 1)
    : faculties;

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
          {isSecretaryOrStaff && (
            <button
              onClick={() => handleOpenCourseModal(null)}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center space-x-1"
            >
              <span>🎓 Add Course</span>
            </button>
          )}
          {isSecretaryOrStaff && (
            <button
              onClick={() => handleOpenCourseUnitModal(null)}
              className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center space-x-1"
            >
              <span>📚 Add Course Unit</span>
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
          🏛️ {isStudent ? 'My Faculty & Leadership' : 'Faculties & Leadership'} ({visibleFaculties.length})
        </button>
        <button
          onClick={() => setActiveTab('assignments')}
          className={`pb-3 text-xs font-bold border-b-2 transition-all ${activeTab === 'assignments' ? 'border-brand-light text-brand-dark' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          👨‍🏫 Course Units & Lecturers ({courseUnits.length})
        </button>
        {isSecretaryOrStaff && (
          <button
            onClick={() => setActiveTab('students')}
            className={`pb-3 text-xs font-bold border-b-2 transition-all ${activeTab === 'students' ? 'border-brand-light text-brand-dark' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            🎓 Student Allocations ({students.length})
          </button>
        )}
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
                        {tt.class_date ? `${tt.class_date} (${tt.day_of_week})` : tt.day_of_week}
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
            {visibleFaculties.map((fac) => (
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

                  {/* Degree Courses in this Faculty */}
                  <div className="pt-2 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-slate-500">Degree Courses & Duration</span>
                      {isSecretaryOrStaff && (
                        <button
                          onClick={() => {
                            setEditingCourse(null);
                            setCourseFormData({
                              faculty: fac.id,
                              name: '',
                              code: '',
                              description: '',
                              department: '',
                              duration_years: 3
                            });
                            setShowCourseModal(true);
                          }}
                          className="text-[10px] font-bold text-blue-600 hover:text-blue-800"
                        >
                          + Add Course
                        </button>
                      )}
                    </div>
                    {courses.filter(c => c.faculty === fac.id || c.faculty_code === fac.code).length === 0 ? (
                      <p className="text-[11px] text-slate-400 italic">No courses added yet.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-44 overflow-y-auto custom-scrollbar">
                        {courses.filter(c => c.faculty === fac.id || c.faculty_code === fac.code).map(c => (
                          <div key={c.id} className="p-2 bg-blue-50/50 rounded-lg border border-blue-100 flex items-center justify-between text-xs">
                            <div>
                              <span className="font-bold text-slate-800">{c.code}</span> - <span className="text-slate-600">{c.name}</span>
                              <div className="flex items-center gap-2 text-[10px] text-slate-500 font-semibold mt-0.5">
                                <span className="bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-bold">⏱️ {c.duration_years || 3} Years</span>
                                <span>📚 {c.units_count || courseUnits.filter(u => u.course === c.id || u.course_code === c.code).length} Units</span>
                              </div>
                            </div>
                            {isSecretaryOrStaff && (
                              <div className="flex items-center space-x-1 shrink-0">
                                <button
                                  onClick={() => handleOpenCourseModal(c)}
                                  className="text-[10px] text-slate-600 hover:text-blue-600 font-bold px-1"
                                  title="Edit course details"
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={() => handleDeleteCourse(c.id, c.code)}
                                  className="text-[10px] text-red-500 hover:text-red-700 font-bold px-1"
                                  title="Delete course"
                                >
                                  🗑️
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
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
              <div className="flex items-center gap-2">
                {isSecretaryOrStaff && (
                  <button
                    onClick={() => handleOpenCourseUnitModal(null)}
                    className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all"
                  >
                    📚 Add Course Unit
                  </button>
                )}
                {isSecretaryOrStaff && (
                  <button
                    onClick={() => setShowCsvModal(true)}
                    className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-xs font-bold rounded-lg transition-all"
                  >
                    📤 CSV Import
                  </button>
                )}
              </div>
            </div>

            {/* Year of Study Filter Bar */}
            <div className="flex items-center space-x-2 bg-slate-50 p-2 rounded-xl border border-slate-100 text-xs">
              <span className="font-bold text-slate-500 uppercase text-[10px]">Filter Year:</span>
              {['All', '1', '2', '3', '4'].map(yr => (
                <button
                  key={yr}
                  onClick={() => setSelectedUnitYearFilter(yr)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    selectedUnitYearFilter === yr
                      ? 'bg-teal-700 text-white shadow-sm'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {yr === 'All' ? 'All Years' : `Year ${yr}`}
                </button>
              ))}
            </div>

            {courseUnits.length === 0 ? (
              <p className="text-slate-400 text-xs py-8 text-center">No course units registered yet.</p>
            ) : (
              <div className="overflow-x-auto custom-scrollbar border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                      <th className="px-3 py-3">Code</th>
                      <th className="px-3 py-3">Unit Name</th>
                      <th className="px-3 py-3">Course Program</th>
                      <th className="px-3 py-3 text-center">Year</th>
                      <th className="px-3 py-3 text-center">Credits</th>
                      <th className="px-3 py-3">Assigned Lecturers</th>
                      {canAssignLecturer && <th className="px-3 py-3 text-center">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {courseUnits
                      .filter(u => selectedUnitYearFilter === 'All' || (u.year_of_study || 1) === parseInt(selectedUnitYearFilter))
                      .map((unit) => (
                        <tr key={unit.id} className="hover:bg-slate-50 transition-all">
                          <td className="px-3 py-3 font-extrabold text-brand-dark">{unit.code}</td>
                          <td className="px-3 py-3 font-bold text-slate-850">{unit.name}</td>
                          <td className="px-3 py-3">{unit.course_code}</td>
                          <td className="px-3 py-3 text-center font-bold">
                            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-teal-50 text-teal-800 border border-teal-200">
                              Year {unit.year_of_study || 1}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center font-bold">{unit.credit_units} CU</td>
                          <td className="px-3 py-3">
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
                            <td className="px-3 py-3 text-center">
                              <div className="flex items-center justify-center space-x-1">
                                <button
                                  onClick={() => {
                                    setSelectedUnit(unit);
                                    setSelectedLecturerId('');
                                    setShowAssignModal(true);
                                  }}
                                  className="px-2.5 py-1 bg-brand-light text-white text-[10px] font-bold rounded-lg hover:bg-brand-medium shadow-sm transition-all"
                                  title="Assign lecturer"
                                >
                                  ⚡ Assign
                                </button>
                                <button
                                  onClick={() => handleOpenCourseUnitModal(unit)}
                                  className="px-2 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 text-[10px] font-bold rounded-lg transition-all"
                                  title="Edit unit"
                                >
                                  ✏️ Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteCourseUnit(unit.id, unit.code)}
                                  className="px-2 py-1 bg-red-50 text-red-600 hover:bg-red-100 text-[10px] font-bold rounded-lg transition-all"
                                  title="Delete unit"
                                >
                                  🗑️
                                </button>
                              </div>
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

      {/* TAB 4: STUDENT FACULTY & COURSE ENROLLMENT */}
      {activeTab === 'students' && (
        <div className="space-y-6">
          
          {/* Students Directory */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            {(() => {
              const filteredStudents = students.filter(st => {
                const matchesSearch = !studentSearch || 
                  (st.first_name || '').toLowerCase().includes(studentSearch.toLowerCase()) ||
                  (st.last_name || '').toLowerCase().includes(studentSearch.toLowerCase()) ||
                  (st.username || '').toLowerCase().includes(studentSearch.toLowerCase()) ||
                  (st.email || '').toLowerCase().includes(studentSearch.toLowerCase()) ||
                  (st.reg_number || st.registration_number || '').toLowerCase().includes(studentSearch.toLowerCase());
                const matchesFaculty = studentFacultyFilter === 'All' || (st.faculty_code === studentFacultyFilter || String(st.faculty) === String(studentFacultyFilter));
                const matchesYear = studentYearFilter === 'All' || String(st.year_of_study || 1) === String(studentYearFilter);
                return matchesSearch && matchesFaculty && matchesYear;
              });

              const totalStudentPages = Math.max(1, Math.ceil(filteredStudents.length / studentPageSize));
              const safeStudentPage = Math.min(Math.max(1, studentPage), totalStudentPages);
              const paginatedStudents = filteredStudents.slice((safeStudentPage - 1) * studentPageSize, safeStudentPage * studentPageSize);

              return (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
                    <h3 className="text-sm font-bold text-slate-850 uppercase tracking-wider">
                      Registered Student Allocations ({filteredStudents.length} of {students.length})
                    </h3>
                    
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (students.length > 0) {
                            const firstSt = students[0];
                            setSelectedStudentId(firstSt.id);
                            setTargetFacultyId(firstSt.faculty || (faculties[0]?.id || ''));
                            setTargetCourseIds(firstSt.assigned_courses || []);
                            setTargetYearOfStudy(firstSt.year_of_study || 1);
                          }
                          setShowSingleAllocModal(true);
                        }}
                        className="px-3.5 py-1.5 bg-brand-light hover:bg-brand-medium text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center space-x-1.5"
                      >
                        <span>🎓 + Allocate Student Profile</span>
                      </button>

                      {selectedStudentAllocIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setShowBulkAllocModal(true)}
                          className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center space-x-1.5"
                        >
                          <span>⚡ Bulk Assign Selected ({selectedStudentAllocIds.length})</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Search and Filters Toolbar */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Search Students</label>
                      <input
                        type="text"
                        placeholder="Search name, reg no, email..."
                        value={studentSearch}
                        onChange={(e) => { setStudentSearch(e.target.value); setStudentPage(1); }}
                        className="w-full bg-white border border-slate-200 text-slate-800 font-medium rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-brand-light"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Filter Faculty</label>
                      <select
                        value={studentFacultyFilter}
                        onChange={(e) => { setStudentFacultyFilter(e.target.value); setStudentPage(1); }}
                        className="w-full bg-white border border-slate-200 text-slate-800 font-bold rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-brand-light"
                      >
                        <option value="All">All Faculties ({faculties.length})</option>
                        {faculties.map(f => (
                          <option key={f.id} value={f.code}>[{f.code}] {f.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Year of Study</label>
                      <select
                        value={studentYearFilter}
                        onChange={(e) => { setStudentYearFilter(e.target.value); setStudentPage(1); }}
                        className="w-full bg-white border border-slate-200 text-slate-800 font-bold rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-brand-light"
                      >
                        <option value="All">All Academic Years</option>
                        <option value="1">Year 1</option>
                        <option value="2">Year 2</option>
                        <option value="3">Year 3</option>
                        <option value="4">Year 4</option>
                      </select>
                    </div>
                  </div>
                  
                  {filteredStudents.length === 0 ? (
                    <p className="text-slate-400 text-xs py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      No student accounts match your filter criteria.
                    </p>
                  ) : (
                    <>
                      <div className="overflow-x-auto custom-scrollbar border border-slate-200 rounded-xl">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                              <th className="px-3 py-3 w-10 text-center">
                                <input
                                  type="checkbox"
                                  checked={filteredStudents.length > 0 && selectedStudentAllocIds.length === filteredStudents.length}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedStudentAllocIds(filteredStudents.map(s => s.id));
                                    } else {
                                      setSelectedStudentAllocIds([]);
                                    }
                                  }}
                                  className="rounded text-brand-light cursor-pointer"
                                />
                              </th>
                              <th className="px-4 py-3">Student Name & Reg No</th>
                              <th className="px-4 py-3 text-center">Year of Study</th>
                              <th className="px-4 py-3">Assigned Faculty</th>
                              <th className="px-4 py-3">Enrolled Course Programs</th>
                              <th className="px-4 py-3 text-center">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-700">
                            {paginatedStudents.map((st) => (
                              <tr key={st.id} className="hover:bg-slate-50 transition-all">
                                <td className="px-3 py-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={selectedStudentAllocIds.includes(st.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedStudentAllocIds(prev => [...prev, st.id]);
                                      } else {
                                        setSelectedStudentAllocIds(prev => prev.filter(id => id !== st.id));
                                      }
                                    }}
                                    className="rounded text-brand-light cursor-pointer"
                                  />
                                </td>
                                <td className="px-4 py-3 font-bold text-slate-850">
                                  {st.first_name || st.username} {st.last_name}
                                  <span className="block text-[10px] text-slate-400 font-normal">{st.email}</span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-50 text-purple-700 border border-purple-200">
                                    Year {st.year_of_study || 1}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  {st.faculty_code ? (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
                                      {st.faculty_code} - {st.faculty_name}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 italic text-[11px]">Unassigned</span>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  {st.assigned_course_codes && st.assigned_course_codes.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                      {st.assigned_course_codes.map(cCode => (
                                        <span key={cCode} className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                          {cCode}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 italic text-[11px]">No specific courses</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-center space-x-2">
                                  <button
                                    onClick={() => {
                                      setSelectedStudentId(st.id);
                                      setTargetFacultyId(st.faculty || (faculties[0]?.id || ''));
                                      setTargetCourseIds(st.assigned_courses || []);
                                      setTargetYearOfStudy(st.year_of_study || 1);
                                      setShowSingleAllocModal(true);
                                    }}
                                    className="px-2.5 py-1 bg-brand-light text-white text-[10px] font-bold rounded hover:bg-brand-medium shadow-xs transition-all"
                                  >
                                    ✏️ Allocate / Edit
                                  </button>
                                  {st.faculty && (
                                    <button
                                      onClick={() => handleRemoveStudentFromFaculty(st.faculty, st.id)}
                                      className="px-2 py-1 bg-red-50 text-red-600 hover:bg-red-100 text-[10px] font-bold rounded"
                                      title="Remove student from faculty"
                                    >
                                      Remove
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination Controls Bar */}
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 text-xs text-slate-500 font-semibold border-t border-slate-100">
                        <div className="flex items-center space-x-2">
                          <span>Showing {(safeStudentPage - 1) * studentPageSize + 1} - {Math.min(safeStudentPage * studentPageSize, filteredStudents.length)} of {filteredStudents.length} students</span>
                          <select
                            value={studentPageSize}
                            onChange={(e) => { setStudentPageSize(Number(e.target.value)); setStudentPage(1); }}
                            className="bg-slate-50 border border-slate-200 rounded text-xs px-2 py-1 font-bold text-slate-700"
                          >
                            <option value={10}>10 per page</option>
                            <option value={20}>20 per page</option>
                            <option value={50}>50 per page</option>
                          </select>
                        </div>

                        <div className="flex items-center space-x-1.5">
                          <button
                            onClick={() => setStudentPage(1)}
                            disabled={safeStudentPage <= 1}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold disabled:opacity-40"
                          >
                            « First
                          </button>
                          <button
                            onClick={() => setStudentPage(prev => Math.max(1, prev - 1))}
                            disabled={safeStudentPage <= 1}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold disabled:opacity-40"
                          >
                            ‹ Prev
                          </button>
                          <span className="px-3 py-1 font-bold text-slate-800">
                            Page {safeStudentPage} of {totalStudentPages}
                          </span>
                          <button
                            onClick={() => setStudentPage(prev => Math.min(totalStudentPages, prev + 1))}
                            disabled={safeStudentPage >= totalStudentPages}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold disabled:opacity-40"
                          >
                            Next ›
                          </button>
                          <button
                            onClick={() => setStudentPage(totalStudentPages)}
                            disabled={safeStudentPage >= totalStudentPages}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold disabled:opacity-40"
                          >
                            Last »
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </>
              );
            })()}
          </div>

        </div>
      )}

      {/* SINGLE STUDENT ALLOCATION POPUP MODAL */}
      {showSingleAllocModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-100 animate-scale-up">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-850">🎓 Allocate Student Profile</h3>
                <p className="text-slate-500 text-xs">Assign target Faculty, Academic Year of Study, and Course Programs.</p>
              </div>
              <button onClick={() => setShowSingleAllocModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-lg">✕</button>
            </div>

            <form onSubmit={handleAssignStudentToFaculty} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1">Select Student Account</label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => {
                    setSelectedStudentId(e.target.value);
                    const st = students.find(s => s.id === parseInt(e.target.value));
                    if (st) {
                      setTargetFacultyId(st.faculty || (faculties[0]?.id || ''));
                      setTargetCourseIds(st.assigned_courses || []);
                      setTargetYearOfStudy(st.year_of_study || 1);
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-850"
                  required
                >
                  <option value="">Select Student Account...</option>
                  {students.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.first_name || st.username} {st.last_name} ({st.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Year of Study</label>
                  <select
                    value={targetYearOfStudy}
                    onChange={(e) => setTargetYearOfStudy(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-850"
                  >
                    <option value={1}>Year 1</option>
                    <option value={2}>Year 2</option>
                    <option value={3}>Year 3</option>
                    <option value={4}>Year 4</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Target Faculty</label>
                  <select
                    value={targetFacultyId}
                    onChange={(e) => setTargetFacultyId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-850"
                    required
                  >
                    <option value="">Select Faculty...</option>
                    {faculties.map((f) => (
                      <option key={f.id} value={f.id}>{f.code} - {f.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1">Enrolled Course Programs (Multiple)</label>
                <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  {courses.filter(c => !targetFacultyId || c.faculty === parseInt(targetFacultyId)).map((c) => {
                    const isChecked = targetCourseIds.includes(c.id);
                    return (
                      <label key={c.id} className="flex items-center space-x-2 font-medium text-slate-700 text-xs cursor-pointer hover:bg-white p-1 rounded">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setTargetCourseIds(prev => [...prev, c.id]);
                            } else {
                              setTargetCourseIds(prev => prev.filter(id => id !== c.id));
                            }
                          }}
                          className="rounded text-brand-light cursor-pointer"
                        />
                        <span className="font-bold text-slate-850">[{c.code}]</span>
                        <span className="text-slate-600">{c.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowSingleAllocModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-brand-light hover:bg-brand-medium text-white font-bold rounded-xl shadow-sm transition-all text-xs"
                >
                  {submitting ? 'Saving...' : 'Save Allocation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BULK STUDENT ALLOCATION MODAL */}
      {showBulkAllocModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-100 animate-scale-up">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-850">🎓 Bulk Assign Year & Courses ({selectedStudentAllocIds.length} Students)</h3>
                <p className="text-slate-500 text-xs">Assign selected student accounts to Faculty, Year of Study, and Course Programs at once.</p>
              </div>
              <button onClick={() => setShowBulkAllocModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-lg">✕</button>
            </div>

            <form onSubmit={handleBulkStudentAllocSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Academic Year of Study</label>
                  <select
                    value={bulkAllocYearOfStudy}
                    onChange={(e) => setBulkAllocYearOfStudy(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs"
                  >
                    <option value={1}>Year 1</option>
                    <option value={2}>Year 2</option>
                    <option value={3}>Year 3</option>
                    <option value={4}>Year 4</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Target Faculty</label>
                  <select
                    value={bulkAllocFacultyId}
                    onChange={(e) => setBulkAllocFacultyId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs"
                  >
                    <option value="">-- Keep Current Faculty --</option>
                    {faculties.map(f => (
                      <option key={f.id} value={f.id}>[{f.code}] {f.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1">Enrolled Degree Course Programs</label>
                <div className="max-h-36 overflow-y-auto custom-scrollbar border border-slate-200 rounded-xl p-2.5 bg-slate-50 space-y-1.5">
                  {courses.filter(c => !bulkAllocFacultyId || c.faculty === parseInt(bulkAllocFacultyId)).map(c => {
                    const isChecked = bulkAllocCourseIds.includes(c.id);
                    return (
                      <label key={c.id} className="flex items-center space-x-2 p-1 hover:bg-white rounded cursor-pointer text-xs">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setBulkAllocCourseIds(prev => [...prev, c.id]);
                            } else {
                              setBulkAllocCourseIds(prev => prev.filter(id => id !== c.id));
                            }
                          }}
                          className="rounded text-brand-light cursor-pointer"
                        />
                        <span className="font-bold text-slate-850">[{c.code}]</span>
                        <span className="text-slate-600">{c.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowBulkAllocModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-brand-light hover:bg-brand-medium text-white font-bold rounded-xl shadow-sm transition-all text-xs"
                >
                  {submitting ? 'Applying Bulk Allocations...' : `Apply to ${selectedStudentAllocIds.length} Students`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INLINE LECTURER ASSIGNMENT MODAL (Zero Scrolling Needed!) */}
      {showAssignModal && selectedUnit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-100 animate-scale-up">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-850">Assign Lecturer to Course Unit</h3>
              <button onClick={() => { setShowAssignModal(false); setSelectedUnit(null); }} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleAssignLecturer} className="space-y-4 text-xs">
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-150 space-y-1">
                <p className="font-bold text-slate-850 text-sm">{selectedUnit.name}</p>
                <p className="text-slate-500 font-medium">Code: <strong className="text-brand-dark">{selectedUnit.code}</strong> · Program: {selectedUnit.course_code}</p>
                <p className="text-slate-500 font-medium">Credits: {selectedUnit.credit_units} CU</p>
              </div>

              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1.5">Select Lecturer to Assign</label>
                <select
                  value={selectedLecturerId}
                  onChange={(e) => setSelectedLecturerId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-850"
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

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setShowAssignModal(false); setSelectedUnit(null); }}
                  className="px-4 py-2 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-brand-light hover:bg-brand-medium text-white font-bold rounded-xl shadow-md transition-all"
                >
                  {submitting ? 'Assigning...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
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

              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Date</label>
                  <input
                    type="date"
                    value={ttFormData.class_date}
                    onChange={(e) => setTtFormData({ ...ttFormData, class_date: e.target.value })}
                    className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Day</label>
                  <select
                    value={ttFormData.day_of_week}
                    onChange={(e) => setTtFormData({ ...ttFormData, day_of_week: e.target.value })}
                    className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl"
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

      {/* MODAL: CREATE / EDIT COURSE */}
      {showCourseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-850">
                {editingCourse ? `Edit Course ${editingCourse.code}` : 'Add New Course to Faculty'}
              </h3>
              <button onClick={() => setShowCourseModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleSaveCourse} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1">Assigned Faculty</label>
                <select
                  value={courseFormData.faculty}
                  onChange={(e) => setCourseFormData({ ...courseFormData, faculty: e.target.value })}
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
                  <label className="block text-slate-700 font-bold uppercase mb-1">Course Code</label>
                  <input
                    type="text"
                    value={courseFormData.code}
                    onChange={(e) => setCourseFormData({ ...courseFormData, code: e.target.value })}
                    placeholder="e.g. BIT2026, BSN2026"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Course Duration (Years)</label>
                  <select
                    value={courseFormData.duration_years}
                    onChange={(e) => setCourseFormData({ ...courseFormData, duration_years: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                    required
                  >
                    <option value={1}>1 Year (Certificate/Diploma)</option>
                    <option value={2}>2 Years (Associate Degree)</option>
                    <option value={3}>3 Years (Standard Degree)</option>
                    <option value={4}>4 Years (Engineering/Honors)</option>
                    <option value={5}>5 Years (Medicine/Surgery)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1">Full Course Name</label>
                <input
                  type="text"
                  value={courseFormData.name}
                  onChange={(e) => setCourseFormData({ ...courseFormData, name: e.target.value })}
                  placeholder="e.g. Bachelor of Information Technology"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1">Department</label>
                <input
                  type="text"
                  value={courseFormData.department}
                  onChange={(e) => setCourseFormData({ ...courseFormData, department: e.target.value })}
                  placeholder="e.g. Department of Computing & Data Science"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1">Description</label>
                <textarea
                  value={courseFormData.description}
                  onChange={(e) => setCourseFormData({ ...courseFormData, description: e.target.value })}
                  placeholder="Summary of course structure and goals..."
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl resize-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCourseModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md"
                >
                  {submitting ? 'Saving...' : editingCourse ? 'Save Changes' : 'Create Course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE / EDIT COURSE UNIT */}
      {showCourseUnitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-850">
                {editingCourseUnit ? `Edit Course Unit ${editingCourseUnit.code}` : 'Add Course Unit to Course Program'}
              </h3>
              <button onClick={() => setShowCourseUnitModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleSaveCourseUnit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1">Target Course Program</label>
                <select
                  value={unitFormData.course}
                  onChange={(e) => setUnitFormData({ ...unitFormData, course: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  required
                >
                  <option value="">Select Course Program...</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Unit Code</label>
                  <input
                    type="text"
                    value={unitFormData.code}
                    onChange={(e) => setUnitFormData({ ...unitFormData, code: e.target.value })}
                    placeholder="e.g. BIT2104"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Credit Units</label>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={unitFormData.credit_units}
                    onChange={(e) => setUnitFormData({ ...unitFormData, credit_units: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Year of Study</label>
                  <select
                    value={unitFormData.year_of_study}
                    onChange={(e) => setUnitFormData({ ...unitFormData, year_of_study: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                    required
                  >
                    <option value={1}>Year 1</option>
                    <option value={2}>Year 2</option>
                    <option value={3}>Year 3</option>
                    <option value={4}>Year 4</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1">Course Unit Name</label>
                <input
                  type="text"
                  value={unitFormData.name}
                  onChange={(e) => setUnitFormData({ ...unitFormData, name: e.target.value })}
                  placeholder="e.g. Cloud Infrastructure Systems"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1">Assign Lecturers (Optional)</label>
                <div className="max-h-36 overflow-y-auto custom-scrollbar border border-slate-200 rounded-xl p-2 bg-slate-50 space-y-1">
                  {lecturers.map((lec) => {
                    const isChecked = unitFormData.lecturers.includes(lec.id);
                    return (
                      <label key={lec.id} className="flex items-center space-x-2 p-1 hover:bg-white rounded cursor-pointer text-xs">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setUnitFormData(prev => ({ ...prev, lecturers: [...prev.lecturers, lec.id] }));
                            } else {
                              setUnitFormData(prev => ({ ...prev, lecturers: prev.lecturers.filter(id => id !== lec.id) }));
                            }
                          }}
                          className="rounded text-brand-dark focus:ring-brand-light"
                        />
                        <span className="font-semibold text-slate-800">{lec.first_name || lec.username} {lec.last_name}</span>
                        <span className="text-slate-400 text-[10px]">({lec.email})</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCourseUnitModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-md"
                >
                  {submitting ? 'Saving...' : editingCourseUnit ? 'Save Changes' : 'Create Course Unit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
