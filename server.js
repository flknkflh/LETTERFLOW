/**
 * LetterFlow Enterprise — Server
 * Local-first, WiFi-accessible document management system.
 * Primary data stored in local PostgreSQL. ./data/db.json is used as initial migration seed.
 */

const http    = require("http");
const fs      = require("fs");
const path    = require("path");
const crypto  = require("crypto");
const os      = require("os");
const postgres = require("./db-postgres");

/* ───────────────────────── Config ───────────────────────── */
const PORT       = Number(process.env.PORT || 3000);
const HOST       = "0.0.0.0";
const ROOT       = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR   = path.join(ROOT, "data");
const DB_FILE    = path.join(DATA_DIR, "db.json");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css" : "text/css; charset=utf-8",
  ".js"  : "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg" : "image/svg+xml",
  ".png" : "image/png",
  ".jpg" : "image/jpeg",
  ".jpeg": "image/jpeg",
  ".pdf" : "application/pdf",
  ".ico" : "image/x-icon",
};

/* ──────────────────────── Helpers ───────────────────────── */
function nowIso() { return new Date().toISOString(); }
function makeId(prefix = "id") {
  return `${prefix}-${crypto.randomBytes(5).toString("hex")}`;
}

function getLanAddresses() {
  const nets = os.networkInterfaces();
  const out  = [];
  for (const net of Object.values(nets)) {
    for (const item of (net || [])) {
      if (item.family === "IPv4" && !item.internal) out.push(item.address);
    }
  }
  return out;
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type"  : "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Access-Control-Allow-Origin": "*",
  });
  res.end(body);
}

function sendFile(res, filePath, downloadName, mimeType, disposition = "attachment") {
  fs.readFile(filePath, (err, content) => {
    if (err) {
      sendJson(res, 404, { error: "File tidak ditemukan" });
      return;
    }
    const safeName = String(downloadName || path.basename(filePath)).replace(/"/g, "");
    res.writeHead(200, {
      "Content-Type": mimeType || MIME_TYPES[path.extname(filePath)] || "application/octet-stream",
      "Content-Length": content.length,
      "Content-Disposition": `${disposition}; filename="${safeName}"`,
      "Access-Control-Allow-Origin": "*",
    });
    res.end(content);
  });
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 20_000_000) { reject(new Error("Payload terlalu besar")); req.destroy(); }
    });
    req.on("end", () => {
      if (!raw) { resolve({}); return; }
      try { resolve(JSON.parse(raw)); }
      catch { reject(new Error("JSON tidak valid")); }
    });
  });
}

function sanitizeFileName(name) {
  return String(name || "dokumen.pdf")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140) || "dokumen.pdf";
}

function sanitizePathSegment(name, fallback = "Tanpa Nama") {
  return sanitizeFileName(name || fallback).replace(/\.[^.]+$/, "") || fallback;
}

function saveUploadedDataUrl(input, prefix = "dokumen", allowedMimes = ["application/pdf"]) {
  if (!input || !input.dataUrl) return null;

  const originalName = sanitizeFileName(input.name || `${prefix}.pdf`);
  const mime = String(input.type || "").trim() || "application/pdf";
  const match = String(input.dataUrl).match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Format file upload tidak valid");

  const allowed = new Set(allowedMimes);
  if (!allowed.has(mime) || match[1] !== mime) {
    throw new Error("Tipe file upload tidak didukung");
  }

  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length > 15 * 1024 * 1024) {
    throw new Error("Ukuran file maksimal 15MB");
  }

  const ext = path.extname(originalName).toLowerCase() || ".pdf";
  const storedName = `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`;
  const storedPath = path.join(UPLOADS_DIR, storedName);
  fs.writeFileSync(storedPath, bytes);

  return {
    id: makeId("doc"),
    originalName,
    storedName,
    mime,
    size: bytes.length,
    uploadedAt: nowIso()
  };
}

function saveReviewAttachments(files = []) {
  if (!Array.isArray(files)) return [];
  const allowed = ["application/pdf", "image/png", "image/jpeg"];
  return files
    .filter(file => file && file.dataUrl)
    .map(file => saveUploadedDataUrl(file, "revisi", allowed));
}

