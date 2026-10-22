import React, { useEffect, useState } from 'react';
import { api } from '../lib/api-client';
import { Course, Enrollment, Student } from '@classguard/shared';
import { GraduationCap, Plus, Users, BookOpen, X, Check } from 'lucide-react';

export const CoursesPage: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);

  // Add course form
  const [newCode, setNewCode] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDept, setNewDept] = useState('Computer Science');
  const [newLevel, setNewLevel] = useState('400L');
  const [newUnits, setNewUnits] = useState(3);

  // Enroll form
  const [selectedStudentId, setSelectedStudentId] = useState('');

  const loadCourses = async () => {
    const res = await api.getCourses();
    if (res.success) {
      setCourses(res.data);
      if (res.data.length > 0 && !selectedCourse) {
        handleSelectCourse(res.data[0]);
      }
    }
  };

  const handleSelectCourse = async (course: Course) => {
    setSelectedCourse(course);
    const res = await api.getCourseEnrollments(course.id);
    if (res.success) {
      setEnrollments(res.data);
    }
  };

  useEffect(() => {
    loadCourses();
    api.getStudents().then((res) => {
      if (res.success) setAllStudents(res.data);
    });
  }, []);

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode || !newTitle) return;
    const res = await api.createCourse({
      code: newCode,
      title: newTitle,
      department: newDept,
      level: newLevel,
      creditUnits: Number(newUnits),
    });
    if (res.success) {
      setShowAddCourse(false);
      setNewCode('');
      setNewTitle('');
      loadCourses();
    }
  };

  const handleEnrollStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse || !selectedStudentId) return;
    const res = await api.enrollStudent(selectedStudentId, selectedCourse.id);
    if (res.success) {
      setShowEnrollModal(false);
      handleSelectCourse(selectedCourse);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-emerald-400" />
            <span>Course & Enrollment Management</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Configure academic courses, assign lecturers, and manage student enrollments
          </p>
        </div>

        <button
          onClick={() => setShowAddCourse(true)}
          className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Course</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Course Cards List */}
        <div className="space-y-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block px-1">
            Department Courses ({courses.length})
          </span>
          {courses.map((c) => {
            const isSelected = selectedCourse?.id === c.id;
            return (
              <div
                key={c.id}
                onClick={() => handleSelectCourse(c)}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-zinc-900 border-emerald-500/50 shadow-lg shadow-emerald-500/10'
                    : 'glass-panel border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-sm text-emerald-400">{c.code}</span>
                  <span className="text-[11px] font-mono text-zinc-400 px-2 py-0.5 rounded bg-zinc-800">
                    {c.creditUnits} Units
                  </span>
                </div>
                <h3 className="text-xs font-semibold text-zinc-200 mt-1">{c.title}</h3>
                <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-500">
                  <span>{c.lecturerName || 'Unassigned'}</span>
                  <span className="font-mono">{c.level}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Course Enrollment Roster */}
        <div className="lg:col-span-2 glass-panel rounded-2xl border border-zinc-800 p-6 flex flex-col justify-between">
          <div>
            {selectedCourse ? (
              <>
                <div className="flex items-start justify-between pb-4 border-b border-zinc-800 mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-base text-emerald-400">{selectedCourse.code}</span>
                      <span className="text-xs text-zinc-500">•</span>
                      <h2 className="text-sm font-bold text-zinc-100">{selectedCourse.title}</h2>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">
                      Lecturer: <span className="text-zinc-300 font-medium">{selectedCourse.lecturerName || 'Dr. Alan Turing'}</span>
                    </p>
                  </div>

                  <button
                    onClick={() => setShowEnrollModal(true)}
                    className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-semibold text-emerald-400 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Enroll Student</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-900/60 text-zinc-400 uppercase font-mono tracking-wider text-[11px] border-b border-zinc-800">
                      <tr>
                        <th className="py-2.5 px-3">Matriculation</th>
                        <th className="py-2.5 px-3">Student Name</th>
                        <th className="py-2.5 px-3">Biometrics</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                      {enrollments.length > 0 ? (
                        enrollments.map((e) => (
                          <tr key={e.id} className="hover:bg-zinc-800/20">
                            <td className="py-2.5 px-3 font-mono font-semibold text-zinc-200">
                              {e.studentMatric}
                            </td>
                            <td className="py-2.5 px-3 text-zinc-100 font-medium">{e.studentName}</td>
                            <td className="py-2.5 px-3">
                              {(e as any).hasFaceEnrolled ? (
                                <span className="text-emerald-400 text-[11px] flex items-center gap-1">
                                  <Check className="w-3.5 h-3.5" /> Enrolled
                                </span>
                              ) : (
                                <span className="text-amber-400 text-[11px]">Pending</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                {e.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-zinc-500">
                            No students enrolled in this course yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="py-16 text-center text-zinc-500">Select a course to view enrolled students.</div>
            )}
          </div>

          {selectedCourse && (
            <div className="pt-4 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-500">
              <span>Total Enrolled: {enrollments.length} students</span>
              <span className="font-mono">Academic Session: 2025/2026 First Semester</span>
            </div>
          )}
        </div>
      </div>

      {/* Add Course Modal */}
      {showAddCourse && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md rounded-2xl border border-zinc-800 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800 mb-4">
              <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-400" />
                <span>Create New Course</span>
              </h2>
              <button onClick={() => setShowAddCourse(false)} className="text-zinc-500 hover:text-zinc-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCourse} className="space-y-4 text-xs">
              <div>
                <label className="block text-zinc-400 font-medium mb-1">Course Code</label>
                <input
                  type="text"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  placeholder="e.g. CSC 411"
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 font-mono uppercase focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1">Course Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Neural Networks & Deep Learning"
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Department</label>
                  <select
                    value={newDept}
                    onChange={(e) => setNewDept(e.target.value)}
                    className="w-full px-2 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none"
                  >
                    <option value="Computer Science">Computer Science</option>
                    <option value="Software Engineering">Software Eng</option>
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Level</label>
                  <select
                    value={newLevel}
                    onChange={(e) => setNewLevel(e.target.value)}
                    className="w-full px-2 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none font-mono"
                  >
                    <option value="400L">400L</option>
                    <option value="300L">300L</option>
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Units</label>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={newUnits}
                    onChange={(e) => setNewUnits(parseInt(e.target.value, 10))}
                    className="w-full px-2 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddCourse(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-900 text-zinc-400 hover:bg-zinc-800 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold"
                >
                  Create Course
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Enroll Student Modal */}
      {showEnrollModal && selectedCourse && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md rounded-2xl border border-zinc-800 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800 mb-4">
              <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>Enroll Student into {selectedCourse.code}</span>
              </h2>
              <button onClick={() => setShowEnrollModal(false)} className="text-zinc-500 hover:text-zinc-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEnrollStudent} className="space-y-4 text-xs">
              <div>
                <label className="block text-zinc-400 font-medium mb-1">Select Student</label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 focus:outline-none"
                  required
                >
                  <option value="">-- Choose a student --</option>
                  {allStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.matricNumber} - {s.fullName} ({s.department})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-zinc-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEnrollModal(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-900 text-zinc-400 hover:bg-zinc-800 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedStudentId}
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 text-xs font-bold"
                >
                  Confirm Enrollment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
