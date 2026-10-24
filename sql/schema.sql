-- =====================================================================
--  KUIS BAHASA C — SKEMA SUPABASE LENGKAP
--  Jalankan seluruh file ini di Supabase SQL Editor (sekali).
-- =====================================================================

create extension if not exists "pgcrypto";

-- =====================================================================
--  1. TABEL
-- =====================================================================

-- Profil pengguna (id = auth.users.id)
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  nim_kelas   text,
  role        text not null default 'peserta' check (role in ('admin', 'peserta')),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Kuis
create table if not exists public.quizzes (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  description      text,
  duration_minutes integer not null default 15 check (duration_minutes between 1 and 600),
  shuffle          boolean not null default false,
  status           text not null default 'draft'
                   check (status in ('draft', 'menunggu', 'berjalan', 'selesai')),
  started_at       timestamptz,
  ends_at          timestamptz,
  ended_at         timestamptz,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now()
);

-- Soal pilihan ganda
create table if not exists public.questions (
  id             uuid primary key default gen_random_uuid(),
  quiz_id        uuid not null references public.quizzes(id) on delete cascade,
  question_text  text not null,
  code_snippet   text,
  option_a       text not null,
  option_b       text not null,
  option_c       text not null,
  option_d       text not null,
  correct_answer text not null check (correct_answer in ('A', 'B', 'C', 'D')),
  points         integer not null default 10 check (points between 1 and 100),
  order_no       integer not null default 1,
  created_at     timestamptz not null default now()
);

-- Token akses kuis
create table if not exists public.tokens (
  id         uuid primary key default gen_random_uuid(),
  quiz_id    uuid not null references public.quizzes(id) on delete cascade,
  code       text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- Peserta yang sudah join sebuah kuis
create table if not exists public.participants (
  id            uuid primary key default gen_random_uuid(),
  quiz_id       uuid not null references public.quizzes(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  token_id      uuid references public.tokens(id) on delete set null,
  joined_at     timestamptz not null default now(),
  submitted_at  timestamptz,
  score         integer not null default 0,
  correct_count integer not null default 0,
  wrong_count   integer not null default 0,
  rank          integer,
  unique (quiz_id, user_id)
);

-- Jawaban peserta (is_correct tetap NULL sampai finalize_quiz)
create table if not exists public.answers (
  id               uuid primary key default gen_random_uuid(),
  participant_id   uuid not null references public.participants(id) on delete cascade,
  question_id      uuid not null references public.questions(id) on delete cascade,
  selected_answer  text check (selected_answer in ('A', 'B', 'C', 'D')),
  is_correct       boolean,
  answered_at      timestamptz not null default now(),
  unique (participant_id, question_id)
);

-- Materi pembelajaran
create table if not exists public.materials (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  content      text,
  file_url     text,
  is_published boolean not null default false,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- =====================================================================
--  2. INDEX
-- =====================================================================

create index if not exists idx_profiles_role          on public.profiles(role);
create index if not exists idx_quizzes_status         on public.quizzes(status);
create index if not exists idx_questions_quiz         on public.questions(quiz_id, order_no);
create index if not exists idx_tokens_quiz            on public.tokens(quiz_id);
create index if not exists idx_tokens_code            on public.tokens(upper(code));
create index if not exists idx_participants_quiz      on public.participants(quiz_id);
create index if not exists idx_participants_user      on public.participants(user_id);
create index if not exists idx_answers_participant    on public.answers(participant_id);
create index if not exists idx_answers_question       on public.answers(question_id);
create index if not exists idx_materials_published    on public.materials(is_published, created_at desc);

-- =====================================================================
--  3. HELPER & TRIGGER
-- =====================================================================

-- Cek apakah user yang sedang login adalah admin aktif
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active
  );
$$;

grant execute on function public.is_admin() to authenticated;

-- Buat profil otomatis ketika user baru mendaftar.
-- Registrasi publik SELALU menjadi 'peserta' (role di-hardcode).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, nim_kelas, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1)),
    nullif(new.raw_user_meta_data->>'nim_kelas', ''),
    'peserta'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
--  4. ROW LEVEL SECURITY
-- =====================================================================