function collectFileAudit(db) {
  const files = [];
  for (const letter of db.letters || []) {
    if (letter.dokumen) {
      files.push({
        id: letter.dokumen.id || letter.dokumen.storedName,
        type: "Dokumen Surat",
        letterId: letter.id,
        nomor: letter.nomor,
        perihal: letter.perihal,
        uploader: letter.pembuatNama || "Pembuat",
        role: "pembuat",
        originalName: letter.dokumen.originalName,
        storedName: letter.dokumen.storedName,
        mime: letter.dokumen.mime,
        size: letter.dokumen.size,
        uploadedAt: letter.dokumen.uploadedAt || letter.createdAt
      });
    }

    for (const review of letter.reviewHistory || []) {
      for (const attachment of review.attachments || []) {
        files.push({
          id: attachment.id || attachment.storedName,
          type: "Lampiran Revisi",
          letterId: letter.id,
          reviewId: review.id,
          nomor: letter.nomor,
          perihal: letter.perihal,
          uploader: review.reviewerNama || "Reviewer",
          role: "pereview",
          originalName: attachment.originalName,
          storedName: attachment.storedName,
          mime: attachment.mime,
          size: attachment.size,
          uploadedAt: attachment.uploadedAt || review.reviewedAt
        });
      }
    }

    for (const revision of letter.signerRevisions || []) {
      for (const attachment of revision.attachments || []) {
        files.push({
          id: attachment.id || attachment.storedName,
          type: "Lampiran Revisi Penandatangan",
          letterId: letter.id,
          revisionId: revision.id,
          nomor: letter.nomor,
          perihal: letter.perihal,
          uploader: revision.signerNama || "Penandatangan",
          role: "penandatangan",
          originalName: attachment.originalName,
          storedName: attachment.storedName,
          mime: attachment.mime,
          size: attachment.size,
          uploadedAt: attachment.uploadedAt || revision.createdAt
        });
      }
    }
  }
  return files.sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0));
}

function clearUploadsDirectory() {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  for (const item of fs.readdirSync(UPLOADS_DIR)) {
    const target = path.join(UPLOADS_DIR, item);
    const resolved = path.resolve(target);
    if (!resolved.startsWith(path.resolve(UPLOADS_DIR))) continue;
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}

function getDefaultSuperAdmin() {
  return {
    id: "usr-000",
    name: "Super Admin",
    nip: "superadmin",
    password: "super123",
    role: "super-admin",
    avatar: "SA",
    unit: "Bag InArTala"
  };
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

function createZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const name = entry.name.replace(/\\/g, "/");
    const nameBuffer = Buffer.from(name, "utf8");
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(String(entry.data || ""), "utf8");
    const crc = crc32(data);
    const { time, day } = dosDateTime(entry.date ? new Date(entry.date) : new Date());

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(day, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, nameBuffer, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(day, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBuffer);

    offset += local.length + nameBuffer.length + data.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...centralParts, end]);
}

function fileBufferFromUpload(upload) {
  if (!upload || !upload.storedName) return null;
  const resolved = path.resolve(UPLOADS_DIR, upload.storedName);
  if (!resolved.startsWith(path.resolve(UPLOADS_DIR)) || !fs.existsSync(resolved)) return null;
  return fs.readFileSync(resolved);
}

function signatureBuffer(signature) {
  const image = signature && signature.image;
  if (!image || !String(image).startsWith("data:image/png;base64,")) return null;
  return Buffer.from(String(image).replace(/^data:image\/png;base64,/, ""), "base64");
}

function buildBackupZip(db) {
  const entries = [];
  const manifest = {
    appName: db.meta && db.meta.appName,
    generatedAt: nowIso(),
    letterCount: (db.letters || []).length,
    fileCount: 0
  };

  entries.push({
    name: "backupdata/manifest.json",
    data: JSON.stringify(manifest, null, 2)
  });

  for (const letter of db.letters || []) {
    const unit = sanitizePathSegment(letter.pembuatUnit, "Tanpa Unit");
    const pembuat = sanitizePathSegment(letter.pembuatNama, "Tanpa Pembuat");
    const surat = sanitizePathSegment(`${letter.nomor || letter.id} - ${letter.perihal || "Surat"}`, letter.id);
    const base = `backupdata/${unit}/${pembuat}/${surat}`;

    entries.push({
      name: `${base}/metadata-surat.json`,
      data: JSON.stringify(letter, null, 2),
      date: letter.updatedAt || letter.createdAt
    });

    const docBuffer = fileBufferFromUpload(letter.dokumen);
    if (docBuffer) {
      entries.push({
        name: `${base}/dokumen/${sanitizeFileName(letter.dokumen.originalName || letter.dokumen.storedName)}`,
        data: docBuffer,
        date: letter.dokumen.uploadedAt || letter.createdAt
      });
      manifest.fileCount++;
    }

    for (const review of letter.reviewHistory || []) {
      for (const attachment of review.attachments || []) {
        const attachmentBuffer = fileBufferFromUpload(attachment);
        if (!attachmentBuffer) continue;
        entries.push({
          name: `${base}/lampiran-revisi/${sanitizePathSegment(review.reviewerNama, "Reviewer")}/${sanitizeFileName(attachment.originalName || attachment.storedName)}`,
          data: attachmentBuffer,
          date: attachment.uploadedAt || review.reviewedAt
        });
        manifest.fileCount++;
      }
    }

    for (const revision of letter.signerRevisions || []) {
      for (const attachment of revision.attachments || []) {
        const attachmentBuffer = fileBufferFromUpload(attachment);
        if (!attachmentBuffer) continue;
        entries.push({
          name: `${base}/lampiran-revisi-penandatangan/${sanitizePathSegment(revision.signerNama, "Penandatangan")}/${sanitizeFileName(attachment.originalName || attachment.storedName)}`,
          data: attachmentBuffer,
          date: attachment.uploadedAt || revision.createdAt
        });
        manifest.fileCount++;
      }
    }

    const signBuffer = signatureBuffer(letter.tandaTangan);
    if (signBuffer) {
      entries.push({
        name: `${base}/ttd/ttd-${sanitizePathSegment(letter.tandaTangan.nama, "penandatangan")}.png`,
        data: signBuffer,
        date: letter.tandaTangan.signedAt
      });
      manifest.fileCount++;
    }
  }

  entries[0].data = JSON.stringify(manifest, null, 2);
  return createZip(entries);
}

