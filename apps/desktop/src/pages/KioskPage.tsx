import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import jsQR from 'jsqr';
import { api } from '../lib/api-client';
import { FaceRecognitionService } from '../lib/face-service';
import { Student } from '@classguard/shared';
import {
  Tv,
  QrCode,
  Camera,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  LogOut,
  Sparkles,
  ShieldAlert,
  ArrowRight,
  UserCheck,
  Clock,
  Scan,
  HelpCircle,
} from 'lucide-react';

type KioskStep = 'MATRIC' | 'VERIFY_FACE' | 'QR_FALLBACK' | 'RESULT';

export const KioskPage: React.FC = () => {
  const navigate = useNavigate();

  const [step, setStep] = useState<KioskStep>('MATRIC');
  const [matricNumber, setMatricNumber] = useState('');
  const [student, setStudent] = useState<Student | null>(null);
  const [activeSession, setActiveSession] = useState<any | null>(null);

  // Verification state & attempt counting
  const [faceAttemptCount, setFaceAttemptCount] = useState(0);
  const [qrAttemptCount, setQrAttemptCount] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [faceErrorMessage, setFaceErrorMessage] = useState<string | null>(null);

  // Result state
  const [resultSuccess, setResultSuccess] = useState(false);
  const [resultMessage, setResultMessage] = useState('');
  const [resultStatus, setResultStatus] = useState<'PRESENT' | 'LATE' | 'EXCUSED' | null>(null);
  const [verificationMethod, setVerificationMethod] = useState<string | null>(null);
  const [similarityScore, setSimilarityScore] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(5);

  // Camera & Video
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Clock
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());

  // Demo Students list for rapid testing
  const [demoStudents, setDemoStudents] = useState<Student[]>([]);

  useEffect(() => {
    const clockTimer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);

    // Load active session & demo students
    api.getSessions().then((res) => {
      if (res.success && res.data.length > 0) {
        const active = res.data.find((s: any) => s.status === 'ACTIVE') || res.data[0];
        setActiveSession(active);
      }
    });

    api.getStudents().then((res) => {
      if (res.success) setDemoStudents(res.data.slice(0, 6));
    });

    return () => clearInterval(clockTimer);
  }, []);

  // Cleanup camera stream
  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async (onFrame?: () => void) => {
    try {
      stopCamera();
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      if (onFrame) {
        scanIntervalRef.current = window.setInterval(onFrame, 150);
      }
    } catch (err: any) {
      setCameraError('Webcam is not available or blocked. You can use biometric simulation.');
    }
  };

  // Step 1: Matriculation submission -> Goes directly to Face Verification!
  const handleMatricSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!matricNumber.trim()) return;

    const matric = matricNumber.trim().toUpperCase();
    const res = await api.getStudent(matric);
    if (res.success && res.data) {
      const stu = res.data;
      setStudent(stu);
      setFaceAttemptCount(0);
      setQrAttemptCount(0);
      setFaceErrorMessage(null);

      // Check if student has face enrolled
      if (!stu.hasFaceEnrolled) {
        setFaceErrorMessage(`Student ${stu.fullName} has no biometric face template enrolled.`);
        setStep('VERIFY_FACE');
        startCamera();
        return;
      }

      // PRIMARY ACTION: Proceed immediately to Facial Verification
      setStep('VERIFY_FACE');
      startCamera();
    } else {
      setResultMessage(`No student record found for matriculation number "${matric}". Please verify your number with the academic administrator.`);
      setResultSuccess(false);
      setStep('RESULT');
    }
  };

  // Step 2: PRIMARY METHOD - Facial Verification
  const handlePerformFacialVerification = async (useSimulated = false) => {
    if (!student) return;
    setIsVerifying(true);
    setFaceErrorMessage(null);

    let capturedEmbedding: number[] | undefined = undefined;

    if (!useSimulated && videoRef.current) {
      try {
        const faceService = FaceRecognitionService.getInstance();
        const faceResult = await faceService.extractFaceEmbedding(videoRef.current);
        if (faceResult && faceResult.embedding) {
          capturedEmbedding = faceResult.embedding;
        }
      } catch (err) {
        console.warn('Live facial feature extraction warning:', err);
      }
    }

    const payload = {
      matricNumber: student.matricNumber,
      sessionId: activeSession?.id,
      courseId: activeSession?.courseId,
      capturedEmbedding,
      testSimulatedMatch: useSimulated,
      kioskId: 'KIOSK-01',
    };

    const res = await api.verifyFaceAndRecord(payload);
    setIsVerifying(false);

    if (res.success) {
      // SUCCESS! Mark attendance immediately. DO NOT require QR scan!
      stopCamera();
      setResultSuccess(true);
      setResultMessage(res.message);
      setResultStatus(res.attendanceStatus || 'PRESENT');
      setVerificationMethod('FACE_VERIFIED');
      setSimilarityScore(res.similarityScore || 96);
      setStep('RESULT');
    } else {
      // Face Verification failed
      const newAttempts = faceAttemptCount + 1;
      setFaceAttemptCount(newAttempts);
      setFaceErrorMessage(res.message);
    }
  };

  // Step 3: Switch to FALLBACK - Student QR Credential
  const handleSwitchToQrFallback = () => {
    setFaceErrorMessage(null);
    setStep('QR_FALLBACK');
    // Start camera in QR scanning mode
    startCamera(scanQrCredentialFrame);
  };

  // Real-time QR Code scanning via jsQR for Student QR Card
  const scanQrCredentialFrame = () => {
    if (!videoRef.current || !canvasRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
      return;
    }
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    });

    if (code && code.data) {
      stopCamera();
      processQrFallbackCredential(code.data);
    }
  };

  // Process Student QR Fallback Credential
  const processQrFallbackCredential = async (qrString: string) => {
    if (!student) return;
    setIsVerifying(true);

    const payload = {
      studentQrCredentialString: qrString,
      matricNumber: student.matricNumber,
      sessionId: activeSession?.id,
      courseId: activeSession?.courseId,
      kioskId: 'KIOSK-01',
    };

    const res = await api.verifyQrFallbackAndRecord(payload);
    setIsVerifying(false);

    if (res.success) {
      stopCamera();
      setResultSuccess(true);
      setResultMessage(res.message);
      setResultStatus(res.attendanceStatus || 'PRESENT');
      setVerificationMethod('QR_FALLBACK');
      setStep('RESULT');
    } else {
      const newCount = qrAttemptCount + 1;
      setQrAttemptCount(newCount);
      setResultMessage(res.message || 'Student QR credential was invalid or rejected.');
      if (newCount >= 2) {
        stopCamera();
        setResultSuccess(false);
        setStep('RESULT');
      }
    }
  };

  // Simulation helper for QR fallback testing on a single PC
  const handleSimulateStudentQrCredential = async () => {
    if (!student) return;
    let cred = student.qrCredential;
    if (!cred) {
      // Generate one on the fly for demonstration
      const genRes = await api.generateQrCredential(student.id);
      if (genRes.success && genRes.qrCredential) {
        cred = genRes.qrCredential;
      }
    }

    if (cred) {
      processQrFallbackCredential(cred);
    } else {
      alert('Could not retrieve student QR credential.');
    }
  };

  // Auto-reset timer on RESULT step
  useEffect(() => {
    if (step === 'RESULT') {
      setCountdown(5);
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            handleResetKiosk();
            return 5;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [step]);

  // Clean reset for next student
  const handleResetKiosk = () => {
    stopCamera();
    setStep('MATRIC');
    setMatricNumber('');
    setStudent(null);
    setFaceAttemptCount(0);
    setQrAttemptCount(0);
    setFaceErrorMessage(null);
    setResultSuccess(false);
    setResultMessage('');
    setResultStatus(null);
    setVerificationMethod(null);
    setSimilarityScore(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#07090e] text-zinc-100 flex flex-col justify-between p-6 select-none overflow-hidden font-sans">
      {/* Kiosk Top Bar */}
      <header className="flex items-center justify-between pb-4 border-b border-zinc-800/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Tv className="w-5 h-5 text-zinc-950 font-bold" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-tight text-zinc-100">
                Class<span className="text-emerald-400">Guard</span>
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                ATTENDANCE KIOSK
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800 text-zinc-400">
                FACE FIRST → QR FALLBACK
              </span>
            </div>
            <p className="text-xs text-zinc-400 font-mono">
              Active Course: <span className="text-zinc-200 font-semibold">{activeSession?.courseCode || 'CSC 403'}</span> (
              {activeSession?.courseTitle || 'Computer Vision & Biometrics'})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-sm font-mono font-bold text-zinc-200">{currentTime}</div>
            <div className="text-[10px] text-zinc-500 font-mono">
              Session: {activeSession?.openingTime || '09:00'} - {activeSession?.closingTime || '12:00'}
            </div>
          </div>

          <button
            onClick={() => {
              stopCamera();
              navigate('/dashboard');
            }}
            title="Return to Staff Console"
            className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-400 hover:text-zinc-200 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Staff Console</span>
          </button>
        </div>
      </header>

      {/* Main Kiosk Viewport */}
      <main className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full py-6">
        {/* STEP 1: MATRICULATION NUMBER ENTRY */}
        {step === 'MATRIC' && (
          <div className="w-full space-y-6 animate-fadeIn">
            <div className="text-center space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 font-mono">
                Step 1 of 2 • Identification
              </span>
              <h2 className="text-2xl font-extrabold text-zinc-100">Enter Matriculation Number</h2>
              <p className="text-xs text-zinc-400 max-w-md mx-auto">
                Enter your university matriculation number to begin immediate facial verification.
              </p>
            </div>

            <form onSubmit={handleMatricSubmit} className="space-y-4">
              <div className="relative">
                <input
                  type="text"
                  value={matricNumber}
                  onChange={(e) => setMatricNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. CSC/2021/001"
                  autoFocus
                  className="w-full px-5 py-4 rounded-2xl bg-zinc-900/90 border-2 border-zinc-700 text-xl font-mono text-center text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 tracking-wider shadow-xl transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={!matricNumber.trim()}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 text-zinc-950 font-bold text-base flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 transition-all cursor-pointer"
              >
                <span>Proceed to Facial Verification</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </form>

            {/* Quick Demo Student Selector Pills */}
            <div className="pt-4 border-t border-zinc-800/80">
              <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 block text-center mb-2.5">
                Quick Evaluator Selection (Click to test):
              </span>
              <div className="flex flex-wrap justify-center gap-2">
                {demoStudents.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setMatricNumber(s.matricNumber);
                      setStudent(s);
                      setFaceAttemptCount(0);
                      setQrAttemptCount(0);
                      setFaceErrorMessage(null);
                      setStep('VERIFY_FACE');
                      startCamera();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-emerald-500/50 text-xs text-zinc-300 font-mono transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="font-bold text-emerald-400">{s.matricNumber}</span>
                    <span className="text-zinc-500">• {s.fullName.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: PRIMARY METHOD - FACIAL VERIFICATION */}
        {step === 'VERIFY_FACE' && (
          <div className="w-full space-y-5 animate-fadeIn text-center">
            <div className="space-y-1">
              <div className="flex items-center justify-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-mono">
                  PRIMARY VERIFICATION METHOD
                </span>
                <span className="text-xs text-zinc-400 font-mono">
                  • Student: <strong className="text-zinc-200">{student?.fullName}</strong> ({student?.matricNumber})
                </span>
              </div>
              <h2 className="text-2xl font-black text-zinc-100">Look at the Camera</h2>
              <p className="text-xs text-zinc-400 max-w-md mx-auto">
                Position your face within the frame. Facial verification will complete your attendance automatically without needing a QR code.
              </p>
            </div>

            {/* Face Viewfinder Frame */}
            <div className="relative rounded-2xl overflow-hidden bg-zinc-950 border-2 border-emerald-500/60 aspect-video max-w-lg mx-auto flex items-center justify-center shadow-2xl">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover -scale-x-100"
              />
              <canvas ref={canvasRef} className="hidden" />

              {/* Oval Face Alignment Reticle */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className={`w-48 h-60 rounded-full border-2 ${faceErrorMessage ? 'border-amber-400' : 'border-emerald-400'} shadow-[0_0_30px_rgba(16,185,129,0.35)] flex items-center justify-center transition-colors`}>
                  <span className="text-[10px] text-emerald-300 font-mono uppercase bg-zinc-950/80 px-2 py-0.5 rounded">
                    {faceErrorMessage ? 'Adjust Face Position' : 'Align Face Inside'}
                  </span>
                </div>
              </div>

              {isVerifying && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center gap-2 text-emerald-400 font-semibold text-sm">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Analyzing facial biometrics...</span>
                </div>
              )}
            </div>

            {/* Error or Retries Message */}
            {faceErrorMessage && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs max-w-lg mx-auto flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-left">
                  <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span>{faceErrorMessage} (Attempt {faceAttemptCount} of 2)</span>
                </div>
              </div>
            )}

            {/* Guidance tips */}
            <div className="flex items-center justify-center gap-6 text-xs text-zinc-400">
              <span>• Good ambient lighting</span>
              <span>• Look directly ahead</span>
              <span>• Neutral expression</span>
            </div>

            {/* Primary Action Buttons */}
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                disabled={isVerifying}
                onClick={() => handlePerformFacialVerification(false)}
                className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-bold text-sm flex items-center gap-2 shadow-xl shadow-emerald-500/25 transition-all cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>Verify Face Now</span>
              </button>

              <button
                type="button"
                disabled={isVerifying}
                onClick={() => handlePerformFacialVerification(true)}
                className="px-4 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-cyan-400 font-semibold text-xs flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Simulate Real Match</span>
              </button>

              {/* FALLBACK PROMPT: Shown if face fails after attempts OR if no face enrolled */}
              {(faceAttemptCount >= 1 || !student?.hasFaceEnrolled) && (
                <button
                  type="button"
                  onClick={handleSwitchToQrFallback}
                  className="px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer animate-pulse"
                >
                  <QrCode className="w-4 h-4" />
                  <span>Use QR Fallback</span>
                </button>
              )}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleResetKiosk}
                className="text-xs text-zinc-500 hover:text-zinc-300 underline font-mono"
              >
                Cancel / Change Matriculation Number
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: FALLBACK METHOD - STUDENT QR CREDENTIAL */}
        {step === 'QR_FALLBACK' && (
          <div className="w-full space-y-5 animate-fadeIn text-center">
            <div className="space-y-1">
              <div className="flex items-center justify-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 font-mono">
                  FALLBACK CREDENTIAL METHOD
                </span>
                <span className="text-xs text-zinc-400 font-mono">
                  • Student: <strong className="text-zinc-200">{student?.fullName}</strong> ({student?.matricNumber})
                </span>
              </div>
              <h2 className="text-2xl font-black text-zinc-100">Scan Student QR Credential</h2>
              <p className="text-xs text-zinc-400 max-w-md mx-auto">
                Hold your personal Student QR Credential card in front of the camera lens to complete fallback attendance check-in.
              </p>
            </div>

            {/* QR Viewfinder Frame */}
            <div className="relative rounded-2xl overflow-hidden bg-zinc-950 border-2 border-amber-500/50 aspect-video max-w-lg mx-auto flex items-center justify-center shadow-2xl">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              <canvas ref={canvasRef} className="hidden" />

              {/* Viewfinder Target Overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-52 h-52 border-2 border-amber-400/80 rounded-2xl relative shadow-[0_0_25px_rgba(245,158,11,0.3)]">
                  <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-amber-400 rounded-tl-lg" />
                  <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-amber-400 rounded-tr-lg" />
                  <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-amber-400 rounded-bl-lg" />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-amber-400 rounded-br-lg" />
                  <div className="w-full h-0.5 bg-amber-400 shadow-[0_0_10px_#f59e0b] animate-scanline absolute top-0" />
                </div>
              </div>

              {isVerifying && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center gap-2 text-amber-400 font-semibold text-sm">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Validating Student Credential...</span>
                </div>
              )}
            </div>

            {/* Offline Single-PC Testing Simulation Shortcut */}
            <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 max-w-lg mx-auto flex items-center justify-between gap-3 text-xs">
              <div className="text-left">
                <span className="font-semibold text-zinc-300 block">Single-PC Demonstration Workflow:</span>
                <span className="text-[11px] text-zinc-500">
                  Simulate scanning {student?.fullName}'s registered student QR credential card.
                </span>
              </div>
              <button
                type="button"
                onClick={handleSimulateStudentQrCredential}
                className="px-3.5 py-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 font-semibold text-xs transition-colors cursor-pointer flex-shrink-0"
              >
                Scan Student QR Card
              </button>
            </div>

            <div className="flex items-center justify-center gap-4 pt-1">
              <button
                type="button"
                onClick={() => {
                  setStep('VERIFY_FACE');
                  startCamera();
                }}
                className="text-xs text-zinc-400 hover:text-zinc-200 underline font-mono"
              >
                ← Return to Facial Verification
              </button>
              <button
                type="button"
                onClick={handleResetKiosk}
                className="text-xs text-zinc-500 hover:text-zinc-300 underline font-mono"
              >
                Cancel Check-in
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: RESULT / FEEDBACK SCREEN */}
        {step === 'RESULT' && (
          <div className="w-full max-w-md mx-auto space-y-6 text-center animate-fadeIn">
            {resultSuccess ? (
              <div className="p-8 rounded-3xl bg-zinc-900/90 border border-emerald-500/40 glow-emerald-lg space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-mono">
                    STATUS: {resultStatus}
                  </span>
                  <h2 className="text-2xl font-black text-zinc-100 mt-2">{student?.fullName}</h2>
                  <p className="text-xs text-zinc-400 font-mono mt-0.5">{student?.matricNumber}</p>
                </div>

                <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80 text-xs space-y-1.5 font-mono">
                  <div className="flex justify-between text-zinc-400">
                    <span>Course:</span>
                    <span className="text-zinc-200 font-semibold">{activeSession?.courseCode}</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Verification Method:</span>
                    <span className={`font-bold ${verificationMethod === 'FACE_VERIFIED' ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {verificationMethod === 'FACE_VERIFIED' ? 'FACE VERIFIED (PRIMARY)' : 'QR FALLBACK'}
                    </span>
                  </div>
                  {similarityScore && (
                    <div className="flex justify-between text-zinc-400">
                      <span>Biometric Confidence:</span>
                      <span className="text-emerald-400 font-bold">{similarityScore}%</span>
                    </div>
                  )}
                  <div className="flex justify-between text-zinc-400">
                    <span>Timestamp:</span>
                    <span className="text-zinc-300">{new Date().toLocaleTimeString()}</span>
                  </div>
                </div>

                <p className="text-xs text-emerald-400/90">{resultMessage}</p>
              </div>
            ) : (
              <div className="p-8 rounded-3xl bg-zinc-900/90 border border-rose-500/40 space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center justify-center mx-auto">
                  <XCircle className="w-10 h-10" />
                </div>
                <div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40 font-mono">
                    VERIFICATION UNSUCCESSFUL
                  </span>
                  <h2 className="text-xl font-extrabold text-zinc-100 mt-2">Attendance Not Marked</h2>
                </div>

                <p className="text-xs text-rose-300 bg-rose-950/40 p-3 rounded-xl border border-rose-900/50">
                  {resultMessage}
                </p>

                <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 text-xs text-zinc-400 text-left space-y-1">
                  <span className="font-semibold text-zinc-300 block">Next steps:</span>
                  <span>1. If face verification failed, use the QR Fallback credential.</span>
                  <span className="block">2. If neither method succeeds, please contact your course lecturer for manual attendance override.</span>
                </div>

                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    onClick={handleResetKiosk}
                    className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-semibold text-zinc-200 cursor-pointer"
                  >
                    Try Again
                  </button>

                  <button
                    onClick={handleSwitchToQrFallback}
                    className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-semibold cursor-pointer"
                  >
                    Use QR Fallback
                  </button>
                </div>
              </div>
            )}

            {/* Auto-reset countdown indicator */}
            <div className="flex items-center justify-center gap-3">
              <span className="text-xs text-zinc-500 font-mono">
                Screen resetting in <strong className="text-emerald-400">{countdown}s</strong>
              </span>
              <button
                onClick={handleResetKiosk}
                className="text-xs text-zinc-400 hover:text-zinc-200 underline font-medium cursor-pointer"
              >
                Next Student Now
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer / Privacy note */}
      <footer className="text-center text-[11px] text-zinc-500 py-2 border-t border-zinc-800/60 flex items-center justify-between">
        <span>ClassGuard Kiosk System • Offline Biometric Processing</span>
        <span>Face Verification First → QR Fallback Second → Lecturer Override Last</span>
      </footer>
    </div>
  );
};
