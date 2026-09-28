// Database adapter.
// The rest of the app only calls db.all / db.get / db.run / db.tx, so the same
// SQL runs on SQLite (default, zero setup) and on MySQL (set DB_CLIENT=mysql).
// Rules we follow to keep SQL portable:
//   - only "?" placeholders, no dialect-specific functions (dates are computed in JS)
//   - dates stored as 'YYYY-MM-DD', times as 'HH:MM', timestamps as ISO strings
//   - JSON stored as TEXT and parsed in JavaScript
const fs = require('node:fs');
const path = require('node:path');
const config = require('../config');

let impl = null;

const clean = (params = []) =>
  params.map((v) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v));

function schemaSql(client) {
  const pk = client === 'mysql' ? 'INTEGER PRIMARY KEY AUTO_INCREMENT' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
  return fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8').replaceAll('{{PK}}', pk);
}

const INDEXES = [
  'CREATE INDEX idx_appt_doctor_date ON appointments (doctor_id, appt_date)',
  'CREATE INDEX idx_appt_patient ON appointments (patient_id)',
  'CREATE INDEX idx_tb_patient ON test_bookings (patient_id)',
  'CREATE INDEX idx_tb_status ON test_bookings (status)',
  'CREATE INDEX idx_donor_group ON donors (blood_group)',
  'CREATE INDEX idx_notif_user ON notifications (user_id, is_read)',
  'CREATE INDEX idx_ai_patient ON ai_consult_logs (patient_id)',
];

async function initSqlite() {
  let DatabaseSync;
  try {
    ({ DatabaseSync } = require('node:sqlite'));
  } catch {
    throw new Error(
      `Built-in SQLite needs Node.js 22.13 or newer (you have ${process.version}). ` +
        'Install the current LTS from nodejs.org, or set DB_CLIENT=mysql.'
    );
  }
  fs.mkdirSync(path.dirname(config.sqliteFile), { recursive: true });
  const db = new DatabaseSync(config.sqliteFile);
  db.exec('PRAGMA foreign_keys = ON;');
  if (config.sqliteFile !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');

  impl = {
    client: 'sqlite',
    async all(sql, params) {
      return db.prepare(sql).all(...clean(params)).map((r) => ({ ...r }));
    },
    async get(sql, params) {
      const row = db.prepare(sql).get(...clean(params));
      return row ? { ...row } : null;
    },
    async run(sql, params) {
      const r = db.prepare(sql).run(...clean(params));
      return { insertId: Number(r.lastInsertRowid), changes: Number(r.changes) };
    },
    async exec(sql) {
      db.exec(sql);
    },
    // node:sqlite is synchronous, so as long as the callback only awaits db
    // calls, no other request can run in the middle of the transaction.
    async tx(fn) {
      db.exec('BEGIN');
      try {
        const out = await fn(impl);
        db.exec('COMMIT');
        return out;
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    },
    async close() {
      db.close();
    },
  };
}

async function initMysql() {
  let mysql;
  try {
    mysql = require('mysql2/promise');
  } catch {
    throw new Error('MySQL mode needs the mysql2 package: run "npm install mysql2".');
  }
  const { database, ...conn } = config.mysql;
  // Create the database if it does not exist yet.
  const boot = await mysql.createConnection(conn);
  await boot.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await boot.end();

  const pool = mysql.createPool({ ...conn, database, connectionLimit: 10, multipleStatements: true, dateStrings: true });
  const wrap = (c) => ({
    client: 'mysql',
    async all(sql, params) {
      const [rows] = await c.query(sql, clean(params));
      return rows;
    },
    async get(sql, params) {
      const [rows] = await c.query(sql, clean(params));
      return rows[0] || null;
    },
    async run(sql, params) {
      const [r] = await c.query(sql, clean(params));
      return { insertId: r.insertId, changes: r.affectedRows };
    },
    async exec(sql) {
      await c.query(sql);
    },
  });
  impl = wrap(pool);
  impl.tx = async (fn) => {
    const c = await pool.getConnection();
    try {
      await c.beginTransaction();
      const out = await fn(wrap(c));
      await c.commit();
      return out;
    } catch (err) {
      await c.rollback();
      throw err;
    } finally {
      c.release();
    }
  };
  impl.close = () => pool.end();
}

async function init() {
  if (impl) return impl;
  if (config.dbClient === 'mysql') await initMysql();
  else await initSqlite();
  await impl.exec(schemaSql(impl.client));
  for (const sql of INDEXES) {
    try {
      await impl.exec(sql);
    } catch (err) {
      if (!/exist|Duplicate key name/i.test(err.message)) throw err;
    }
  }
  return impl;
}

// Proxy so modules can `require('./db')` once and call db.get(...) later.
module.exports = new Proxy(
  { init },
  {
    get(target, prop) {
      if (prop === 'init') return init;
      if (prop === 'reset') return () => { impl = null; };
      if (!impl) throw new Error('Database not initialised - call db.init() first');
      return impl[prop];
    },
  }
);
