const fs = require('fs');

const openApi = JSON.parse(fs.readFileSync('C:\\floraprise.com\\flora\\scripts\\openapi.json', 'utf8'));
const paths = openApi.paths || {};
const schemas = openApi.components && openApi.components.schemas || {};

const schemaNames = [
  'SellableFinishedGoodDto',
  'FinishedGoodsBatchDto',
  'CustomBouquetComponent',
  'CustomBouquetRequest',
  'CustomBouquetSaveRequest',
  'MobileBootstrapResponse',
  'MobileBootstrapCompanyDto',
  'MobileBootstrapUserDto',
  'LoginRequest',
  'MobileApiLoginRequest',
  'MobileAuthTokenResponse',
  'ProductSettingsRequest',
  'CreateProductRequest',
  'UpdateProductRequest',
  'InventoryProductDto',
];

for (const n of schemaNames) {
  if (schemas[n]) {
    console.log('\n=== SCHEMA:', n, '===');
    console.log(JSON.stringify(schemas[n], null, 2).slice(0, 2500));
  }
}

console.log('\n=== AUTH ENDPOINTS ===');
for (const [path, ops] of Object.entries(paths)) {
  if (/auth/i.test(path)) {
    for (const [method, op] of Object.entries(ops)) {
      if (typeof op === 'object') {
        console.log(method.toUpperCase(), path, '->', op.operationId);
      }
    }
  }
}

console.log('\n=== PRODUCT / FINISHED-GOOD / CATALOG / BOUQUET ENDPOINTS ===');
for (const [path, ops] of Object.entries(paths)) {
  if (/product|finished|bouquet|catalog|design|gallery|recipe/i.test(path)) {
    for (const [method, op] of Object.entries(ops)) {
      if (typeof op === 'object') {
        console.log(method.toUpperCase(), path, '->', op.operationId);
      }
    }
  }
}
