/* Vercel Serverless Function: mengambil data live dari Google Sheet (tab "2026")
   lewat endpoint gviz, memprosesnya dengan aturan penagihan yang sama persis
   dengan versi Google Script, lalu mengembalikan JSON siap tampil untuk frontend.
   Tanpa dependensi apa pun. ID sheet bisa diubah lewat env var SHEET_ID. */
'use strict';

var DEFAULT_SHEET_ID = '17iEKENHep2BaFt6KPGUkr6RUYM9AOVIv';
var SHEET_NAME = '2026';

/* Peta kolom sheet (0-based). Tiap bulan = (piutang, bayar, sisa, tanggal). */
var MONTHS = [
  { name: 'Januari',   short: 'Jan', cols: [4, 5, 7, 8] },
  { name: 'Februari',  short: 'Feb', cols: [10, 11, 12, 13] },
  { name: 'Maret',     short: 'Mar', cols: [15, 16, 17, 18] },
  { name: 'April',     short: 'Apr', cols: [20, 21, 22, 23] },
  { name: 'Mei',       short: 'Mei', cols: [25, 26, 27, 28] },
  { name: 'Juni',      short: 'Jun', cols: [30, 31, 32, 33] },
  { name: 'Juli',      short: 'Jul', cols: [35, 36, 37, 38] },
  { name: 'Agustus',   short: 'Agu', cols: [40, 41, 42, 43] },
  { name: 'September', short: 'Sep', cols: [45, 46, 47, 48] },
  { name: 'Oktober',   short: 'Okt', cols: [50, 51, 52, 53] },
];
var MONTH_ORDER = MONTHS.map(function (m) { return m.name; });
var RATES = { 2: 1650000, 3: 1100000 };
/* Tenant yang mulai berjualan di tengah tahun: nama (huruf kecil) -> bulan mulai. */
var START_MONTHS = { 'higashi': 'September' };

