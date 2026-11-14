const express = require('express');
const router = express.Router();
const basicAuth = require('express-basic-auth');
const { parse } = require('csv-parse/sync');
const db = require('../config/db');
require('dotenv').config();

// Middleware Basic Auth
const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

router.use(
  basicAuth({
    users: { admin: adminPassword },
    challenge: true,
    realm: 'Portal Admin 05TPLP009',
    unauthorizedResponse: () => 'Akses ditolak: Autentikasi diperlukan untuk membuka Panel Admin.',
  })
);

const ALLOWED_TYPES = ['tugas', 'kas', 'mentari', 'matkul', 'tautan'];
const TABLE_MAP = {
  tugas: 'tugas',
  kas: 'kas',
  mentari: 'mentari',
  matkul: 'mata_kuliah',
  tautan: 'tautan_cepat',
};

// ============================================================================
// 1. GET /admin - Ringkasan & Statistik Kelas (Bento Grid Dashboard)
// ============================================================================
router.get('/', async (req, res) => {
  try {
    const [tugasCountRes, kasSaldoRes, mentariCountRes, matkulCountRes, tautanCountRes] = await Promise.all([
      db.execute('SELECT COUNT(*) AS total FROM tugas'),
      db.execute("SELECT COALESCE(SUM(CASE WHEN LOWER(jenis) = 'pemasukan' THEN nominal ELSE -nominal END), 0) AS saldo FROM kas"),
      db.execute("SELECT COUNT(*) AS total FROM mentari WHERE LOWER(status) = 'buka'"),
      db.execute('SELECT COUNT(*) AS total FROM mata_kuliah'),
      db.execute("SELECT COUNT(*) AS total FROM tautan_cepat WHERE status = 'Aktif'"),
    ]);

    const stats = {
      totalTugas: Number(tugasCountRes.rows[0]?.total || 0),
      saldoKas: Number(kasSaldoRes.rows[0]?.saldo || 0),
      totalMentari: Number(mentariCountRes.rows[0]?.total || 0),
      totalMatkul: Number(matkulCountRes.rows[0]?.total || 0),
      totalTautan: Number(tautanCountRes.rows[0]?.total || 0),
    };

    res.render('pages/admin', {
      title: 'Ringkasan & Statistik - Admin 05TPLP009',
      currentPage: 'admin',
      status: req.query.status || null,
      stats,
      isAdmin: true,
    });
  } catch (error) {
    console.error('Error saat mengambil data ringkasan statistik admin:', error);
    res.render('pages/admin', {
      title: 'Ringkasan & Statistik - Admin 05TPLP009',
      currentPage: 'admin',
      status: req.query.status || null,
      stats: {
        totalTugas: 0,
        saldoKas: 0,
        totalMentari: 0,
        totalMatkul: 0,
        totalTautan: 0,
      },
      isAdmin: true,
    });
  }
});

// ============================================================================
// 2. GET LIST ROUTES - HALAMAN MANAJEMEN DATA TERPISAH (CRUD LISTS)
// ============================================================================

// GET /admin/tugas-list - Kelola Daftar Tugas Kuliah
router.get('/tugas-list', async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM tugas ORDER BY id DESC');
    res.render('pages/admin-list-tugas', {
      title: 'Kelola Tugas Kuliah - Admin 05TPLP009',
      currentPage: 'admin-tugas',
      status: req.query.status || null,
      tugas: result.rows || [],
      isAdmin: true,
    });
  } catch (error) {
    console.error('Error saat load daftar tugas:', error);
    res.render('pages/admin-list-tugas', {
      title: 'Kelola Tugas Kuliah - Admin 05TPLP009',
      currentPage: 'admin-tugas',
      status: 'gagal',
      tugas: [],
      isAdmin: true,
    });
  }
});

// GET /admin/kas-list - Kelola Buku Mutasi Kas
router.get('/kas-list', async (req, res) => {
  try {
    await db.execute("UPDATE kas SET jenis = 'Pemasukan' WHERE keterangan LIKE '%Iuran%' OR LOWER(TRIM(jenis)) = 'pemasukan'");
    const [result, saldoRes] = await Promise.all([
      db.execute('SELECT * FROM kas ORDER BY tanggal DESC, id DESC'),
      db.execute("SELECT COALESCE(SUM(CASE WHEN LOWER(jenis) = 'pemasukan' THEN nominal ELSE -nominal END), 0) AS saldo FROM kas"),
    ]);
    res.render('pages/admin-list-kas', {
      title: 'Kelola Mutasi Kas - Admin 05TPLP009',
      currentPage: 'admin-kas',
      status: req.query.status || null,
      kas: result.rows || [],
      saldoKas: Number(saldoRes.rows[0]?.saldo || 0),
      isAdmin: true,
    });
  } catch (error) {
    console.error('Error saat load buku mutasi kas:', error);
    res.render('pages/admin-list-kas', {
      title: 'Kelola Mutasi Kas - Admin 05TPLP009',
      currentPage: 'admin-kas',
      status: 'gagal',
      kas: [],
      saldoKas: 0,
      isAdmin: true,
    });
  }
});

