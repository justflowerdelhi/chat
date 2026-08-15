
$ErrorActionPreference = "Stop"
$root = "C:\floraprise.com\flora"

$route = Join-Path $root "src\app\api\whatsapp\webhook\route.ts"
$reception = Join-Path $root "src\lib\receptionConversation.ts"

if (!(Test-Path $route)) { throw "Webhook route not found: $route" }
if (!(Test-Path $reception)) { throw "Reception conversation not found: $reception" }
if (!(Test-Path (Join-Path $root "src\lib\justflowerCatalogue.ts"))) {
  throw "justflowerCatalogue.ts is missing from src\lib"
}

# ---------- WhatsApp webhook ----------
$r = Get-Content $route -Raw

if ($r -notmatch 'justflowerCatalogue') {
  $r = $r.Replace(
    'import { DEMO_CATALOGUE, type DemoCatalogueProduct } from "@/lib/demoCatalogue";',
    'import { DEMO_CATALOGUE, type DemoCatalogueProduct } from "@/lib/demoCatalogue";' + [Environment]::NewLine +
    'import { getJustFlowerCatalogueRecommendations } from "@/lib/justflowerCatalogue";'
  )
}

# Change deterministic matcher to async, preserving the existing demo matcher as fallback.
$r = $r.Replace(
  'function getDirectCatalogueMatches(message: string): DemoCatalogueProduct[] {',
  'async function getDirectCatalogueMatches(message: string): Promise<DemoCatalogueProduct[]> {'
)

# Rename the existing demo implementation so we can wrap it.
$r = $r.Replace(
  'async function getDirectCatalogueMatches(message: string): Promise<DemoCatalogueProduct[]> {',
  'function getDemoCatalogueMatches(message: string): DemoCatalogueProduct[] {'
)

# Insert a live wrapper immediately before the webhook handler.
if ($r -notmatch 'async function getDirectCatalogueMatches') {
  $marker = 'async function handle'
  $idx = $r.IndexOf($marker)
  if ($idx -lt 0) {
    # Find the first exported POST instead, which is the actual handler boundary.
    $idx = $r.IndexOf('export async function POST')
  }
  if ($idx -lt 0) { throw "Could not find WhatsApp handler boundary." }

  $wrapper = @'
async function getDirectCatalogueMatches(message: string): Promise<DemoCatalogueProduct[]> {
  try {
    const liveProducts = await getJustFlowerCatalogueRecommendations(message);
    if (liveProducts.length > 0) {
      console.log("Using live JustFlower catalogue:", liveProducts.map((p) => ({
        name: p.name,
        price: p.price,
      })));
      return liveProducts;
    }
  } catch (error) {
    console.error("Live JustFlower catalogue failed:", error);
  }

  // Preserve the existing working demo catalogue as fallback.
  return getDemoCatalogueMatches(message);
}

'@
  $r = $r.Substring(0, $idx) + $wrapper + $r.Substring($idx)
}

# The call is currently synchronous in the existing webhook.
$r = $r.Replace(
  'const directCatalogueProducts = getDirectCatalogueMatches(incomingText);',
  'const directCatalogueProducts = await getDirectCatalogueMatches(incomingText);'
)

# Extend deterministic trigger to common Hinglish requests.
$r = $r.Replace(
  'catalog|catalogue|design|designs|show|options)',
  'catalog|catalogue|design|designs|show|options|dikhao|dikhaiye|dikhado|batao|chahiye)'
)

Set-Content $route $r -Encoding UTF8

# ---------- Hinglish ----------
$rc = Get-Content $reception -Raw

if ($rc -notmatch 'LANGUAGE RULE:') {
  $needle = 'const stateInstruction = buildStateInstruction(knownDetails);'
  if ($rc -notmatch [regex]::Escape($needle)) {
    throw "Could not find stateInstruction line in receptionConversation.ts"
  }

  $insert = @'
const stateInstruction = buildStateInstruction(knownDetails);

  const lastCustomerMessage =
    chronologicalHistory
      .filter((m) => m.role === "user")
      .slice(-1)[0]?.content || "";

  const hinglishInstruction =
    /[\u0900-\u097F]/.test(lastCustomerMessage) ||
    /\b(mujhe|mujhko|chahiye|chaiye|hai|hain|ka|ki|ke|ko|mein|mera|meri|mere|aap|apko|yeh|ye|woh|kya|kuch|dikhao|dikhaiye|batao|bataiye|kitna|kitne|kal|aaj|liye|wali|wala|waale|mummy|mumma|papa|bhai|behen|shaadi)\b/i.test(lastCustomerMessage)
      ? `
LANGUAGE RULE:
- The customer is using Hindi/Hinglish.
- Reply naturally in Indian Hinglish: a comfortable mix of simple Hindi and English.
- Do not use formal or literary Hindi.
- Keep product names, prices and URLs/images exactly as provided.
- Keep the reply short, warm and conversational.
`
      : "";
'@

  $rc = $rc.Replace($needle, $insert)
}

$oldContent = @'
content: stateInstruction
          ? `${FLORIST_MITRA_PROMPT}\n\n${stateInstruction}`
          : FLORIST_MITRA_PROMPT,
'@

$newContent = @'
content: `${FLORIST_MITRA_PROMPT}${hinglishInstruction}${
          stateInstruction ? `\n\n${stateInstruction}` : ""
        }`,
'@

if ($rc.Contains($oldContent)) {
  $rc = $rc.Replace($oldContent, $newContent)
} elseif ($rc -notmatch 'hinglishInstruction') {
  throw "Could not locate the system prompt content block in receptionConversation.ts"
}

Set-Content $reception $rc -Encoding UTF8

Write-Host ""
Write-Host "SUCCESS: Live JustFlower catalogue + Hinglish changes applied."
Write-Host ""
Write-Host "Changed:"
Write-Host "  src\app\api\whatsapp\webhook\route.ts"
Write-Host "  src\lib\receptionConversation.ts"
Write-Host ""
Write-Host "Next: npm run build"
