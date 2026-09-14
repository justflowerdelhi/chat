export function getWhatsAppConfig() {
  return {
    webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '',
  };
}

/**
 * Get the IFA system member ID for session persistence.
 * IFA WhatsApp sessions must reference a valid member_id in chat_sessions.user_id.
 * This is a system member that exists solely to satisfy the foreign key constraint.
 */
export function getIfaSystemMemberId(): number {
  const value = process.env.IFA_SYSTEM_MEMBER_ID?.trim();
  if (!value) {
    throw new Error(
      'IFA_SYSTEM_MEMBER_ID environment variable is required for IFA WhatsApp session persistence. ' +
      'Set it to the member ID of the IFA System member (e.g., IFA_SYSTEM_MEMBER_ID=2).'
    );
  }

  const memberId = parseInt(value, 10);
  if (isNaN(memberId) || memberId <= 0) {
    throw new Error(
      `IFA_SYSTEM_MEMBER_ID must be a positive integer. Got: ${value}`
    );
  }

  return memberId;
}