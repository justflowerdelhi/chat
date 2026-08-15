# Floraprise Cloud ERP → API Authentication & Design Gallery Discovery

**Scope:** Discovery only — no sync implemented, no database modified, no secrets exposed.

## 1. ERP Source/Deployment Location

- The backend API is the compiled .NET 10 application `Sumpooj.API.dll` in `C:\ERP\FlorapriseApi\`.
- `C:\ERP\FlorapriseApi\appsettings.json` and the production override files contain `Jwt:Key`, `Jwt:Issuer`, the PostgreSQL connection string, and a `WebsiteApiKey`.
- The `erp.floraprise.com` site is a static Next.js build under `C:\ERP\floraprise.com\` (or `C:\Inetpub\vhosts\floraprise.com\httpdocs\`). The unpacked static files contain no API client or authentication implementation — the ERP user interface talks to the same `api.floraprise.com` backend described below.

## 2. Authentication Mechanism

The API uses **JWT Bearer** authentication (`bearer` security scheme in the OpenAPI document).

### Login endpoints

| Method | Path | Purpose | Request body |
|---|---|---|---|
| `POST` | `/api/auth/login` | Web/ERP user login | `{ "email": "", "password": "" }` (schema `LoginRequest`) |
| `POST` | `/api/auth/refresh` | Exchange refresh token for a new token pair | `{ "refreshToken": "" }` (schema `RefreshRequest`) |
| `POST` | `/api/auth/revoke` | Revoke the current refresh token | `{ "refreshToken": "" }` |
| `GET`  | `/api/auth/me` | Get current user/context | — |
| `POST` | `/api/v1/mobile/auth/login` | Mobile app login | `MobileApiLoginRequest` (requires `companyId`, `identifier`, `password`, `deviceId`, `platform`, `appVersion`, …) |
| `POST` | `/api/v1/mobile/auth/refresh` | Mobile token refresh | `MobileApiRefreshRequest` (`{ "refreshToken": "" }`) |
| `POST` | `/api/v1/mobile/auth/logout` | Mobile session revoke | `MobileApiLogoutRequest` |

### Token response shape

The documented mobile response (`MobileAuthTokenResponse`) is:

```json
{
  "accessToken": "jwt-string",
  "refreshToken": "refresh-string",
  "expiresAtUtc": "2026-07-28T10:30:00Z",
  "companyId": "00000000-0000-0000-0000-000000000000",
  "mobileUserId": "...",
  "mobileDeviceId": "...",
  "bootstrap": { /* MobileBootstrapResponse */ }
}
```

The web `POST /api/auth/login` response is not fully described in the OpenAPI; it most likely returns the `accessToken`/`refreshToken` pair (or a plain JWT string), but this should be confirmed with a real login call.

### Authorization header

All authenticated calls must include:

```
Authorization: Bearer <accessToken>
```

### Token refresh

- Send the current `refreshToken` to `POST /api/auth/refresh`.
- The old refresh token is revoked/rotated on use.
- The response returns a new `accessToken` + `refreshToken` + `expiresAtUtc`.

## 3. Florist / Business Identification

- The API uses a **UUID `companyId`** for tenant/business identification (`MobileBootstrapCompanyDto` has `id`, `name`, `currency`, `region`, `timeZone`, `taxIdentifier`).
- There is **no `member_id` field** in the API contract.
- The AI database currently uses an integer `member_id` (e.g. `Just Flowers` = `1`). To reuse the ERP auth, store the ERP `companyId` UUID as an `external_company_id` column in `members` or `business_profiles` and map it at runtime to the AI `member_id`.

## 4. ERP → API Request Mechanism

- The ERP (and therefore the Floraprise AI server) must call `https://api.floraprise.com` over HTTPS.
- Requests must set `Authorization: Bearer <token>`.
- The `WebsiteApiKey` from `appsettings.json` is **not** an API Bearer token; it is used for website-specific integration and was verified to return `401` against `/api/products`.
- The `Sumpooj.API` backend validates the JWT using the `Jwt:Key` and `Jwt:Issuer` from its `appsettings.json`.

## 5. Product / Design Gallery Data Endpoints

