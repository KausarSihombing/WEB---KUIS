# Kuis Bahasa C

Aplikasi web kuis Bahasa C bergaya platform pembelajaran (mirip Edlink) dengan dua peran:

- **Instruktur / Admin** — membuat kuis dan soal, mengatur token, memulai/mengakhiri kuis secara realtime, mengubah durasi saat kuis berjalan, mengelola materi, memantau peserta, dan melihat leaderboard lengkap.
- **Peserta** — mendaftar akun sendiri, masuk kuis memakai token, mengerjakan soal satu per layar dengan jawaban tersimpan otomatis, menunggu instruktur mengakhiri kuis, lalu melihat peringkat nama saja.

Frontend: **HTML, CSS, JavaScript murni (vanilla)**. Backend: **Supabase** (Postgres, Auth, Realtime, Storage, RPC). Tidak ada build step dan tidak ada framework.

---

## 1. Alur Sistem

```
Instruktur                                    Peserta
──────────────────────────────────────────    ────────────────────────────────
Buat kuis + soal (status: draft)
Buka pendaftaran  → status: menunggu
Bagikan token 6 karakter                      Daftar akun (role: peserta)
                                              Login → "Ikuti Kuis" → masukkan token
                                              join_quiz_with_token() → ruang tunggu
Tekan START di Live Kuis
  start_quiz(): started_at + ends_at server   Realtime: status → berjalan
  status → berjalan                           Halaman soal terbuka otomatis
                                              Jawaban disimpan tiap klik (belum dinilai)
Ubah durasi ± menit (opsional)
  adjust_quiz_duration(): ends_at baru        Timer menyesuaikan tanpa refresh
Pantau progres jawaban per peserta
Tekan AKHIRI KUIS
  finalize_quiz() dijalankan SEKALI:
  kunci jawaban → hitung is_correct,
  score, benar/salah, ranking,
  status → selesai                            Halaman peringkat: NAMA saja
Leaderboard lengkap (nilai, benar/salah,      Podium Top 3 + urutan nama
waktu) + export CSV                           (tanpa nilai/poin)
```

### Aturan penilaian

1. Selama kuis berjalan, tabel `answers` hanya menyimpan pilihan peserta. `is_correct` tetap `NULL` dan tidak ada skor.
2. Peserta menekan **Selesai Mengerjakan** → `submitted_at` diisi, jawaban dikunci. Tidak ada nilai yang dihitung atau dikirim.
3. Hanya `finalize_quiz(quiz_id)` (RPC, wajib admin) yang menghitung `is_correct`, `score`, `correct_count`, `wrong_count`, dan `rank`.
4. `finalize_quiz` juga mengunci semua peserta yang belum submit, mengubah status kuis menjadi `selesai`, dan membuka leaderboard.
5. Peserta hanya bisa membaca peringkat melalui RPC `get_public_ranking()` yang mengembalikan **nama + rank** dan menolak jika kuis belum selesai.

### Status kuis

| Status | Arti | Aksi admin |
|---|---|---|
| `draft` | Belum bisa diikuti | Edit kuis/soal, **Buka Pendaftaran** |
| `menunggu` | Token bisa dipakai, peserta di ruang tunggu | **START** di Live Kuis |
| `berjalan` | Soal terbuka, timer server berjalan | Ubah durasi, monitoring, **AKHIRI KUIS** |
| `selesai` | Nilai & ranking terkunci | Leaderboard, export CSV |

---

## 2. Struktur File

