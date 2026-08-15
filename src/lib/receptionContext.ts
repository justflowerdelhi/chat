export interface ReceptionContext {
  memberId: number;
  businessName: string;
  customerPhone?: string;
  channel: 'whatsapp' | 'widget' | 'public-chat';
  language: string;
  timezone: string;
  purpose: string;
}
