/* =====================================================================
   UI HELPERS — layout, sidebar, toast, modal, sanitasi, format
   ===================================================================== */
import { sb } from './supabase.js';

/* ----------------------------- selektor ----------------------------- */
export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

/* ----------------------------- sanitasi ----------------------------- */
const ALLOWED_TAGS = {
  P: [], BR: [], STRONG: [], B: [], EM: [], I: [], U: [], S: [],
  UL: [], OL: [], LI: [], H3: [], H4: [], H5: [], H6: [],
  A: ['href'], CODE: [], PRE: [], BLOCKQUOTE: [], SPAN: [], HR: [],
  TABLE: [], THEAD: [], TBODY: [], TR: [], TH: [], TD: [],
};
const DROP_TAGS = ['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'FORM', 'INPUT', 'BUTTON'];

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

/** Sanitasi HTML materi: hanya tag dasar, atribut href http(s). */
export function sanitizeHtml(html) {
  const doc = new DOMParser().parseFromString(`<div>${html ?? ''}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  if (!root) return '';

  const clean = (node) => {
    [...node.children].forEach((el) => {
      if (DROP_TAGS.includes(el.tagName)) {
        el.remove();
        return;
      }
      if (!ALLOWED_TAGS[el.tagName]) {
        el.replaceWith(...el.childNodes);
        return;
      }
      [...el.attributes].forEach((attr) => {
        const name = attr.name.toLowerCase();
        const keep = ALLOWED_TAGS[el.tagName].includes(name) &&
          (name !== 'href' || /^https?:\/\//i.test(attr.value));
        if (!keep) el.removeAttribute(attr.name);
      });
      if (el.tagName === 'A') {
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener noreferrer');
      }
      clean(el);
    });
  };

  clean(root);
  return root.innerHTML;
}

/* ----------------------------- format ----------------------------- */
export function formatDate(iso, withTime = true) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('id-ID', withTime
    ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatClock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export function formatDuration(ms) {
  if (ms == null || Number.isNaN(ms)) return '—';
  return formatClock(Math.max(0, Math.round(ms / 1000)));
}

export function initials(name) {
  return String(name ?? '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?';
}

export function statusBadge(status) {
  const map = {
    draft: ['badge-draft', 'Draft'],
    menunggu: ['badge-menunggu', 'Menunggu'],
    berjalan: ['badge-berjalan', 'Berjalan'],
    selesai: ['badge-selesai', 'Selesai'],
  };
  const [cls, label] = map[status] ?? ['badge-off', status ?? '—'];
  return `<span class="badge ${cls}">${label}</span>`;
}

/* ----------------------------- toast ----------------------------- */
export function toast(message, type = 'success', duration = 3400) {
  let stack = $('.toast-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'toast-stack';
    document.body.appendChild(stack);
  }
  const icons = { success: '✓', error: '!', info: 'i' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<i>${icons[type] ?? 'i'}</i><div>${escapeHtml(message)}</div>`;
  stack.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 220);
  }, duration);
}

/* ----------------------------- modal ----------------------------- */
export function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
}

export function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

export function closeAllModals() {
  $$('.modal.open').forEach((m) => m.classList.remove('open'));
}

