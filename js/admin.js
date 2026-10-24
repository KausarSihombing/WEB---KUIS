/* =====================================================================
   ADMIN HELPERS — CRUD & kontrol kuis
   ===================================================================== */
import { sb } from './supabase.js';

function fail(error) {
  throw new Error(error?.message || 'Terjadi kesalahan pada server.');
}

function unwrapRpc(result) {
  if (result.error) fail(result.error);
  const data = result.data;
  if (data && data.ok === false) throw new Error(data.error || 'Permintaan gagal.');
  return data;
}

/* ------------------------------- kuis ------------------------------- */
export async function listQuizzes() {
  const { data, error } = await sb
    .from('quizzes')
    .select('id, title, description, duration_minutes, shuffle, status, started_at, ends_at, ended_at, created_at')
    .order('created_at', { ascending: false });
  if (error) fail(error);
  return data ?? [];
}

export async function getQuiz(quizId) {
  const { data, error } = await sb.from('quizzes').select('*').eq('id', quizId).maybeSingle();
  if (error) fail(error);
  return data;
}

export async function saveQuiz(values, quizId = null) {
  const payload = {
    title: values.title.trim(),
    description: values.description?.trim() || null,
    duration_minutes: Number(values.duration_minutes),
    shuffle: Boolean(values.shuffle),
  };

  if (quizId) {
    const { data, error } = await sb.from('quizzes').update(payload).eq('id', quizId).select().single();
    if (error) fail(error);
    return data;
  }

  const { data: userData } = await sb.auth.getUser();
  const { data, error } = await sb
    .from('quizzes')
    .insert({ ...payload, created_by: userData?.user?.id ?? null })
    .select()
    .single();
  if (error) fail(error);
  return data;
}

export async function updateQuizStatus(quizId, status) {
  const { data, error } = await sb.from('quizzes').update({ status }).eq('id', quizId).select().single();
  if (error) fail(error);
  return data;
}

export async function deleteQuiz(quizId) {
  const { error } = await sb.from('quizzes').delete().eq('id', quizId);
  if (error) fail(error);
}

/* ------------------------------- soal ------------------------------- */
export async function listQuestions(quizId) {
  const { data, error } = await sb
    .from('questions')
    .select('*')
    .eq('quiz_id', quizId)
    .order('order_no', { ascending: true });
  if (error) fail(error);
  return data ?? [];
}

export async function saveQuestion(values, questionId = null) {
  const payload = {
    quiz_id: values.quiz_id,
    question_text: values.question_text.trim(),
    code_snippet: values.code_snippet?.trim() || null,
    option_a: values.option_a.trim(),
    option_b: values.option_b.trim(),
    option_c: values.option_c.trim(),
    option_d: values.option_d.trim(),
    correct_answer: String(values.correct_answer).toUpperCase(),
    points: Number(values.points),
    order_no: Number(values.order_no),
  };

  if (questionId) {
    const { data, error } = await sb.from('questions').update(payload).eq('id', questionId).select().single();
    if (error) fail(error);
    return data;
  }

  const { data, error } = await sb.from('questions').insert(payload).select().single();
  if (error) fail(error);
  return data;
}

export async function deleteQuestion(questionId) {
  const { error } = await sb.from('questions').delete().eq('id', questionId);
  if (error) fail(error);
}

/* ------------------------------- token ------------------------------- */
const TOKEN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function makeTokenCode() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => TOKEN_ALPHABET[b % TOKEN_ALPHABET.length]).join('');
}

export async function createToken(quizId) {
  let lastError = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = makeTokenCode();
    const { data, error } = await sb
      .from('tokens')
      .insert({ quiz_id: quizId, code, is_active: true })
      .select()
      .single();
    if (!error) return data;
    lastError = error;
    if (error.code !== '23505') fail(error);
  }
  fail(lastError ?? { message: 'Gagal membuat token unik.' });
}

export async function listTokens(quizId) {
  const { data, error } = await sb
    .from('tokens')
    .select('*')
    .eq('quiz_id', quizId)
    .order('created_at', { ascending: false });
  if (error) fail(error);
  return data ?? [];
}

export async function setTokenActive(tokenId, active) {
  const { data, error } = await sb.from('tokens').update({ is_active: active }).eq('id', tokenId).select().single();
  if (error) fail(error);
  return data;
}

export async function deleteToken(tokenId) {
  const { error } = await sb.from('tokens').delete().eq('id', tokenId);
  if (error) fail(error);
}

export async function listTokenUsage(quizId) {
  const { data, error } = await sb
    .from('participants')
    .select('id, joined_at, token_id, user_id, profiles(full_name, nim_kelas), tokens(code)')
    .eq('quiz_id', quizId)
    .order('joined_at', { ascending: true });
  if (error) fail(error);
  return data ?? [];
}

/* ------------------------------- live ------------------------------- */
export async function startQuiz(quizId) {
  return unwrapRpc(await sb.rpc('start_quiz', { p_quiz_id: quizId }));
}