```
/
├── index.html                  Landing page
├── login.html                  Login semua peran
├── register.html               Registrasi peserta (role selalu peserta)
├── admin/
│   ├── dashboard.html          Statistik + daftar kuis
│   ├── quiz.html               CRUD kuis + soal
│   ├── tokens.html             Generate / aktifkan / hapus token + pemakaian
│   ├── live.html               Lobby, START, ubah durasi, monitoring, AKHIRI
│   ├── leaderboard.html        Podium + tabel lengkap + export CSV
│   ├── materials.html          CRUD materi + upload file
│   └── participants.html       Akun peserta, riwayat, aktif/nonaktif, hapus
├── peserta/
│   ├── home.html               Beranda: statistik, riwayat, materi
│   ├── join.html               Input token
│   ├── lobby.html              Ruang tunggu realtime
│   ├── quiz.html               Satu soal per layar, autosave, timer server
│   ├── waiting.html            "Jawaban terkirim, menunggu instruktur..."
│   ├── ranking.html            Podium Top 3 + nama peserta
│   └── materials.html          Baca materi terbit
├── css/
│   └── style.css               Seluruh desain (tema hijau, responsif)
├── js/
│   ├── supabase.js             Konfigurasi URL + anon key
│   ├── auth.js                 Login, register, guard peran
│   ├── ui.js                   Layout sidebar, toast, modal, sanitasi, format
│   ├── quiz.js                 RPC peserta, timer countdown, routing
│   ├── admin.js                CRUD kuis/soal/token/materi, kontrol live
│   └── realtime.js             Subscribe perubahan quizzes/participants
├── sql/
│   ├── schema.sql              Tabel, index, trigger, RLS, view, RPC, realtime, storage
│   └── seed.sql                Kuis contoh + 10 soal C + token CBASIC
└── README.md
```

---

## 3. Setup Supabase (Langkah demi Langkah)

### 3.1 Buat project

1. Buka <https://supabase.com> → **New project**.
2. Isi nama, database password, dan region (Singapore paling dekat).
3. Tunggu project selesai dibuat.

### 3.2 Jalankan skema SQL

1. Buka **SQL Editor** → **New query**.
2. Salin **seluruh isi** `sql/schema.sql` → **Run**.
3. Pastikan tidak ada error merah.

`schema.sql` membuat:
- Tabel `profiles`, `quizzes`, `questions`, `tokens`, `participants`, `answers`, `materials`.
- Index, foreign key, trigger `on_auth_user_created` (profil otomatis, role selalu peserta).
- RLS untuk semua tabel + view `questions_public` tanpa kolom kunci jawaban.
- RPC: `join_quiz_with_token`, `save_answer`, `submit_participant`, `get_quiz_state`, `get_my_participations`, `get_lobby_info`, `get_public_ranking`, `start_quiz`, `adjust_quiz_duration`, `finalize_quiz`, `admin_set_participant_active`.
- Realtime untuk `quizzes` dan `participants`.
- Storage bucket `materials` + policy upload admin.

### 3.3 Ambil URL dan API key

1. Buka **Settings → API Keys** (atau tombol **Connect** di dashboard).
2. Salin **Project URL** dan **publishable key** (`sb_publishable_...`).
   Jika project masih memakai key legacy, gunakan **anon public key**.
3. Buka `js/supabase.js`, ganti:

```js
export const SUPABASE_URL = 'https://xxxxxxxx.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_...';
```

> Variable `SUPABASE_ANON_KEY` sengaja dipertahankan agar kompatibel; isinya boleh publishable key atau anon key legacy. **Jangan pernah** menaruh secret key / `service_role` di frontend.

### 3.4 Atur autentikasi

**Authentication → Providers → Email**: pastikan Email aktif.

Untuk pengujian cepat, matikan konfirmasi email:
**Authentication → Sign In / Providers → Email → Confirm email = OFF**.
Jika dibiarkan ON, peserta harus mengklik tautan di email sebelum bisa login; halaman register sudah menangani pesan ini.

### 3.5 Buat admin pertama

1. **Authentication → Users → Add user → Create new user**.
2. Isi email + password admin (mis. `admin@campus.ac.id`), centang auto-confirm bila tersedia.
3. Trigger sudah membuat baris di `profiles` dengan role `peserta`.
4. Jalankan di SQL Editor:

```sql
update public.profiles
set role = 'admin', full_name = 'Nama Instruktur'
where id = (select id from auth.users where email = 'admin@campus.ac.id');
```

