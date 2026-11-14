const { createClient } = require('@libsql/client');
require('dotenv').config();

const url = process.env.TURSO_DATABASE_URL && process.env.TURSO_DATABASE_URL.trim() !== ''
  ? process.env.TURSO_DATABASE_URL
  : 'file:local.db';

const authToken = process.env.TURSO_AUTH_TOKEN;

const db = createClient({
  url: url,
  authToken: authToken || undefined,
});

async function initDb() {
  try {
    // 1. Tabel tugas
    await db.execute(`
      CREATE TABLE IF NOT EXISTS tugas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        matkul TEXT,
        tipe TEXT,
        judul TEXT,
        deskripsi TEXT,
        batas_waktu DATETIME,
        link_drive TEXT,
        status TEXT DEFAULT 'Aktif'
      )
    `);

    // 2. Tabel kas
    await db.execute(`
      CREATE TABLE IF NOT EXISTS kas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tanggal DATE,
        keterangan TEXT,
        jenis TEXT,
        nominal INTEGER
      )
    `);

    // Insert data awal ke tabel kas HANYA jika tabel kosong
    const countKasRes = await db.execute("SELECT COUNT(*) as count FROM kas");
    if (Number(countKasRes.rows[0]?.count || 0) === 0) {
      const initialKas = [
        ['2026-11-01', 'Saldo awal kas kelas Semester 5', 'Pemasukan', 500000],
        ['2026-11-05', 'Iuran kas kelas pekan 1 November', 'Pemasukan', 350000],
        ['2026-11-10', 'Pembelian spidol & perlengkapan kelas', 'Pengeluaran', 45000]
      ];
      for (const [tanggal, keterangan, jenis, nominal] of initialKas) {
        await db.execute({
          sql: "INSERT INTO kas (tanggal, keterangan, jenis, nominal) VALUES (?, ?, ?, ?)",
          args: [tanggal, keterangan, jenis, nominal]
        });
      }
      console.log('✅ Seeding kas berhasil.');
    }

    // Koreksi otomatis mutasi jenis iuran
    await db.execute("UPDATE kas SET jenis = 'Pemasukan' WHERE keterangan LIKE '%Iuran%' OR LOWER(TRIM(jenis)) = 'pemasukan'");

    // 3. Tabel mentari
    await db.execute(`
      CREATE TABLE IF NOT EXISTS mentari (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        matkul TEXT,
        pertemuan TEXT,
        status TEXT,
        batas_waktu DATETIME,
        link_mentari TEXT
      )
    `);

    // Tambah kolom link_mentari jika tabel sudah ada sebelumnya
    try {
      await db.execute("ALTER TABLE mentari ADD COLUMN link_mentari TEXT");
    } catch (err) {
      // Abaikan jika kolom sudah ada
    }

    // Insert data awal ke tabel mentari HANYA jika tabel kosong
    const countMentariRes = await db.execute("SELECT COUNT(*) as count FROM mentari");
    if (Number(countMentariRes.rows[0]?.count || 0) === 0) {
      const initialMentari = [
        ['Kecerdasan Buatan', 'Pertemuan 10', 'Buka', '2026-11-20T23:59', 'https://elearning.unpam.ac.id/mod/forum/view.php?id=101'],
        ['Pemrograman Web 1', 'Pertemuan 11', 'Buka', '2026-11-22T23:59', 'https://elearning.unpam.ac.id/mod/quiz/view.php?id=102'],
        ['Machine Learning', 'Pertemuan 9', 'Tutup', '2026-11-10T23:59', 'https://elearning.unpam.ac.id/mod/forum/view.php?id=103']
      ];
      for (const [matkul, pertemuan, status, batas_waktu, link_mentari] of initialMentari) {
        await db.execute({
          sql: "INSERT INTO mentari (matkul, pertemuan, status, batas_waktu, link_mentari) VALUES (?, ?, ?, ?, ?)",
          args: [matkul, pertemuan, status, batas_waktu, link_mentari]
        });
      }
      console.log('✅ Seeding mentari berhasil.');
    }

    // 4. Tabel mata_kuliah
    await db.execute(`
      CREATE TABLE IF NOT EXISTS mata_kuliah (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nama_matkul TEXT,
        sks INTEGER,
        hari TEXT,
        dosen TEXT,
        link_materi TEXT
      )
    `);

    // Tambah kolom link_materi jika tabel mata_kuliah sudah ada sebelumnya
    try {
      await db.execute("ALTER TABLE mata_kuliah ADD COLUMN link_materi TEXT");
    } catch (err) {
      // Abaikan jika kolom sudah ada
    }

    // Insert data awal ke tabel mata_kuliah HANYA jika tabel kosong
    const countRes = await db.execute("SELECT COUNT(*) as count FROM mata_kuliah");
    const count = Number(countRes.rows[0]?.count || 0);
    if (count === 0) {
      const initialMatkul = [
        ['Kecerdasan Buatan', 3, 'Rabu', 'ANIS MIRZA S.Kom, M.Kom', 'https://drive.google.com/drive/folders/1_KecerdasanBuatan_05TPLP009'],
        ['Sistem Informasi Manajemen', 2, 'Rabu', 'DEANNA DURBIN HUTAGALUNG S.T.,M.Kom.', 'https://drive.google.com/drive/folders/1_SIM_05TPLP009'],
        ['Pengolahan Citra Digital', 2, 'Rabu', 'DEVI DAMAYANTI S.Kom., M.Kom', 'https://drive.google.com/drive/folders/1_PCD_05TPLP009'],
        ['Teknik Riset Operasional', 2, 'Rabu', 'SUTRISNO S.Kom., M.Kom.', 'https://drive.google.com/drive/folders/1_TRO_05TPLP009'],
        ['Pemrograman Web 1', 3, 'Jumat', 'NURHALIMAH S.Kom., M.Kom.', 'https://drive.google.com/drive/folders/1_PemrogramanWeb1_05TPLP009'],
        ['Metode Penelitian', 3, 'Jumat', 'RINNA RACHMATIKA S.Kom., M.Kom', 'https://drive.google.com/drive/folders/1_MetodePenelitian_05TPLP009'],
        ['Digital Entrepreneurship', 2, 'Selasa', 'YULIANA S.Kom., M.Kom.', 'https://drive.google.com/drive/folders/1_DigitalEntrep_05TPLP009'],
        ['Machine Learning', 3, 'Selasa', 'ZURNAN ALFIAN S.Kom., M.Kom.', 'https://drive.google.com/drive/folders/1_MachineLearning_05TPLP009']
      ];
      for (const [nama_matkul, sks, hari, dosen, link_materi] of initialMatkul) {
        await db.execute({
          sql: "INSERT INTO mata_kuliah (nama_matkul, sks, hari, dosen, link_materi) VALUES (?, ?, ?, ?, ?)",
          args: [nama_matkul, sks, hari, dosen, link_materi]
        });
      }
      console.log('✅ Seeding 8 mata kuliah berhasil.');
    }

    // 5. Tabel tautan_cepat
    await db.execute(`
      CREATE TABLE IF NOT EXISTS tautan_cepat (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nama_tautan TEXT,
        url TEXT,
        ikon_svg TEXT,
        status TEXT DEFAULT 'Aktif',
        target_matkul TEXT DEFAULT 'Global'
      )
    `);

    // Tambah kolom target_matkul jika tabel tautan_cepat sudah ada sebelumnya
    try {
      await db.execute("ALTER TABLE tautan_cepat ADD COLUMN target_matkul TEXT DEFAULT 'Global'");
    } catch (err) {
      // Abaikan jika kolom sudah ada
    }

    // Insert data awal ke tabel tautan_cepat HANYA jika tabel kosong
    const countTautanRes = await db.execute("SELECT COUNT(*) as count FROM tautan_cepat");
    const countTautan = Number(countTautanRes.rows[0]?.count || 0);
    if (countTautan === 0) {
      const initialTautan = [
        [
          'Mentari E-Learning UNPAM',
          'https://elearning.unpam.ac.id/',
          `<svg class="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5"/></svg>`,
          'Aktif'
        ],
        [
          'Portal SIAKAD UNPAM',
          'https://siakad.unpam.ac.id/',
          `<svg class="w-4 h-4 text-sky-500 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.333A48.243 48.243 0 0012 9.75c-2.551 0-5.056.2-7.5.583V21"/></svg>`,
          'Aktif'
        ],
        [
          'Google Drive Kelas',
          'https://drive.google.com',
          `<svg class="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"/></svg>`,
          'Aktif'
        ],
        [
          'Perpustakaan Digital UNPAM',
          'https://perpustakaan.unpam.ac.id/',
          `<svg class="w-4 h-4 text-purple-500 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"/></svg>`,
          'Aktif'
        ]
      ];
      for (const [nama_tautan, url, ikon_svg, status] of initialTautan) {
        await db.execute({
          sql: "INSERT INTO tautan_cepat (nama_tautan, url, ikon_svg, status) VALUES (?, ?, ?, ?)",
          args: [nama_tautan, url, ikon_svg, status]
        });
      }
      console.log('✅ Seeding 4 tautan cepat berhasil.');
    }
  } catch (error) {
    console.error('Error saat inisialisasi database:', error);
  }
}

db.initDb = initDb;

module.exports = db;
