import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './config';

export type ReportReason = 'inactividad' | 'insultos' | 'trampa' | 'spam' | 'otro';

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'inactividad', label: '😴 Inactivo / AFK' },
  { value: 'insultos',    label: '🤬 Insultos / Tóxico' },
  { value: 'trampa',      label: '🎭 Hace trampa' },
  { value: 'spam',        label: '📢 Spam en el chat' },
  { value: 'otro',        label: '⚑ Otro motivo' },
];

export async function submitReport(
  gameId: string,
  reportedUid: string,
  reportedName: string,
  reporterUid: string,
  reporterName: string,
  reason: ReportReason
) {
  await addDoc(collection(db, 'games', gameId, 'reports'), {
    reportedUid,
    reportedName,
    reporterUid,
    reporterName,
    reason,
    timestamp: serverTimestamp(),
  });
}