5. Login melalui `login.html` → otomatis diarahkan ke `/admin/dashboard.html`.

> Jika akun admin dibuat **sebelum** `schema.sql` dijalankan, profilnya belum ada. Jalankan ulang `schema.sql` (trigger akan aktif), lalu insert profil manual:
> ```sql
> insert into public.profiles (id, full_name, nim_kelas, role)
> select id, 'Nama Instruktur', null, 'admin'
> from auth.users where email = 'admin@campus.ac.id'
> on conflict (id) do update set role = 'admin';
> ```

### 3.6 Aktifkan Realtime

`schema.sql` sudah menambahkan tabel ke publication. Verifikasi:

**Database → Replication → `supabase_realtime`** → pastikan `quizzes` dan `participants` tercentang.

### 3.7 Jalankan data contoh

Setelah admin dibuat, jalankan **`sql/seed.sql`** di SQL Editor. Hasilnya:

- Kuis **"Kuis Dasar Bahasa C"**, 15 menit, soal diacak, status `menunggu`.
- 10 soal pilihan ganda (variabel, tipe data, if/else, loop, array, fungsi, pointer, string, operator).
- Token aktif: **`CBASIC`**.

Cara mencoba: register peserta → login → Ikuti Kuis → token `CBASIC` → masuk lobby → dari akun admin buka **Live Kuis** → **START**.

### 3.8 Storage materi

Bucket `materials` sudah dibuat oleh SQL dan bersifat **public** agar file materi mudah dibuka peserta. Upload hanya boleh dilakukan admin melalui policy. Jika ingin privat, ubah bucket menjadi private dan ganti `getPublicUrl` dengan signed URL di `js/admin.js`.

---

## 4. Menjalankan Lokal

Karena memakai ES Modules (`<script type="module">`), halaman **tidak bisa** dibuka langsung dengan `file://`.

Pilih salah satu:

**VS Code Live Server**
1. Install ekstensi *Live Server*.
2. Klik kanan `index.html` → **Open with Live Server**.
3. Buka `http://127.0.0.1:5500`.

**Node (`npx serve`)**
```bash
npx serve .
# buka URL yang ditampilkan
```

**Python**
```bash
python -m http.server 5500
# buka http://localhost:5500
```

---

## 5. Deploy Gratis

Aplikasi ini statis, cukup unggah seluruh folder (tanpa `node_modules`).

### Netlify
1. Buka <https://app.netlify.com/drop>.
2. Drag seluruh folder project.
3. Selesai. Tambahkan domain kustom bila perlu.

### Vercel
1. Import repository ke Vercel.
2. Framework preset: **Other**. Build command kosong. Output directory: `.` (root).
3. Deploy.

### GitHub Pages
1. Push project ke repository GitHub.
2. **Settings → Pages → Build and deployment → Deploy from a branch**.
3. Pilih branch `main` dan folder `/ (root)`.
4. Buka `https://username.github.io/repo/`.

Semua link memakai path relatif sehingga aman di subfolder GitHub Pages. Pada Supabase, tambahkan domain deploy ke **Authentication → URL Configuration → Site URL / Redirect URLs** bila memakai konfirmasi email atau OAuth.

---

## 6. Data Contoh — 10 Soal

`sql/seed.sql` membuat kuis dengan soal berikut (kunci jawaban hanya terlihat admin):

| No | Topik | Ringkas | Kunci | Poin |
|---|---|---|---|---|
| 1 | Variabel | `int nilai = 85; printf("%d", nilai);` | A (`85`) | 10 |
| 2 | Tipe data | Tipe untuk satu karakter | B (`char`) | 10 |
| 3 | If/else | `x = 7` → output percabangan | B (`ganjil`) | 10 |
| 4 | Loop for | Jumlah 1 sampai 5 | C (`15`) | 10 |
| 5 | Array | `arr[1]` dari `{10,20,30}` | B (`20`) | 10 |
| 6 | While | Nilai akhir `i` setelah `i < 3` | D (`3`) | 10 |
| 7 | Fungsi | `kuadrat(4)` | B (`16`) | 10 |
| 8 | Pointer | `*p = 25` mengubah `a` | C (`25`) | 10 |
| 9 | String | `strlen("C")` | A (`1`) | 10 |
| 10 | Operator | `5 / 2` pada `int` | D (`2`) | 10 |

