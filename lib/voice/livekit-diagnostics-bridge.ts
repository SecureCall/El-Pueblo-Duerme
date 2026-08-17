'use client';

import type { Room } from 'livekit-client';
import { voiceDiagnostics } from './voice-diagnostics';

/**
 * Installs the diagnostics monitor on a real LiveKit room.
 *
 * VoiceDiagnostics owns the complete listener set and performs an initial
 * snapshot, so this bridge deliberately does not add a second set of Room
 * listeners (which could double-count tracks and speakers).
 */
export function installLiveKitDiagnostics(room: Room): () => void {
  return voiceDiagnostics.install(room);
}
