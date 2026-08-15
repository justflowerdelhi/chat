const fs = require('fs');
const { Pool } = require('pg');

const settings = JSON.parse(fs.readFileSync('C:\\ERP\\FlorapriseApi\\appsettings.json', 'utf8'));
const raw = settings.ConnectionStrings.Default;
const kv = Object.fromEntries(raw.split(';').map((p) => p.trim().split('=').map((s) => s.trim())));
const user = kv.Username || kv.username;
const pass = kv.Password || kv.password;
const host = kv.Host || kv.host;
const port = kv.Port || kv.port;
const db = kv.Database || kv.database;
const connStr = `postgres://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${encodeURIComponent(host)}:${port}/${encodeURIComponent(db)}`;

const pool = new Pool({ connectionString: connStr, connectionTimeoutMillis: 15000, query_timeout: 15000 });

(async () => {
  try {
    const tables = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`
    );
    console.log('=== TABLES ===');
    console.log(tables.rows.map((r) => r.table_name).join('\n'));

    const targetTables = ['members', 'users', 'companies', 'api_keys', 'api_tokens', 'refresh_tokens', 'products', 'designs', 'design_gallery', 'product_images', 'catalog', 'categories', 'occasions', 'flowers'];
    for (const t of targetTables) {
      if (tables.rows.some((r) => r.table_name === t)) {
        const cols = await pool.query(
          `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 AND table_schema = 'public' ORDER BY ordinal_position`,
          [t]
        );
        console.log(`\n=== ${t} columns ===`);
        cols.rows.forEach((r) => console.log(`${r.column_name} ${r.data_type}`));
        const count = await pool.query(`SELECT COUNT(*)::int AS count FROM "${t}"`);
        console.log(`count: ${count.rows[0].count}`);
      }
    }
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