function num(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  if (v instanceof Date) return null;
  var s = String(v).replace(/\./g, '').replace(/,/g, '.').trim();
  var n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function parseFloor(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Math.floor(v);
  var m = String(v).match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

var BULAN_SINGKAT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/* Mengubah isi sel tanggal menjadi teks "28 Okt 2026".
   Dari gviz, tanggal datang sebagai string "Date(2026,9,28)" (bulan 0-based);
   bila sudah berupa string biasa, string itu dipakai apa adanya. */
function formatPaidDate(v) {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) {
    return v.getDate() + ' ' + BULAN_SINGKAT[v.getMonth()] + ' ' + v.getFullYear();
  }
  var s = String(v).trim();
  if (s === '' || s === '-') return null;
  var dm = s.match(/^Date\((\d+),\s*(\d+),\s*(\d+)/);
  if (dm) {
    return parseInt(dm[3], 10) + ' ' + BULAN_SINGKAT[parseInt(dm[2], 10)] + ' ' + dm[1];
  }
  return s;
}

/* Mengubah array 2D nilai sheet menjadi daftar tenant + status tiap bulan.
   Aturan penagihan (jangan diubah tanpa konfirmasi):
   - Rekap mencakup Januari–Oktober 2026. Februari–Maret selalu libur (Ramadhan).
   - Kolom bulan yang kosong = BELUM BAYAR, ditagih sesuai tarif lantai.
   - Higashi mulai berjualan September 2026 (bulan sebelumnya "belum berjualan").
   - Bambu Sushi Juni 2026: kurang bayar (ditagih 1.650.000, dibayar 800.000).
   - Bu Rudi April 2026: bayar 1.300.000 vs tagihan 1.100.000 — selisih 200.000
     adalah iuran koperasi, BUKAN lebih bayar sewa; April tetap lunas pas.
   - Wan Gembul Januari 2026: ditagih & dibayar 1.667.000, tetap lunas.
   - Status kosong/lunas HANYA ditentukan dari piutang + bayar, jangan pernah
     dari kolom sisa (berisi placeholder di bulan kosong). */
function rowsToTenants(values) {
  var tenants = [];
  values.forEach(function (c) {
    if (!c) return;
    var nameRaw = c[1];
    var ownerRaw = c[2];
    var floor = parseFloor(c[3]);
    if (nameRaw === null || nameRaw === undefined) return;
    var name = String(nameRaw).trim();
    if (!name || !floor || !RATES[floor]) return;
    var owner = ownerRaw !== null && ownerRaw !== undefined ? String(ownerRaw).trim() : '';
    var no = num(c[0]);
    var rate = RATES[floor];
    var startMonth = START_MONTHS[name.toLowerCase()] || null;
    var months = MONTHS.map(function (m) {
      if (m.name === 'Februari' || m.name === 'Maret') {
        return { month: m.name, state: 'libur' };
      }
      if (startMonth && MONTH_ORDER.indexOf(m.name) < MONTH_ORDER.indexOf(startMonth)) {
        return { month: m.name, state: 'belum-jualan' };
      }
      var pi = num(c[m.cols[0]]);
      var ba = num(c[m.cols[1]]);
      if (pi === null && ba === null) {
        return { month: m.name, state: 'belum', amount: rate };
      }
      var billed = pi !== null ? pi : rate;
      var paid = ba !== null ? ba : 0;
      var paidDate = formatPaidDate(c[m.cols[3]]);
      if (paid >= billed) {
        var lebih = (name.toLowerCase().indexOf('rudi') >= 0 && m.name === 'April')
          ? 0 : Math.max(0, paid - billed);
        return { month: m.name, state: 'lunas', billed: billed, paid: Math.min(paid, billed), paidDate: paidDate, lebih: lebih };
      }
      return { month: m.name, state: 'kurang', billed: billed, paid: paid, amount: billed - paid, paidDate: paidDate };
    });
    var tagihan = 0, terbayar = 0, tunggakan = 0, lebihBayar = 0;
    months.forEach(function (mo) {
      if (mo.state === 'belum') { tagihan += mo.amount; tunggakan += mo.amount; }
      else if (mo.state === 'kurang') { tagihan += mo.billed; terbayar += mo.paid; tunggakan += mo.amount; }
      else if (mo.state === 'lunas') { tagihan += mo.billed; terbayar += mo.paid; lebihBayar += mo.lebih || 0; }
    });
    var status = tunggakan > 0
      ? (months.some(function (mo) { return mo.state === 'belum'; }) ? 'belum' : 'kurang')
      : 'lunas';
    tenants.push({
      no: no, name: name, owner: owner, floor: floor, rate: rate,
      months: months, tagihan: tagihan, terbayar: terbayar,
      tunggakan: tunggakan, lebihBayar: lebihBayar, status: status,
    });
  });
  tenants.sort(function (a, b) {
    if (a.no === null && b.no === null) return 0;
    if (a.no === null) return 1;
    if (b.no === null) return -1;
    return a.no - b.no;
  });
  return tenants;
}

/* Mengurai respons gviz: kadang diawali prefix /*O_o*\/ lalu dibungkus
   google.visualization.Query.setResponse(...). */
function parseGviz(text) {
  var t = text.replace(/^\/\*O_o\*\/\s*/, '');
  var start = t.indexOf('{');
  var end = t.lastIndexOf('}');
  if (start < 0 || end < 0 || end <= start) throw new Error('Format respons sheet tidak dikenali');
  return JSON.parse(t.slice(start, end + 1));
}

async function handler(req, res) {
  var sheetId = process.env.SHEET_ID || DEFAULT_SHEET_ID;
  var url = 'https://docs.google.com/spreadsheets/d/' + sheetId +
    '/gviz/tq?tqx=out:json&sheet=' + SHEET_NAME;
  try {
    var r = await fetch(url, { headers: { 'User-Agent': 'rekap-kantin-vercel/1.0' } });
    if (!r.ok) {
      res.status(502).json({ ok: false, error: 'Google Sheet mengembalikan HTTP ' + r.status });
      return;
    }
    var text = await r.text();
    var data = parseGviz(text);
    if (!data.table || !data.table.rows) {
      res.status(502).json({ ok: false, error: 'Struktur data sheet tidak dikenali' });
      return;
    }
    /* gviz: tiap baris = { c: [ {v: nilai} | null, ... ] }. Ubah ke array 2D
       yang sama bentuknya dengan getValues() versi Google Script. */
    var values = data.table.rows.map(function (row) {
      var cells = row.c || [];
      return cells.map(function (cell) { return cell ? cell.v : null; });
    });
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ ok: true, fetchedAt: new Date().toISOString(), tenants: rowsToTenants(values) });
  } catch (err) {
    res.status(502).json({ ok: false, error: 'Gagal mengambil data sheet: ' + err.message });
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = handler;
  module.exports.parseGviz = parseGviz;
  module.exports.rowsToTenants = rowsToTenants;
}
