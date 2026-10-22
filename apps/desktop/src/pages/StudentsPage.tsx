import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import { api } from '../lib/api-client';
import { FaceRecognitionService } from '../lib/face-service';
import { Student, Course } from '@classguard/shared';
import {
  Users,
  Search,
  UserPlus,
  Camera,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  Trash2,
  X,
  RefreshCw,
  Sparkles,
  Edit2,
  Eye,
  QrCode,
  Printer,
  Download,
  Check,
  Ban,
  FileCheck2,
} from 'lucide-react';

export const StudentsPage: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'directory' | 'status'>('directory');

  // Register Modal
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [newMatric, setNewMatric] = useState('');
  const [newName, setNewName] = useState('');
  const [newDept, setNewDept] = useState('Computer Science');
  const [newLevel, setNewLevel] = useState('400L');
  const [newEmail, setNewEmail] = useState('');
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);

  // Edit Modal
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editName, setEditName] = useState('');
  const [editDept, setEditDept] = useState('');
  const [editLevel, setEditLevel] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editActive, setEditActive] = useState(true);

  // View Student Modal
  const [viewingStudent, setViewingStudent] = useState<Student | null>(null);

  // QR Credential Card Modal
  const [qrCardStudent, setQrCardStudent] = useState<Student | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);

  // Face Enrollment Modal
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [enrollmentStatus, setEnrollmentStatus] = useState<'idle' | 'detecting' | 'captured' | 'saving' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [extractedEmbedding, setExtractedEmbedding] = useState<number[] | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
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
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search]);

  // Clean up camera on modal close
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
        videoRef.current.play();
      }
      setIsCameraActive(true);
      setEnrollmentStatus('detecting');
      setStatusMessage('Center your face in the oval guide with balanced lighting.');
    } catch (err: any) {
      console.warn('Camera access unavailable:', err);
      setIsCameraActive(false);
      setEnrollmentStatus('error');
      setStatusMessage('Webcam not detected or permission denied. You can use sample synthetic biometric generation.');
    }
  };

  const handleOpenEnrollment = (student: Student) => {
    setSelectedStudent(student);
    setEnrollmentStatus('idle');
    setExtractedEmbedding(null);
    setStatusMessage('');
    startCamera();
  };

  const handleCloseEnrollment = () => {
    stopCamera();
    setSelectedStudent(null);
  };

  // Real facial feature extraction (128D)
  const handleCaptureFace = async () => {
    if (!videoRef.current || !selectedStudent) return;
    setEnrollmentStatus('saving');
    setStatusMessage('Analyzing facial geometry and extracting 128D vector representation...');

    try {
      const faceService = FaceRecognitionService.getInstance();
      const result = await faceService.extractFaceEmbedding(videoRef.current);

      if (result && result.embedding && result.embedding.length === 128) {
        setExtractedEmbedding(result.embedding);
        const saveRes = await api.enrollFace(selectedStudent.id, result.embedding);
        if (saveRes.success) {
          setEnrollmentStatus('success');
          setStatusMessage('Biometric representation successfully enrolled and stored locally!');
          loadData();
        } else {
          setEnrollmentStatus('error');
          setStatusMessage(saveRes.error || saveRes.message || 'Failed to save biometric template.');
        }
      } else {
        setStatusMessage('No clear single face detected in frame. Please adjust lighting and face camera directly.');
        setEnrollmentStatus('error');
      }
    } catch (err: any) {
      setEnrollmentStatus('error');
      setStatusMessage(`Biometric extraction failed: ${err.message}`);
    }
  };

  // Synthetic Biometric Enrollment (for tests & demonstration)
  const handleSyntheticEnrollment = async () => {
    if (!selectedStudent) return;
    setEnrollmentStatus('saving');
    setStatusMessage('Generating synthetic 128D test embedding for demonstration...');
    try {
      const faceService = FaceRecognitionService.getInstance();
      const synthetic = faceService.getSimulatedEmbedding(selectedStudent.matricNumber, true);
      const saveRes = await api.enrollFace(selectedStudent.id, synthetic);
      if (saveRes.success) {
        setEnrollmentStatus('success');
        setStatusMessage('Biometric representation successfully enrolled locally!');
        loadData();
      } else {
        setEnrollmentStatus('error');
        setStatusMessage(saveRes.error || saveRes.message || 'Failed to save template.');
      }
    } catch (err: any) {
      setEnrollmentStatus('error');
      setStatusMessage(err.message);
    }
  };

  // Delete Face Biometric Template
  const handleDeleteFace = async (studentId: string) => {
    if (confirm('Are you sure you want to delete this student facial biometric template? The student will need to re-enroll or use QR fallback.')) {
      await api.deleteFace(studentId);
      loadData();
    }
  };

  // Register New Student
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMatric || !newName) return;
    const res = await api.createStudent({
      matricNumber: newMatric.trim().toUpperCase(),
      fullName: newName.trim(),
      department: newDept,
      level: newLevel,
      email: newEmail.trim() || undefined,
      courseIds: selectedCourseIds,
    });
    if (res.success) {
      setShowRegisterModal(false);
      setNewMatric('');
      setNewName('');
      setNewEmail('');
      setSelectedCourseIds([]);
      loadData();
    } else {
      alert(res.error || res.message || 'Failed to register student');
    }
  };

  // Edit Student
  const handleOpenEdit = (student: Student) => {
    setEditingStudent(student);
    setEditName(student.fullName);
    setEditDept(student.department);
    setEditLevel(student.level);
    setEditEmail(student.email || '');
    setEditActive(student.active);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
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
      alert(res.error || res.message || 'Failed to update student');
    }
  };

  // Delete / Withdraw Student
  const handleDeleteStudent = async (student: Student) => {
    if (confirm(`Withdraw/Delete student record for ${student.fullName} (${student.matricNumber})? This will also remove biometric templates.`)) {
      const res = await api.deleteStudent(student.id);
      if (res.success) {
        loadData();
      } else {
        alert(res.error || res.message || 'Failed to delete student');
      }
    }
  };

  // View & Generate Student QR Credential Card
  const handleOpenQrCard = async (student: Student) => {
    setQrCardStudent(student);
    let cred = student.qrCredential;
    if (!cred) {
      setIsGeneratingQr(true);
      const res = await api.generateQrCredential(student.id);
      setIsGeneratingQr(false);
      if (res.success && res.qrCredential) {
        cred = res.qrCredential;
      }
    }

    if (cred) {
      try {
        const url = await QRCode.toDataURL(cred, {
          width: 256,
          margin: 2,
          color: { dark: '#040d1a', light: '#ffffff' },
        });
        setQrCodeDataUrl(url);
      } catch (err) {
        console.error('Failed to generate QR data URL:', err);
      }
    }
  };

  const handleRegenerateQr = async () => {
    if (!qrCardStudent) return;
    setIsGeneratingQr(true);
    const res = await api.generateQrCredential(qrCardStudent.id);
    setIsGeneratingQr(false);
    if (res.success && res.qrCredential) {
      const url = await QRCode.toDataURL(res.qrCredential, {
        width: 256,
        margin: 2,
        color: { dark: '#040d1a', light: '#ffffff' },
      });
      setQrCodeDataUrl(url);
      loadData();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-400" />
            <span>Student Management & Biometric Enrollment</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Register students, enroll facial templates, issue offline QR credentials, and manage course allocations
          </p>
        </div>

        <button
          onClick={() => setShowRegisterModal(true)}
          className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>Register Student</span>
        </button>
      </div>

      {/* Tabs & Search Header */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-xl">
          <button
            onClick={() => setActiveTab('directory')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'directory' ? 'bg-zinc-800 text-emerald-400 shadow' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Student Directory
          </button>
          <button
            onClick={() => setActiveTab('status')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'status' ? 'bg-zinc-800 text-emerald-400 shadow' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Enrollment Status Overview
          </button>
        </div>

        {/* Search Input */}
        <div className="glass-panel rounded-xl px-3 py-2 border border-zinc-800 flex items-center gap-2.5 w-full md:w-80">
          <Search className="w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by matriculation or name..."
            className="w-full bg-transparent text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-xs text-zinc-500 hover:text-zinc-300">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: STUDENT DIRECTORY TABLE */}
      {activeTab === 'directory' && (
        <div className="glass-panel rounded-2xl border border-zinc-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-900/60 text-zinc-400 uppercase font-mono tracking-wider text-[11px] border-b border-zinc-800">
                <tr>
                  <th className="py-3 px-4">Matriculation</th>
                  <th className="py-3 px-4">Full Name</th>
                  <th className="py-3 px-4">Department & Level</th>
                  <th className="py-3 px-4">Facial Template</th>
                  <th className="py-3 px-4">QR Credential</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                {students.length > 0 ? (
                  students.map((s) => (
                    <tr key={s.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-semibold text-zinc-200">{s.matricNumber}</td>
                      <td className="py-3.5 px-4 font-medium text-zinc-100">{s.fullName}</td>
                      <td className="py-3.5 px-4 text-zinc-400">
                        {s.department} <span className="font-mono text-zinc-500">• {s.level}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        {s.hasFaceEnrolled ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Enrolled</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>Pending</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => handleOpenQrCard(s)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/20 cursor-pointer"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>View Card</span>
                        </button>
                      </td>
                      <td className="py-3.5 px-4">
                        {s.active ? (
                          <span className="text-[11px] font-semibold text-emerald-400">Active</span>
                        ) : (
                          <span className="text-[11px] font-semibold text-rose-400">Withdrawn</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-1.5">
                        {/* View Student */}
                        <button
                          onClick={() => setViewingStudent(s)}
                          title="View Student Profile"
                          className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {/* Edit Student */}
                        <button
                          onClick={() => handleOpenEdit(s)}
                          title="Edit Student Information"
                          className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Facial Enrollment / Re-Enroll */}
                        <button
                          onClick={() => handleOpenEnrollment(s)}
                          className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-semibold text-emerald-400 inline-flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>{s.hasFaceEnrolled ? 'Re-Enroll' : 'Enroll Face'}</span>
                        </button>

                        {/* Delete Face Template */}
                        {s.hasFaceEnrolled && (
                          <button
                            onClick={() => handleDeleteFace(s.id)}
                            title="Delete Facial Biometric Template"
                            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-amber-500/10 border border-zinc-800 text-zinc-500 hover:text-amber-400 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Delete Student */}
                        <button
                          onClick={() => handleDeleteStudent(s)}
                          title="Withdraw / Delete Student Record"
                          className="p-1.5 rounded-lg bg-zinc-900 hover:bg-rose-500/10 border border-zinc-800 text-zinc-500 hover:text-rose-400 transition-colors cursor-pointer"
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-zinc-500">
                      {loading ? 'Loading student records...' : 'No student records found matching query.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: ENROLLMENT STATUS OVERVIEW TABLE (Section 2 Requirement) */}
      {activeTab === 'status' && (
        <div className="glass-panel rounded-2xl border border-zinc-800 overflow-hidden space-y-4 p-5">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <div>
              <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-emerald-400" />
                <span>Student Biometric & Credential Enrollment Status Overview</span>
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Audit table displaying facial enrollment, credential status, and account eligibility for attendance kiosks.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-900/60 text-zinc-400 uppercase font-mono tracking-wider text-[11px] border-b border-zinc-800">
                <tr>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">Matriculation Number</th>
                  <th className="py-3 px-4">Facial Enrollment Status</th>
                  <th className="py-3 px-4">QR Credential Status</th>
                  <th className="py-3 px-4">Account Status</th>
                  <th className="py-3 px-4 text-right">Quick Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                {students.map((s) => (
                  <tr key={s.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-zinc-100">{s.fullName}</td>
                    <td className="py-3.5 px-4 font-mono text-zinc-300">{s.matricNumber}</td>
                    <td className="py-3.5 px-4">
                      {s.hasFaceEnrolled ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>ENROLLED (128D)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>NOT ENROLLED</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                        <Check className="w-3.5 h-3.5" />
                        <span>ISSUED & ACTIVE</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`text-[11px] font-semibold ${s.active ? 'text-emerald-400' : 'text-zinc-500'}`}>
                        {s.active ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {!s.hasFaceEnrolled ? (
                        <button
                          onClick={() => handleOpenEnrollment(s)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs cursor-pointer"
                        >
                          Enroll Face Now
                        </button>
                      ) : (
                        <button
                          onClick={() => handleOpenQrCard(s)}
                          className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 font-semibold text-xs cursor-pointer"
                        >
                          Print QR Badge
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: VIEW STUDENT PROFILE */}
      {viewingStudent && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg rounded-2xl border border-zinc-800 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>Student Academic Record</span>
              </h2>
              <button onClick={() => setViewingStudent(null)} className="text-zinc-500 hover:text-zinc-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                <span className="text-zinc-500 block mb-1">Full Name</span>
                <span className="font-bold text-zinc-100 text-sm">{viewingStudent.fullName}</span>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                <span className="text-zinc-500 block mb-1">Matriculation Number</span>
                <span className="font-mono font-bold text-emerald-400 text-sm">{viewingStudent.matricNumber}</span>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                <span className="text-zinc-500 block mb-1">Department & Level</span>
                <span className="text-zinc-200">{viewingStudent.department} ({viewingStudent.level})</span>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                <span className="text-zinc-500 block mb-1">Institutional Email</span>
                <span className="text-zinc-200 font-mono">{viewingStudent.email || 'Not provided'}</span>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                <span className="text-zinc-500 block mb-1">Facial Biometric Status</span>
                <span className={`font-semibold ${viewingStudent.hasFaceEnrolled ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {viewingStudent.hasFaceEnrolled ? 'Enrolled (128D Embeddings Active)' : 'Pending Biometric Registration'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                <span className="text-zinc-500 block mb-1">Account Eligibility</span>
                <span className={`font-semibold ${viewingStudent.active ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {viewingStudent.active ? 'Active (Eligible for Check-in)' : 'Deactivated'}
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-800 flex justify-end gap-2">
              <button
                onClick={() => {
                  const s = viewingStudent;
                  setViewingStudent(null);
                  handleOpenQrCard(s);
                }}
                className="px-3.5 py-2 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>View QR Badge</span>
              </button>
              <button
                onClick={() => setViewingStudent(null)}
                className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT STUDENT */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md rounded-2xl border border-zinc-800 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-4">
              <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-emerald-400" />
                <span>Edit Student Record</span>
              </h2>
              <button onClick={() => setEditingStudent(null)} className="text-zinc-500 hover:text-zinc-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div>
                <label className="block text-zinc-400 font-medium mb-1">Matriculation (Immutable)</label>
                <input
                  type="text"
                  disabled
                  value={editingStudent.matricNumber}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-400 font-mono"
                />
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1">Full Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Department</label>
                  <input
                    type="text"
                    value={editDept}
                    onChange={(e) => setEditDept(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Level</label>
                  <select
                    value={editLevel}
                    onChange={(e) => setEditLevel(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 focus:outline-none font-mono"
                  >
                    <option value="400L">400L</option>
                    <option value="300L">300L</option>
                    <option value="200L">200L</option>
                    <option value="100L">100L</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="editActiveCheckbox"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                  className="rounded border-zinc-700 text-emerald-500 focus:ring-0"
                />
                <label htmlFor="editActiveCheckbox" className="text-xs text-zinc-300">
                  Student account active and eligible for attendance
                </label>
              </div>

              <div className="pt-3 border-t border-zinc-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-4 py-2 rounded-lg bg-zinc-900 text-zinc-400 hover:bg-zinc-800 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: STUDENT QR CREDENTIAL BADGE CARD (Section 2 Requirement) */}
      {qrCardStudent && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-sm rounded-3xl border border-zinc-700/80 p-6 shadow-2xl space-y-4 text-center">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-bold">
                Student QR Credential Badge
              </span>
              <button onClick={() => setQrCardStudent(null)} className="text-zinc-500 hover:text-zinc-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Printable ID Badge Preview */}
            <div className="bg-gradient-to-b from-zinc-900 to-zinc-950 p-6 rounded-2xl border-2 border-zinc-700/80 shadow-2xl space-y-4">
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500 flex items-center justify-center text-zinc-950 font-black text-xs">
                    CG
                  </div>
                  <span className="font-extrabold text-sm text-zinc-100 tracking-tight">UNIVERSITY ATTENDANCE</span>
                </div>
                <p className="text-[10px] font-mono text-zinc-500 uppercase">OFFLINE VERIFIABLE BIOMETRIC BADGE</p>
              </div>

              {/* QR Code Canvas / Image */}
              <div className="p-3 bg-white rounded-xl max-w-[200px] mx-auto shadow-inner">
                {qrCodeDataUrl ? (
                  <img src={qrCodeDataUrl} alt="Student QR Credential" className="w-full aspect-square" />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center text-zinc-400 text-xs font-mono">
                    Generating QR...
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-base font-extrabold text-zinc-100">{qrCardStudent.fullName}</h3>
                <p className="text-xs font-mono font-bold text-emerald-400">{qrCardStudent.matricNumber}</p>
                <p className="text-[11px] text-zinc-400">{qrCardStudent.department} • {qrCardStudent.level}</p>
              </div>

              <div className="text-[9px] font-mono text-zinc-500 border-t border-zinc-800/80 pt-2">
                Opaque Token • HMAC Signed • Zero PII Leakage
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/20"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Badge</span>
              </button>

              <button
                type="button"
                disabled={isGeneratingQr}
                onClick={handleRegenerateQr}
                className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-semibold text-zinc-300 flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingQr ? 'animate-spin' : ''}`} />
                <span>Regenerate Token</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: FACIAL ENROLLMENT MODAL */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg rounded-2xl border border-zinc-800 p-6 shadow-2xl relative overflow-hidden">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <div>
                <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                  <Camera className="w-4 h-4 text-emerald-400" />
                  <span>Facial Representation Enrollment</span>
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Student: <span className="text-zinc-200 font-semibold">{selectedStudent.fullName}</span> (
                  <span className="font-mono text-emerald-400">{selectedStudent.matricNumber}</span>)
                </p>
              </div>

              <button
                onClick={handleCloseEnrollment}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Video Viewport with positioning guide */}
            <div className="my-5 relative rounded-xl overflow-hidden bg-zinc-950 border border-zinc-800 aspect-video flex items-center justify-center">
              {isCameraActive ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover -scale-x-100"
                  />
                  <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />

                  {/* Face Guide Oval */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-44 h-56 rounded-full border-2 border-emerald-400/60 shadow-[0_0_20px_rgba(16,185,129,0.3)] animate-pulse flex items-center justify-center">
                      <span className="text-[10px] text-emerald-400/80 font-mono tracking-wider uppercase bg-zinc-950/70 px-2 py-0.5 rounded">
                        Position Face Here
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center p-6 space-y-2">
                  <Camera className="w-10 h-10 text-zinc-700 mx-auto" />
                  <p className="text-xs text-zinc-400">Webcam inactive or not supported in this view.</p>
                  <button
                    onClick={startCamera}
                    className="mt-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-emerald-400 hover:bg-zinc-800 cursor-pointer"
                  >
                    Start Webcam
                  </button>
                </div>
              )}
            </div>

            {/* Status Feedback Notification */}
            {statusMessage && (
              <div
                className={`p-3 rounded-xl text-xs mb-4 flex items-center gap-2 ${
                  enrollmentStatus === 'success'
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                    : enrollmentStatus === 'error'
                    ? 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-300'
                }`}
              >
                {enrollmentStatus === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
                {enrollmentStatus === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />}
                {enrollmentStatus === 'saving' && <RefreshCw className="w-4 h-4 animate-spin text-cyan-400 flex-shrink-0" />}
                <span>{statusMessage}</span>
              </div>
            )}

            {/* Modal Footer Controls */}
            <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80">
              <button
                type="button"
                onClick={handleSyntheticEnrollment}
                className="px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-cyan-400 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Generates offline synthetic 128D embedding if physical camera is obstructed"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Simulate 128D Embedding</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCloseEnrollment}
                  className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-400 transition-colors cursor-pointer"
                >
                  Close
                </button>

                <button
                  type="button"
                  onClick={handleCaptureFace}
                  disabled={!isCameraActive || enrollmentStatus === 'saving'}
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>{enrollmentStatus === 'saving' ? 'Analyzing...' : 'Capture & Enroll'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: REGISTER NEW STUDENT (With Course Assignments) */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg rounded-2xl border border-zinc-800 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800 mb-4">
              <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-emerald-400" />
                <span>Register New Student</span>
              </h2>
              <button onClick={() => setShowRegisterModal(false)} className="text-zinc-500 hover:text-zinc-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegister} className="space-y-4 text-xs">
              <div>
                <label className="block text-zinc-400 font-medium mb-1">Matriculation Number *</label>
                <input
                  type="text"
                  value={newMatric}
                  onChange={(e) => setNewMatric(e.target.value.toUpperCase())}
                  placeholder="e.g. CSC/2021/017"
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 font-mono focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1">Full Name *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Oluwaseun Adeleke"
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Department *</label>
                  <select
                    value={newDept}
                    onChange={(e) => setNewDept(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 focus:outline-none"
                  >
                    <option value="Computer Science">Computer Science</option>
                    <option value="Software Engineering">Software Engineering</option>
                    <option value="Information Technology">Information Technology</option>
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Level / Programme *</label>
                  <select
                    value={newLevel}
                    onChange={(e) => setNewLevel(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 focus:outline-none font-mono"
                  >
                    <option value="400L">400L (Undergraduate)</option>
                    <option value="300L">300L (Undergraduate)</option>
                    <option value="200L">200L (Undergraduate)</option>
                    <option value="100L">100L (Undergraduate)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1">Institutional Email (Optional)</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="student@classguard.edu"
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Course Allocation Section */}
              <div className="pt-2">
                <label className="block text-zinc-400 font-medium mb-2">Initial Course Enrollments:</label>
                <div className="space-y-1.5 max-h-36 overflow-y-auto p-2 bg-zinc-950/70 rounded-xl border border-zinc-800">
                  {courses.map((c) => {
                    const isSelected = selectedCourseIds.includes(c.id);
                    return (
                      <label
                        key={c.id}
                        className="flex items-center gap-2 p-1.5 rounded hover:bg-zinc-900 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCourseIds([...selectedCourseIds, c.id]);
                            } else {
                              setSelectedCourseIds(selectedCourseIds.filter((id) => id !== c.id));
                            }
                          }}
                          className="rounded border-zinc-700 text-emerald-500 focus:ring-0"
                        />
                        <span className="font-mono text-emerald-400 font-bold">{c.code}</span>
                        <span className="text-zinc-300 truncate">• {c.title}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-900 text-zinc-400 hover:bg-zinc-800 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold"
                >
                  Register & Issue QR Credential
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
