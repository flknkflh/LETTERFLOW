const fs = require("fs");
const { Pool } = require("pg");

const pool = new Pool(process.env.DATABASE_URL ? {
  connectionString: process.env.DATABASE_URL
} : {
  host: process.env.PGHOST || "localhost",
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || "surat_online",
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD || "postgres",
});

function toJson(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") {
    try { return JSON.parse(value); } catch { return fallback; }
  }
  return value;
}

function rowToUser(row) {
  return {
    ...toJson(row.data, {}),
    id: row.id,
    name: row.name,
    nip: row.nip,
    password: row.password,
    role: row.role,
    avatar: row.avatar,
    unit: row.unit || ""
  };
}

function rowToLetter(row) {
  return {
    ...toJson(row.data, {}),
    id: row.id,
    nomor: row.nomor,
    perihal: row.perihal,
    kategori: row.kategori,
    prioritas: row.prioritas,
    status: row.status,
    pembuatId: row.pembuat_id,
    pembuatNama: row.pembuat_nama,
    pembuatUnit: row.pembuat_unit,
    penandatanganId: row.penandatangan_id,
    createdAt: row.created_at ? row.created_at.toISOString() : row.created_at,
    updatedAt: row.updated_at ? row.updated_at.toISOString() : row.updated_at
  };
}

async function query(text, params) {
  return pool.query(text, params);
}

async function initPostgres(seedFile, migrateDatabase) {
  await query(`
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      nip TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      avatar TEXT,
      unit TEXT,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS letters (
      id TEXT PRIMARY KEY,
      nomor TEXT,
      perihal TEXT,
      kategori TEXT,
      prioritas TEXT,
      status TEXT,
      pembuat_id TEXT,
      pembuat_nama TEXT,
      pembuat_unit TEXT,
      penandatangan_id TEXT,
      created_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ,
      data JSONB NOT NULL DEFAULT '{}'::jsonb
    );

    CREATE INDEX IF NOT EXISTS idx_letters_nomor ON letters (nomor);
    CREATE INDEX IF NOT EXISTS idx_letters_perihal ON letters (perihal);
    CREATE INDEX IF NOT EXISTS idx_letters_kategori ON letters (kategori);
    CREATE INDEX IF NOT EXISTS idx_letters_status ON letters (status);
    CREATE INDEX IF NOT EXISTS idx_letters_pembuat ON letters (pembuat_id);
    CREATE INDEX IF NOT EXISTS idx_letters_data_gin ON letters USING GIN (data);
    CREATE INDEX IF NOT EXISTS idx_users_name ON users (name);
    CREATE INDEX IF NOT EXISTS idx_users_nip ON users (nip);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
  `);

  const count = await query("SELECT COUNT(*)::int AS total FROM users");
  if (count.rows[0].total === 0 && fs.existsSync(seedFile)) {
    const seed = migrateDatabase(JSON.parse(fs.readFileSync(seedFile, "utf8")));
    await writeState(seed);
  }
}

async function readState() {
  const [metaResult, userResult, letterResult] = await Promise.all([
    query("SELECT value FROM app_meta WHERE key = 'meta'"),
    query("SELECT * FROM users ORDER BY role = 'super-admin' DESC, name ASC"),
    query("SELECT * FROM letters ORDER BY COALESCE(updated_at, created_at) DESC NULLS LAST")
  ]);

  return {
    meta: metaResult.rows[0] ? toJson(metaResult.rows[0].value, {}) : {},
    users: userResult.rows.map(rowToUser),
    letters: letterResult.rows.map(rowToLetter)
  };
}