// GET /admin/mentari-list - Kelola Sesi Mentari E-Learning
router.get('/mentari-list', async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM mentari ORDER BY id DESC');
    res.render('pages/admin-list-mentari', {
      title: 'Kelola Mentari E-Learning - Admin 05TPLP009',
      currentPage: 'admin-mentari',
      status: req.query.status || null,
      mentari: result.rows || [],
      isAdmin: true,
    });
  } catch (error) {
    console.error('Error saat load daftar mentari:', error);
    res.render('pages/admin-list-mentari', {
      title: 'Kelola Mentari E-Learning - Admin 05TPLP009',
      currentPage: 'admin-mentari',
      status: 'gagal',
      mentari: [],
      isAdmin: true,
    });
  }
});

// GET /admin/matkul-list - Kelola Daftar Mata Kuliah
router.get('/matkul-list', async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM mata_kuliah ORDER BY id ASC');
    res.render('pages/admin-list-matkul', {
      title: 'Kelola Mata Kuliah - Admin 05TPLP009',
      currentPage: 'admin-matkul',
      status: req.query.status || null,
      matkul: result.rows || [],
      isAdmin: true,
    });
  } catch (error) {
    console.error('Error saat load daftar mata kuliah:', error);
    res.render('pages/admin-list-matkul', {
      title: 'Kelola Mata Kuliah - Admin 05TPLP009',
      currentPage: 'admin-matkul',
      status: 'gagal',
      matkul: [],
      isAdmin: true,
    });
  }
});

// GET /admin/tautan-list - Kelola Daftar Tautan Cepat
router.get('/tautan-list', async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM tautan_cepat ORDER BY id DESC');
    res.render('pages/admin-list-tautan', {
      title: 'Kelola Tautan Cepat - Admin 05TPLP009',
      currentPage: 'admin-tautan',
      status: req.query.status || null,
      tautan: result.rows || [],
      tautanCepat: result.rows || [],
      isAdmin: true,
    });
  } catch (error) {
    console.error('Error saat load daftar tautan cepat:', error);
    res.render('pages/admin-list-tautan', {
      title: 'Kelola Tautan Cepat - Admin 05TPLP009',
      currentPage: 'admin-tautan',
      status: 'gagal',
      tautan: [],
      tautanCepat: [],
      isAdmin: true,
    });
  }
});

// ============================================================================
// 2. GET ROUTES - HALAMAN FORM TAMBAH TERPISAH (SINGLE PAGE PER TASK)
// ============================================================================

// GET /admin/tugas/add - Halaman Tambah Tugas Kuliah
router.get('/tugas/add', async (req, res) => {
  try {
    const matkulRes = await db.execute('SELECT * FROM mata_kuliah ORDER BY nama_matkul ASC');
    const matkul = matkulRes.rows || [];

    res.render('pages/admin-add-tugas', {
      title: 'Tambah Tugas Kuliah - Admin 05TPLP009',
      currentPage: 'admin',
      matkul,
      mataKuliah: matkul,
      isAdmin: true,
    });
  } catch (error) {
    console.error('Error saat load form tambah tugas:', error);
    res.render('pages/admin-add-tugas', {
      title: 'Tambah Tugas Kuliah - Admin 05TPLP009',
      currentPage: 'admin',
      matkul: [],
      mataKuliah: [],
      isAdmin: true,
    });
  }
});

// GET /admin/mentari/add - Halaman Tambah Sesi Mentari E-Learning
router.get('/mentari/add', async (req, res) => {
  try {
    const matkulRes = await db.execute('SELECT * FROM mata_kuliah ORDER BY nama_matkul ASC');
    const matkul = matkulRes.rows || [];

    res.render('pages/admin-add-mentari', {
      title: 'Tambah Sesi Mentari - Admin 05TPLP009',
      currentPage: 'admin',
      matkul,
      mataKuliah: matkul,
      isAdmin: true,
    });
  } catch (error) {
    console.error('Error saat load form tambah mentari:', error);
    res.render('pages/admin-add-mentari', {
      title: 'Tambah Sesi Mentari - Admin 05TPLP009',
      currentPage: 'admin',
      matkul: [],
      mataKuliah: [],
      isAdmin: true,
    });
  }
});