---

## 7. Keamanan yang Diterapkan

- **Hanya anon key** di frontend. Tidak ada service role.
- **RLS aktif** di semua tabel:
  - Admin (cek `is_admin()` di database) punya akses penuh.
  - Peserta hanya bisa membaca profilnya, riwayat partisipasinya lewat RPC `get_my_participations`, jawabannya (saat kuis berjalan), dan materi terbit.
  - Tabel `participants` hanya bisa dibaca admin. Peserta memakai RPC `get_my_participations` yang **tidak memuat** `score`, `correct_count`, atau `wrong_count`.
  - Peserta tidak bisa membaca `tokens`, `questions.correct_answer`, atau `answers.is_correct`.
- **View `questions_public`** tidak memuat `correct_answer` dan hanya mengembalikan soal kuis berjalan yang diikuti peserta.
- **Semua aksi sensitif lewat RPC** `SECURITY DEFINER` dengan validasi peran/status di server:
  join token, simpan jawaban, submit, mulai, ubah durasi, finalisasi.
- **Registrasi publik selalu `peserta`**; role di-hardcode di trigger, metadata tidak bisa menaikkan hak akses.
- **Kolom `profiles.role` dan `is_active` tidak bisa diubah peserta** lewat API (column privilege + RPC admin).
- **XSS**: semua data dinamis di-escape; isi materi disanitasi dengan allowlist tag/atribut sebelum dirender; URL lampiran hanya `http(s)`.
- **Jawaban dikunci** setelah submit (`save_answer` menolak) dan setelah kuis selesai.

Catatan: peserta dapat melihat nama peserta lain **hanya setelah kuis selesai** dan **tanpa nilai**. Ini sesuai spesifikasi leaderboard peserta.

---

## 8. Troubleshooting

| Masalah | Penyebab & solusi |
|---|---|
| "Supabase belum dikonfigurasi" | Isi `SUPABASE_URL` dan `SUPABASE_ANON_KEY` (publishable/anon) di `js/supabase.js`, lalu hard-refresh. |
| Login berhasil tapi kembali ke halaman login | Profil tidak ditemukan / nonaktif. Cek tabel `profiles`, jalankan ulang trigger atau insert profil. |
| Register tapi tidak bisa login | Konfirmasi email masih aktif. Cek inbox atau matikan *Confirm email* di Supabase. |
| Token tidak valid | Token nonaktif, kuis masih `draft`, atau sudah `selesai`. Cek halaman **Token Akses** dan status kuis. |
| Peserta tidak pindah saat START | Realtime belum aktif. Cek **Database → Replication**, pastikan `quizzes` dan `participants` masuk publication `supabase_realtime`; refresh halaman. |
| Timer peserta berbeda dengan HP | Memang disengaja: timer memakai `ends_at` server, bukan jam perangkat. |
| Tidak bisa mengurangi durasi | Pengurangan akan melewati waktu yang sudah berjalan. Server menolak dan menampilkan pesan. |
| "Tambahkan minimal satu soal" saat START | Kuis harus punya minimal satu soal. |
| Upload materi gagal | Pastikan bucket `materials` ada dan akun ber-role `admin`. Cek **Storage → materials**. |
| Hapus peserta tapi masih bisa login | Menghapus profil dari aplikasi tidak menghapus baris `auth.users`. Hapus juga user di **Authentication → Users** bila perlu. |

---

## 9. Ringkasan File SQL

- `sql/schema.sql` — jalankan sekali di project baru.
- `sql/seed.sql` — jalankan setelah admin ada. Aman diulang.
- Untuk mengulang dari nol: hapus tabel lewat SQL Editor atau buat project Supabase baru, lalu jalankan `schema.sql` lagi.
