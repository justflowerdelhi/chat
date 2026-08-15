const fs = require('fs');

const openApi = JSON.parse(fs.readFileSync('C:\\floraprise.com\\flora\\scripts\\openapi.json', 'utf8'));

const paths = openApi.paths || {};
const schemas = (openApi.components && openApi.components.schemas) || {};

function printOperation(path, method, op) {
  console.log(`\n${method.toUpperCase()} ${path}`);
  console.log('  summary:', op.summary || op.operationId || '(none)');
  console.log('  tags:', (op.tags || []).join(', '));
  if (op.requestBody && op.requestBody.content) {
    for (const [ct, body] of Object.entries(op.requestBody.content)) {
      if (body.schema) {
        const ref = body.schema.$ref || JSON.stringify(body.schema);
        console.log('  requestContent:', ct, 'schema:', ref);
      }
    }
  }
  if (op.parameters && op.parameters.length) {
    for (const p of op.parameters) {
      console.log('  param:', p.name, p.in, p.required ? 'required' : 'optional', JSON.stringify(p.schema || {}));
    }
  }
  if (op.responses) {
    for (const [code, resp] of Object.entries(op.responses)) {
      if (resp.content) {
        for (const [ct, body] of Object.entries(resp.content)) {
          console.log('  response', code, ct, 'schema:', body.schema ? (body.schema.$ref || JSON.stringify(body.schema)) : 'none');
        }
      } else {
        console.log('  response', code, '(no content)');
      }
    }
  }
  if (op.security) {
    console.log('  security:', JSON.stringify(op.security));
  }
}

function printSchema(name) {
  const s = schemas[name];
  if (!s) return;
  console.log(`\n=== SCHEMA ${name} ===`);
  console.log(JSON.stringify(s, null, 2).slice(0, 2000));
}

console.log('=== SECURITY SCHEMES ===');
console.log(JSON.stringify((openApi.components && openApi.components.securitySchemes) || {}, null, 2));

console.log('\n=== AUTH PATHS ===');
for (const [path, ops] of Object.entries(paths)) {
  if (/auth/i.test(path)) {
    for (const [method, op] of Object.entries(ops)) {
      if (typeof op === 'object') printOperation(path, method, op);
    }
  }
}

console.log('\n=== PRODUCT / DESIGN / GALLERY PATHS ===');
for (const [path, ops] of Object.entries(paths)) {
  if (/product|design|gallery|catalog|image/i.test(path)) {
    for (const [method, op] of Object.entries(ops)) {
      if (typeof op === 'object') printOperation(path, method, op);
    }
  }
}

const schemaNames = Object.keys(schemas).filter((k) =>
  /Login|Token|Auth|Product|Design|Gallery|Catalog|Image|Price|Member|Company/i.test(k)
);
for (const n of schemaNames) {
  printSchema(n);
}
