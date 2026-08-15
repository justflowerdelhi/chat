$ErrorActionPreference = "Stop"
$root = "C:\floraprise.com\flora"

$serviceSource = Join-Path $root "src\lib\justflowerCatalogue.ts"
Copy-Item ".\justflowerCatalogue.ts" $serviceSource -Force

$route = Join-Path $root "src\app\api\whatsapp\route.ts"
$r = Get-Content $route -Raw

$r = $r.Replace(
'import { DEMO_CATALOGUE, type DemoCatalogueProduct } from "@/lib/demoCatalogue";',
'import type { DemoCatalogueProduct } from "@/lib/demoCatalogue";`r`nimport { getJustFlowerCatalogueRecommendations } from "@/lib/justflowerCatalogue";'
)

# Make direct matcher async and use live JustFlower catalogue first.
$start = $r.IndexOf('function getDirectCatalogueMatches(message: string): DemoCatalogueProduct[] {')
if ($start -lt 0) { throw "Could not find getDirectCatalogueMatches" }

$end = $r.IndexOf('async function handleMessage', $start)
if ($end -lt 0) { throw "Could not find handleMessage" }

$newMatcher = @'
async function getDirectCatalogueMatches(message: string): Promise<DemoCatalogueProduct[]> {
  const liveProducts = await getJustFlowerCatalogueRecommendations(message);

  if (liveProducts.length > 0) {
    console.log("Using live JustFlower catalogue:", liveProducts.map((p) => ({
      name: p.name,
      price: p.price,
    })));
    return liveProducts;
  }

  // Safe fallback to the existing demo catalogue.
  return [];
}

'@

$r = $r.Substring(0, $start) + $newMatcher + $r.Substring($end)

$r = $r.Replace(
'const directCatalogueProducts = getDirectCatalogueMatches(incomingText);',
'const directCatalogueProducts = await getDirectCatalogueMatches(incomingText);'
)

$r = $r.Replace(
'"Here are some bouquet options:",',
'"Here are some options from Just Flowers:",'
)

Set-Content $route $r -Encoding UTF8

# Add automatic Hinglish behavior to the existing system prompt.
$reception = Join-Path $root "src\lib\receptionConversation.ts"
$rc = Get-Content $reception -Raw

$old = @'
const stateInstruction = buildStateInstruction(knownDetails);

  const response = await openai.chat.completions.create({
'@

$new = @'
const stateInstruction = buildStateInstruction(knownDetails);
  const lastCustomerMessage =
    normalizedMessages[normalizedMessages.length - 1]?.content || "";
  const hinglishInstruction =
    /[\u0900-\u097F]/.test(lastCustomerMessage) ||
    /\b(hi|hello|namaste|mujhe|mujhko|chahiye|chaiye|hai|hain|ka|ki|ke|ko|mein|me|mera|meri|mere|aap|apko|apko|tum|yeh|ye|woh|kya|kuch|dikhao|dikhaiye|batao|bataiye|kitna|kitne|kal|aaj|par|se|tak|liye|wali|wala|waale|birthday|shaadi|shaadi ke|mummy|papa|bhai|behen)\b/i.test(lastCustomerMessage)
      ? `
LANGUAGE RULE:
- The customer is using Hindi/Hinglish.
- Reply naturally in Indian Hinglish: a comfortable mix of simple Hindi and English.
- Do not translate everything into formal Hindi.
- Keep product names and prices exactly as catalogue data.
- Keep replies short, friendly and conversational.
`
      : "";

  const response = await openai.chat.completions.create({
'@

if ($rc.Contains($old)) {
    $rc = $rc.Replace($old, $new)
    $rc = $rc.Replace(
'content: stateInstruction`r`n          ? `${FLORIST_MITRA_PROMPT}\n\n${stateInstruction}``r`n          : FLORIST_MITRA_PROMPT,',
'content: `${FLORIST_MITRA_PROMPT}${hinglishInstruction}${stateInstruction ? `\n\n${stateInstruction}` : ""}`,'
    )
    # Handle normal LF text if the first exact replacement did not match the conditional.
    $rc = $rc.Replace(
'content: stateInstruction`r`n          ? `${FLORIST_MITRA_PROMPT}\n\n${stateInstruction}``r`n          : FLORIST_MITRA_PROMPT,',
'content: `${FLORIST_MITRA_PROMPT}${hinglishInstruction}${stateInstruction ? `\n\n${stateInstruction}` : ""}`,'
    )
    Set-Content $reception $rc -Encoding UTF8
}

Write-Host "Live JustFlower catalogue + Hinglish patch applied."
Write-Host "Run: npm run build"
