const express = require('express');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const { marked } = require('marked');
require('dotenv').config();

const db = require('./config/db');
const adminRoutes = require('./routes/admin');

const app = express();

// Markdown Renderer Helper untuk EJS Views
app.locals.marked = (text) => {
  if (!text) return '';
  return marked.parseInline ? marked.parseInline(text) : marked(text);
};

// Inisialisasi Tabel & Seeding Database Turso (SQLite)
if (db.initDb) {
  db.initDb();
}

(async () => {
  try { await db.execute("ALTER TABLE tautan_cepat ADD COLUMN target_matkul TEXT DEFAULT 'Global'"); } catch (e) { /* ignore */ }
})();

// View Engine Setup
app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layout');

// Middleware parsing JSON & form URL-encoded
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets
app.use(express.static(path.join(__dirname, 'public')));

// Global Middleware untuk Fetch Mata Kuliah dan Tautan Cepat untuk EJS Layout
app.use(async (req, res, next) => {
  try {
    const [matkulRes, tautanRes] = await Promise.all([
      db.execute("SELECT * FROM mata_kuliah ORDER BY id ASC"),
      db.execute("SELECT * FROM tautan_cepat WHERE status = 'Aktif' AND (target_matkul = 'Global' OR target_matkul IS NULL) ORDER BY id ASC")
    ]);
    res.locals.mataKuliah = matkulRes.rows || [];
    res.locals.tautanCepat = tautanRes.rows || [];
  } catch (error) {
    console.error('Error saat global fetch layout:', error);
    res.locals.mataKuliah = [];
    res.locals.tautanCepat = [];
  }
  next();
});

// ============================================================================
// PUBLIC ROUTES MAHASISWA (READ-ONLY) TERHUBUNG BASIS DATA TURSO
// ============================================================================

// 1. GET / - Beranda Portal Kelas (Tugas Aktif vs Arsip Selesai & Mentari)
app.get('/', async (req, res) => {
  try {
    const nowIso = new Date().toISOString();

    const [
      countTugasAktifRes,
      countMentariAktifRes,
      countMatkulRes,
      statsKasRes,
      tugasAktifRes,
      tugasArsipRes,
      mentariAktifRes,
      matkulRes,
      tautanRes
    ] = await Promise.all([
      db.execute({
        sql: "SELECT COUNT(*) AS total FROM tugas WHERE status != 'Selesai' AND batas_waktu > ?",
        args: [nowIso]
      }),
      db.execute({
        sql: "SELECT COUNT(*) AS total FROM mentari WHERE status NOT IN ('Tutup', 'Selesai') AND batas_waktu > ?",
        args: [nowIso]
      }),
      db.execute("SELECT COUNT(*) AS total FROM mata_kuliah"),
      db.execute(`
        SELECT 
          COALESCE(SUM(CASE WHEN LOWER(jenis) = 'pemasukan' THEN nominal ELSE -nominal END), 0) AS saldo,
          COALESCE(SUM(CASE WHEN LOWER(jenis) = 'pemasukan' THEN nominal ELSE 0 END), 0) AS pemasukan,
          COALESCE(SUM(CASE WHEN LOWER(jenis) = 'pengeluaran' THEN nominal ELSE 0 END), 0) AS pengeluaran
        FROM kas
      `),
      db.execute({
        sql: "SELECT * FROM tugas WHERE status != 'Selesai' AND batas_waktu > ? ORDER BY batas_waktu ASC",
        args: [nowIso]
      }),
      db.execute({
        sql: "SELECT * FROM tugas WHERE status = 'Selesai' OR batas_waktu <= ? ORDER BY batas_waktu DESC LIMIT 5",
        args: [nowIso]
      }),
      db.execute({
        sql: "SELECT * FROM mentari WHERE status NOT IN ('Tutup', 'Selesai') AND batas_waktu > ? ORDER BY batas_waktu ASC LIMIT 3",
        args: [nowIso]
      }),
      db.execute("SELECT * FROM mata_kuliah ORDER BY id ASC"),
      db.execute("SELECT * FROM tautan_cepat WHERE status = 'Aktif' AND (target_matkul = 'Global' OR target_matkul IS NULL) ORDER BY id ASC")
    ]);

    const tugasAktif = tugasAktifRes.rows || [];
    const tugasArsip = tugasArsipRes.rows || [];
    const mentariAktif = mentariAktifRes.rows || [];
    const totalTugasAktif = Number(countTugasAktifRes.rows[0]?.total || tugasAktif.length);
    const totalMentariAktif = Number(countMentariAktifRes.rows[0]?.total || mentariAktif.length);
    const totalMatkul = Number(countMatkulRes.rows[0]?.total || matkulRes.rows?.length || 0);

    const kasData = statsKasRes.rows[0] || { saldo: 0, pemasukan: 0, pengeluaran: 0 };
    const statsKas = {
      saldo: Number(kasData.saldo || 0),
      pemasukan: Number(kasData.pemasukan || 0),
      pengeluaran: Number(kasData.pengeluaran || 0)
    };
    const statsTugas = {
      total: totalTugasAktif,
      pekanIni: tugasAktif.length > 0 ? 1 : 0
    };
    const mataKuliah = matkulRes.rows || [];
    const tautanCepat = tautanRes.rows || [];

    res.render('pages/beranda', {
      title: 'Beranda - techiesnine | 05TPLP009',
      currentPage: 'beranda',
      isAdmin: false,
      totalTugasAktif,
      totalMentariAktif,
      totalMatkul,
      statsKas,
      statsTugas,
      tugasAktif,
      tugasArsip,
      tugasSelesai: tugasArsip,
      tugas: tugasAktif,
      tugasTerdekat: tugasAktif.slice(0, 2),
      mentariAktif,
      mentariTerdekat: mentariAktif,
      mentari: mentariAktif,
      mataKuliah,
      tautanCepat
    });
  } catch (error) {
    console.error('Error saat load data beranda:', error);
    res.render('pages/beranda', {
      title: 'Beranda - techiesnine | 05TPLP009',
      currentPage: 'beranda',
      isAdmin: false,
      totalTugasAktif: 0,
      totalMentariAktif: 0,
      totalMatkul: 0,
      statsKas: { saldo: 0, pemasukan: 0, pengeluaran: 0 },
      statsTugas: { total: 0, pekanIni: 0 },
      tugasAktif: [],
      tugasArsip: [],
      tugasSelesai: [],
      tugas: [],
      tugasTerdekat: [],
      mentariAktif: [],
      mentariTerdekat: [],
      mentari: [],
      mataKuliah: [],
      tautanCepat: []
    });
  }
});

