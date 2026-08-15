const fs = require('fs');
const s = JSON.parse(fs.readFileSync('C:\\floraprise.com\\flora\\scripts\\openapi-summary.json', 'utf8'));

console.log('=== SECURITY SCHEMES ===');
console.log(JSON.stringify(s.securitySchemes, null, 2));

console.log('\n=== AUTH OPERATIONS ===');
for (const op of s.auth) {
  console.log('\n' + op.method.toUpperCase(), op.path);
  console.log('  operationId:', op.operationId);
  console.log('  tags:', op.tags);
  if (op.requestSchema) console.log('  request:', JSON.stringify(op.requestSchema, null, 2).slice(0, 1500));
  if (op.responses) {
    for (const [code, r] of Object.entries(op.responses)) {
      console.log('  response', code, ':', r ? JSON.stringify(r, null, 2).slice(0, 1500) : 'empty');
    }
  }
}

console.log('\n=== PRODUCT OPERATIONS ===');
for (const op of s.products) {
  console.log('\n' + op.method.toUpperCase(), op.path);
  console.log('  operationId:', op.operationId);
  console.log('  tags:', op.tags);
  if (op.parameters && op.parameters.length) console.log('  params:', JSON.stringify(op.parameters, null, 2));
  if (op.requestSchema) console.log('  request:', JSON.stringify(op.requestSchema, null, 2).slice(0, 1500));
  if (op.responses) {
    for (const [code, r] of Object.entries(op.responses)) {
      console.log('  response', code, ':', r ? JSON.stringify(r, null, 2).slice(0, 1500) : 'empty');
    }
  }
}

console.log('\n=== DESIGN/GALLERY/CATALOG OPERATIONS ===');
for (const op of s.designGallery) {
  console.log('\n' + op.method.toUpperCase(), op.path);
  console.log('  operationId:', op.operationId);
  console.log('  tags:', op.tags);
  if (op.requestSchema) console.log('  request:', JSON.stringify(op.requestSchema, null, 2).slice(0, 1200));
  if (op.responses) {
    for (const [code, r] of Object.entries(op.responses)) {
      console.log('  response', code, ':', r ? JSON.stringify(r, null, 2).slice(0, 1200) : 'empty');
    }
  }
}

console.log('\n=== MEMBER/COMPANY/PRODUCT SCHEMAS ===');
for (const [n, sch] of Object.entries(s.schemas)) {
  console.log('\n' + n);
  console.log('  required:', sch.required);
  console.log('  properties:', JSON.stringify(sch.properties, null, 2).slice(0, 1200));
}
