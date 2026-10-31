/* =====================================================================
   QUIZ HELPERS — alur peserta
   ===================================================================== */
import { sb } from './supabase.js';

function unwrapRpc(result) {
  if (result.error) throw new Error(result.error.message);
  const data = result.data;
  if (data && data.ok === false) throw new Error(data.error || 'Permintaan gagal.');
  return data;
}

export async function joinQuizWithToken(code) {
  return unwrapRpc(await sb.rpc('join_quiz_with_token', { p_code: code }));
}

export async function getQuizState(quizId) {
  return unwrapRpc(await sb.rpc('get_quiz_state', { p_quiz_id: quizId }));
}

export async function getLobbyInfo(quizId) {
  return unwrapRpc(await sb.rpc('get_lobby_info', { p_quiz_id: quizId }));
}

export async function saveAnswer(quizId, questionId, answer) {
  return unwrapRpc(await sb.rpc('save_answer', {
    p_quiz_id: quizId,
    p_question_id: questionId,
    p_answer: answer,
  }));
}

export async function submitParticipant(quizId) {
  return unwrapRpc(await sb.rpc('submit_participant', { p_quiz_id: quizId }));
}

export async function getPublicRanking(quizId) {
  const { data, error } = await sb.rpc('get_public_ranking', { p_quiz_id: quizId });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getQuizQuestions(quizId) {
  const { data, error } = await sb
    .from('questions_public')
    .select('id, quiz_id, question_text, code_snippet, option_a, option_b, option_c, option_d, points, order_no')
    .eq('quiz_id', quizId)
    .order('order_no', { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getMyAnswers(participantId) {
  const { data, error } = await sb
    .from('answers')
    .select('question_id, selected_answer')
    .eq('participant_id', participantId);

  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Arahkan peserta sesuai status kuis (dipakai dari dalam folder /peserta). */
export function participantRoute(quizId, status, submitted = false) {
  if (status === 'menunggu') return `lobby.html?quiz=${quizId}`;
  if (status === 'berjalan') {
    return submitted
      ? `waiting.html?quiz=${quizId}`
      : `quiz.html?quiz=${quizId}`;
  }
  if (status === 'selesai') return `ranking.html?quiz=${quizId}`;
  return 'home.html';
}

/**
 * Timer countdown yang mengikuti ends_at dari SERVER.
 * serverNow dipakai untuk mengoreksi jam perangkat peserta.
 */
export function createCountdown({ endsAt, serverNow, onTick, onEnd }) {
  let endMs = endsAt ? new Date(endsAt).getTime() : 0;
  let offset = serverNow ? new Date(serverNow).getTime() - Date.now() : 0;
  let intervalId = null;
  let finished = false;

  const remainingMs = () => Math.max(0, endMs - (Date.now() + offset));

  const tick = () => {
    const left = remainingMs();
    onTick?.(left / 1000);
    if (left <= 0 && !finished) {
      finished = true;
      stop();
      onEnd?.();
    }
  };

  const start = () => {
    if (intervalId) clearInterval(intervalId);
    finished = false;
    tick();
    intervalId = setInterval(tick, 250);
  };

  const stop = () => {
    if (intervalId) clearInterval(intervalId);
    intervalId = null;
  };

  return {
    start,
    stop,
    remainingMs,
    sync(newEndsAt, newServerNow) {
      endMs = new Date(newEndsAt).getTime();
      if (newServerNow) offset = new Date(newServerNow).getTime() - Date.now();
      if (!intervalId) start();
      else tick();
    },
  };
}
