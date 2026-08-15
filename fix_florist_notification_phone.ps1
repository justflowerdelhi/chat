$ErrorActionPreference = "Stop"

$root = "C:\floraprise.com\flora"
$route = Join-Path $root "src\app\api\whatsapp\webhook\route.ts"

if (!(Test-Path $route)) {
    throw "Webhook route not found: $route"
}

$r = Get-Content $route -Raw

$old = @'
  if (result.enquiry) {
    try {
      await sendFloristEnquiryNotification(account, result.enquiry);
    } catch (notificationError) {
      console.error("Failed to notify florist about enquiry:", notificationError);
    }
  }
'@

$new = @'
  if (result.enquiry) {
    try {
      // WhatsApp already gives us the customer's real phone number.
      // The AI should not be expected to extract it from the conversation.
      const enquiryForNotification = {
        ...result.enquiry,
        phone: result.enquiry.phone?.trim() || message.from,
      };

      console.log("Sending florist enquiry notification:", {
        customerPhone: enquiryForNotification.phone,
        notificationPhone: account.notificationPhoneNumber,
        occasion: enquiryForNotification.occasion,
      });

      await sendFloristEnquiryNotification(account, enquiryForNotification);
    } catch (notificationError) {
      console.error("Failed to notify florist about enquiry:", notificationError);
    }
  }
'@

if (!$r.Contains($old)) {
    throw "Could not find the existing enquiry notification block. No changes were made."
}

$r = $r.Replace($old, $new)

Set-Content $route $r -Encoding UTF8

Write-Host ""
Write-Host "SUCCESS: Florist notification will now use the customer's WhatsApp number."
Write-Host "The AI no longer needs to extract the phone number."
Write-Host ""
Write-Host "Next: npm run build"