function filterLettersForRole(letters, role, userId) {
  if (!role || role === "super-admin" || role === "pemonitor") return letters;
  if (role === "pembuat") return letters.filter(l => l.pembuatId === userId);
  if (role === "pereview") return letters.filter(l => (l.reviewerIds || []).includes(userId));
  if (role === "penandatangan") return letters.filter(l => l.penandatanganId === userId);
  return [];
}

/* ─────────────────────── Database ───────────────────────── */
function ensureDatabase() {
  if (!fs.existsSync(DATA_DIR))    fs.mkdirSync(DATA_DIR,    { recursive: true });
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  if (fs.existsSync(DB_FILE)) return;

  const seed = {
    meta: { appName: "LetterFlow Enterprise", createdAt: nowIso() },

    users: [
      { id: "usr-000", name: "Super Admin",     nip: "superadmin", password: "super123", role: "super-admin",   avatar: "SA", unit: "Bag InArTala" },
      { id: "usr-001", name: "Admin Sistem",    nip: "admin",    password: "admin123",  role: "pembuat",       avatar: "AS", unit: "Bag InArTala" },
      { id: "usr-002", name: "Budi Santoso",    nip: "budi",     password: "review123", role: "pereview",      avatar: "BS", unit: "Kepala Divisi Operasional" },
      { id: "usr-003", name: "Citra Handayani", nip: "citra",    password: "sign123",   role: "penandatangan", avatar: "CH", unit: "Direktur Operasional" },
      { id: "usr-004", name: "Dwi Prasetyo",    nip: "dwi",      password: "monitor123",role: "pemonitor",     avatar: "DP", unit: "Monitoring & Evaluasi" },
    ],

    letters: [
      {
        id: "surat-demo-001",
        nomor: "001/SK/InArTala/X/2024",
        perihal: "Memorandum Internal: Kebijakan Keamanan Q3",
        kategori: "Surat Keputusan (SK)",
        prioritas: "Normal",
        status: "Menunggu Review",
        pembuatId: "usr-001",
        pembuatNama: "Admin Sistem",
        pembuatUnit: "Bag InArTala",
        reviewerIds: ["usr-002"],
        penandatanganId: "usr-003",
        ringkasan: "Memorandum mengenai kebijakan keamanan informasi triwulan ketiga tahun 2024.",
        dokumen: null,
        catatan: [
          { id: makeId("cat"), oleh: "Admin Sistem", peran: "pembuat", pesan: "Mohon direview segera.", createdAt: nowIso() }
        ],
        reviewHistory: [
          { id: makeId("rv"), reviewerId: "usr-002", reviewerNama: "Budi Santoso", status: "Menunggu", catatan: "", reviewedAt: null }
        ],
        tandaTangan: null,
        riwayat: [
          { id: makeId("log"), aksi: "Surat dibuat", oleh: "Admin Sistem", createdAt: nowIso() }
        ],
        createdAt: nowIso(),
        updatedAt: nowIso()
      },
      {
        id: "surat-demo-002",
        nomor: "002/ND/InArTala/X/2024",
        perihal: "Surat Penawaran Kerjasama - TechCorp Inc.",
        kategori: "Nota Dinas",
        prioritas: "Urgent",
        status: "Draft",
        pembuatId: "usr-001",
        pembuatNama: "Admin Sistem",
        pembuatUnit: "Bag InArTala",
        reviewerIds: [],
        penandatanganId: null,
        ringkasan: "Surat penawaran kerjasama dengan TechCorp Inc. untuk pengadaan perangkat IT.",
        dokumen: null,
        catatan: [],
        reviewHistory: [],
        tandaTangan: null,
        riwayat: [
          { id: makeId("log"), aksi: "Surat dibuat", oleh: "Admin Sistem", createdAt: nowIso() }
        ],
        createdAt: nowIso(),
        updatedAt: nowIso()
      },
      {
        id: "surat-demo-003",
        nomor: "003/LT/InArTala/X/2024",
        perihal: "Laporan Tahunan Divisi Infrastruktur 2023",
        kategori: "Laporan",
        prioritas: "Normal",
        status: "Ditandatangani",
        pembuatId: "usr-001",
        pembuatNama: "Admin Sistem",
        pembuatUnit: "Bag InArTala",
        reviewerIds: ["usr-002"],
        penandatanganId: "usr-003",
        ringkasan: "Laporan komprehensif aktivitas dan capaian Divisi Infrastruktur sepanjang tahun 2023.",
        dokumen: null,
        catatan: [],
        reviewHistory: [
          { id: makeId("rv"), reviewerId: "usr-002", reviewerNama: "Budi Santoso", status: "Disetujui", catatan: "Sudah sesuai standar.", reviewedAt: nowIso() }
        ],
        tandaTangan: {
          image: null,
          nama: "Citra Handayani",
          jabatan: "Direktur Operasional",
          signedAt: nowIso()
        },
        riwayat: [
          { id: makeId("log"), aksi: "Surat ditandatangani elektronik", oleh: "Citra Handayani", createdAt: nowIso() },
          { id: makeId("log"), aksi: "Disetujui oleh reviewer", oleh: "Budi Santoso", createdAt: nowIso() },
          { id: makeId("log"), aksi: "Surat dibuat", oleh: "Admin Sistem", createdAt: nowIso() }
        ],
        createdAt: nowIso(),
        updatedAt: nowIso()
      }
    ]
  };

  fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2));
}