// 2. GET /tugas - Daftar Tugas Kuliah (Mendukung Auto-Archive, Filter Matkul, Filter Tipe & Sorting)
app.get('/tugas', async (req, res) => {
  try {
    const nowIso = new Date().toISOString();
    const filterMatkul = req.query.matkul && req.query.matkul.trim() !== '' ? req.query.matkul.trim() : null;
    const filterTipe = req.query.tipe && req.query.tipe.trim() !== '' ? req.query.tipe.trim() : 'Semua';
    const rawSort = (req.query.urutkan || req.query.sort || '').trim();
    const sort = (rawSort === 'terjauh' || rawSort === 'terlama') ? 'terjauh' : 'terdekat';

    const sortOrder = sort === 'terjauh' ? 'DESC' : 'ASC';

    let sqlAktif = "SELECT * FROM tugas WHERE status != 'Selesai' AND batas_waktu > ?";
    let argsAktif = [nowIso];

    let sqlArsip = "SELECT * FROM tugas WHERE (status = 'Selesai' OR batas_waktu <= ?)";
    let argsArsip = [nowIso];

    if (filterMatkul && filterMatkul !== 'Semua') {
      sqlAktif += " AND matkul = ?";
      argsAktif.push(filterMatkul);
      sqlArsip += " AND matkul = ?";
      argsArsip.push(filterMatkul);
    }

    if (filterTipe && filterTipe !== 'Semua') {
      sqlAktif += " AND tipe = ?";
      argsAktif.push(filterTipe);
      sqlArsip += " AND tipe = ?";
      argsArsip.push(filterTipe);
    }

    sqlAktif += ` ORDER BY batas_waktu ${sortOrder}`;
    sqlArsip += ` ORDER BY batas_waktu DESC`;

    const [tugasAktifRes, tugasArsipRes, matkulRes, tautanRes] = await Promise.all([
      db.execute({ sql: sqlAktif, args: argsAktif }),
      db.execute({ sql: sqlArsip, args: argsArsip }),
      db.execute("SELECT * FROM mata_kuliah ORDER BY id ASC"),
      db.execute("SELECT * FROM tautan_cepat WHERE status = 'Aktif' AND (target_matkul = 'Global' OR target_matkul IS NULL) ORDER BY id ASC")
    ]);

    const tugasAktif = tugasAktifRes.rows || [];
    const tugasArsip = tugasArsipRes.rows || [];
    const mataKuliah = matkulRes.rows || [];
    const tautanCepat = tautanRes.rows || [];

    const selectedMatkul = mataKuliah.find(m => m.nama_matkul === filterMatkul);

    let tautanMatkulKhusus = [];
    if (filterMatkul && filterMatkul !== 'Semua') {
      const tautanKhususRes = await db.execute({
        sql: "SELECT * FROM tautan_cepat WHERE status = 'Aktif' AND target_matkul = ?",
        args: [filterMatkul]
      });
      tautanMatkulKhusus = tautanKhususRes.rows || [];
    }

    res.render('pages/tugas', {
      title: filterMatkul ? `Tugas: ${filterMatkul} - techiesnine` : 'Daftar Tugas & E-Learning - techiesnine | 05TPLP009',
      currentPage: 'tugas',
      isAdmin: false,
      filterMatkul,
      filterTipe,
      sort,
      sortOrder: sort,
      urutkan: sort === 'terjauh' ? 'terlama' : 'terdekat',
      selectedMatkul,
      tautanMatkulKhusus,
      tugasAktif,
      tugasArsip,
      tugas: [...tugasAktif, ...tugasArsip],
      mataKuliah,
      tautanCepat
    });
  } catch (error) {
    console.error('Error saat load data tugas:', error);
    res.render('pages/tugas', {
      title: 'Daftar Tugas & E-Learning - techiesnine | 05TPLP009',
      currentPage: 'tugas',
      isAdmin: false,
      filterMatkul: null,
      filterTipe: 'Semua',
      sort: 'terdekat',
      sortOrder: 'terdekat',
      selectedMatkul: null,
      tautanMatkulKhusus: [],
      tugasAktif: [],
      tugasArsip: [],
      tugas: [],
      mataKuliah: [],
      tautanCepat: []
    });
  }
});

