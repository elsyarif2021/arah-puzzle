# Arah

Puzzle panah PWA dengan 30 level, 10 untuk setiap kategori Mudah, Sedang, dan Sulit. Ketuk panah yang jalurnya bebas. Percobaan yang terhalang mengurangi satu nyawa. Jawab soal Juz 29 atau 30 untuk menyingkirkan penghalang, memakai petunjuk, atau menambah satu nyawa saat tersisa satu. Tiga bantuan tersedia per percobaan. Jawaban benar mengurangi satu jatah dan jawaban salah membiarkan jatah tetap. Selesaikan minimal satu soal untuk membuka panah terakhir pada papan baru. Setiap soal menampilkan rujukan dan terjemahan Quran.ai edisi id-id, bersumber dari Quran.com edisi 33.

Tombol suara mengatur efek melesat, efek mentok, serta ucapan Alhamdulillah dan Astaghfirullah. Kuis dan audio tersimpan di cache offline setelah pemuatan awal. Tantangan harian menggunakan tanggal WIB. Progres disimpan di browser, dan papan lama tetap dapat diteruskan hingga pemain menekan Ulangi.

## Jalankan

Ekstrak arsip, buka terminal di folder ini, lalu jalankan `python3 -m http.server 8765`. Buka http://localhost:8765 dan tunggu teks “Siap dimainkan offline”. Untuk mengaksesnya dari HP, hos seluruh isi folder di hosting statis HTTPS. Tombol “Pasang aplikasi” menampilkan petunjuk pemasangan.

Tidak ada dependensi runtime.

## Peringkat harian online

Peringkat hari ini menampilkan 20 hasil terbaik berdasarkan sisa nyawa, kemudian waktu. Skor disimpan saat pemain menekan Kirim skor. Skor lama tanpa riwayat langkah tetap tersedia di perangkat, dan percobaan baru dapat dikirim. Server memeriksa ulang urutan langkah; durasi dihitung oleh aplikasi.

Untuk hosting dengan peringkat, jalankan `node worker/build.mjs` dan deploy `dist/server/index.js` sebagai Worker ES module. Hubungkan D1 sebagai `DB` dan terapkan migrasi SQL dari folder `drizzle`. Server statis sederhana hanya menjalankan game dan cache offline.

Buka **Profil** di bagian atas untuk menyimpan nama panggilan di perangkat. Nama ini diisi otomatis saat mengirim skor.

Selesaikan semua 10 level dalam satu kategori untuk membuka sertifikat penghargaan dalam format PNG A4. Sertifikat dapat diakses kembali dari menu Level.
