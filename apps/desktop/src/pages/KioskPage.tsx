import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import jsQR from 'jsqr';
import { api } from '../lib/api-client';
import { FaceRecognitionService } from '../lib/face-service';
import { Student, AttendanceSession, isValidMatricNumber } from '@classguard/shared';
import {
  Tv,
  QrCode,
  Camera,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  Clock,
  ShieldCheck,
  RefreshCw,
  Loader2,
  ArrowLeft,
  X,
} from 'lucide-react';

type KioskStep = 'WAITING_SESSION' | 'ENTER_MATRIC' | 'VERIFY_FACE' | 'QR_FALLBACK' | 'RESULT';

export const KioskPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [step, setStep] = useState<KioskStep>('WAITING_SESSION');
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  // Student & Verification State
  const [matricNumber, setMatricNumber] = useState('');
  const [matricError, setMatricError] = useState<string | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [faceAttempts, setFaceAttempts] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationFeedback, setVerificationFeedback] = useState<string | null>(null);

  // Result state
  const [resultSuccess, setResultSuccess] = useState(false);
  const [resultMessage, setResultMessage] = useState('');
  const [attendanceStatus, setAttendanceStatus] = useState<'PRESENT' | 'LATE' | 'EXCUSED' | null>(null);
  const [verificationMethod, setVerificationMethod] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(5);

  // Camera references
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const qrScanTimerRef = useRef<number | null>(null);

  // Clock
  const [clock, setClock] = useState(new Date().toLocaleTimeString());

  // 1. Resolve and validate active session from URL param or lecturer console
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setClock(new Date().toLocaleTimeString());
    }, 1000);

    const resolveSession = async () => {
      setSessionLoading(true);
      try {
        const queryParams = new URLSearchParams(location.search);
        const querySessionId = queryParams.get('session');

        const res = await api.getSessions();
        if (res.success && res.data) {
          let matched: AttendanceSession | null = null;
          if (querySessionId) {
            matched = res.data.find((s) => s.id === querySessionId && s.status === 'ACTIVE') || null;
          }
          if (!matched) {
            // Find any currently ACTIVE session
            matched = res.data.find((s) => s.status === 'ACTIVE') || null;
          }

          if (matched) {
            setActiveSession(matched);
            setStep('ENTER_MATRIC');
          } else {
            setActiveSession(null);
            setStep('WAITING_SESSION');
          }
        }
      } catch (err) {
        console.error('Failed to resolve active session:', err);
        setStep('WAITING_SESSION');
      } finally {
        setSessionLoading(false);
      }
    };

    resolveSession();

    return () => {
      clearInterval(clockInterval);
      stopCamera();
    };
  }, [location.search]);

  // Privacy reset countdown on result screen
  useEffect(() => {
    if (step === 'RESULT') {
      setCountdown(5);
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            resetKioskForNextStudent();
            return 5;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [step]);

  const stopCamera = () => {
    if (qrScanTimerRef.current) {
      clearInterval(qrScanTimerRef.current);
      qrScanTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async (onFrame?: () => void) => {
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
      if (onFrame) {
        qrScanTimerRef.current = window.setInterval(onFrame, 200);
      }
    } catch (err: any) {
      setVerificationFeedback('Webcam access was denied or hardware not found.');
    }
  };

  const resetKioskForNextStudent = () => {
    stopCamera();
    setMatricNumber('');
    setMatricError(null);
    setStudent(null);
    setFaceAttempts(0);
    setIsVerifying(false);
    setVerificationFeedback(null);
    setResultSuccess(false);
    setResultMessage('');
    setAttendanceStatus(null);
    setVerificationMethod(null);
    setStep(activeSession ? 'ENTER_MATRIC' : 'WAITING_SESSION');
  };

  // Step 1: Matriculation Number Submission
  const handleMatricSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanMatric = matricNumber.trim().toUpperCase();

    if (!cleanMatric) {
      setMatricError('Please enter your matriculation number.');
      return;
    }

    if (!isValidMatricNumber(cleanMatric)) {
      setMatricError('Invalid format. Must match 2xxx/2xxxxx (e.g. 2022/241414)');
      return;
    }

    setMatricError(null);
    setIsVerifying(true);

    try {
      const res = await api.getStudent(cleanMatric);
      if (res.success && res.data) {
        const stu = res.data;
        setStudent(stu);
        setFaceAttempts(0);
        setVerificationFeedback(null);

        // Check course enrollment
        if (activeSession) {
          const enrollments = await api.getCourseEnrollments(activeSession.courseId);
          if (enrollments.success && enrollments.data) {
            const isEnrolled = enrollments.data.some((e: any) => e.studentId === stu.id);
            if (!isEnrolled) {
              setResultSuccess(false);
              setResultMessage(`Student ${stu.fullName} is not enrolled in course ${activeSession.courseCode || 'this course'}.`);
              setStep('RESULT');
              setIsVerifying(false);
              return;
            }
          }
        }

        // If student has no facial biometrics enrolled, direct immediately to QR fallback
        if (!stu.hasFaceEnrolled) {
          setVerificationFeedback(
            `Notice: No facial biometric template is enrolled for ${stu.fullName}. Please present your student QR credential card.`
          );
          setStep('QR_FALLBACK');
          startCamera(scanQrCodeFrame);
          setIsVerifying(false);
          return;
        }

        // PRIMARY WORKFLOW: Proceed to Facial Verification
        setStep('VERIFY_FACE');
        startCamera();
      } else {
        setMatricError(`Student with matriculation number "${cleanMatric}" was not found.`);
      }
    } catch (err: any) {
      setMatricError(err.message || 'Error looking up student record.');
    } finally {
      setIsVerifying(false);
    }
  };

  // Step 2: PRIMARY METHOD - Real Facial Verification
  const handlePerformFacialVerification = async () => {
    if (!student || !activeSession || !videoRef.current) return;
    setIsVerifying(true);
    setVerificationFeedback('Extracting facial representation using local neural network...');

    try {
      const faceService = FaceRecognitionService.getInstance();
      const faceResult = await faceService.extractFaceEmbedding(videoRef.current);

      if (!faceResult.success || !faceResult.embedding) {
        setIsVerifying(false);
        const newAttempts = faceAttempts + 1;
        setFaceAttempts(newAttempts);
        setVerificationFeedback(faceResult.message || 'No clear face detected in frame.');
        return;
      }

      // Send actual 128D descriptor to authoritative verification service
      const res = await api.verifyFaceAndRecord({
        matricNumber: student.matricNumber,
        sessionId: activeSession.id,
        courseId: activeSession.courseId,
        capturedEmbedding: faceResult.embedding,
        kioskId: 'KIOSK-STATION-01',
      });

      setIsVerifying(false);

      if (res.success) {
        // SUCCESS: Attendance recorded immediately! No QR scan needed!
        stopCamera();
        setResultSuccess(true);
        setResultMessage(res.message);
        setAttendanceStatus(res.attendanceStatus || 'PRESENT');
        setVerificationMethod('FACE_VERIFIED');
        setStep('RESULT');
      } else {
        const newAttempts = faceAttempts + 1;
        setFaceAttempts(newAttempts);
        setVerificationFeedback(res.message);

        // If duplicate record
        if (res.statusCode === 'ALREADY_MARKED') {
          stopCamera();
          setResultSuccess(false);
          setResultMessage(res.message);
          setStep('RESULT');
        }
      }
    } catch (err: any) {
      setIsVerifying(false);
      setVerificationFeedback(`Face verification error: ${err.message}`);
    }
  };

  // Switch to Fallback Method: Student QR Credential
  const handleSwitchToQrFallback = () => {
    setVerificationFeedback(null);
    setStep('QR_FALLBACK');
    startCamera(scanQrCodeFrame);
  };

  // Step 3: QR Fallback Frame Scanner (using jsQR)
  const scanQrCodeFrame = () => {
    if (!videoRef.current || !canvasRef.current || videoRef.current.readyState < 2) {
      return;
    }
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imgData.data, imgData.width, imgData.height, {
      inversionAttempts: 'dontInvert',
    });

    if (code && code.data) {
      stopCamera();
      processQrFallback(code.data);
    }
  };

  const processQrFallback = async (qrString: string) => {
    if (!student || !activeSession) return;
    setIsVerifying(true);
    setVerificationFeedback('Validating student QR credential signature...');

    try {
      const res = await api.verifyQrFallbackAndRecord({
        studentQrCredentialString: qrString,
        matricNumber: student.matricNumber,
        sessionId: activeSession.id,
        courseId: activeSession.courseId,
        kioskId: 'KIOSK-STATION-01',
      });

      setIsVerifying(false);

      if (res.success) {
        setResultSuccess(true);
        setResultMessage(res.message);
        setAttendanceStatus(res.attendanceStatus || 'PRESENT');
        setVerificationMethod('QR_FALLBACK');
        setStep('RESULT');
      } else {
        setResultSuccess(false);
        setResultMessage(
          `${res.message} If both facial verification and QR fallback fail, please notify your lecturer for manual attendance override.`
        );
        setStep('RESULT');
      }
    } catch (err: any) {
      setIsVerifying(false);
      setResultSuccess(false);
      setResultMessage(`QR processing failed: ${err.message}`);
      setStep('RESULT');
    }
  };

  // Return to lecturer console
  const handleExitKiosk = () => {
    stopCamera();
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen w-screen flex flex-col bg-zinc-950 text-zinc-100 select-none overflow-hidden relative">
      <canvas ref={canvasRef} className="hidden" />

      {/* Top Kiosk Header */}
      <header className="h-16 px-6 border-b border-zinc-800 bg-zinc-900/60 backdrop-blur-md flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-md shadow-emerald-500/20">
            <ShieldCheck className="w-5 h-5 text-zinc-950 font-bold" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-sm text-zinc-100">
                Class<span className="text-emerald-400">Guard</span>
              </span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                Attendance Kiosk
              </span>
            </div>
            {activeSession && (
              <p className="text-[11px] text-zinc-400 truncate max-w-sm">
                {activeSession.courseCode} • {activeSession.title}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 font-mono text-xs text-zinc-300 bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-800">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            <span>{clock}</span>
          </div>

          <button
            onClick={handleExitKiosk}
            title="Return to Lecturer Console"
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Kiosk Content Area */}
      <main className="flex-1 flex items-center justify-center p-6">
        {/* State: WAITING_SESSION */}
        {step === 'WAITING_SESSION' && (
          <div className="max-w-md w-full text-center space-y-4 p-8 rounded-2xl bg-zinc-900/50 border border-zinc-800 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-zinc-800/80 flex items-center justify-center mx-auto text-zinc-400">
              <Tv className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-zinc-100">No Active Attendance Session</h2>
            <p className="text-xs text-zinc-400">
              The attendance kiosk cannot accept check-ins without an active course session. An authorized lecturer must initiate a session from their console.
            </p>
            <button
              onClick={handleExitKiosk}
              className="mt-4 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 transition-colors"
            >
              Return to Console
            </button>
          </div>
        )}

        {/* State: ENTER_MATRIC */}
        {step === 'ENTER_MATRIC' && (
          <div className="max-w-md w-full space-y-6 p-8 rounded-2xl bg-zinc-900/60 border border-zinc-800 shadow-2xl backdrop-blur-xl">
            <div className="text-center space-y-1">
              <h2 className="text-lg font-bold text-zinc-100">Mark Your Attendance</h2>
              <p className="text-xs text-zinc-400">
                Enter your university matriculation number to begin verification.
              </p>
            </div>

            {matricError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{matricError}</span>
              </div>
            )}

            <form onSubmit={handleMatricSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Matriculation Number <span className="text-zinc-500 font-mono text-[10px]">(2xxx/2xxxxx)</span>
                </label>
                <input
                  type="text"
                  value={matricNumber}
                  onChange={(e) => {
                    setMatricNumber(e.target.value);
                    if (matricError) setMatricError(null);
                  }}
                  placeholder="2022/241414"
                  className="w-full px-4 py-3 rounded-xl bg-zinc-950 border border-zinc-800 text-base text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 text-center font-mono tracking-wider font-semibold"
                  autoFocus
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isVerifying}
                className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all cursor-pointer"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying Student...</span>
                  </>
                ) : (
                  <>
                    <span>Proceed to Facial Verification</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* State: VERIFY_FACE (Primary Method) */}
        {step === 'VERIFY_FACE' && student && (
          <div className="max-w-lg w-full space-y-4 p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 font-mono">
                  Primary Verification Method
                </span>
                <h3 className="text-base font-bold text-zinc-100 mt-0.5">{student.fullName}</h3>
                <p className="text-xs text-zinc-400 font-mono">{student.matricNumber}</p>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-zinc-500 block">Attempt</span>
                <span className="text-xs font-mono font-bold text-zinc-300">{faceAttempts + 1} of 2</span>
              </div>
            </div>

            {/* Live Camera Viewfinder */}
            <div className="relative aspect-video bg-zinc-950 rounded-xl overflow-hidden border border-zinc-800 flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />

              {/* Viewfinder Oval Guide */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-44 h-56 rounded-full border-2 border-dashed border-emerald-400/60 shadow-inner" />
              </div>

              {isVerifying && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
                  <p className="text-xs text-zinc-200 font-medium">Extracting biometric embedding...</p>
                </div>
              )}
            </div>

            {verificationFeedback && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{verificationFeedback}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={resetKioskForNextStudent}
                className="px-3 py-2 rounded-xl text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isVerifying}
                onClick={handlePerformFacialVerification}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>Verify Face</span>
              </button>

              {/* Offer QR Fallback if face attempt failed or student prefers */}
              <button
                type="button"
                onClick={handleSwitchToQrFallback}
                className="px-3.5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <QrCode className="w-3.5 h-3.5 text-cyan-400" />
                <span>Use QR Fallback</span>
              </button>
            </div>
          </div>
        )}

        {/* State: QR_FALLBACK (Secondary Fallback Method) */}
        {step === 'QR_FALLBACK' && student && (
          <div className="max-w-lg w-full space-y-4 p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-cyan-400 font-mono">
                  Fallback Verification Method
                </span>
                <h3 className="text-base font-bold text-zinc-100 mt-0.5">{student.fullName}</h3>
                <p className="text-xs text-zinc-400 font-mono">{student.matricNumber}</p>
              </div>

              <button
                onClick={() => {
                  stopCamera();
                  setStep('VERIFY_FACE');
                  startCamera();
                }}
                className="text-xs text-zinc-400 hover:text-emerald-400 transition-colors flex items-center gap-1"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>Back to Face</span>
              </button>
            </div>

            <div className="relative aspect-video bg-zinc-950 rounded-xl overflow-hidden border border-zinc-800 flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />

              {/* QR Scan Target Overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-48 rounded-xl border-2 border-cyan-400/80 shadow-inner flex items-center justify-center">
                  <QrCode className="w-12 h-12 text-cyan-400/30" />
                </div>
              </div>
            </div>

            <p className="text-xs text-zinc-400 text-center">
              Hold your personal student QR credential card up to the camera to scan.
            </p>

            {verificationFeedback && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{verificationFeedback}</span>
              </div>
            )}
          </div>
        )}

        {/* State: RESULT */}
        {step === 'RESULT' && (
          <div className="max-w-md w-full text-center space-y-5 p-8 rounded-2xl bg-zinc-900/60 border border-zinc-800 shadow-2xl backdrop-blur-xl">
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto ${
                resultSuccess
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                  : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
              }`}
            >
              {resultSuccess ? <CheckCircle2 className="w-8 h-8" /> : <XCircle className="w-8 h-8" />}
            </div>

            <div>
              <h2 className="text-xl font-bold text-zinc-100">
                {resultSuccess ? (
                  <span>
                    Attendance Marked:{' '}
                    <span className={attendanceStatus === 'LATE' ? 'text-amber-400' : 'text-emerald-400'}>
                      {attendanceStatus}
                    </span>
                  </span>
                ) : (
                  'Attendance Verification Failed'
                )}
              </h2>
              <p className="text-xs text-zinc-300 mt-2 max-w-sm mx-auto">{resultMessage}</p>

              {resultSuccess && verificationMethod && (
                <div className="mt-3 inline-block px-3 py-1 rounded-full bg-zinc-800 text-[10px] font-mono text-zinc-400 border border-zinc-700">
                  Method:{' '}
                  {verificationMethod === 'FACE_VERIFIED'
                    ? 'Primary Facial Verification'
                    : 'Student QR Fallback'}
                </div>
              )}
            </div>

            {/* Countdown privacy reset */}
            <div className="pt-4 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
              <span>Automatic privacy reset in {countdown}s</span>
              <button
                onClick={resetKioskForNextStudent}
                className="text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer"
              >
                Next Student Now &rarr;
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