function migrateDatabase(db) {
  db.users = db.users || [];
  db.letters = db.letters || [];
  if (!db.users.some(u => u.role === "super-admin")) {
    db.users.unshift(getDefaultSuperAdmin());
  }
  return db;
}

function readDb() {
  throw new Error("Gunakan readDbAsync untuk PostgreSQL");
}
let postgresReady = null;
function ensurePostgresReady() {
  ensureDatabase();
  if (!postgresReady) {
    postgresReady = postgres.initPostgres(DB_FILE, migrateDatabase).catch(err => {
      postgresReady = null;
      throw err;
    });
  }
  return postgresReady;
}
async function readDbAsync() {
  await ensurePostgresReady();
  const db = migrateDatabase(await postgres.readState());
  await postgres.writeState(db);
  return db;
}
async function writeDb(db) { await postgres.writeState(db); }

function addHistory(letter, aksi, oleh) {
  letter.riwayat.unshift({ id: makeId("log"), aksi, oleh, createdAt: nowIso() });
}

function formatErrorMessage(err) {
  if (!err) return "Terjadi kesalahan tidak dikenal";
  if (err.message) return err.message;
  if (err.code) return `Kode error: ${err.code}`;
  if (Array.isArray(err.errors) && err.errors.length) {
    return err.errors.map(formatErrorMessage).join("; ");
  }
  return String(err);
}

