-- =====================================================================
--  DATA CONTOH — 10 SOAL DASAR BAHASA C
--  Jalankan SETELAH schema.sql dan SETELAH akun admin dibuat.
--  Aman dijalankan berulang (idempotent).
-- =====================================================================

do $$
declare
  v_admin uuid;
  v_quiz  uuid;
begin
  select id into v_admin
  from public.profiles
  where role = 'admin' and is_active = true
  order by created_at
  limit 1;

  if v_admin is null then
    raise notice 'Tidak ada admin aktif. Buat akun admin terlebih dahulu, lalu jalankan seed ini lagi.';
    return;
  end if;

  select id into v_quiz
  from public.quizzes
  where title = 'Kuis Dasar Bahasa C'
  limit 1;

  if v_quiz is null then
    insert into public.quizzes
      (title, description, duration_minutes, shuffle, status, created_by)
    values
      ('Kuis Dasar Bahasa C',
       'Kuis pilihan ganda tentang variabel, tipe data, percabangan, perulangan, array, fungsi, string, dan pointer dasar.',
       15, true, 'menunggu', v_admin)
    returning id into v_quiz;
  end if;

  if not exists (select 1 from public.questions where quiz_id = v_quiz) then
    insert into public.questions
      (quiz_id, question_text, code_snippet, option_a, option_b, option_c, option_d, correct_answer, points, order_no)
    values
    (v_quiz,
     'Perhatikan potongan kode berikut. Apa yang akan ditampilkan?',
     $c$#include <stdio.h>

int main(void) {
    int nilai = 85;
    printf("%d", nilai);
    return 0;
}$c$,
     '85', '85.00', 'nilai', 'error kompilasi',
     'A', 10, 1),

    (v_quiz,
     'Tipe data manakah yang paling tepat untuk menyimpan satu karakter seperti ''A''?',
     null,
     'int', 'char', 'float', 'string',
     'B', 10, 2),

    (v_quiz,
     'Apa keluaran dari potongan kode berikut?',
     $c$#include <stdio.h>

int main(void) {
    int x = 7;
    if (x % 2 == 0)
        printf("genap");
    else
        printf("ganjil");
    return 0;
}$c$,
     'genap', 'ganjil', '7', 'tidak ada output',
     'B', 10, 3),

    (v_quiz,
     'Berapa nilai yang dicetak oleh perulangan berikut?',
     $c$#include <stdio.h>

int main(void) {
    int total = 0;
    for (int i = 1; i <= 5; i++) {
        total += i;
    }
    printf("%d", total);
    return 0;
}$c$,
     '10', '14', '15', '55',
     'C', 10, 4),

    (v_quiz,
     'Indeks array dimulai dari 0. Apa keluaran kode berikut?',
     $c$#include <stdio.h>

int main(void) {
    int arr[3] = {10, 20, 30};
    printf("%d", arr[1]);
    return 0;
}$c$,
     '10', '20', '30', 'error',
     'B', 10, 5),

    (v_quiz,
     'Apa nilai akhir variabel i?',
     $c$#include <stdio.h>

int main(void) {
    int i = 0;
    while (i < 3) {
        i++;
    }
    printf("%d", i);
    return 0;
}$c$,
     '0', '2', '4', '3',
     'D', 10, 6),

    (v_quiz,
     'Apa keluaran dari pemanggilan fungsi berikut?',
     $c$#include <stdio.h>

int kuadrat(int x) {
    return x * x;
}

int main(void) {
    printf("%d", kuadrat(4));
    return 0;
}$c$,
     '8', '16', '4', '12',
     'B', 10, 7),

    (v_quiz,
     'Apa yang dicetak setelah pointer mengubah nilai variabel?',
     $c$#include <stdio.h>

int main(void) {
    int a = 10;
    int *p = &a;
    *p = 25;
    printf("%d", a);
    return 0;
}$c$,
     '10', 'error', '25', 'alamat memori',
     'C', 10, 8),

    (v_quiz,
     'Apa hasil strlen() pada string berikut?',
     $c$#include <stdio.h>
#include <string.h>

int main(void) {
    char nama[] = "C";
    printf("%d", strlen(nama));
    return 0;
}$c$,
     '1', '2', '0', '3',
     'A', 10, 9),

    (v_quiz,
     'Perhatikan pembagian bilangan bulat berikut. Apa yang dicetak?',
     $c$#include <stdio.h>

int main(void) {
    int a = 5, b = 2;
    printf("%d", a / b);
    return 0;
}$c$,
     '2.5', '3', '0', '2',
     'D', 10, 10);
  end if;

  if not exists (select 1 from public.tokens where quiz_id = v_quiz) then
    insert into public.tokens (quiz_id, code, is_active)
    values (v_quiz, 'CBASIC', true);
  end if;

  raise notice 'Seed selesai. Token contoh: CBASIC';
end $$;