// GET /admin/kas/add - Halaman Catat Transaksi Kas
router.get('/kas/add', (req, res) => {
  res.render('pages/admin-add-kas', {
    title: 'Catat Transaksi Kas - Admin 05TPLP009',
    currentPage: 'admin',
    isAdmin: true,
  });
});

// GET /admin/matkul/add - Halaman Tambah Mata Kuliah
router.get('/matkul/add', (req, res) => {
  res.render('pages/admin-add-matkul', {
    title: 'Tambah Mata Kuliah - Admin 05TPLP009',
    currentPage: 'admin',
    isAdmin: true,
  });
});

// GET /admin/tautan/add - Halaman Tambah Tautan Cepat
router.get('/tautan/add', (req, res) => {
  res.render('pages/admin-add-tautan', {
    title: 'Tambah Tautan Cepat - Admin 05TPLP009',
    currentPage: 'admin',
    isAdmin: true,
  });
});

// ============================================================================
// 3. CREATE ROUTES (POST /admin/tugas, POST /admin/kas, POST /admin/mentari, POST /admin/matkul)
// ============================================================================

// POST /admin/tugas - Tambah Tugas Baru
router.post('/tugas', async (req, res) => {
  try {
    const { matkul, tipe, judul, deskripsi, batas_waktu, link_drive, status } = req.body;

    await db.execute({
      sql: `INSERT INTO tugas (matkul, tipe, judul, deskripsi, batas_waktu, link_drive, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        matkul || '',
        tipe || 'Individu',
        judul || '',
        deskripsi || '',
        batas_waktu || null,
        link_drive || '',
        status || 'Aktif',
      ],
    });

    res.redirect('/admin/tugas-list?status=tugas_sukses');
  } catch (error) {
    console.error('Error saat insert tugas:', error);
    res.redirect('/admin/tugas-list?status=gagal');
  }
});

// POST /admin/kas - Catat Transaksi Kas
router.post('/kas', async (req, res) => {
  try {
    const { tanggal, keterangan, jenis, nominal } = req.body;
    let finalJenis = (jenis && jenis.trim().toLowerCase() === 'pemasukan') || /iuran/i.test(keterangan || '')
      ? 'Pemasukan'
      : 'Pengeluaran';

    await db.execute({
      sql: `INSERT INTO kas (tanggal, keterangan, jenis, nominal) VALUES (?, ?, ?, ?)`,
      args: [
        tanggal || new Date().toISOString().split('T')[0],
        keterangan || '',
        finalJenis.trim(),
        parseInt(nominal, 10) || 0,
      ],
    });

    res.redirect('/admin/kas-list?status=kas_sukses');
  } catch (error) {
    console.error('Error saat insert kas:', error);
    res.redirect('/admin/kas-list?status=gagal');
  }
});

// POST /admin/kas/sync - Sinkronisasi Data Kas dari Google Spreadsheet (Multi-Sync Pemasukan & Pengeluaran)
router.post('/kas/sync', async (req, res) => {
  try {
    // 1. Kosongkan tabel sebelum sync
    await db.execute('DELETE FROM kas');

    const today = new Date().toISOString().slice(0, 10);

    // 2. Fetch & Insert URL 1: PEMASUKAN (Iuran Kelas)
    const resMasuk = await fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vTy_CmWHQMX_WFXBw75P3hJ7YLZaK1_rDI6_rJAs5pIpPFtDoKV8ywa2o0r7B4Bjg/pub?gid=13792944&single=true&output=csv');
    const csvMasuk = await resMasuk.text();
    const linesMasuk = csvMasuk.split('\n');
    let idxMasuk = 0;
    for (let i = 0; i < Math.min(10, linesMasuk.length); i++) {
      const line = linesMasuk[i].toLowerCase();
      if (line.includes('nama lengkap') || line.includes('nim') || (line.includes('keterangan') && line.includes('nominal'))) {
        idxMasuk = i;
        break;
      }
    }
    const cleanCsvMasuk = linesMasuk.slice(idxMasuk).join('\n');
    const recordsMasuk = parse(cleanCsvMasuk, { columns: true, skip_empty_lines: true, relax_column_count: true });

    for (const row of recordsMasuk) {
      // Ambil nominal asli, bersihkan titik/Rp
      let nominal = 0;
      const rawNominal = row.Nominal || row['Total Dibayar (Rp)'] || row.nominal || '';
      if (rawNominal) {
        nominal = parseInt(String(rawNominal).replace(/\D/g, ''), 10) || 0;
      }

      const nama = row['Nama Lengkap'] ? row['Nama Lengkap'].trim() : (row.Keterangan || '');
      if (!nama || nama.toLowerCase().includes('total') || isNaN(parseInt(row.No, 10))) {
        continue;
      }

      const tanggal = row.Tanggal || today;
      const keterangan = row.Keterangan || ('Iuran Kas - ' + nama);

      let jenis = 'Pemasukan';
      if (/iuran/i.test(keterangan)) {
        jenis = 'Pemasukan';
      }

      if (nominal > 0) {
        await db.execute({
          sql: 'INSERT INTO kas (tanggal, keterangan, jenis, nominal) VALUES (?, ?, ?, ?)',
          args: [tanggal, keterangan, jenis.trim(), nominal]
        });
      }
    }

    // 3. Fetch & Insert URL 2: PENGELUARAN
    const resKeluar = await fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vTy_CmWHQMX_WFXBw75P3hJ7YLZaK1_rDI6_rJAs5pIpPFtDoKV8ywa2o0r7B4Bjg/pub?gid=1556861564&single=true&output=csv');
    const csvKeluar = await resKeluar.text();
    const linesKeluar = csvKeluar.split('\n');
    let idxKeluar = 0;
    for (let i = 0; i < Math.min(10, linesKeluar.length); i++) {
      const line = linesKeluar[i].toLowerCase();
      if (line.includes('tanggal') && line.includes('keterangan')) {
        idxKeluar = i;
        break;
      }
    }
    const cleanCsvKeluar = linesKeluar.slice(idxKeluar).join('\n');
    const recordsKeluar = parse(cleanCsvKeluar, { columns: true, skip_empty_lines: true, relax_column_count: true });

    for (const row of recordsKeluar) {
      let nominal = 0;
      const rawNominal = row.Nominal || row['Nominal (Rp)'] || row.nominal || '';
      if (rawNominal) {
        nominal = parseInt(String(rawNominal).replace(/\D/g, ''), 10) || 0;
      }

      let tanggal = row.Tanggal || today;
      if (tanggal && tanggal.includes('/')) {
        const parts = tanggal.split('/');
        if (parts.length === 3) {
          tanggal = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }

      const keterangan = row.Keterangan || row.keterangan || '';
      let jenis = 'Pengeluaran';
      if (/iuran/i.test(keterangan)) {
        jenis = 'Pemasukan';
      }

      if (nominal > 0 && keterangan && !keterangan.toLowerCase().includes('total')) {
        await db.execute({
          sql: 'INSERT INTO kas (tanggal, keterangan, jenis, nominal) VALUES (?, ?, ?, ?)',
          args: [tanggal, keterangan, jenis.trim(), nominal]
        });
      }
    }

    // 4. Pengaman ekstra otomatisasi jenis
    await db.execute("UPDATE kas SET jenis = 'Pemasukan' WHERE keterangan LIKE '%Iuran%' OR LOWER(TRIM(jenis)) = 'pemasukan'");

    // 5. Redirect dengan status sukses
    res.redirect('/admin/kas-list?status=sync_success');

  } catch (error) {
    console.error("Error saat sinkronisasi kas:", error);
    res.redirect('/admin/kas-list?status=sync_error');
  }
});

// POST /admin/mentari - Tambah Sesi E-Learning Mentari
router.post('/mentari', async (req, res) => {
  try {
    const { matkul, pertemuan, status, batas_waktu, link_mentari } = req.body;

    await db.execute({
      sql: `INSERT INTO mentari (matkul, pertemuan, status, batas_waktu, link_mentari) VALUES (?, ?, ?, ?, ?)`,
      args: [
        matkul || '',
        pertemuan || '',
        status || 'Buka',
        batas_waktu || null,
        link_mentari || '',
      ],
    });

    res.redirect('/admin/mentari-list?status=mentari_sukses');
  } catch (error) {
    console.error('Error saat insert mentari:', error);
    res.redirect('/admin/mentari-list?status=gagal');
  }
});

// Alias POST /admin/mentari/add
router.post('/mentari/add', async (req, res) => {
  try {
    const { matkul, pertemuan, status, batas_waktu, link_mentari } = req.body;

    await db.execute({
      sql: `INSERT INTO mentari (matkul, pertemuan, status, batas_waktu, link_mentari) VALUES (?, ?, ?, ?, ?)`,
      args: [
        matkul || '',
        pertemuan || '',
        status || 'Buka',
        batas_waktu || null,
        link_mentari || '',
      ],
    });

    res.redirect('/admin/mentari-list?status=mentari_sukses');
  } catch (error) {
    console.error('Error saat insert mentari:', error);
    res.redirect('/admin/mentari-list?status=gagal');
  }
});

// POST /admin/matkul - Tambah Mata Kuliah Baru
router.post('/matkul', async (req, res) => {
  try {
    const { nama_matkul, sks, hari, dosen, link_materi } = req.body;

    await db.execute({
      sql: `INSERT INTO mata_kuliah (nama_matkul, sks, hari, dosen, link_materi) VALUES (?, ?, ?, ?, ?)`,
      args: [
        nama_matkul || '',
        parseInt(sks, 10) || 0,
        hari || '',
        dosen || '',
        link_materi || '',
      ],
    });

    res.redirect('/admin/matkul-list?status=matkul_sukses');
  } catch (error) {
    console.error('Error saat insert matkul:', error);
    res.redirect('/admin/matkul-list?status=gagal');
  }
});

// Alias POST /admin/matkul/add
router.post('/matkul/add', async (req, res) => {
  try {
    const { nama_matkul, sks, hari, dosen, link_materi } = req.body;

    await db.execute({
      sql: `INSERT INTO mata_kuliah (nama_matkul, sks, hari, dosen, link_materi) VALUES (?, ?, ?, ?, ?)`,
      args: [
        nama_matkul || '',
        parseInt(sks, 10) || 0,
        hari || '',
        dosen || '',
        link_materi || '',
      ],
    });

    res.redirect('/admin/matkul-list?status=matkul_sukses');
  } catch (error) {
    console.error('Error saat insert matkul:', error);
    res.redirect('/admin/matkul-list?status=gagal');
  }
});

// POST /admin/tautan - Tambah Tautan Cepat Baru
router.post('/tautan', async (req, res) => {
  try {
    const { nama_tautan, url, ikon_svg, status } = req.body;

    await db.execute({
      sql: `INSERT INTO tautan_cepat (nama_tautan, url, ikon_svg, status) VALUES (?, ?, ?, ?)`,
      args: [
        nama_tautan || '',
        url || '',
        ikon_svg || '',
        status || 'Aktif',
      ],
    });

    res.redirect('/admin/tautan-list?status=tautan_sukses');
  } catch (error) {
    console.error('Error saat insert tautan:', error);
    res.redirect('/admin/tautan-list?status=gagal');
  }
});

// Alias POST /admin/tautan/add
router.post('/tautan/add', async (req, res) => {
  try {
    const { nama_tautan, url, ikon_svg, status } = req.body;

    await db.execute({
      sql: `INSERT INTO tautan_cepat (nama_tautan, url, ikon_svg, status) VALUES (?, ?, ?, ?)`,
      args: [
        nama_tautan || '',
        url || '',
        ikon_svg || '',
        status || 'Aktif',
      ],
    });

    res.redirect('/admin/tautan-list?status=tautan_sukses');
  } catch (error) {
    console.error('Error saat insert tautan:', error);
    res.redirect('/admin/tautan-list?status=gagal');
  }
});

// ============================================================================
// 4. GET /admin/:type/edit/:id - Render Halaman Edit Form (Update Read)
// ============================================================================
router.get('/:type/edit/:id', async (req, res) => {
  try {
    const { type, id } = req.params;

    if (!ALLOWED_TYPES.includes(type)) {
      return res.redirect('/admin?status=invalid_type');
    }

    const tableName = TABLE_MAP[type] || type;
    const [result, matkulRes] = await Promise.all([
      db.execute({
        sql: `SELECT * FROM ${tableName} WHERE id = ?`,
        args: [id],
      }),
      db.execute('SELECT * FROM mata_kuliah ORDER BY nama_matkul ASC')
    ]);

    if (!result.rows || result.rows.length === 0) {
      return res.redirect('/admin?status=not_found');
    }

    const typeTitleMap = {
      tugas: 'Tugas Kuliah',
      kas: 'Transaksi Kas',
      mentari: 'Jadwal Mentari',
      matkul: 'Mata Kuliah',
      tautan: 'Tautan Cepat',
    };

    res.render('pages/admin-edit', {
      title: `Edit ${typeTitleMap[type] || type} - 05TPLP009`,
      currentPage: 'admin',
      type,
      data: result.rows[0],
      matkul: matkulRes.rows || [],
      mataKuliah: matkulRes.rows || [],
      isAdmin: true,
    });
  } catch (error) {
    console.error('Error saat mengambil data edit:', error);
    res.redirect('/admin?status=gagal');
  }
});

// ============================================================================
// 5. POST /admin/:type/edit/:id - Proses Update Data (Update Execute)
// ============================================================================
router.post('/:type/edit/:id', async (req, res) => {
  try {
    const { type, id } = req.params;

    if (!ALLOWED_TYPES.includes(type)) {
      return res.redirect('/admin?status=invalid_type');
    }

    if (type === 'tugas') {
      const { matkul, tipe, judul, deskripsi, batas_waktu, link_drive, status } = req.body;
      await db.execute({
        sql: `UPDATE tugas SET matkul = ?, tipe = ?, judul = ?, deskripsi = ?, batas_waktu = ?, link_drive = ?, status = ? WHERE id = ?`,
        args: [
          matkul || '',
          tipe || 'Individu',
          judul || '',
          deskripsi || '',
          batas_waktu || null,
          link_drive || '',
          status || 'Aktif',
          id,
        ],
      });
    } else if (type === 'kas') {
      const { tanggal, keterangan, jenis, nominal } = req.body;
      let finalJenis = (jenis && jenis.trim().toLowerCase() === 'pemasukan') || /iuran/i.test(keterangan || '')
        ? 'Pemasukan'
        : 'Pengeluaran';

      await db.execute({
        sql: `UPDATE kas SET tanggal = ?, keterangan = ?, jenis = ?, nominal = ? WHERE id = ?`,
        args: [
          tanggal || new Date().toISOString().split('T')[0],
          keterangan || '',
          finalJenis.trim(),
          parseInt(nominal, 10) || 0,
          id,
        ],
      });
    } else if (type === 'mentari') {
      const { matkul, pertemuan, status, batas_waktu, link_mentari } = req.body;
      await db.execute({
        sql: `UPDATE mentari SET matkul = ?, pertemuan = ?, status = ?, batas_waktu = ?, link_mentari = ? WHERE id = ?`,
        args: [
          matkul || '',
          pertemuan || '',
          status || 'Buka',
          batas_waktu || null,
          link_mentari || '',
          id,
        ],
      });
    } else if (type === 'matkul') {
      const { nama_matkul, sks, hari, dosen, link_materi } = req.body;
      await db.execute({
        sql: `UPDATE mata_kuliah SET nama_matkul = ?, sks = ?, hari = ?, dosen = ?, link_materi = ? WHERE id = ?`,
        args: [
          nama_matkul || '',
          parseInt(sks, 10) || 0,
          hari || '',
          dosen || '',
          link_materi || '',
          id,
        ],
      });
    } else if (type === 'tautan') {
      const { nama_tautan, url, ikon_svg, status } = req.body;
      await db.execute({
        sql: `UPDATE tautan_cepat SET nama_tautan = ?, url = ?, ikon_svg = ?, status = ? WHERE id = ?`,
        args: [
          nama_tautan || '',
          url || '',
          ikon_svg || '',
          status || 'Aktif',
          id,
        ],
      });
    }

    res.redirect(`/admin/${type}-list?status=${type}_edit_sukses`);
  } catch (error) {
    console.error('Error saat update data:', error);
    res.redirect(`/admin/${req.params.type || 'tugas'}-list?status=gagal`);
  }
});

// ============================================================================
// 6. POST /admin/:type/delete/:id - Hapus Data (Delete Execute)
// ============================================================================
router.post('/:type/delete/:id', async (req, res) => {
  try {
    const { type, id } = req.params;

    if (!ALLOWED_TYPES.includes(type)) {
      return res.redirect('/admin?status=invalid_type');
    }

    const tableName = TABLE_MAP[type] || type;
    await db.execute({
      sql: `DELETE FROM ${tableName} WHERE id = ?`,
      args: [id],
    });

    res.redirect(`/admin/${type}-list?status=${type}_hapus_sukses`);
  } catch (error) {
    console.error('Error saat menghapus data:', error);
    res.redirect(`/admin/${req.params.type || 'tugas'}-list?status=gagal`);
  }
});

module.exports = router;
