import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import { api } from '../lib/api-client';
import { FaceRecognitionService } from '../lib/face-service';
import { Student, Course, isValidMatricNumber, MATRIC_NUMBER_REGEX } from '@classguard/shared';
import {
  Users,
  Search,
  UserPlus,
  Camera,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Trash2,
  Edit2,
  Eye,
  QrCode,
  Download,
  Loader2,
  RefreshCw,
} from 'lucide-react';

export const StudentsPage: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Add Student Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMatric, setNewMatric] = useState('');
  const [newName, setNewName] = useState('');
  const [newDept, setNewDept] = useState('Computer Science');
  const [newLevel, setNewLevel] = useState('400L');
  const [newEmail, setNewEmail] = useState('');
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [matricError, setMatricError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submittingStudent, setSubmittingStudent] = useState(false);

  // Edit Student Modal
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editName, setEditName] = useState('');
  const [editDept, setEditDept] = useState('');
  const [editLevel, setEditLevel] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editActive, setEditActive] = useState(true);

  // View Student Modal
  const [viewingStudent, setViewingStudent] = useState<Student | null>(null);

  // QR Credential Modal
  const [qrCardStudent, setQrCardStudent] = useState<Student | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

  // Real Facial Enrollment Modal
  const [enrollingStudent, setEnrollingStudent] = useState<Student | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [enrollmentStatus, setEnrollmentStatus] = useState<'idle' | 'detecting' | 'capturing' | 'saving' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [stuRes, crsRes] = await Promise.all([
        api.getStudents(search),
        api.getCourses(),
      ]);
      if (stuRes.success) setStudents(stuRes.data);
      if (crsRes.success) setCourses(crsRes.data);
    } catch (err) {
      console.error('Failed to load students:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search]);

  // Clean up camera stream
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const startCamera = async () => {
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsCameraActive(true);
      setEnrollmentStatus('detecting');
      setStatusMessage('Center student face in the frame with even lighting.');
    } catch (err: any) {
      console.warn('Camera access unavailable:', err);
      setIsCameraActive(false);
      setEnrollmentStatus('error');
      setStatusMessage('Webcam not detected or camera permission denied.');
    }
  };

  const handleOpenEnrollment = (student: Student) => {
    setEnrollingStudent(student);
    setEnrollmentStatus('idle');
    setStatusMessage('');
    startCamera();
  };

  const handleCloseEnrollment = () => {
    stopCamera();
    setEnrollingStudent(null);
  };

  // Real facial feature extraction (128D) using bundled local models
  const handleCaptureRealFace = async () => {
    if (!videoRef.current || !enrollingStudent) return;
    setEnrollmentStatus('capturing');
    setStatusMessage('Analyzing facial geometry and extracting 128D embedding using local neural network...');

    try {
      const faceService = FaceRecognitionService.getInstance();
      const result = await faceService.extractFaceEmbedding(videoRef.current);

      if (result.success && result.embedding && result.embedding.length === 128) {
        setEnrollmentStatus('saving');
        setStatusMessage('Saving biometric template to secure local database...');

        const saveRes = await api.enrollFace(enrollingStudent.id, result.embedding);
        if (saveRes.success) {
          setEnrollmentStatus('success');
          setStatusMessage(`Biometric template successfully enrolled for ${enrollingStudent.fullName}!`);
          stopCamera();
          loadData();
        } else {
          setEnrollmentStatus('error');
          setStatusMessage(saveRes.error || saveRes.message || 'Failed to save biometric template.');
        }
      } else {
        setEnrollmentStatus('error');
        setStatusMessage(result.message || 'No clear single face detected. Adjust lighting and face the camera directly.');
      }
    } catch (err: any) {
      setEnrollmentStatus('error');
      setStatusMessage(`Biometric extraction failed: ${err.message}`);
    }
  };

  // Delete face template
  const handleDeleteFace = async (studentId: string) => {
    if (confirm('Delete this facial biometric template? The student will need to re-enroll or use QR fallback.')) {
      await api.deleteFace(studentId);
      loadData();
    }
  };

  // Add Student submission with strict matriculation number validation
  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanMatric = newMatric.trim().toUpperCase();
    const cleanName = newName.trim();

    if (!cleanMatric || !cleanName) {
      setFormError('Please enter both matriculation number and full name.');
      return;
    }

    if (!isValidMatricNumber(cleanMatric)) {
      setMatricError('Matriculation number must match format 2xxx/2xxxxx (e.g. 2022/241414)');
      return;
    }

    setSubmittingStudent(true);
    setFormError(null);
    setMatricError(null);

    try {
      const res = await api.createStudent({
        matricNumber: cleanMatric,
        fullName: cleanName,
        department: newDept,
        level: newLevel,
        email: newEmail.trim() || undefined,
        courseIds: selectedCourseIds,
      });

      if (res.success && (res.student || res.data)) {
        setShowAddModal(false);
        setNewMatric('');
        setNewName('');
        setNewEmail('');
        setSelectedCourseIds([]);
        loadData();
      } else {
        setFormError(res.error || res.message || 'Failed to register student');
      }
    } catch (err: any) {
      setFormError(err.message || 'Unexpected registration error');
    } finally {
      setSubmittingStudent(false);
    }
  };

  // Edit student submission
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;

    try {
      const res = await api.updateStudent(editingStudent.id, {
        fullName: editName.trim(),
        department: editDept,
        level: editLevel,
        email: editEmail.trim() || undefined,
        active: editActive,
      });

      if (res.success) {
        setEditingStudent(null);
        loadData();
      } else {
        alert(res.error || res.message || 'Failed to update student details');
      }
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    }
  };

  // QR Credential Card Display
  const handleViewQrCredential = async (student: Student) => {
    let credentialString = student.qrCredential;
    if (!credentialString || credentialString.length < 10) {
      const genRes = await api.generateQrCredential(student.id);
      if (genRes.success && genRes.qrCredential) {
        credentialString = genRes.qrCredential;
      }
    }

    if (credentialString) {
      try {
        const url = await QRCode.toDataURL(credentialString, { width: 300, margin: 2 });
        setQrCodeDataUrl(url);
        setQrCardStudent(student);
      } catch (err) {
        alert('Failed to generate visual QR code image.');
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-400" />
            <span>Student Management & Biometric Enrollment</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Register students, manage real facial biometric templates, and issue student QR credentials.
          </p>
        </div>

        <button
          onClick={() => {
            setShowAddModal(true);
            setFormError(null);
            setMatricError(null);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-xs shadow-md shadow-emerald-500/20 transition-all cursor-pointer self-start"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Student</span>
        </button>
      </div>

      {/* Search and Table Card */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by matric number (2xxx/2xxxxx) or name..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="text-xs text-zinc-400 font-mono">
            <span>Total: <strong>{students.length}</strong> students</span>
          </div>
        </div>

        {/* Student Table */}
        <div className="overflow-x-auto border border-zinc-800/80 rounded-lg">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-900/80 text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Matriculation No.</th>
                <th className="py-2.5 px-4 font-semibold">Full Name</th>
                <th className="py-2.5 px-4 font-semibold">Department</th>
                <th className="py-2.5 px-4 font-semibold">Level</th>
                <th className="py-2.5 px-4 font-semibold">Facial Biometrics</th>
                <th className="py-2.5 px-4 font-semibold">Account Status</th>
                <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-500">
                    <Loader2 className="w-5 h-5 text-emerald-400 animate-spin mx-auto mb-2" />
                    <span>Loading student records...</span>
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-500">
                    No students found matching your search.
                  </td>
                </tr>
              ) : (
                students.map((s) => (
                  <tr key={s.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-emerald-400">{s.matricNumber}</td>
                    <td className="py-3 px-4 font-medium text-zinc-100">{s.fullName}</td>
                    <td className="py-3 px-4 text-zinc-400">{s.department}</td>
                    <td className="py-3 px-4 text-zinc-400 font-mono text-[11px]">{s.level}</td>
                    <td className="py-3 px-4">
                      {s.hasFaceEnrolled ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Enrolled</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                          <AlertCircle className="w-3 h-3" />
                          <span>Not Enrolled</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {s.active ? (
                        <span className="text-[10px] font-medium text-zinc-300">Active</span>
                      ) : (
                        <span className="text-[10px] font-medium text-rose-400">Deactivated</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {/* Enroll / Re-enroll Face Button */}
                        <button
                          onClick={() => handleOpenEnrollment(s)}
                          title={s.hasFaceEnrolled ? 'Re-enroll Face' : 'Enroll Face'}
                          className={`p-1.5 rounded-lg border transition-colors ${
                            s.hasFaceEnrolled
                              ? 'border-zinc-700 text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10'
                              : 'border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20'
                          }`}
                        >
                          <Camera className="w-3.5 h-3.5" />
                        </button>

                        {/* View QR Fallback Credential */}
                        <button
                          onClick={() => handleViewQrCredential(s)}
                          title="View / Print QR Credential"
                          className="p-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                        </button>

                        {/* Edit Student */}
                        <button
                          onClick={() => {
                            setEditingStudent(s);
                            setEditName(s.fullName);
                            setEditDept(s.department);
                            setEditLevel(s.level);
                            setEditEmail(s.email || '');
                            setEditActive(s.active);
                          }}
                          title="Edit Student Details"
                          className="p-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Face if enrolled */}
                        {s.hasFaceEnrolled && (
                          <button
                            onClick={() => handleDeleteFace(s.id)}
                            title="Delete Facial Template"
                            className="p-1.5 rounded-lg border border-zinc-800 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* REAL CAMERA FACIAL ENROLLMENT MODAL */}
      {enrollingStudent && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                  <Camera className="w-4 h-4 text-emerald-400" />
                  <span>Real Facial Biometric Enrollment</span>
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Enrolling: <strong className="text-zinc-200">{enrollingStudent.fullName}</strong> ({enrollingStudent.matricNumber})
                </p>
              </div>
              <button
                onClick={handleCloseEnrollment}
                className="text-zinc-500 hover:text-zinc-300 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            {/* Video Viewfinder */}
            <div className="relative aspect-video bg-zinc-950 rounded-xl overflow-hidden border border-zinc-800 flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover -scale-x-100 camera-mirror"
              />

              {/* Viewfinder Oval Guide */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-60 rounded-full border-2 border-dashed border-emerald-400/60 shadow-inner" />
              </div>

              {!isCameraActive && (
                <div className="absolute inset-0 bg-zinc-950 flex flex-col items-center justify-center gap-2 p-4 text-center">
                  <Camera className="w-8 h-8 text-zinc-600" />
                  <p className="text-xs text-zinc-400">{statusMessage || 'Initializing local camera...'}</p>
                </div>
              )}
            </div>

            {/* Status / Message box */}
            {statusMessage && (
              <div
                className={`p-3 rounded-lg text-xs flex items-start gap-2 ${
                  enrollmentStatus === 'success'
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                    : enrollmentStatus === 'error'
                    ? 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                    : 'bg-zinc-800/80 border border-zinc-700 text-zinc-300'
                }`}
              >
                {enrollmentStatus === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                ) : enrollmentStatus === 'error' ? (
                  <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <Loader2 className="w-4 h-4 text-emerald-400 animate-spin flex-shrink-0 mt-0.5" />
                )}
                <span>{statusMessage}</span>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={handleCloseEnrollment}
                className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200"
              >
                Close
              </button>

              {enrollmentStatus !== 'success' ? (
                <button
                  type="button"
                  disabled={!isCameraActive || enrollmentStatus === 'capturing' || enrollmentStatus === 'saving'}
                  onClick={handleCaptureRealFace}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-semibold text-xs flex items-center gap-2 shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
                >
                  {enrollmentStatus === 'capturing' || enrollmentStatus === 'saving' ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Extracting Biometric Vector...</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-3.5 h-3.5" />
                      <span>Capture & Enroll Face</span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCloseEnrollment}
                  className="px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-xs"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ADD STUDENT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-emerald-400" />
                <span>Register New Student</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-zinc-500 hover:text-zinc-300 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleAddStudent} className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-300 font-medium mb-1">
                  Matriculation Number * <span className="text-zinc-500 font-mono text-[10px]">(Format: 2xxx/2xxxxx)</span>
                </label>
                <input
                  type="text"
                  value={newMatric}
                  onChange={(e) => {
                    setNewMatric(e.target.value);
                    if (matricError) setMatricError(null);
                  }}
                  placeholder="2022/241414"
                  className={`w-full px-3 py-2 rounded-lg bg-zinc-950 border text-zinc-100 placeholder-zinc-600 focus:outline-none font-mono ${
                    matricError ? 'border-rose-500' : 'border-zinc-800 focus:border-emerald-500'
                  }`}
                  required
                />
                {matricError && (
                  <p className="text-[11px] text-rose-400 mt-1">{matricError}</p>
                )}
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Full Name *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Babatunde Fashola"
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Department</label>
                  <input
                    type="text"
                    value={newDept}
                    onChange={(e) => setNewDept(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Academic Level</label>
                  <select
                    value={newLevel}
                    onChange={(e) => setNewLevel(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="100L">100L</option>
                    <option value="200L">200L</option>
                    <option value="300L">300L</option>
                    <option value="400L">400L</option>
                    <option value="500L">500L</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Email Address</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="student@classguard.edu"
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded-lg text-zinc-400 hover:text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingStudent}
                  className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold"
                >
                  {submittingStudent ? 'Registering...' : 'Register Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT STUDENT MODAL */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-emerald-400" />
                <span>Edit Student Details</span>
              </h3>
              <button
                onClick={() => setEditingStudent(null)}
                className="text-zinc-500 hover:text-zinc-300 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-400 font-medium mb-1">Matriculation Number (Read Only)</label>
                <input
                  type="text"
                  value={editingStudent.matricNumber}
                  disabled
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950/50 border border-zinc-800/60 text-zinc-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Full Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Department</label>
                  <input
                    type="text"
                    value={editDept}
                    onChange={(e) => setEditDept(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Level</label>
                  <input
                    type="text"
                    value={editLevel}
                    onChange={(e) => setEditLevel(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="editActive"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-0"
                />
                <label htmlFor="editActive" className="text-zinc-300">Account Active</label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-3 py-1.5 rounded-lg text-zinc-400 hover:text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR CREDENTIAL MODAL */}
      {qrCardStudent && qrCodeDataUrl && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl text-center space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">Student QR Credential</h3>
              <button
                onClick={() => setQrCardStudent(null)}
                className="text-zinc-500 hover:text-zinc-300 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <div className="p-3 bg-white rounded-xl inline-block shadow-lg mx-auto">
              <img src={qrCodeDataUrl} alt="Student QR Credential" className="w-48 h-48 mx-auto" />
            </div>

            <div>
              <p className="font-bold text-sm text-zinc-100">{qrCardStudent.fullName}</p>
              <p className="font-mono text-xs text-emerald-400 font-semibold mt-0.5">{qrCardStudent.matricNumber}</p>
              <p className="text-[11px] text-zinc-400 mt-1">{qrCardStudent.department} • {qrCardStudent.level}</p>
            </div>

            <p className="text-[10px] text-zinc-500">
              This cryptographic QR credential is used at the kiosk if facial verification fails.
            </p>

            <button
              onClick={() => setQrCardStudent(null)}
              className="w-full py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
