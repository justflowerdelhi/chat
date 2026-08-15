const fs = require('fs');

const files = [
  'C:\\ERP\\FlorapriseApi\\Sumpooj.API.dll',
  'C:\\ERP\\FlorapriseApi\\Sumpooj.Application.dll',
  'C:\\ERP\\FlorapriseApi\\Sumpooj.Domain.dll',
  'C:\\ERP\\FlorapriseApi\\Sumpooj.Infrastructure.dll',
];

const patterns = [
  /\[controller\]/gi,
  /Auth/i,
  /Login/i,
  /Token/i,
  /Refresh/i,
  /Product/i,
  /Design/i,
  /Gallery/i,
  /Catalog/i,
  /Image/i,
  /Price/i,
  /Availability/i,
  /Occasion/i,
  /Flower/i,
  /Bouquet/i,
  /Member/i,
  /Company/i,
  /Business/i,
  /\/api\//i,
  /api\./i,
];

function extractUtf16le(buf) {
  const out = [];
  let i = 0;
  while (i < buf.length - 2) {
    if (buf[i + 1] === 0 && buf[i] >= 0x20 && buf[i] < 0x80 && i < buf.length - 4) {
      let s = '';
      let j = i;
      while (j < buf.length - 1) {
        const lo = buf[j];
        const hi = buf[j + 1];
        if (hi !== 0) break;
        if (lo === 0) break;
        if (lo < 0x20 || lo > 0x7e) break;
        s += String.fromCharCode(lo);
        j += 2;
      }
      if (s.length >= 4) {
        out.push(s);
      }
      i = j;
    } else {
      i++;
    }
  }
  return out;
}

function extractAscii(buf) {
  const out = [];
  let i = 0;
  while (i < buf.length) {
    if (buf[i] >= 0x20 && buf[i] < 0x80) {
      let s = '';
      let j = i;
      while (j < buf.length && buf[j] >= 0x20 && buf[j] < 0x80) {
        s += String.fromCharCode(buf[j]);
        j++;
      }
      if (s.length >= 4) {
        out.push(s);
      }
      i = j;
    } else {
      i++;
    }
  }
  return out;
}

const found = new Set();
for (const f of files) {
  if (!fs.existsSync(f)) continue;
  const buf = fs.readFileSync(f);
  const list = extractUtf16le(buf);
  for (const s of list) {
    if (patterns.some((p) => p.test(s))) {
      found.add(s);
    }
  }
}

for (const s of [...found].sort()) {
  console.log(s);
}
