'use client';

import { useEffect, useState } from 'react';
import { voiceDiagnostics, VoiceDiagnosticSnapshot } from './voice-diagnostics';

export function useVoiceDiagnostics(): VoiceDiagnosticSnapshot {
  const [snapshot, setSnapshot] = useState(() => voiceDiagnostics.getSnapshot());
  useEffect(() => voiceDiagnostics.onChange(setSnapshot), []);
  return snapshot;
}

export function VoiceDiagnosticsPanel({ enabled = process.env.NODE_ENV !== 'production' }: { enabled?: boolean }) {
  const snapshot = useVoiceDiagnostics();
  if (!enabled) return null;

  const rows = [
    ['Players', `${snapshot.participants}/35`],
    ['Audio tracks', snapshot.audioTracks],
    ['Subscribed', snapshot.subscribedTracks],
    ['Unsubscribed', snapshot.unsubscribedTracks],
    ['Subscription failures', snapshot.subscriptionFailures],
    ['Active speakers', snapshot.activeSpeakers],
    ['Reconnecting', snapshot.reconnecting],
    ['Reconnected', snapshot.reconnected],
    ['Playback blocked', snapshot.playbackBlocked],
    ['Stream paused', snapshot.streamPaused],
    ['Stream resumed', snapshot.streamResumed],
    ['Duplicate tracks', snapshot.duplicateTrackSids],
  ] as const;

  return (
    <aside aria-label="Voice diagnostics" style={{ position: 'fixed', right: 12, bottom: 12, zIndex: 99999, width: 280, padding: 12, borderRadius: 12, background: 'rgba(10,10,14,.94)', color: '#fff', font: '12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace', boxShadow: '0 8px 30px rgba(0,0,0,.35)' }}>
      <strong style={{ display: 'block', marginBottom: 8 }}>🎙️ VOICE DIAGNOSTICS</strong>
      {rows.map(([label, value]) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span>{label}</span><b>{value}</b>
        </div>
      ))}
      <div style={{ marginTop: 8, opacity: .7 }}>Last: {snapshot.lastEvent ?? '—'}</div>
      {snapshot.lastError && <div style={{ marginTop: 4, color: '#ff9b9b' }}>Error: {snapshot.lastError}</div>}
    </aside>
  );
}
