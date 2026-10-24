/* =====================================================================
   REALTIME — Supabase Postgres Changes
   ===================================================================== */
import { sb } from './supabase.js';

const channels = new Set();

function uniqueName(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Pantau perubahan baris kuis (status, ends_at, dll). */
export function watchQuiz(quizId, onChange, onError) {
  if (!sb || !quizId) return null;

  const channel = sb
    .channel(uniqueName(`quiz-${quizId}`))
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'quizzes', filter: `id=eq.${quizId}` },
      (payload) => onChange?.(payload.new, payload.old),
    )
    .subscribe((status, error) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('[Realtime] kuis:', status, error);
        onError?.(status);
      }
    });

  channels.add(channel);
  return channel;
}

/** Pantau peserta yang join / submit (dipakai admin & lobby). */
export function watchParticipants(quizId, onChange, onError) {
  if (!sb || !quizId) return null;

  const channel = sb
    .channel(uniqueName(`participants-${quizId}`))
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'participants', filter: `quiz_id=eq.${quizId}` },
      (payload) => onChange?.(payload),
    )
    .subscribe((status, error) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('[Realtime] peserta:', status, error);
        onError?.(status);
      }
    });

  channels.add(channel);
  return channel;
}

/** Pantau jawaban masuk (monitoring admin). */
export function watchAnswers(onChange, onError) {
  if (!sb) return null;

  const channel = sb
    .channel(uniqueName('answers'))
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'answers' },
      (payload) => onChange?.(payload),
    )
    .subscribe((status, error) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('[Realtime] jawaban:', status, error);
        onError?.(status);
      }
    });

  channels.add(channel);
  return channel;
}

export function stopChannel(channel) {
  if (!channel || !sb) return;
  sb.removeChannel(channel);
  channels.delete(channel);
}

export function stopAllRealtime() {
  if (!sb) return;
  channels.forEach((channel) => sb.removeChannel(channel));
  channels.clear();
}

window.addEventListener('beforeunload', stopAllRealtime);