// GET /tugas/:id - Detail Informasi Penugasan (Render Markdown Deskripsi via Marked)
app.get('/tugas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.execute({
      sql: 'SELECT * FROM tugas WHERE id = ?',
      args: [id]
    });

    if (!result.rows || result.rows.length === 0) {
      return res.redirect('/tugas');
    }

    const { marked } = await import('marked');
    const tugas = result.rows[0];
    tugas.deskripsi_html = tugas.deskripsi ? marked.parse(tugas.deskripsi) : '';

    res.render('pages/tugas-detail', {
      title: `${tugas.judul} - Detail Tugas techiesnine | 05TPLP009`,
      currentPage: 'tugas',
      isAdmin: false,
      tugas
    });
  } catch (error) {
    console.error('Error saat load detail tugas:', error);
    res.redirect('/tugas');
  }
});

// 3. GET /kas - Transparansi Uang Kas Kelas
app.get('/kas', async (req, res) => {
  try {
    const [kasRes, statsKasRes, matkulRes, tautanRes] = await Promise.all([
      db.execute("SELECT * FROM kas ORDER BY tanggal DESC, id DESC"),
      db.execute(`
        SELECT 
          COALESCE(SUM(CASE WHEN LOWER(jenis) = 'pemasukan' THEN nominal ELSE -nominal END), 0) AS saldo,
          COALESCE(SUM(CASE WHEN LOWER(jenis) = 'pemasukan' THEN nominal ELSE 0 END), 0) AS pemasukan,
          COALESCE(SUM(CASE WHEN LOWER(jenis) = 'pengeluaran' THEN nominal ELSE 0 END), 0) AS pengeluaran,
          COUNT(*) as totalTransaksi
        FROM kas
      `),
      db.execute("SELECT * FROM mata_kuliah ORDER BY id ASC"),
      db.execute("SELECT * FROM tautan_cepat WHERE status = 'Aktif' AND (target_matkul = 'Global' OR target_matkul IS NULL) ORDER BY id ASC")
    ]);

    const kas = kasRes.rows || [];
    const rawStats = statsKasRes.rows[0] || { saldo: 0, pemasukan: 0, pengeluaran: 0, totalTransaksi: 0 };
    const statsKas = {
      saldo: Number(rawStats.saldo || 0),
      pemasukan: Number(rawStats.pemasukan || 0),
      pengeluaran: Number(rawStats.pengeluaran || 0),
      totalTransaksi: Number(rawStats.totalTransaksi || 0)
    };
    const mataKuliah = matkulRes.rows || [];
    const tautanCepat = tautanRes.rows || [];

    res.render('pages/kas', {
      title: 'Transparansi Kas - techiesnine | 05TPLP009',
      currentPage: 'kas',
      isAdmin: false,
      kas,
      statsKas,
      mataKuliah,
      tautanCepat
    });
  } catch (error) {
    console.error('Error saat load data kas:', error);
    res.render('pages/kas', {
      title: 'Transparansi Kas - techiesnine | 05TPLP009',
      currentPage: 'kas',
      isAdmin: false,
      kas: [],
      statsKas: { saldo: 0, pemasukan: 0, pengeluaran: 0, totalTransaksi: 0 },
      mataKuliah: [],
      tautanCepat: []
    });
  }
});