There is **no endpoint explicitly named “Design Gallery”** in the OpenAPI. The product/design data is spread across these groups:

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/products/search` | Product list. Query params: `Query`, `ProductType`, `Category`, `IsActive`, `IsPerishable`, `LowStockOnly`, `Page`, `PageSize`. Response schema is not documented. |
| `GET` | `/api/products/{id}` | Single product by UUID. Response schema not documented. |
| `POST` | `/api/products` | Create a product (schema `CreateProductRequest`). |
| `PUT` | `/api/products/{id}` | Update a product (schema `UpdateProductRequest`). |
| `GET` | `/api/inventory/products` | Inventory products used for bouquet building. Returns `InventoryProductDto[]`. |
| `GET` | `/api/production/finished-goods/sellable` | Sellable finished bouquets/goods. Returns `SellableFinishedGoodDto[]`. |
| `GET` | `/api/production/finished-goods` | Finished batches. Returns `FinishedGoodsBatchDto[]`. |
| `GET` | `/api/production/recipes` | Production recipes (GET/POST). Likely the catalog of saved bouquet designs. |
| `GET` | `/api/ai/bouquet-recipes` | Saved AI bouquet recipes. Response schema not documented. |
| `POST` | `/api/ai/bouquet-recipes` | Save an AI bouquet recipe (schema `SaveBouquetRecipeRequest`). |
| `POST` | `/api/ai/analyze-bouquet` | AI image analysis. Request/response not documented. |

## 6. Key Schemas

### Product create/update (`CreateProductRequest` / `UpdateProductRequest`)

- `productName`, `sku`, `barcode`, `productType`, `category`, `categoryId` (UUID), `brand`, `description`, `tags[]`, `unitOfMeasure`
- `retailPrice`, `costPrice`, `wholesalePrice`, `weddingEventPrice`
- `taxRuleId`, `taxCategory`, `trackInventory`, `trackBatch`, `openingStock`, `reorderLevel`, `shelfLifeDays`, `expiryAlertDays`, `temperatureNotes`
- `isMultiUnit`, `avgUnitsPerStem`
- `flowerAttributes`: `{ color?, variety?, grade?, countryOfOrigin?, seasonality[] }`
- `settings`: `{ status, allowAsRawMaterial, availableOnline, commissionEligible }`

### Sellable finished goods (`SellableFinishedGoodDto`)

- `id`, `name`, `sku`, `barcode?`, `category`, `productType`, `retailPrice`, `costPrice`, `stockQuantity`, `isActive`, `isPerishable`
- `recipeId`, `recipeName`, `batchCode`, `locationId`, `locationName`

### Custom / saved bouquet (`CustomBouquetRequest` / `SaveBouquetRecipeRequest`)

- `name`, `category?`, `style?`, `shape?`, `height?`
- `components[]`: `productId` / `flower`, `productName` / `color`, `quantity` / `stems`, `unitCost`
- `sellingPrice`, `laborCost?`, `image?` (string URL/base64), `locationId`

## 7. Recommended Secure Floraprise AI Integration

1. **Machine user per florist**: Create or reuse a service/login account in the ERP for each florist (e.g. `ai-bot@justflowers.com`).
2. **Map tenants**: Add `external_company_id` (UUID) to the AI `members` / `business_profiles` table and map it to the existing `member_id`.
3. **Token management at the server**:
   - Call `POST /api/auth/login` with the service account and store the returned `accessToken` and `refreshToken` in a secure secret store (not `.env` or source).
   - Use `POST /api/auth/refresh` before `expiresAtUtc` to rotate tokens.
   - Include `Authorization: Bearer <accessToken>` on every product call.
4. **Product/Design Gallery fetch**:
   - Use `GET /api/products/search` (with `ProductType`, `Category`, `IsActive=true`) for the main catalog.
   - Use `GET /api/products/{id}` for individual product details.
   - Complement with `GET /api/production/finished-goods/sellable` for completed/sellable designs and `GET /api/ai/bouquet-recipes` for saved recipes once the response format is validated.
5. **Do not use the offline mobile auth** for the server; use the web `/api/auth/login` path.
6. Do not validate the JWT locally unless necessary; let the API validate `Authorization` headers.

## 8. Exact Credentials / Configuration Still Required

- API base URL: `https://api.floraprise.com` (already used by the ERP).
- Valid service-account `email` and `password` for the pilot florist (`Just Flowers`, AI `member_id = 1`).
- The corresponding ERP `companyId` UUID for that florist (returned in login/bootstrap or via `GET /api/auth/me`).
- Exact token lifetime (to know when to refresh) — not present in the OpenAPI, must be measured.
- `ProductType` / `Category` values used by the florist to flag “Design Gallery” items.
- The actual response schemas for `GET /api/products/search` and `GET /api/products/{id}` (they are not declared in the public OpenAPI).
- Network/CORS permission for the AI server to reach `api.floraprise.com`.
- A secure secret store for `FLORAPRISE_API_USER`, `FLORAPRISE_API_PASSWORD`, and the per-florist access/refresh tokens.

---

*This report is based on the deployed ERP configuration at `C:\ERP\FlorapriseApi\appsettings*.json`, the API OpenAPI document at `https://api.floraprise.com/openapi/v1/openapi.json`, and the static ERP front-end build. No live credentials were used and no database was modified.*
