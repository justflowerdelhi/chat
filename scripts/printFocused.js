const fs = require('fs');
const s = JSON.parse(fs.readFileSync('C:\\floraprise.com\\flora\\scripts\\openapi-summary.json', 'utf8'));

console.log('=== SECURITY SCHEMES ===');
console.log(JSON.stringify(s.securitySchemes, null, 2));

console.log('\n=== AUTH OPERATIONS ===');
for (const op of s.auth) {
  console.log(op.method.toUpperCase(), op.path, '->', op.operationId, 'tags:', op.tags);
  if (op.requestSchema) {
    console.log('  request:', JSON.stringify(op.requestSchema, null, 2).slice(0, 1200));
  }
  for (const [code, r] of Object.entries(op.responses)) {
    if (r) console.log('  response', code, ':', JSON.stringify(r, null, 2).slice(0, 1500));
  }
}

console.log('\n=== PRODUCT OPERATION IDs ===');
for (const op of s.products) {
  console.log(op.method.toUpperCase(), op.path, '->', op.operationId);
}

console.log('\n=== DESIGN/GALLERY/CATALOG OPERATION IDs ===');
for (const op of s.designGallery) {
  console.log(op.method.toUpperCase(), op.path, '->', op.operationId);
}

console.log('\n=== RELEVANT SCHEMAS ===');
const keep = [
  'LoginRequest',
  'LoginResponse',
  'AuthToken',
  'ProductDto',
  'ProductListItem',
  'ProductListDto',
  'ProductResponse',
  'ProductListResponse',
  'GetProductsRequest',
  'GetProductRequest',
  'ProductSearchRequest',
  'MemberDto',
  'CompanyDto',
  'CompanyResponse',
  'CreateProductRequest',
  'UpdateProductRequest',
  'ProductSettingsRequest',
  'InventoryProductDto',
  'ProductBarcodeInfo',
  'ProductProfitDto',
];
for (const n of keep) {
  if (s.schemas[n]) {
    console.log('\n===', n, '===');
    console.log(JSON.stringify(s.schemas[n], null, 2).slice(0, 2000));
  }
}
