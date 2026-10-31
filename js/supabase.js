/* =====================================================================
   KONFIGURASI SUPABASE
   Ganti dua nilai di bawah dengan URL project & publishable key milikmu.
   Ambil di: Supabase Dashboard > Settings > API Keys
   (atau tombol Connect di dashboard).

   SUPABASE_ANON_KEY boleh diisi publishable key (sb_publishable_...)
   atau anon public key legacy. JANGAN pernah memakai secret/service_role key.
   ===================================================================== */

export const SUPABASE_URL = 'https://meevuzychnqbrtvejhea.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_kJzWA5qryFW1RHU7ES1eww_sepJwHVP';

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

if (SUPABASE_ANON_KEY.startsWith('sb_secret_') || SUPABASE_ANON_KEY.includes('service_role')) {
  console.error('[Kuis C] BAHAYA: yang dipasang adalah secret key. Ganti dengan publishable/anon key; secret key melewati RLS dan tidak boleh ada di frontend.');
}

export const CONFIG_HINT =
  'Supabase belum dikonfigurasi. Buka js/supabase.js lalu isi SUPABASE_URL dan SUPABASE_ANON_KEY (publishable/anon key) dari dashboard Supabase.';
