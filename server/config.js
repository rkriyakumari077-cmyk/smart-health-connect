// Central configuration. Everything can be overridden with environment
// variables (see .env.example). Defaults run with zero setup on SQLite.
const path = require('node:path');
const fs = require('node:fs');

// Tiny .env loader so students don't need the dotenv package.
const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const root = path.join(__dirname, '..');

module.exports = {
  root,
  port: Number(process.env.PORT || 3000),
  dbClient: (process.env.DB_CLIENT || 'sqlite').toLowerCase(), // 'sqlite' | 'mysql'
  sqliteFile: process.env.SQLITE_FILE || path.join(root, 'data', 'smart-health.db'),
  mysql: {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'smart_health_connect',
  },
  tokenSecret: process.env.SHC_SECRET || null, // generated and stored in data/.secret if empty
  tokenDays: 7,
  reminderEveryMinutes: 15,
};
