const db = require('../config/db');

async function initDb() {
  try {
    // 1. Tabel tugas
    await db.execute(`
      CREATE TABLE IF NOT EXISTS tugas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        matkul TEXT NOT NULL,
        tipe TEXT NOT NULL,
        judul TEXT NOT NULL,
        deskripsi TEXT,
        batas_waktu DATETIME,
        link_drive TEXT,
        status TEXT DEFAULT 'Aktif'
      )
    `);

    // Migrasi kolom status jika tabel tugas sudah ada sebelumnya
    try {
      await db.execute("ALTER TABLE tugas ADD COLUMN status TEXT DEFAULT 'Aktif'");
    } catch (err) {
      // Abaikan jika kolom status sudah ada
    }

    // Pastikan seluruh tugas eksisting yang status-nya null di-update menjadi 'Aktif'
    try {
      await db.execute("UPDATE tugas SET status = 'Aktif' WHERE status IS NULL OR status = ''");
    } catch (err) {
      // Abaikan jika tabel kosong
    }

    // 2. Tabel kas
    await db.execute(`
      CREATE TABLE IF NOT EXISTS kas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tanggal DATE NOT NULL,
        keterangan TEXT NOT NULL,
        jenis TEXT NOT NULL,
        nominal INTEGER NOT NULL
      )
    `);

    // 3. Tabel mentari
    await db.execute(`
      CREATE TABLE IF NOT EXISTS mentari (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        matkul TEXT NOT NULL,
        pertemuan TEXT NOT NULL,
        status TEXT NOT NULL,
        batas_waktu DATETIME,
        link_mentari TEXT
      )
    `);

    // Migrasi kolom link_mentari jika tabel mentari sudah ada sebelumnya
    try {
      await db.execute("ALTER TABLE mentari ADD COLUMN link_mentari TEXT");
    } catch (err) {
      // Abaikan jika kolom link_mentari sudah ada
    }

    // 4. Tabel mata_kuliah (Skema baru: id, nama_matkul, sks, hari, dosen)
    let needRecreateMatkul = false;
    try {
      const tableInfo = await db.execute("PRAGMA table_info(mata_kuliah)");
      const colNames = (tableInfo.rows || []).map(r => r.name);
      if (colNames.length > 0 && (!colNames.includes('hari') || !colNames.includes('dosen'))) {
        needRecreateMatkul = true;
      }
    } catch (e) {
      needRecreateMatkul = false;
    }

    if (needRecreateMatkul) {
      await db.execute("DROP TABLE IF EXISTS mata_kuliah");
    }

    await db.execute(`
      CREATE TABLE IF NOT EXISTS mata_kuliah (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nama_matkul TEXT,
        sks INTEGER,
        hari TEXT,
        dosen TEXT
      )
    `);

    // Inisialisasi daftar mata kuliah default jika belum ada
    try {
      const checkMatkul = await db.execute("SELECT COUNT(*) as count FROM mata_kuliah");
      if (Number(checkMatkul.rows[0]?.count || 0) === 0) {
        const defaultMatkul = [
          ['Kecerdasan Buatan', 3, 'Rabu', 'ANIS MIRZA S.Kom, M.Kom'],
          ['Sistem Informasi Manajemen', 2, 'Rabu', 'DEANNA DURBIN HUTAGALUNG S.T.,M.Kom.'],
          ['Pengolahan Citra Digital', 2, 'Rabu', 'DEVI DAMAYANTI S.Kom., M.Kom'],
          ['Teknik Riset Operasional', 2, 'Rabu', 'SUTRISNO S.Kom., M.Kom.'],
          ['Pemrograman Web 1', 3, 'Jumat', 'NURHALIMAH S.Kom., M.Kom.'],
          ['Metode Penelitian', 3, 'Jumat', 'RINNA RACHMATIKA S.Kom., M.Kom'],
          ['Digital Entrepreneurship', 2, 'Selasa', 'YULIANA S.Kom., M.Kom.'],
          ['Machine Learning', 3, 'Selasa', 'ZURNAN ALFIAN S.Kom., M.Kom.']
        ];
        for (const [nama, sks, hari, dosen] of defaultMatkul) {
          await db.execute({
            sql: "INSERT INTO mata_kuliah (nama_matkul, sks, hari, dosen) VALUES (?, ?, ?, ?)",
            args: [nama, sks, hari, dosen]
          });
        }
      }
    } catch (e) {
      console.error('Error saat seeding mata_kuliah:', e);
    }

    console.log('✅ Inisialisasi tabel database (tugas, kas, mentari, mata_kuliah) berhasil.');
  } catch (error) {
    console.error('❌ Terjadi kesalahan saat inisialisasi tabel database:', error.message || error);
  }
}

module.exports = initDb;

if (require.main === module) {
  initDb();
}
