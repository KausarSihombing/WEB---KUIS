/* =====================================================================
   AUTH — Supabase Auth + profil + guard peran
   ===================================================================== */
import { sb, isConfigured, CONFIG_HINT } from './supabase.js';

export const ROOT = (() => {
  const path = location.pathname.replaceAll('\\', '/');
  return /\/admin\/|\/peserta\//.test(path) ? '../' : '';
})();

export function go(path) {
  location.href = `${ROOT}${path}`;
}

export function homeFor(profile) {
  return profile?.role === 'admin' ? 'admin/dashboard.html' : 'peserta/home.html';
}

function friendlyAuthError(message = '') {
  const text = message.toLowerCase();
  if (text.includes('invalid login credentials')) return 'Email atau password salah.';
  if (text.includes('email not confirmed')) return 'Email belum dikonfirmasi. Cek kotak masuk email kamu.';
  if (text.includes('user already registered')) return 'Email ini sudah terdaftar. Silakan login.';
  if (text.includes('password should be at least')) return 'Password minimal 6 karakter.';
  if (text.includes('rate limit') || text.includes('too many')) return 'Terlalu banyak percobaan. Coba lagi beberapa saat lagi.';
  if (text.includes('failed to fetch') || text.includes('network')) return 'Tidak dapat terhubung ke server. Periksa koneksi dan konfigurasi Supabase.';
  return message || 'Terjadi kesalahan. Coba lagi.';
}

export async function fetchProfile(userId) {
  if (!sb) throw new Error(CONFIG_HINT);
  const { data, error } = await sb
    .from('profiles')
    .select('id, full_name, nim_kelas, role, is_active, created_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw new Error(friendlyAuthError(error.message));
  return data;
}

export async function signIn(email, password) {
  if (!isConfigured) throw new Error(CONFIG_HINT);
  const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(friendlyAuthError(error.message));

  const profile = await fetchProfile(data.user.id);
  if (!profile) {
    await sb.auth.signOut();
    throw new Error('Profil akun tidak ditemukan. Hubungi instruktur.');
  }
  if (!profile.is_active) {
    await sb.auth.signOut();
    throw new Error('Akun ini dinonaktifkan oleh instruktur.');
  }
  return profile;
}

export async function signUp({ fullName, nimKelas, email, password }) {
  if (!isConfigured) throw new Error(CONFIG_HINT);

  const { data, error } = await sb.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: {
        full_name: fullName.trim(),
        nim_kelas: nimKelas.trim(),
      },
    },
  });

  if (error) throw new Error(friendlyAuthError(error.message));

  // Supabase mengembalikan identities kosong bila email sudah dipakai
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new Error('Email ini sudah terdaftar. Silakan login.');
  }

  // Email confirmation aktif → belum ada session
  if (!data.session) return { needsConfirmation: true, profile: null };

  const profile = await fetchProfile(data.session.user.id);
  return { needsConfirmation: false, profile };
}

export async function signOut() {
  await sb?.auth.signOut();
}

/** Guard halaman. Mengembalikan profil atau null (sudah diarahkan). */
export async function requireAuth(expectedRole = null) {
  if (!isConfigured) {
    location.replace(`${ROOT}login.html?error=config`);
    return null;
  }
  if (!sb) {
    location.replace(`${ROOT}login.html`);
    return null;
  }

  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    location.replace(`${ROOT}login.html`);
    return null;
  }

  let profile = null;
  try {
    profile = await fetchProfile(session.user.id);
  } catch (error) {
    console.error(error);
  }

  if (!profile) {
    await sb.auth.signOut();
    location.replace(`${ROOT}login.html?error=profile`);
    return null;
  }

  if (!profile.is_active) {
    await sb.auth.signOut();
    location.replace(`${ROOT}login.html?error=inactive`);
    return null;
  }

  if (expectedRole && profile.role !== expectedRole) {
    location.replace(`${ROOT}${homeFor(profile)}`);
    return null;
  }

  return profile;
}

/** Untuk halaman login/register: kalau sudah login, langsung arahkan. */
export async function redirectIfAuthenticated() {
  if (!isConfigured || !sb) return null;
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return null;
  try {
    const profile = await fetchProfile(session.user.id);
    if (profile?.is_active) {
      location.replace(`${ROOT}${homeFor(profile)}`);
      return profile;
    }
    await sb.auth.signOut();
  } catch (error) {
    console.error(error);
    await sb.auth.signOut();
  }
  return null;
}

export { friendlyAuthError };
