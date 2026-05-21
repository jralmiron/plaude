'use client';

import { useState } from 'react';
import { AudioRecorder } from './AudioRecorder';
import { TranscriptionList } from './TranscriptionList';

export function RecorderApp({ currentUsername, onDone }: { currentUsername?: string; onDone?: () => void }) {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,_rgba(255,247,237,0.92)_0%,_rgba(255,255,255,0.96)_100%)] p-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
        <AudioRecorder onDone={() => { setRefreshKey((k) => k + 1); onDone?.(); }} />
      </div>
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_70px_-46px_rgba(15,23,42,0.35)] sm:p-7">
        <TranscriptionList refreshKey={refreshKey} currentUsername={currentUsername} />
      </div>
    </div>
  );
}