alter table public.profiles     enable row level security;
alter table public.quizzes      enable row level security;
alter table public.questions    enable row level security;
alter table public.tokens       enable row level security;
alter table public.participants enable row level security;
alter table public.answers      enable row level security;
alter table public.materials    enable row level security;

-- ---------- profiles ----------
drop policy if exists profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Peserta hanya boleh mengubah nama & NIM-nya sendiri.
-- role / is_active tidak bisa diubah lewat API oleh peserta.
revoke update on public.profiles from anon, authenticated;
grant update (full_name, nim_kelas) on public.profiles to authenticated;

-- ---------- quizzes ----------
drop policy if exists quizzes_select on public.quizzes;
create policy quizzes_select on public.quizzes
  for select to authenticated
  using (public.is_admin() or status <> 'draft');

drop policy if exists quizzes_admin_all on public.quizzes;
create policy quizzes_admin_all on public.quizzes
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------- questions (hanya admin; peserta lewat view) ----------
drop policy if exists questions_admin_all on public.questions;
create policy questions_admin_all on public.questions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------- tokens (hanya admin) ----------
drop policy if exists tokens_admin_all on public.tokens;
create policy tokens_admin_all on public.tokens
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------- participants ----------
drop policy if exists participants_select_own_or_admin on public.participants;
create policy participants_select_own_or_admin on public.participants
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists participants_admin_write on public.participants;
create policy participants_admin_write on public.participants
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists participants_admin_delete on public.participants;
create policy participants_admin_delete on public.participants
  for delete to authenticated
  using (public.is_admin());

-- ---------- answers ----------
-- Peserta hanya bisa membaca jawabannya sendiri SELAMA kuis berjalan.
-- Setelah kuis difinalisasi, jawaban (beserta is_correct) tertutup.
drop policy if exists answers_select_own_or_admin on public.answers;
create policy answers_select_own_or_admin on public.answers
  for select to authenticated
  using (
    public.is_admin()
    or (
      exists (
        select 1
        from public.participants p
        join public.quizzes q on q.id = p.quiz_id
        where p.id = answers.participant_id
          and p.user_id = auth.uid()
          and q.status = 'berjalan'
      )
    )
  );

-- ---------- materials ----------
drop policy if exists materials_select on public.materials;
create policy materials_select on public.materials
  for select to authenticated
  using (is_published or public.is_admin());

drop policy if exists materials_admin_all on public.materials;
create policy materials_admin_all on public.materials
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- =====================================================================
--  5. VIEW SOAL TANPA KUNCI JAWABAN
--  Peserta hanya bisa melihat soal dari kuis yang sedang berjalan
--  dan hanya untuk kuis yang ia ikuti.
-- =====================================================================

create or replace view public.questions_public as
select
  q.id,
  q.quiz_id,
  q.question_text,
  q.code_snippet,
  q.option_a,
  q.option_b,
  q.option_c,
  q.option_d,
  q.points,
  q.order_no
from public.questions q
join public.quizzes z on z.id = q.quiz_id
where z.status = 'berjalan'
  and exists (
    select 1 from public.participants p
    where p.quiz_id = q.quiz_id and p.user_id = auth.uid()
  );

revoke all on public.questions_public from anon;
grant select on public.questions_public to authenticated;

-- =====================================================================
--  6. RPC — ALUR PESERTA
-- =====================================================================

