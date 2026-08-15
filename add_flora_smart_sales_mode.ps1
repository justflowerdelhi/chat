$ErrorActionPreference = "Stop"

$root = "C:\floraprise.com\flora"
$file = Join-Path $root "src\lib\receptionConversation.ts"

if (!(Test-Path $file)) {
    throw "File not found: $file"
}

$r = Get-Content $file -Raw

if ($r -match "SMART SALES RULES") {
    Write-Host "Smart Sales Mode is already installed. Nothing changed."
    exit 0
}

$marker = @'
  const hinglishInstruction =
'@

if (!$r.Contains($marker)) {
    throw "Could not find hinglishInstruction block. No changes were made."
}

$smartRules = @'
  const smartSalesInstruction = `
SMART SALES RULES:
- Behave like an experienced human florist salesperson, not a questionnaire.
- Remember the conversation. Understand references such as "first one", "second one", "the cheaper one", "that bouquet", "same one", "this one", "add chocolate", and "remove the cake" from the recent conversation.
- Never ask again for information that is already known from the conversation.
- If the customer gives a budget, stay within it whenever possible and recommend the best matching option first.
- When several suitable products are available, explain the choice briefly and offer at most 2 alternatives. Do not dump a long catalogue in text.
- If live catalogue products/images have already been sent, refer to them naturally instead of pretending you cannot see them.
- For a birthday, anniversary or celebration, you may suggest one relevant add-on such as cake, chocolate or teddy ONLY when it is supported by the available catalogue/context. Do not invent products or prices.
- For condolence, sympathy or sensitive occasions, be respectful and do not push upsells.
- If the customer says "just show me", show options rather than asking unnecessary questions.
- If one important detail is missing, ask only that one question needed to move the enquiry forward.
- When the customer selects a product, confirm the selected product and price before asking for the next missing detail.
- Keep replies short and WhatsApp-friendly. Use bullets only when they genuinely improve clarity.
- Never claim that an order, payment, delivery or florist confirmation has happened unless the system explicitly confirms it.
`;

'@

# Insert smartSalesInstruction immediately before the existing stateInstruction.
$needle = '  const stateInstruction = buildStateInstruction(knownDetails);'
if (!$r.Contains($needle)) {
    throw "Could not find stateInstruction line. No changes were made."
}

$r = $r.Replace($needle, $smartRules + $needle)

# Add the smart rules to the existing system prompt.
$oldPrompt = @'
        content: `${FLORIST_MITRA_PROMPT}${hinglishInstruction}${
          stateInstruction ? `\n\n${stateInstruction}` : ""
        }`,
'@

$newPrompt = @'
        content: `${FLORIST_MITRA_PROMPT}${hinglishInstruction}${smartSalesInstruction}${
          stateInstruction ? `\n\n${stateInstruction}` : ""
        }`,
'@

if (!$r.Contains($oldPrompt)) {
    throw "Could not find the current system prompt block. No changes were made."
}

$r = $r.Replace($oldPrompt, $newPrompt)

Set-Content $file $r -Encoding UTF8

Write-Host ""
Write-Host "SUCCESS: Flora Smart Sales Mode installed."
Write-Host ""
Write-Host "New behavior includes:"
Write-Host "  - Understand first/second/cheaper/that one references"
Write-Host "  - Better budget-aware recommendations"
Write-Host "  - Fewer repetitive questions"
Write-Host "  - Occasion-aware suggestions"
Write-Host "  - Gentle relevant add-on suggestions"
Write-Host "  - Shorter WhatsApp-friendly replies"
Write-Host ""
Write-Host "Next: npm run build"