export async function adjustQuizDuration(quizId, deltaMinutes) {
  return unwrapRpc(await sb.rpc('adjust_quiz_duration', {
    p_quiz_id: quizId,
    p_delta_minutes: deltaMinutes,
  }));
}

export async function finalizeQuiz(quizId) {
  return unwrapRpc(await sb.rpc('finalize_quiz', { p_quiz_id: quizId }));
}

export async function listParticipants(quizId) {
  const { data, error } = await sb
    .from('participants')
    .select('id, quiz_id, user_id, joined_at, submitted_at, score, correct_count, wrong_count, rank, profiles(full_name, nim_kelas, is_active)')
    .eq('quiz_id', quizId)
    .order('joined_at', { ascending: true });
  if (error) fail(error);
  return data ?? [];
}

export async function countAnswersByParticipant(quizId) {
  const { data: parts, error: partError } = await sb
    .from('participants')
    .select('id')
    .eq('quiz_id', quizId);
  if (partError) fail(partError);

  const ids = (parts ?? []).map((p) => p.id);
  if (!ids.length) return {};

  const { data, error } = await sb
    .from('answers')
    .select('participant_id')
    .in('participant_id', ids);
  if (error) fail(error);

  return (data ?? []).reduce((acc, row) => {
    acc[row.participant_id] = (acc[row.participant_id] ?? 0) + 1;
    return acc;
  }, {});
}

/* ------------------------------- materi ------------------------------- */
export async function listMaterials() {
  const { data, error } = await sb.from('materials').select('*').order('created_at', { ascending: false });
  if (error) fail(error);
  return data ?? [];
}

export async function saveMaterial(values, materialId = null) {
  const { data: userData } = await sb.auth.getUser();
  const payload = {
    title: values.title.trim(),
    description: values.description?.trim() || null,
    content: values.content || null,
    file_url: values.file_url?.trim() || null,
    is_published: Boolean(values.is_published),
  };

  if (materialId) {
    const { data, error } = await sb.from('materials').update(payload).eq('id', materialId).select().single();
    if (error) fail(error);
    return data;
  }

  const { data, error } = await sb
    .from('materials')
    .insert({ ...payload, created_by: userData?.user?.id ?? null })
    .select()
    .single();
  if (error) fail(error);
  return data;
}

export async function deleteMaterial(materialId) {
  const { error } = await sb.from('materials').delete().eq('id', materialId);
  if (error) fail(error);
}

export async function uploadMaterialFile(file) {
  const safeName = file.name
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
  const path = `${new Date().toISOString().slice(0, 10)}/${Date.now()}-${safeName}`;

  const { error } = await sb.storage.from('materials').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) fail(error);

  const { data } = sb.storage.from('materials').getPublicUrl(path);
  return data.publicUrl;
}

/* ------------------------------- peserta ------------------------------- */
export async function listPeserta() {
  const { data, error } = await sb
    .from('profiles')
    .select('id, full_name, nim_kelas, role, is_active, created_at')
    .eq('role', 'peserta')
    .order('created_at', { ascending: false });
  if (error) fail(error);
  return data ?? [];
}

export async function listPesertaHistory(userId) {
  const { data, error } = await sb
    .from('participants')
    .select('id, joined_at, submitted_at, score, correct_count, wrong_count, rank, quizzes(title, status, ended_at)')
    .eq('user_id', userId)
    .order('joined_at', { ascending: false });
  if (error) fail(error);
  return data ?? [];
}

export async function setParticipantActive(userId, active) {
  return unwrapRpc(await sb.rpc('admin_set_participant_active', {
    p_user_id: userId,
    p_active: active,
  }));
}

export async function deleteParticipantProfile(userId) {
  const { error } = await sb.from('profiles').delete().eq('id', userId);
  if (error) fail(error);
}

/* ------------------------------- leaderboard ------------------------------- */
export async function getLeaderboard(quizId) {
  const { data, error } = await sb
    .from('participants')
    .select('id, score, correct_count, wrong_count, rank, joined_at, submitted_at, profiles(full_name, nim_kelas)')
    .eq('quiz_id', quizId)
    .order('rank', { ascending: true, nullsFirst: false });
  if (error) fail(error);
  return data ?? [];
}

/** Waktu pengerjaan = submitted_at - joined_at (fallback: started_at kuis). */
export async function getLeaderboardWithTiming(quizId, startedAt) {
  const rows = await getLeaderboard(quizId);
  return rows.map((row) => {
    const start = new Date(startedAt ?? row.joined_at).getTime();
    const end = row.submitted_at ? new Date(row.submitted_at).getTime() : null;
    return {
      ...row,
      full_name: row.profiles?.full_name ?? 'Peserta',
      nim_kelas: row.profiles?.nim_kelas ?? '—',
      duration_ms: end ? Math.max(0, end - start) : null,
    };
  });
}
