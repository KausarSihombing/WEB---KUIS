/* =====================================================================
   KONFIGURASI SUPABASE
   Ganti dua nilai di bawah dengan URL project & anon key milikmu.
   Ambil di: Supabase Dashboard > Project Settings > API.
   JANGAN pernah memakai service_role key di frontend.
   ===================================================================== */

export const SUPABASE_URL = 'https://YOUR-PROJECT-REF.supabase.co';
export const SUPABASE_ANON_KEY = 'YOUR-ANON-KEY';

export const isConfigured =
  !SUPABASE_URL.includes('YOUR-PROJECT-REF') &&
  !SUPABASE_ANON_KEY.includes('YOUR-ANON-KEY');

const lib = globalThis.supabase;

if (!lib) {
  console.error('[Kuis C] Library Supabase belum termuat. Pastikan tag CDN supabase-js ada sebelum script module.');
}

export const sb = lib
  ? lib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

if (!isConfigured) {
  console.warn('[Kuis C] js/supabase.js belum dikonfigurasi. Isi SUPABASE_URL dan SUPABASE_ANON_KEY.');
}

export const CONFIG_HINT =
  'Supabase belum dikonfigurasi. Buka js/supabase.js lalu isi SUPABASE_URL dan SUPABASE_ANON_KEY dari dashboard Supabase.';