// GET /kas/pemasukan - Detail Pemasukan Kas Publik
app.get('/kas/pemasukan', async (req, res) => {
  try {
    const result = await db.execute("SELECT * FROM kas WHERE LOWER(jenis) = 'pemasukan' ORDER BY tanggal DESC");
    res.render('pages/kas-pemasukan', {
      title: 'Detail Pemasukan Kas - techiesnine',
      currentPage: 'kas',
      pemasukan: result.rows || []
    });
  } catch (error) {
    console.error('Error load detail pemasukan:', error);
    res.redirect('/kas');
  }
});

// GET /kas/pengeluaran - Detail Pengeluaran Kas Publik
app.get('/kas/pengeluaran', async (req, res) => {
  try {
    const result = await db.execute("SELECT * FROM kas WHERE LOWER(jenis) = 'pengeluaran' ORDER BY tanggal DESC");
    res.render('pages/kas-pengeluaran', {
      title: 'Detail Pengeluaran Kas - techiesnine',
      currentPage: 'kas',
      pengeluaran: result.rows || []
    });
  } catch (error) {
    console.error('Error load detail pengeluaran:', error);
    res.redirect('/kas');
  }
});

// 4. GET /mentari - Jadwal Mentari E-Learning UNPAM (Mendukung Auto-Archive)
app.get('/mentari', async (req, res) => {
  try {
    const nowIso = new Date().toISOString();

    const [mentariAktifRes, mentariArsipRes, matkulRes, tautanRes] = await Promise.all([
      db.execute({
        sql: "SELECT * FROM mentari WHERE status NOT IN ('Tutup', 'Selesai') AND batas_waktu > ? ORDER BY batas_waktu ASC",
        args: [nowIso]
      }),
      db.execute({
        sql: "SELECT * FROM mentari WHERE status IN ('Tutup', 'Selesai') OR batas_waktu <= ? ORDER BY batas_waktu DESC",
        args: [nowIso]
      }),
      db.execute("SELECT * FROM mata_kuliah ORDER BY id ASC"),
      db.execute("SELECT * FROM tautan_cepat WHERE status = 'Aktif' AND (target_matkul = 'Global' OR target_matkul IS NULL) ORDER BY id ASC")
    ]);

    const mentariAktif = mentariAktifRes.rows || [];
    const mentariArsip = mentariArsipRes.rows || [];
    const mataKuliah = matkulRes.rows || [];
    const tautanCepat = tautanRes.rows || [];

    res.render('pages/mentari', {
      title: 'Jadwal Mentari E-Learning - techiesnine | 05TPLP009',
      currentPage: 'mentari',
      isAdmin: false,
      mentariAktif,
      mentariArsip,
      mentari: [...mentariAktif, ...mentariArsip],
      mataKuliah,
      tautanCepat
    });
  } catch (error) {
    console.error('Error saat load data mentari:', error);
    res.render('pages/mentari', {
      title: 'Jadwal Mentari E-Learning - techiesnine | 05TPLP009',
      currentPage: 'mentari',
      isAdmin: false,
      mentariAktif: [],
      mentariArsip: [],
      mentari: [],
      mataKuliah: [],
      tautanCepat: []
    });
  }
});

// Admin Route (Protected by Basic Auth)
app.use('/admin', adminRoutes);

// Port configuration
const PORT = process.env.PORT || 3000;

// Listen if executed directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
  });
}

module.exports = app;
