$ErrorActionPreference = "Stop"

$root = "C:\floraprise.com\flora"
$route = Join-Path $root "src\app\api\whatsapp\webhook\route.ts"
$reception = Join-Path $root "src\lib\receptionConversation.ts"

if (!(Test-Path $route)) { throw "Missing: $route" }
if (!(Test-Path $reception)) { throw "Missing: $reception" }

# Back up before changing anything.
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
Copy-Item $route "$route.bak_$stamp" -Force
Copy-Item $reception "$reception.bak_$stamp" -Force

$r = Get-Content $route -Raw

# WhatsApp is showing the rupee character as mojibake on some messages.
# Use ASCII "Rs." in outbound WhatsApp text/captions; this is intentionally
# more robust than relying on Unicode encoding.
$r = $r.Replace("₹", "Rs.")
$r = $r.Replace("â‚¹", "Rs.")
$r = $r.Replace("Ã¢â‚‚Â¹", "Rs.")
$r = $r.Replace("ðŸŒ¸", "")
$r = $r.Replace("Ã°Å¸ÅŒÂ¸", "")

# Replace the enquiry heading with ASCII so it cannot become mojibake.
$r = [regex]::Replace(
    $r,
    '(?m)^(\s*).*New Flora Assistant Enquiry.*$',
    '$1"New Flora Assistant Enquiry",'
)

Set-Content $route $r -Encoding UTF8

$c = Get-Content $reception -Raw

if ($c -notmatch "function extractDeliveryDateFallback") {
$helper = @'
function extractDeliveryDateFallback(historyMessages: ChatHistoryRow[]): string {
  const text = historyMessages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n");

  const now = new Date();
  const indiaNow = new Date(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now)
  );

  const pad = (n: number) => String(n).padStart(2, "0");
  const formatDate = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  // Explicit numeric dates: 18/08/2026, 18-08-2026, 18.08.2026
  const numeric = text.match(/\b(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?\b/);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);
    let year = numeric[3] ? Number(numeric[3]) : indiaNow.getFullYear();
    if (year < 100) year += 2000;

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${pad(month)}-${pad(day)}`;
    }
  }

  // Dates such as "18 August", "18th Aug", "18 August 2026".
  const monthNames =
    "january|february|march|april|may|june|july|august|september|october|november|december";
  const monthMatch = text.match(
    new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthNames})(?:\\s+(\\d{4}))?\\b`, "i")
  );

  if (monthMatch) {
    const months = [
      "january","february","march","april","may","june",
      "july","august","september","october","november","december"
    ];
    const day = Number(monthMatch[1]);
    const month = months.indexOf(monthMatch[2].toLowerCase()) + 1;
    const year = monthMatch[3]
      ? Number(monthMatch[3])
      : indiaNow.getFullYear();

    if (month > 0 && day >= 1 && day <= 31) {
      return `${year}-${pad(month)}-${pad(day)}`;
    }
  }

  // Relative dates. Supports common Indian English/Hinglish wording.
  if (/\b(day after tomorrow|parso)\b/i.test(text)) {
    const d = new Date(indiaNow);
    d.setDate(d.getDate() + 2);
    return formatDate(d);
  }

  if (/\b(tomorrow|kal)\b/i.test(text)) {
    const d = new Date(indiaNow);
    d.setDate(d.getDate() + 1);
    return formatDate(d);
  }

  if (/\btoday\b|\baaj\b|\baaj hi\b/i.test(text)) {
    return formatDate(indiaNow);
  }

  // "next Sunday", "next Monday", etc.
  const weekdayMatch = text.match(
    /\bnext\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i
  );

  if (weekdayMatch) {
    const weekdays = [
      "sunday","monday","tuesday","wednesday","thursday","friday","saturday"
    ];
    const target = weekdays.indexOf(weekdayMatch[1].toLowerCase());
    const d = new Date(indiaNow);
    const current = d.getDay();
    let delta = (target - current + 7) % 7;
    if (delta === 0) delta = 7;
    d.setDate(d.getDate() + delta);
    return formatDate(d);
  }

  return "";
}

'@
$marker = "async function createEnquiryIfCompleted("
$idx = $c.IndexOf($marker)
if ($idx -lt 0) { throw "Could not find createEnquiryIfCompleted." }
$c = $c.Substring(0, $idx) + $helper + $c.Substring($idx)
}

# Make the AI extraction instruction explicitly preserve customer-provided dates.
$c = $c.Replace(
"Use only information present in the conversation. Leave unknown fields as empty strings.",
"Use only information present in the conversation. Leave unknown fields as empty strings. IMPORTANT: If the customer has provided a delivery date in any form (for example 18 August, 18/08/2026, tomorrow, kal, parso, or next Sunday), extract it into deliveryDate. Convert relative dates to an ISO date (YYYY-MM-DD) using the current date. Never leave deliveryDate empty when the conversation clearly contains a delivery date."
)

# After parse, use a deterministic fallback if the AI still missed the date.
$needle = "    const summary = parseEnquirySummary(summaryResponse.choices[0].message.content);"
if ($c.Contains($needle) -and $c -notmatch "extractDeliveryDateFallback\(historyMessages\)") {
    $replacement = @'
    const summary = parseEnquirySummary(summaryResponse.choices[0].message.content);

    if (summary) {
      const fallbackDeliveryDate = extractDeliveryDateFallback(historyMessages);
      if (!summary.deliveryDate && fallbackDeliveryDate) {
        summary.deliveryDate = fallbackDeliveryDate;
        console.log("Delivery date recovered deterministically:", fallbackDeliveryDate);
      }
    }
'@
    $c = $c.Replace($needle, $replacement)
}

Set-Content $reception $c -Encoding UTF8

Write-Host ""
Write-Host "SUCCESS: WhatsApp display + delivery-date reliability fixes installed."
Write-Host ""
Write-Host "1. WhatsApp catalogue prices now use ASCII 'Rs.' instead of the rupee symbol."
Write-Host "2. Florist enquiry heading is ASCII-safe."
Write-Host "3. Delivery dates are extracted from explicit and relative customer messages."
Write-Host "4. A deterministic date fallback runs if AI extraction misses a provided date."
Write-Host ""
Write-Host "Backups created:"
Write-Host "  $route.bak_$stamp"
Write-Host "  $reception.bak_$stamp"
Write-Host ""
Write-Host "Next: npm run build"
