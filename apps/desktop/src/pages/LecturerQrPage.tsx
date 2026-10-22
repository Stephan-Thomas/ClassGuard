import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { api } from '../lib/api-client';
import {
  QrCode,
  ShieldCheck,
  Clock,
  RefreshCw,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  Tv,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

export const LecturerQrPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [currentTokenString, setCurrentTokenString] = useState<string>('');
  const [currentTokenObject, setCurrentTokenObject] = useState<any | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [countdown, setCountdown] = useState<number>(30);
  const [copied, setCopied] = useState(false);
  const [isProjectionMode, setIsProjectionMode] = useState(false);
  const [attendeeCount, setAttendeeCount] = useState(0);

  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Load sessions
  useEffect(() => {
    api.getSessions().then((res) => {
      if (res.success && res.data.length > 0) {
        setSessions(res.data);
        const querySessionId = searchParams.get('session');
        if (querySessionId && res.data.some((s: any) => s.id === querySessionId)) {
          setSelectedSessionId(querySessionId);
        } else {
          const active = res.data.find((s: any) => s.status === 'ACTIVE') || res.data[0];
          setSelectedSessionId(active.id);
        }
      }
    });
  }, [searchParams]);

  // Rotate token periodically
  useEffect(() => {
    if (!selectedSessionId) return;

    const rotateToken = async () => {
      try {
        const res = await api.generateSignedToken(selectedSessionId, 30);
        if (res.success && res.tokenString) {
          setCurrentTokenString(res.tokenString);
          setCurrentTokenObject(res.tokenObject);
          setCountdown(30);

          // Generate QR Code image data URL
          const url = await QRCode.toDataURL(res.tokenString, {
            width: 420,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#ffffff',
            },
            errorCorrectionLevel: 'M',
          });
          setQrDataUrl(url);

          // Update attendee count
          const detail = await api.getSession(selectedSessionId);
          if (detail.success && detail.data) {
            setAttendeeCount(detail.data.presentCount + detail.data.lateCount);
          }
        }
      } catch (err) {
        console.error('Failed to rotate QR token:', err);
      }
    };

    rotateToken();
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          rotateToken();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [selectedSessionId]);

  const handleCopyToken = () => {
    if (!currentTokenString) return;
    navigator.clipboard.writeText(currentTokenString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const selectedSession = sessions.find((s) => s.id === selectedSessionId);

  return (
    <div className={`space-y-6 ${isProjectionMode ? 'fixed inset-0 z-50 bg-zinc-950 p-8 flex flex-col justify-between' : ''}`}>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <QrCode className="w-5 h-5 text-emerald-400" />
            <span>Lecturer Dynamic QR Display</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Display this screen to students. The token rotates every 30 seconds with an asymmetric cryptographic signature.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {sessions.length > 1 && (
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 focus:outline-none"
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.courseCode}: {s.title}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => setIsProjectionMode(!isProjectionMode)}
            className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-semibold text-zinc-200 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {isProjectionMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span>{isProjectionMode ? 'Exit Projection' : 'Projector View'}</span>
          </button>
        </div>
      </div>

      {/* Main QR Presentation Box */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* QR Card */}
        <div className="lg:col-span-7 flex flex-col items-center justify-center">
          <div className="p-8 rounded-3xl bg-zinc-900/90 border border-zinc-800 shadow-2xl relative glow-emerald flex flex-col items-center">
            {/* Header info */}
            <div className="w-full flex items-center justify-between mb-4 pb-3 border-b border-zinc-800">
              <span className="font-mono font-bold text-sm text-emerald-400">
                {selectedSession?.courseCode || 'CSC 403'}
              </span>
              <span className="text-xs text-zinc-400 font-semibold truncate max-w-[200px]">
                {selectedSession?.title}
              </span>
            </div>

            {/* QR Code Canvas */}
            <div className="p-4 rounded-2xl bg-white shadow-inner flex items-center justify-center">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="Active Session QR Code" className="w-72 h-72 sm:w-80 sm:h-80 object-contain" />
              ) : (
                <div className="w-72 h-72 flex items-center justify-center text-zinc-500 text-xs font-mono">
                  Generating signed QR token...
                </div>
              )}
            </div>

            {/* Rotation Countdown Bar */}
            <div className="w-full mt-6 space-y-1.5">
              <div className="flex justify-between items-center text-xs text-zinc-400">
                <span className="flex items-center gap-1.5 font-mono">
                  <RefreshCw className="w-3 h-3 text-emerald-400 animate-spin" />
                  <span>Rotating in:</span>
                </span>
                <span className="font-mono font-bold text-emerald-400 text-sm">{countdown}s</span>
              </div>
              <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  style={{ width: `${(countdown / 30) * 100}%` }}
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-1000 ease-linear"
                />
              </div>
            </div>

            {/* Asymmetric signature verification pill */}
            <div className="mt-5 w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-semibold">
              <ShieldCheck className="w-4 h-4" />
              <span>Ed25519 Cryptographically Signed</span>
            </div>
          </div>
        </div>

        {/* Side Details & Single-PC Demo Shortcuts */}
        <div className="lg:col-span-5 space-y-5">
          {/* Real-time scan counter card */}
          <div className="glass-panel rounded-2xl p-6 border border-zinc-800">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Live Attendance</span>
            <div className="mt-2 flex items-baseline gap-3">
              <span className="text-3xl font-extrabold text-zinc-100 font-mono">{attendeeCount}</span>
              <span className="text-xs text-emerald-400 font-medium">students checked in</span>
            </div>
            <button
              onClick={() => navigate(`/live-monitor?session=${selectedSessionId}`)}
              className="mt-4 w-full py-2 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-semibold text-zinc-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Open Live Monitoring Roster</span>
              <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />
            </button>
          </div>

          {/* Cryptographic Token Metadata */}
          <div className="glass-panel rounded-2xl p-6 border border-zinc-800 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Token Security Metadata</h3>
            {currentTokenObject?.payload ? (
              <div className="space-y-2 text-xs font-mono text-zinc-300">
                <div className="flex justify-between py-1 border-b border-zinc-800">
                  <span className="text-zinc-500">Token ID:</span>
                  <span className="text-zinc-300 truncate max-w-[150px]">
                    {currentTokenObject.payload.tokenId.slice(0, 12)}...
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-800">
                  <span className="text-zinc-500">Nonce:</span>
                  <span className="text-zinc-300">{currentTokenObject.payload.nonce}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-800">
                  <span className="text-zinc-500">Expires At:</span>
                  <span className="text-amber-400">
                    {new Date(currentTokenObject.payload.expiresAt).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-500">Loading token payload...</p>
            )}

            {/* Single-PC Offline Demo Helper Button */}
            <div className="pt-3 border-t border-zinc-800">
              <p className="text-[11px] text-zinc-400 mb-2">
                <strong>Offline Testing Helper:</strong> If you are demonstrating the project on a single laptop without
                a 2nd screen, copy this active signed token to test the kiosk scanner instantly!
              </p>
              <button
                onClick={handleCopyToken}
                className="w-full py-2 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-semibold text-cyan-400 flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Signed Token Copied!' : 'Copy Active Signed Token'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
