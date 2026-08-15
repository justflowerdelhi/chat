const fs = require('fs');
const path = require('path');

const envPath = path.resolve('.env.local');
const env = {};
if (fs.existsSync(envPath)) {
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (match) env[match[1]] = match[2].trim();
  }
}

const keys = [
  'FLORAPRISE_ERP_API_URL',
  'FLORAPRISE_ERP_EMAIL',
  'FLORAPRISE_ERP_PASSWORD',
];

const present = [];
const missing = [];

for (const k of keys) {
  const v = process.env[k];
  if (v && v.trim().length > 0) present.push(k);
  else missing.push(k);
}

console.log('Present:', present.join(', ') || '(none)');
console.log('Missing:', missing.join(', ') || '(none)');
