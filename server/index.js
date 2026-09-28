// Smart Health Connect — server entry point.
const path = require('node:path');
const express = require('express');
const config = require('./config');
const db = require('./db');
const { seed, DEMO_PASSWORD } = require('./db/seed');
const { sendReminders } = require('./services');
const { HttpError } = require('./utils');
const { doctors, appts } = require('./routes/appointments');
const { admin, records } = require('./routes/admin');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '200kb' }));
  app.use((_req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'same-origin');
    next();
  });

  // ----- API -----
  app.get('/api/health', (_req, res) => res.json({ ok: true, db: db.client }));
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/ai', require('./routes/ai'));
  app.use('/api/doctors', doctors);
  app.use('/api/appointments', appts);
  app.use('/api/lab', require('./routes/lab'));
  app.use('/api/blood', require('./routes/blood'));
  app.use('/api/admin', admin);
  app.use('/api/records', records);
  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'API route not found')));

  // ----- Frontend -----
  app.get('/vendor/jspdf.umd.min.js', (_req, res) =>
    res.sendFile(path.join(config.root, 'node_modules', 'jspdf', 'dist', 'jspdf.umd.min.js'))
  );
  app.use(express.static(path.join(config.root, 'public'), { extensions: ['html'] }));

  // ----- Errors -----
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body is not valid JSON' });
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? 'Something went wrong on the server. Please try again.' : err.message });
  });
  return app;
}

async function start() {
  await db.init();
  const seeded = await seed();
  const app = createApp();
  const run = () => sendReminders().catch((e) => console.error('Reminder job failed:', e.message));
  await run();
  setInterval(run, config.reminderEveryMinutes * 60 * 1000).unref();
  app.listen(config.port, () => {
    console.log(`\n  Smart Health Connect is running → http://localhost:${config.port}`);
    console.log(`  Database: ${db.client}${db.client === 'sqlite' ? ` (${path.relative(config.root, config.sqliteFile)})` : ` (${config.mysql.database})`}`);
    if (seeded) console.log(`  Demo data created. Every demo account uses the password: ${DEMO_PASSWORD}`);
    console.log('  Demo logins: patient@demo.in · doctor@demo.in · lab@demo.in · admin@demo.in\n');
  });
}

if (require.main === module) {
  start().catch((err) => {
    console.error(`\n  Could not start: ${err.message}\n`);
    process.exit(1);
  });
}

module.exports = { createApp, start };
