export function getWhatsAppConfig() {
  return {
    webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '',
  };
}