-- 6.1 Masuk kuis dengan token
create or replace function public.join_quiz_with_token(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_token public.tokens%rowtype;
  v_quiz  public.quizzes%rowtype;
  v_part  public.participants%rowtype;
  v_prof  public.profiles%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Sesi login tidak ditemukan. Silakan login ulang.');
  end if;

  select * into v_prof from public.profiles where id = v_uid;
  if not found or not v_prof.is_active then
    return jsonb_build_object('ok', false, 'error', 'Akun kamu tidak aktif. Hubungi instruktur.');
  end if;

  if p_code is null or length(trim(p_code)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'Masukkan token kuis terlebih dahulu.');
  end if;

  select * into v_token
  from public.tokens
  where upper(code) = upper(trim(p_code)) and is_active = true;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Token tidak valid atau sudah tidak aktif.');
  end if;

  select * into v_quiz from public.quizzes where id = v_token.quiz_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Kuis untuk token ini tidak ditemukan.');
  end if;

  if v_quiz.status = 'draft' then
    return jsonb_build_object('ok', false, 'error', 'Kuis ini belum dibuka oleh instruktur.');
  end if;

  if v_quiz.status = 'selesai' then
    return jsonb_build_object('ok', false, 'error', 'Kuis ini sudah selesai.');
  end if;

  -- Sudah pernah join: arahkan kembali ke ruang yang sesuai
  select * into v_part
  from public.participants
  where quiz_id = v_quiz.id and user_id = v_uid;

  if found then
    return jsonb_build_object(
      'ok', true,
      'already_joined', true,
      'participant_id', v_part.id,
      'quiz_id', v_quiz.id,
      'quiz_title', v_quiz.title,
      'status', v_quiz.status,
      'submitted', v_part.submitted_at is not null
    );
  end if;

  if v_quiz.status = 'berjalan' and (v_quiz.ends_at is null or v_quiz.ends_at <= now()) then
    return jsonb_build_object('ok', false, 'error', 'Waktu kuis ini telah habis.');
  end if;

  insert into public.participants (quiz_id, user_id, token_id)
  values (v_quiz.id, v_uid, v_token.id)
  returning * into v_part;

  return jsonb_build_object(
    'ok', true,
    'already_joined', false,
    'participant_id', v_part.id,
    'quiz_id', v_quiz.id,
    'quiz_title', v_quiz.title,
    'status', v_quiz.status,
    'submitted', false
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'Kamu sudah terdaftar pada kuis ini.');
end;
$$;

-- 6.2 Simpan jawaban sementara (TIDAK dinilai)
create or replace function public.save_answer(
  p_quiz_id uuid,
  p_question_id uuid,
  p_answer text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_part public.participants%rowtype;
  v_quiz public.quizzes%rowtype;
  v_ans  text := upper(trim(coalesce(p_answer, '')));
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Sesi login tidak ditemukan.');
  end if;

  if v_ans not in ('A', 'B', 'C', 'D') then
    return jsonb_build_object('ok', false, 'error', 'Pilihan jawaban tidak valid.');
  end if;

  select * into v_part
  from public.participants
  where quiz_id = p_quiz_id and user_id = v_uid;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Kamu belum terdaftar pada kuis ini.');
  end if;

  if v_part.submitted_at is not null then
    return jsonb_build_object('ok', false, 'error', 'Jawaban sudah dikumpulkan dan dikunci.');
  end if;

  select * into v_quiz from public.quizzes where id = p_quiz_id;
  if not found or v_quiz.status <> 'berjalan' then
    return jsonb_build_object('ok', false, 'error', 'Kuis belum dimulai atau sudah berakhir.');
  end if;

  if v_quiz.ends_at is not null and now() > v_quiz.ends_at + interval '10 seconds' then
    return jsonb_build_object('ok', false, 'error', 'Waktu kuis telah habis.');
  end if;

  if not exists (
    select 1 from public.questions
    where id = p_question_id and quiz_id = p_quiz_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'Soal tidak ditemukan pada kuis ini.');
  end if;

  insert into public.answers (participant_id, question_id, selected_answer, answered_at)
  values (v_part.id, p_question_id, v_ans, now())
  on conflict (participant_id, question_id)
  do update set selected_answer = excluded.selected_answer, answered_at = now();

  return jsonb_build_object('ok', true, 'saved_at', now());
end;
$$;

-- 6.3 Kumpulkan jawaban (tanpa penilaian)
create or replace function public.submit_participant(p_quiz_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_part public.participants%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Sesi login tidak ditemukan.');
  end if;

  select * into v_part
  from public.participants
  where quiz_id = p_quiz_id and user_id = v_uid;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Kamu belum terdaftar pada kuis ini.');
  end if;

  update public.participants
  set submitted_at = coalesce(submitted_at, now())
  where id = v_part.id
  returning * into v_part;

  return jsonb_build_object(
    'ok', true,
    'submitted_at', v_part.submitted_at
  );
end;
$$;

-- 6.4 State kuis untuk peserta (status, sisa waktu, jawaban terisi)
create or replace function public.get_quiz_state(p_quiz_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_quiz  public.quizzes%rowtype;
  v_part  public.participants%rowtype;
  v_total integer;
  v_answered integer := 0;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Sesi login tidak ditemukan.');
  end if;

  select * into v_quiz from public.quizzes where id = p_quiz_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Kuis tidak ditemukan.');
  end if;

  select * into v_part
  from public.participants
  where quiz_id = p_quiz_id and user_id = v_uid;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Kamu belum terdaftar pada kuis ini.');
  end if;

  select count(*) into v_total from public.questions where quiz_id = p_quiz_id;
  select count(*) into v_answered
  from public.answers
  where participant_id = v_part.id and selected_answer is not null;

  return jsonb_build_object(
    'ok', true,
    'quiz_id', v_quiz.id,
    'title', v_quiz.title,
    'description', v_quiz.description,
    'status', v_quiz.status,
    'ends_at', v_quiz.ends_at,
    'started_at', v_quiz.started_at,
    'shuffle', v_quiz.shuffle,
    'server_now', now(),
    'total_questions', v_total,
    'answered_count', v_answered,
    'participant', jsonb_build_object(
      'id', v_part.id,
      'submitted_at', v_part.submitted_at,
      'rank', v_part.rank
    )
  );
end;
$$;

-- 6.5 Info lobby (jumlah peserta yang sudah masuk)
create or replace function public.get_lobby_info(p_quiz_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quiz public.quizzes%rowtype;
  v_count integer;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'Sesi login tidak ditemukan.');
  end if;

  select * into v_quiz from public.quizzes where id = p_quiz_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Kuis tidak ditemukan.');
  end if;

  select count(*) into v_count from public.participants where quiz_id = p_quiz_id;

  return jsonb_build_object(
    'ok', true,
    'quiz_id', v_quiz.id,
    'title', v_quiz.title,
    'description', v_quiz.description,
    'status', v_quiz.status,
    'ends_at', v_quiz.ends_at,
    'server_now', now(),
    'participant_count', v_count
  );
end;
$$;

-- 6.6 Peringkat publik: NAMA + RANK SAJA, hanya jika kuis selesai
create or replace function public.get_public_ranking(p_quiz_id uuid)
returns table (rank_no integer, full_name text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sesi login tidak ditemukan.';
  end if;

  if not exists (
    select 1 from public.quizzes where id = p_quiz_id and status = 'selesai'
  ) then
    raise exception 'Peringkat belum tersedia. Kuis belum diakhiri instruktur.';
  end if;

  return query
  select p.rank, pr.full_name
  from public.participants p
  join public.profiles pr on pr.id = p.user_id
  where p.quiz_id = p_quiz_id and p.rank is not null
  order by p.rank asc, pr.full_name asc;
end;
$$;

-- =====================================================================
--  7. RPC — KONTROL ADMIN
-- =====================================================================

-- 7.1 Mulai kuis (realtime: status -> berjalan, ends_at dihitung SERVER)
create or replace function public.start_quiz(p_quiz_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quiz  public.quizzes%rowtype;
  v_total integer;
begin
  if not public.is_admin() then
    raise exception 'Akses ditolak: hanya admin yang dapat memulai kuis.';
  end if;

  select * into v_quiz from public.quizzes where id = p_quiz_id;
  if not found then
    raise exception 'Kuis tidak ditemukan.';
  end if;

  if v_quiz.status = 'berjalan' then
    return jsonb_build_object('ok', true, 'already', true, 'ends_at', v_quiz.ends_at);
  end if;

  if v_quiz.status <> 'menunggu' then
    raise exception 'Kuis tidak dalam status menunggu.';
  end if;

  select count(*) into v_total from public.questions where quiz_id = p_quiz_id;
  if v_total = 0 then
    raise exception 'Tambahkan minimal satu soal sebelum memulai kuis.';
  end if;

  update public.quizzes
  set status     = 'berjalan',
      started_at = now(),
      ends_at    = now() + make_interval(mins => duration_minutes),
      ended_at   = null
  where id = p_quiz_id
  returning * into v_quiz;

  return jsonb_build_object('ok', true, 'already', false, 'ends_at', v_quiz.ends_at);
end;
$$;

-- 7.2 Ubah durasi (tidak boleh mengurangi melewati waktu berjalan)
create or replace function public.adjust_quiz_duration(p_quiz_id uuid, p_delta_minutes integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quiz public.quizzes%rowtype;
  v_new_ends timestamptz;
  v_new_duration integer;
begin
  if not public.is_admin() then
    raise exception 'Akses ditolak: hanya admin yang dapat mengubah durasi.';
  end if;

  if p_delta_minutes is null or p_delta_minutes = 0 then
    raise exception 'Perubahan durasi harus berbeda dari 0 menit.';
  end if;

  select * into v_quiz from public.quizzes where id = p_quiz_id;
  if not found then
    raise exception 'Kuis tidak ditemukan.';
  end if;

  if v_quiz.status = 'selesai' then
    raise exception 'Kuis sudah selesai.';
  end if;

  -- Saat masih di lobby: durasi awal yang disesuaikan
  if v_quiz.status = 'menunggu' or v_quiz.status = 'draft' then
    v_new_duration := greatest(1, least(600, v_quiz.duration_minutes + p_delta_minutes));
    update public.quizzes
    set duration_minutes = v_new_duration
    where id = p_quiz_id;

    return jsonb_build_object(
      'ok', true,
      'mode', 'duration',
      'duration_minutes', v_new_duration,
      'ends_at', null
    );
  end if;

  -- Saat berjalan: ends_at yang digeser
  if v_quiz.ends_at is null then
    raise exception 'Kuis belum memiliki waktu selesai.';
  end if;

  v_new_ends := v_quiz.ends_at + make_interval(mins => p_delta_minutes);

  if v_new_ends <= now() then
    raise exception 'Durasi tidak boleh dikurangi sampai melewati waktu yang sudah berjalan. Sisa waktu terlalu sedikit.';
  end if;

  update public.quizzes
  set ends_at = v_new_ends
  where id = p_quiz_id
  returning * into v_quiz;

  return jsonb_build_object(
    'ok', true,
    'mode', 'ends_at',
    'ends_at', v_quiz.ends_at
  );
end;
$$;

-- 7.3 FINALIZE — satu-satunya tempat penilaian
create or replace function public.finalize_quiz(p_quiz_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quiz  public.quizzes%rowtype;
  v_total integer;
  v_parts integer;
begin
  if not public.is_admin() then
    raise exception 'Akses ditolak: hanya admin yang dapat mengakhiri kuis.';
  end if;

  select * into v_quiz from public.quizzes where id = p_quiz_id;
  if not found then
    raise exception 'Kuis tidak ditemukan.';
  end if;

  if v_quiz.status = 'selesai' then
    return jsonb_build_object('ok', true, 'already', true);
  end if;

  if v_quiz.status <> 'berjalan' then
    raise exception 'Kuis belum dimulai sehingga tidak dapat diakhiri.';
  end if;

  select count(*) into v_total from public.questions where quiz_id = p_quiz_id;

  -- (1) Kunci semua peserta yang belum submit
  update public.participants
  set submitted_at = coalesce(submitted_at, now())
  where quiz_id = p_quiz_id;

  -- (2) Hitung benar/salah untuk SETIAP jawaban
  update public.answers a
  set is_correct = (a.selected_answer = q.correct_answer)
  from public.questions q
  where a.question_id = q.id
    and a.participant_id in (select id from public.participants where quiz_id = p_quiz_id);

  -- (3) Hitung skor & jumlah benar/salah
  with agg as (
    select
      p.id,
      coalesce(sum(case when a.is_correct then q.points else 0 end), 0) as score,
      count(*) filter (where a.is_correct) as correct_count
    from public.participants p
    left join public.answers a on a.participant_id = p.id
    left join public.questions q on q.id = a.question_id
    where p.quiz_id = p_quiz_id
    group by p.id
  )
  update public.participants p
  set score         = agg.score,
      correct_count = agg.correct_count,
      wrong_count   = greatest(v_total - agg.correct_count, 0)
  from agg
  where p.id = agg.id;

  -- (4) Ranking
  with ranked as (
    select
      id,
      row_number() over (
        order by score desc,
                 correct_count desc,
                 submitted_at asc nulls last,
                 joined_at asc
      ) as rn
    from public.participants
    where quiz_id = p_quiz_id
  )
  update public.participants p
  set rank = ranked.rn
  from ranked
  where p.id = ranked.id;

  -- (5) Tutup kuis
  update public.quizzes
  set status   = 'selesai',
      ended_at = now(),
      ends_at  = coalesce(ends_at, now())
  where id = p_quiz_id;

  select count(*) into v_parts from public.participants where quiz_id = p_quiz_id;

  return jsonb_build_object(
    'ok', true,
    'already', false,
    'total_questions', v_total,
    'participants', v_parts
  );
end;
$$;

-- 7.4 Aktif/nonaktifkan akun peserta (kolom role/profil tidak bisa diubah via API langsung)
create or replace function public.admin_set_participant_active(p_user_id uuid, p_active boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Akses ditolak: hanya admin.';
  end if;

  update public.profiles
  set is_active = p_active
  where id = p_user_id and role = 'peserta';

  if not found then
    raise exception 'Peserta tidak ditemukan.';
  end if;

  return jsonb_build_object('ok', true, 'is_active', p_active);
end;
$$;

-- =====================================================================
--  8. HAK EKSEKUSI RPC
-- =====================================================================

revoke execute on function public.join_quiz_with_token(text) from public, anon;
revoke execute on function public.save_answer(uuid, uuid, text) from public, anon;
revoke execute on function public.submit_participant(uuid) from public, anon;
revoke execute on function public.get_quiz_state(uuid) from public, anon;
revoke execute on function public.get_lobby_info(uuid) from public, anon;
revoke execute on function public.get_public_ranking(uuid) from public, anon;
revoke execute on function public.start_quiz(uuid) from public, anon;
revoke execute on function public.adjust_quiz_duration(uuid, integer) from public, anon;
revoke execute on function public.finalize_quiz(uuid) from public, anon;
revoke execute on function public.admin_set_participant_active(uuid, boolean) from public, anon;

grant execute on function public.join_quiz_with_token(text) to authenticated;
grant execute on function public.save_answer(uuid, uuid, text) to authenticated;
grant execute on function public.submit_participant(uuid) to authenticated;
grant execute on function public.get_quiz_state(uuid) to authenticated;
grant execute on function public.get_lobby_info(uuid) to authenticated;
grant execute on function public.get_public_ranking(uuid) to authenticated;
grant execute on function public.start_quiz(uuid) to authenticated;
grant execute on function public.adjust_quiz_duration(uuid, integer) to authenticated;
grant execute on function public.finalize_quiz(uuid) to authenticated;
grant execute on function public.admin_set_participant_active(uuid, boolean) to authenticated;

-- =====================================================================
--  9. REALTIME
-- =====================================================================

alter table public.quizzes      replica identity full;
alter table public.participants replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.quizzes;
  exception when duplicate_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.participants;
  exception when duplicate_object then null;
  end;
end $$;

-- =====================================================================
-- 10. STORAGE — BUCKET MATERI
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('materials', 'materials', true)
on conflict (id) do update set public = true;

drop policy if exists materials_files_public_read on storage.objects;
create policy materials_files_public_read on storage.objects
  for select to public
  using (bucket_id = 'materials');

drop policy if exists materials_files_admin_insert on storage.objects;
create policy materials_files_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'materials' and public.is_admin());

drop policy if exists materials_files_admin_update on storage.objects;
create policy materials_files_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'materials' and public.is_admin())
  with check (bucket_id = 'materials' and public.is_admin());

drop policy if exists materials_files_admin_delete on storage.objects;
create policy materials_files_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'materials' and public.is_admin());

-- =====================================================================
-- SELESAI.
-- Langkah berikutnya:
--   1) Buat akun admin lewat Authentication > Users
--   2) Jalankan: update public.profiles set role='admin' where id = (
--        select id from auth.users where email='admin@contoh.com');
--   3) Jalankan sql/seed.sql untuk 10 soal contoh
-- =====================================================================
