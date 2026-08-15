const fs = require('fs');
const openApi = JSON.parse(fs.readFileSync('C:\\floraprise.com\\flora\\scripts\\openapi.json', 'utf8'));
const schemas = openApi.components && openApi.components.schemas || {};

const names = [
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
  'AuthToken',
  'RefreshTokenRequest',
  'ProductSettingsRequest',
  'CreateProductRequest',
  'InventoryProductDto',
  'CompanyDto',
  'CompanyResponse',
  'FlowerAttributesRequest',
  'FlowerAttributes',
  'RecipeDto',
  'RecipeResponse',
  'ProductionRecipeDto',
  'BouquetRecipe',
  'SaveBouquetRecipeRequest',
  'AnalyzeBouquetRequest',
  'BouquetRecipeResponse',
  'BouquetRecipeDto',
  'BouquetComponent',
  'FloralRecipe',
  'Recipe',
];

const out = {};
for (const n of names) {
  if (schemas[n]) out[n] = schemas[n];
}

fs.writeFileSync('C:\\floraprise.com\\flora\\scripts\\focused-schemas.json', JSON.stringify(out, null, 2));
console.log('wrote focused-schemas.json');