/* ──────────────────────── API Router ────────────────────── */
async function handleApi(req, res, pathname) {
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE", "Access-Control-Allow-Headers": "Content-Type" });
    res.end();
    return;
  }

  await ensurePostgresReady();
  const db = await readDbAsync();

  /* ── Auth ── */
  if (req.method === "POST" && pathname === "/api/auth/login") {
    const { nip, password } = await parseBody(req);
    const user = db.users.find(u => u.nip === nip && u.password === password);
    if (!user) { sendJson(res, 401, { error: "NIP atau password salah" }); return; }
    const { password: _, ...safeUser } = user;
    sendJson(res, 200, { user: safeUser });
    return;
  }

  /* ── Users ── */
  if (req.method === "GET" && pathname === "/api/users") {
    const safeUsers = db.users.map(({ password: _, ...u }) => u);
    sendJson(res, 200, { users: safeUsers });
    return;
  }

  if (req.method === "GET" && pathname === "/api/search") {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const role = url.searchParams.get("role");
    const userId = url.searchParams.get("userId");
    const scope = url.searchParams.get("scope") || "letters";
    const mode = url.searchParams.get("mode") || "all";
    const category = url.searchParams.get("category") || "";
    const q = url.searchParams.get("q") || "";

    const letters = scope === "users"
      ? []
      : await postgres.searchLetters({ role, userId, mode, category, q });
    const users = scope === "letters" || role !== "super-admin"
      ? []
      : await postgres.searchUsers({ q, category });

    sendJson(res, 200, { letters, users });
    return;
  }

  if (req.method === "GET" && pathname === "/api/files") {
    sendJson(res, 200, { files: collectFileAudit(db) });
    return;
  }

  if (req.method === "GET" && pathname === "/api/admin/backup.zip") {
    const zip = buildBackupZip(db);
    const stamp = new Date().toISOString().slice(0, 10);
    res.writeHead(200, {
      "Content-Type": "application/zip",
      "Content-Length": zip.length,
      "Content-Disposition": `attachment; filename="backupdata-${stamp}.zip"`,
      "Access-Control-Allow-Origin": "*",
    });
    res.end(zip);
    return;
  }

  if (req.method === "POST" && pathname === "/api/admin/reset-data") {
    const body = await parseBody(req);
    if (body.confirm !== "RESET") {
      sendJson(res, 400, { error: "Konfirmasi reset tidak valid" });
      return;
    }

    const currentSuper = db.users.find(u => u.role === "super-admin") || getDefaultSuperAdmin();
    db.users = [currentSuper];
    db.letters = [];
    db.meta = {
      ...(db.meta || {}),
      resetAt: nowIso(),
      resetBy: currentSuper.nip || currentSuper.name || "superadmin"
    };
    clearUploadsDirectory();
    await writeDb(db);
    const { password: _, ...safeUser } = currentSuper;
    sendJson(res, 200, { ok: true, user: safeUser, users: [safeUser], letters: [] });
    return;
  }

  if (req.method === "POST" && pathname === "/api/users") {
    const body = await parseBody(req);
    if (!body.name || !body.nip || !body.password || !body.role) {
      sendJson(res, 400, { error: "name, nip, password, dan role wajib diisi" }); return;
    }
    if (db.users.find(u => u.nip === body.nip)) {
      sendJson(res, 409, { error: "NIP sudah digunakan" }); return;
    }
    const newUser = {
      id: makeId("usr"),
      name: String(body.name).trim(),
      nip: String(body.nip).trim(),
      password: String(body.password),
      role: body.role,
      avatar: String(body.name).trim().split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase(),
      unit: String(body.unit || "").trim(),
    };
    db.users.push(newUser);
    await writeDb(db);
    const { password: _, ...safeUser } = newUser;
    sendJson(res, 201, { user: safeUser });
    return;
  }

  const userMatch = pathname.match(/^\/api\/users\/([^/]+)$/);
  if (userMatch) {
    const uid = userMatch[1];
    if (req.method === "DELETE") {
      const idx = db.users.findIndex(u => u.id === uid);
      if (idx === -1) { sendJson(res, 404, { error: "User tidak ditemukan" }); return; }
      db.users.splice(idx, 1);
      await writeDb(db);
      sendJson(res, 200, { ok: true });
      return;
    }
    if (req.method === "PUT") {
      const idx = db.users.findIndex(u => u.id === uid);
      if (idx === -1) { sendJson(res, 404, { error: "User tidak ditemukan" }); return; }
      const body = await parseBody(req);
      const u = db.users[idx];
      if (body.name) { u.name = String(body.name).trim(); u.avatar = u.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase(); }
      if (body.role) u.role = body.role;
      if (body.unit) u.unit = String(body.unit).trim();
      if (body.password) u.password = String(body.password);
      db.users[idx] = u;
      await writeDb(db);
      const { password: _, ...safe } = u;
      sendJson(res, 200, { user: safe });
      return;
    }
  }

  /* ── Letters ── */
  if (req.method === "GET" && pathname === "/api/letters") {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const role = url.searchParams.get("role");
    const userId = url.searchParams.get("userId");
    sendJson(res, 200, { letters: filterLettersForRole(db.letters, role, userId) });
    return;
  }

  const reviewAttachmentMatch = pathname.match(/^\/api\/review-attachments\/([^/]+)\/([^/]+)\/([^/]+)$/);
  if (req.method === "GET" && reviewAttachmentMatch) {
    const [, letterId, reviewId, attachmentId] = reviewAttachmentMatch;
    const targetLetter = db.letters.find(l => l.id === letterId);
    const review = targetLetter && (targetLetter.reviewHistory || []).find(r => r.id === reviewId);
    const attachment = review && (review.attachments || []).find(a => a.id === attachmentId);
    if (!attachment || !attachment.storedName) {
      sendJson(res, 404, { error: "Lampiran revisi tidak ditemukan" });
      return;
    }
    const disposition = new URL(req.url, `http://${req.headers.host || "localhost"}`).searchParams.get("download") === "1" ? "attachment" : "inline";
    sendFile(res, path.join(UPLOADS_DIR, attachment.storedName), attachment.originalName, attachment.mime, disposition);
    return;
  }

  const signerAttachmentMatch = pathname.match(/^\/api\/signer-revision-attachments\/([^/]+)\/([^/]+)\/([^/]+)$/);
  if (req.method === "GET" && signerAttachmentMatch) {
    const [, letterId, revisionId, attachmentId] = signerAttachmentMatch;
    const targetLetter = db.letters.find(l => l.id === letterId);
    const revision = targetLetter && (targetLetter.signerRevisions || []).find(r => r.id === revisionId);
    const attachment = revision && (revision.attachments || []).find(a => a.id === attachmentId);
    if (!attachment || !attachment.storedName) {
      sendJson(res, 404, { error: "Lampiran revisi penandatangan tidak ditemukan" });
      return;
    }
    const disposition = new URL(req.url, `http://${req.headers.host || "localhost"}`).searchParams.get("download") === "1" ? "attachment" : "inline";
    sendFile(res, path.join(UPLOADS_DIR, attachment.storedName), attachment.originalName, attachment.mime, disposition);
    return;
  }

  if (req.method === "POST" && pathname === "/api/letters") {
    const body = await parseBody(req);
    if (!body.perihal || !body.pembuatId) {
      sendJson(res, 400, { error: "perihal dan pembuatId wajib diisi" }); return;
    }
    const pembuat = db.users.find(u => u.id === body.pembuatId);
    const letter = {
      id: makeId("surat"),
      nomor: String(body.nomor || "Menunggu nomor TU").trim(),
      perihal: String(body.perihal).trim(),
      kategori: String(body.kategori || "Surat Keputusan (SK)").trim(),
      prioritas: String(body.prioritas || "Normal").trim(),
      status: "Draft",
      pembuatId: body.pembuatId,
      pembuatNama: pembuat ? pembuat.name : "Unknown",
      pembuatUnit: pembuat ? pembuat.unit : "",
      reviewerIds: Array.isArray(body.reviewerIds) ? body.reviewerIds : [],
      penandatanganId: body.penandatanganId || null,
      ringkasan: String(body.ringkasan || "").trim(),
      dokumen: saveUploadedDataUrl(body.dokumen, "surat"),
      catatan: [],
      reviewHistory: [],
      tandaTangan: null,
      riwayat: [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    // Build review history slots
    letter.reviewerIds.forEach(rid => {
      const reviewer = db.users.find(u => u.id === rid);
      letter.reviewHistory.push({
        id: makeId("rv"), reviewerId: rid,
        reviewerNama: reviewer ? reviewer.name : "Unknown",
        status: "Menunggu", catatan: "", reviewedAt: null, attachments: []
      });
    });
    if (letter.reviewerIds.length > 0) letter.status = "Menunggu Review";
    addHistory(letter, "Surat dibuat", letter.pembuatNama);
    db.letters.unshift(letter);
    await writeDb(db);
    sendJson(res, 201, { letter });
    return;
  }

  const letterMatch = pathname.match(/^\/api\/letters\/([^/]+)(?:\/([^/]+))?$/);
  if (!letterMatch) { sendJson(res, 404, { error: "API tidak ditemukan" }); return; }

  const [, lid, action] = letterMatch;
  const letter = db.letters.find(l => l.id === lid);
  if (!letter) { sendJson(res, 404, { error: "Surat tidak ditemukan" }); return; }

  // GET single letter
  if (req.method === "GET" && !action) {
    sendJson(res, 200, { letter });
    return;
  }

  // GET /api/letters/:id/document or /document-download
  if (req.method === "GET" && (action === "document" || action === "document-download")) {
    if (!letter.dokumen || !letter.dokumen.storedName) {
      sendJson(res, 404, { error: "Dokumen belum diunggah" });
      return;
    }
    const filePath = path.join(UPLOADS_DIR, letter.dokumen.storedName);
    sendFile(res, filePath, letter.dokumen.originalName, letter.dokumen.mime, action === "document" ? "inline" : "attachment");
    return;
  }

  // GET /api/letters/:id/signature-image or /signature-download
  if (req.method === "GET" && (action === "signature-image" || action === "signature-download")) {
    const image = letter.tandaTangan && letter.tandaTangan.image;
    if (!image || !String(image).startsWith("data:image/png;base64,")) {
      sendJson(res, 404, { error: "Gambar tanda tangan belum tersedia" });
      return;
    }
    const bytes = Buffer.from(String(image).replace(/^data:image\/png;base64,/, ""), "base64");
    const signer = sanitizeFileName(letter.tandaTangan.nama || "penandatangan").replace(/\.[^.]+$/, "");
    const name = `ttd-${signer}-${letter.nomor || letter.id}.png`.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");
    res.writeHead(200, {
      "Content-Type": "image/png",
      "Content-Length": bytes.length,
      "Content-Disposition": `${action === "signature-image" ? "inline" : "attachment"}; filename="${name}"`,
      "Access-Control-Allow-Origin": "*",
    });
    res.end(bytes);
    return;
  }

  // PUT update letter
  if (req.method === "PUT" && !action) {
    const body = await parseBody(req);
    const fields = ["nomor","perihal","kategori","prioritas","status","ringkasan","penandatanganId"];
    fields.forEach(f => { if (body[f] !== undefined) letter[f] = typeof body[f] === "string" ? body[f].trim() : body[f]; });
    if (body.dokumen && body.dokumen.dataUrl) {
      letter.dokumen = saveUploadedDataUrl(body.dokumen, "surat");
      addHistory(letter, "Dokumen PDF diperbarui", body.updatedBy || "System");
    }
    if (Array.isArray(body.reviewerIds)) {
      letter.reviewerIds = body.reviewerIds;
      letter.reviewHistory = body.reviewerIds.map(rid => {
        const existing = letter.reviewHistory.find(r => r.reviewerId === rid);
        if (existing) return existing;
        const reviewer = db.users.find(u => u.id === rid);
        return { id: makeId("rv"), reviewerId: rid, reviewerNama: reviewer ? reviewer.name : "Unknown", status: "Menunggu", catatan: "", reviewedAt: null, attachments: [] };
      });
    }
    letter.updatedAt = nowIso();
    addHistory(letter, "Surat diperbarui", body.updatedBy || "System");
    await writeDb(db);
    sendJson(res, 200, { letter });
    return;
  }

  // DELETE letter
  if (req.method === "DELETE" && !action) {
    const idx = db.letters.findIndex(l => l.id === lid);
    db.letters.splice(idx, 1);
    await writeDb(db);
    sendJson(res, 200, { ok: true });
    return;
  }

  // POST /api/letters/:id/comments
  if (req.method === "POST" && action === "comments") {
    const body = await parseBody(req);
    const pesan = String(body.pesan || "").trim();
    if (!pesan) { sendJson(res, 400, { error: "Pesan catatan tidak boleh kosong" }); return; }
    const comment = { id: makeId("cat"), oleh: String(body.oleh || "User").trim(), peran: body.peran || "user", pesan, createdAt: nowIso() };
    letter.catatan.unshift(comment);
    letter.updatedAt = nowIso();
    addHistory(letter, `Catatan baru dari ${comment.oleh}`, comment.oleh);
    await writeDb(db);
    sendJson(res, 201, { letter, comment });
    return;
  }

  // POST /api/letters/:id/review
  if (req.method === "POST" && action === "review") {
    const body = await parseBody(req);
    const { reviewerId, status, catatan } = body;
    if (!reviewerId || !status) { sendJson(res, 400, { error: "reviewerId dan status wajib diisi" }); return; }

    const rv = letter.reviewHistory.find(r => r.reviewerId === reviewerId);
    if (!rv) { sendJson(res, 404, { error: "Reviewer tidak terdaftar untuk surat ini" }); return; }
    rv.status    = status === "Ditolak" ? "Ditolak" : status === "Direvisi" ? "Direvisi" : "Disetujui";
    rv.catatan   = String(catatan || "").trim();
    rv.reviewedAt = nowIso();
    rv.attachments = saveReviewAttachments(body.attachments);

    const reviewer = db.users.find(u => u.id === reviewerId);
    addHistory(letter, `Review oleh ${reviewer ? reviewer.name : reviewerId}: ${rv.status}`, reviewer ? reviewer.name : reviewerId);

    // Determine letter status
    if (rv.status === "Ditolak") {
      letter.status = "Ditolak";
    } else if (rv.status === "Direvisi") {
      letter.status = "Sedang Direvisi";
      letter.catatan.unshift({
        id: makeId("cat"),
        oleh: reviewer ? reviewer.name : reviewerId,
        peran: "pereview",
        pesan: `Permintaan revisi: ${rv.catatan || "Silakan revisi dokumen sesuai arahan reviewer."}`,
        createdAt: nowIso()
      });
    } else {
      const allApproved = letter.reviewHistory.every(r => r.status === "Disetujui");
      if (allApproved) letter.status = letter.penandatanganId ? "Menunggu TTD" : "Selesai";
    }

    letter.updatedAt = nowIso();
    await writeDb(db);
    sendJson(res, 200, { letter });
    return;
  }

  // POST /api/letters/:id/signature
  if (req.method === "POST" && action === "signature") {
    const body = await parseBody(req);
    const { userId, image, nama, jabatan } = body;
    if (!nama) { sendJson(res, 400, { error: "Nama penandatangan wajib diisi" }); return; }

    letter.tandaTangan = {
      image: image || null,
      nama: String(nama).trim(),
      jabatan: String(jabatan || "").trim(),
      userId: userId || null,
      signedAt: nowIso()
    };
    letter.status    = "Ditandatangani";
    letter.updatedAt = nowIso();
    addHistory(letter, `Ditandatangani oleh ${letter.tandaTangan.nama}`, letter.tandaTangan.nama);
    await writeDb(db);
    sendJson(res, 201, { letter });
    return;
  }

  // POST /api/letters/:id/submit  (submit for review)
  if (req.method === "POST" && action === "submit") {
    if (letter.reviewerIds.length === 0) { sendJson(res, 400, { error: "Tambahkan reviewer terlebih dahulu" }); return; }
    letter.status    = "Menunggu Review";
    (letter.reviewHistory || []).forEach(r => {
      if (r.status === "Direvisi" || r.status === "Ditolak") {
        r.status = "Menunggu";
        r.reviewedAt = null;
      }
    });
    letter.updatedAt = nowIso();
    addHistory(letter, "Surat disubmit untuk review", letter.pembuatNama);
    await writeDb(db);
    sendJson(res, 200, { letter });
    return;
  }

  // POST /api/letters/:id/request-revision (dari penandatangan)
  if (req.method === "POST" && action === "request-revision") {
    const body = await parseBody(req);
    const { userId, catatan } = body;
    if (!catatan) { sendJson(res, 400, { error: "Catatan revisi wajib diisi" }); return; }

    const signer = db.users.find(u => u.id === userId);
    const revision = {
      id: makeId("srv"),
      signerId: userId || null,
      signerNama: signer ? signer.name : "Penandatangan",
      catatan: String(catatan).trim(),
      attachments: saveReviewAttachments(body.attachments),
      createdAt: nowIso()
    };
    letter.signerRevisions = letter.signerRevisions || [];
    letter.signerRevisions.unshift(revision);
    letter.status = "Sedang Direvisi";
    letter.catatan.unshift({
      id: makeId("cat"),
      oleh: revision.signerNama,
      peran: "penandatangan",
      pesan: `Permintaan revisi dari penandatangan: ${catatan}`,
      createdAt: revision.createdAt
    });
    // Reset status reviewer agar harus approve ulang setelah revisi
    (letter.reviewHistory || []).forEach(r => {
      if (r.status === "Disetujui") {
        r.status = "Menunggu";
        r.reviewedAt = null;
      }
    });
    letter.updatedAt = nowIso();
    addHistory(letter, `Revisi diminta penandatangan: ${catatan}`, revision.signerNama);
    await writeDb(db);
    sendJson(res, 200, { letter });
    return;
  }

  sendJson(res, 405, { error: "Metode tidak didukung" });
}

/* ──────────────────── Static File Server ────────────────── */
function serveStatic(req, res, pathname) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const resolved  = path.resolve(PUBLIC_DIR, `.${requested}`);

  if (!resolved.startsWith(PUBLIC_DIR)) {
    res.writeHead(403); res.end("Forbidden"); return;
  }

  fs.readFile(resolved, (err, content) => {
    if (err) {
      // SPA fallback — serve index.html for unknown paths
      fs.readFile(path.join(PUBLIC_DIR, "index.html"), (err2, html) => {
        if (err2) { res.writeHead(404); res.end("Not found"); return; }
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(html);
      });
      return;
    }
    const mime = MIME_TYPES[path.extname(resolved)] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": mime });
    res.end(content);
  });
}

/* ─────────────────────── HTTP Server ────────────────────── */
function createServer() {
  ensurePostgresReady().catch(err => console.error("PostgreSQL init gagal:", formatErrorMessage(err)));
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/")) {
      try { await handleApi(req, res, url.pathname); }
      catch (e) { sendJson(res, 500, { error: formatErrorMessage(e) }); }
      return;
    }
    serveStatic(req, res, url.pathname);
  });
}

function startServer(port = PORT) {
  const server = createServer();
  server.listen(port, HOST, () => {
    const p = server.address().port;
    console.log(`\n🚀  LetterFlow Enterprise berjalan`);
    console.log(`   Local  : http://localhost:${p}`);
    for (const addr of getLanAddresses()) {
      console.log(`   WiFi   : http://${addr}:${p}`);
    }
    console.log("\n   Tekan Ctrl+C untuk menghentikan server.\n");
  });
  return server;
}

if (require.main === module) startServer(PORT);

module.exports = { createServer, startServer };

