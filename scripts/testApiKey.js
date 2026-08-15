const fs = require('fs');
const https = require('https');

const settings = JSON.parse(fs.readFileSync('C:\\ERP\\FlorapriseApi\\appsettings.json', 'utf8'));
const websiteKey = settings.WebsiteApiKey;
const base = 'https://api.floraprise.com';

const headers = [
  { 'X-Api-Key': websiteKey },
  { 'X-Website-Api-Key': websiteKey },
  { 'WebsiteApiKey': websiteKey },
  { 'Authorization': `ApiKey ${websiteKey}` },
  { 'Authorization': `Bearer ${websiteKey}` },
  { 'Authorization': `ApiKeyV1 ${websiteKey}` },
];

function request(extraHeaders) {
  return new Promise((resolve) => {
    const req = https.request(
      new URL('/api/products', base),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...extraHeaders },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () =>
          resolve({
            headers: extraHeaders,
            status: res.statusCode,
            body: data.slice(0, 300).replace(/\s+/g, ' '),
            wwwAuth: res.headers['www-authenticate'],
          })
        );
      }
    );
    req.on('error', (err) => resolve({ headers: extraHeaders, status: 'ERR', body: err.message }));
    req.setTimeout(10000, () => { req.destroy(); resolve({ headers: extraHeaders, status: 'TIMEOUT' }); });
    req.write(JSON.stringify({}));
    req.end();
  });
}

(async () => {
  for (const h of headers) {
    const r = await request(h);
    console.log(Object.keys(r.headers)[0], r.status, r.wwwAuth || '', r.body.slice(0, 80));
  }
})();
