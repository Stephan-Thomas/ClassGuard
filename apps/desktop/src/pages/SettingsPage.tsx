import React, { useState } from 'react';
import {
  Settings,
  Sliders,
  Shield,
  Fingerprint,
  Cpu,
  Save,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const [threshold, setThreshold] = useState<number>(0.50);
  const [rotationSecs, setRotationSecs] = useState<number>(30);
  const [kioskId, setKioskId] = useState<string>('KIOSK-MAIN-01');
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('classguard_threshold', threshold.toString());
    localStorage.setItem('classguard_qr_rotation', rotationSecs.toString());
    localStorage.setItem('classguard_kiosk_id', kioskId);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
          <Settings className="w-5 h-5 text-emerald-400" />
          <span>System Settings & Biometric Parameters</span>
        </h1>
        <p className="text-xs text-zinc-400 mt-0.5">
          Tune 1-to-1 facial verification thresholds, token rotation parameters, and kiosk identifiers
        </p>
      </div>

      {saved && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>Settings successfully updated and persisted locally.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Biometric Thresholds Card */}
        <div className="glass-panel rounded-2xl p-6 border border-zinc-800 space-y-4">
          <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
            <Fingerprint className="w-4 h-4 text-emerald-400" />
            <span>Facial Verification Sensitivity</span>
          </h2>
          <p className="text-xs text-zinc-400">
            For 128-dimensional L2-normalized vectors (FaceRecognitionNet), Euclidean distance measures the similarity
            between the live webcam capture and the enrolled template.
          </p>

          <div className="space-y-3 pt-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium text-zinc-300">Euclidean Distance Threshold:</span>
              <span className="font-mono font-bold text-emerald-400 text-sm">{threshold.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.30"
              max="0.70"
              step="0.02"
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-zinc-500 font-mono">
              <span>0.30 (Strict / Low False Acceptance)</span>
              <span>0.50 (Standard Recommended)</span>
              <span>0.70 (Permissive / Low False Rejection)</span>
            </div>
          </div>
        </div>

        {/* Security & Token Settings */}
        <div className="glass-panel rounded-2xl p-6 border border-zinc-800 space-y-4">
          <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
            <Shield className="w-4 h-4 text-cyan-400" />
            <span>Session & QR Token Rules</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-zinc-400 font-medium mb-1.5">
                Dynamic QR Token Rotation Interval (Seconds)
              </label>
              <input
                type="number"
                min={10}
                max={120}
                value={rotationSecs}
                onChange={(e) => setRotationSecs(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 font-mono focus:outline-none focus:border-emerald-500"
              />
              <span className="text-[10px] text-zinc-500 block mt-1">Recommended: 30 seconds</span>
            </div>

            <div>
              <label className="block text-zinc-400 font-medium mb-1.5">Kiosk Station Identifier</label>
              <input
                type="text"
                value={kioskId}
                onChange={(e) => setKioskId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 font-mono focus:outline-none focus:border-emerald-500"
              />
              <span className="text-[10px] text-zinc-500 block mt-1">Included in audit trail and sync batches</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Save Configuration</span>
          </button>
        </div>
      </form>
    </div>
  );
};
