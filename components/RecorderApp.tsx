'use client';

import { useState } from 'react';
import { AudioRecorder } from './AudioRecorder';
import { TranscriptionList } from './TranscriptionList';

export function RecorderApp() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <>
      <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-8 mb-4">
        <AudioRecorder onDone={() => setRefreshKey((k) => k + 1)} />
      </div>
      <TranscriptionList refreshKey={refreshKey} />
    </>
  );
}