document.addEventListener('click', (event) => {
  const closer = event.target.closest('[data-close]');
  if (closer) {
    const modal = closer.closest('.modal');
    if (modal) modal.classList.remove('open');
  }
  if (event.target.classList?.contains('modal')) {
    event.target.classList.remove('open');
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeAllModals();
});

/* ----------------------------- tombol busy ----------------------------- */
export function setBusy(button, busy, busyText = 'Memproses...') {
  if (!button) return;
  if (busy) {
    if (!button.dataset.original) button.dataset.original = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<span class="spinner"></span> ${escapeHtml(busyText)}`;
  } else {
    button.disabled = false;
    if (button.dataset.original) {
      button.innerHTML = button.dataset.original;
      delete button.dataset.original;
    }
  }
}

/* ----------------------------- shell layout ----------------------------- */
const ADMIN_NAV = [
  { key: 'dashboard', href: 'admin/dashboard.html', icon: '◈', label: 'Dashboard' },
  { key: 'quiz', href: 'admin/quiz.html', icon: '✎', label: 'Manajemen Kuis' },
  { key: 'tokens', href: 'admin/tokens.html', icon: '⚿', label: 'Token Akses' },
  { key: 'live', href: 'admin/live.html', icon: '▶', label: 'Live Kuis' },
  { key: 'leaderboard', href: 'admin/leaderboard.html', icon: '♛', label: 'Leaderboard' },
  { key: 'materials', href: 'admin/materials.html', icon: '▤', label: 'Materi' },
  { key: 'participants', href: 'admin/participants.html', icon: '☷', label: 'Peserta' },
];

const PESERTA_NAV = [
  { key: 'home', href: 'peserta/home.html', icon: '◈', label: 'Beranda' },
  { key: 'join', href: 'peserta/join.html', icon: '⚿', label: 'Ikuti Kuis' },
  { key: 'materials', href: 'peserta/materials.html', icon: '▤', label: 'Materi' },
];

export function mountShell({ profile, role, active = '', title = '', subtitle = '' } = {}) {
  const sidebar = document.getElementById('sidebar');
  const nav = role === 'admin' ? ADMIN_NAV : PESERTA_NAV;
  const root = '../';

  if (sidebar) {
    sidebar.innerHTML = `
      <a class="sidebar-brand" href="${root}${role === 'admin' ? 'admin/dashboard.html' : 'peserta/home.html'}" style="text-decoration:none;color:inherit">
        <span class="brand-mark">{C}</span>
        <span class="brand-text">Kuis Bahasa C<small>${role === 'admin' ? 'Panel Instruktur' : 'Ruang Peserta'}</small></span>
      </a>
      <nav class="side-nav">
        <div class="side-label">Menu</div>
        ${nav.map((item) => `
          <a class="nav-link ${active === item.key ? 'active' : ''}" href="${root}${item.href}">
            <span class="ico">${item.icon}</span>
            <span>${item.label}</span>
          </a>`).join('')}
      </nav>
      <div class="sidebar-foot">
        <div class="side-user">
          <div class="avatar">${escapeHtml(initials(profile?.full_name))}</div>
          <div class="who">
            <strong>${escapeHtml(profile?.full_name ?? 'Pengguna')}</strong>
            <span>${escapeHtml(role === 'admin' ? 'Instruktur' : (profile?.nim_kelas || 'Peserta'))}</span>
          </div>
        </div>
        <button class="btn btn-ghost btn-block" id="logoutBtn" type="button">⏻ Keluar</button>
      </div>
    `;

    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
      await sb.auth.signOut();
      location.href = `${root}index.html`;
    });
  }

  const titleEl = document.getElementById('pageTitle');
  const subEl = document.getElementById('pageSub');
  if (titleEl && title) titleEl.textContent = title;
  if (subEl && subtitle) subEl.textContent = subtitle;

  wireMobileSidebar();
  return { root };
}

function wireMobileSidebar() {
  const toggle = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (!toggle || !sidebar || !overlay) return;

  const close = () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
  };

  toggle.addEventListener('click', () => {
    const opening = !sidebar.classList.contains('open');
    sidebar.classList.toggle('open', opening);
    overlay.classList.toggle('show', opening);
  });
  overlay.addEventListener('click', close);
  $$('.nav-link', sidebar).forEach((link) => link.addEventListener('click', close));
}

/* ----------------------------- CSV ----------------------------- */
export function downloadCsv(filename, headers, rows) {
  const escapeCell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const lines = [headers.map(escapeCell).join(','), ...rows.map((row) => row.map(escapeCell).join(','))];
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ----------------------------- misc ----------------------------- */
export function emptyState(emoji, title, text = '') {
  return `<div class="empty">
    <div class="emoji">${emoji}</div>
    <h4>${escapeHtml(title)}</h4>
    ${text ? `<p>${escapeHtml(text)}</p>` : ''}
  </div>`;
}

export function loadingState(text = 'Memuat data...') {
  return `<div class="loading-block"><span class="spinner"></span><span>${escapeHtml(text)}</span></div>`;
}

export function round(value, digits = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Number(n.toFixed(digits));
}

export function shuffleWithSeed(items, seedString) {
  let seed = 0;
  for (const ch of String(seedString ?? 'seed')) seed = (seed * 31 + ch.charCodeAt(0)) % 2147483647;
  const rand = () => {
    seed = (seed * 48271) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