async function writeState(db) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM letters");
    await client.query("DELETE FROM users");
    await client.query(
      `INSERT INTO app_meta(key, value)
       VALUES('meta', $1::jsonb)
       ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value`,
      [JSON.stringify(db.meta || {})]
    );

    for (const user of db.users || []) {
      await client.query(
        `INSERT INTO users(id, name, nip, password, role, avatar, unit, data)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
        [
          user.id, user.name, user.nip, user.password, user.role,
          user.avatar || "", user.unit || "", JSON.stringify(user)
        ]
      );
    }

    for (const letter of db.letters || []) {
      await client.query(
        `INSERT INTO letters(
          id, nomor, perihal, kategori, prioritas, status, pembuat_id,
          pembuat_nama, pembuat_unit, penandatangan_id, created_at, updated_at, data
        ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)`,
        [
          letter.id, letter.nomor || "", letter.perihal || "", letter.kategori || "",
          letter.prioritas || "", letter.status || "", letter.pembuatId || "",
          letter.pembuatNama || "", letter.pembuatUnit || "", letter.penandatanganId || "",
          letter.createdAt || null, letter.updatedAt || null, JSON.stringify(letter)
        ]
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

function roleFilterSql(role, userId, startIndex = 1) {
  const params = [];
  if (!role || role === "super-admin" || role === "pemonitor") return { clause: "TRUE", params };
  params.push(userId || "");
  if (role === "pembuat") return { clause: `pembuat_id = $${startIndex}`, params };
  if (role === "penandatangan") return { clause: `penandatangan_id = $${startIndex}`, params };
  if (role === "pereview") return { clause: `data->'reviewerIds' ? $${startIndex}`, params };
  return { clause: "FALSE", params };
}

async function searchLetters({ role, userId, mode, category, q }) {
  const params = [];
  const roleFilter = roleFilterSql(role, userId, 1);
  params.push(...roleFilter.params);
  let next = params.length + 1;

  const where = [roleFilter.clause];
  const term = String(q || "").trim();
  const selectedCategory = String(category || "").trim();

  if (term) {
    params.push(`%${term}%`);
    const p = `$${next++}`;
    if (mode === "category" && selectedCategory) {
      const columnMap = {
        nomor: "nomor",
        perihal: "perihal",
        kategori: "kategori",
        status: "status",
        prioritas: "prioritas",
        pembuatNama: "pembuat_nama",
        pembuatUnit: "pembuat_unit",
        penandatanganId: "penandatangan_id",
        ringkasan: "data->>'ringkasan'"
      };
      const column = columnMap[selectedCategory] || "perihal";
      where.push(`${column} ILIKE ${p}`);
    } else {
      where.push(`(
        nomor ILIKE ${p} OR perihal ILIKE ${p} OR kategori ILIKE ${p} OR status ILIKE ${p}
        OR prioritas ILIKE ${p} OR pembuat_nama ILIKE ${p} OR pembuat_unit ILIKE ${p}
        OR data->>'ringkasan' ILIKE ${p}
      )`);
    }
  } else if (mode === "category" && selectedCategory) {
    const columnMap = {
      nomor: "nomor",
      perihal: "perihal",
      kategori: "kategori",
      status: "status",
      prioritas: "prioritas",
      pembuatNama: "pembuat_nama",
      pembuatUnit: "pembuat_unit",
      penandatanganId: "penandatangan_id"
    };
    const column = columnMap[selectedCategory];
    if (column) where.push(`COALESCE(${column}, '') <> ''`);
  }

  const result = await query(
    `SELECT * FROM letters
     WHERE ${where.join(" AND ")}
     ORDER BY COALESCE(updated_at, created_at) DESC NULLS LAST
     LIMIT 100`,
    params
  );
  return result.rows.map(rowToLetter);
}

async function searchUsers({ q, category }) {
  const params = [];
  const where = [];
  const term = String(q || "").trim();
  const selectedCategory = String(category || "").trim();
  if (term) {
    params.push(`%${term}%`);
    const columnMap = { name: "name", nip: "nip", role: "role", unit: "unit" };
    const column = selectedCategory && columnMap[selectedCategory] ? columnMap[selectedCategory] : null;
    if (column) where.push(`${column} ILIKE $1`);
    else where.push("(name ILIKE $1 OR nip ILIKE $1 OR role ILIKE $1 OR unit ILIKE $1)");
  }
  const result = await query(
    `SELECT * FROM users ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY role = 'super-admin' DESC, name ASC
     LIMIT 100`,
    params
  );
  return result.rows.map(({ password: _, ...row }) => rowToUser(row));
}

module.exports = {
  initPostgres,
  readState,
  writeState,
  searchLetters,
  searchUsers
};
