import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getWhatsAppConnectionByMemberId, toPublicConnection, type WhatsAppConnectionPublic } from '@/lib/whatsappConnection';
import { getRecentWebhookLogs, type WhatsAppWebhookLogRow } from '@/lib/whatsappWebhookLog';
import ConnectionStatusCard from '@/modules/whatsapp-onboarding/components/ConnectionStatusCard';
import PhoneStatusCard from '@/modules/whatsapp-onboarding/components/PhoneStatusCard';
import WebhookStatusCard from '@/modules/whatsapp-onboarding/components/WebhookStatusCard';

export const dynamic = 'force-dynamic';

function latencyClass(ms: number | null): string {
  if (ms === null || ms === undefined) return 'text-gray-500';
  if (ms < 1000) return 'text-green-600';
  if (ms < 3000) return 'text-amber-600';
  return 'text-red-600';
}

function statusBadge(status: number | null, error: string | null) {
  if (error) {
    return <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-bold text-red-700">Error</span>;
  }
  if (status && status >= 200 && status < 300) {
    return <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-bold text-green-700">{status} OK</span>;
  }
  if (status) {
    return <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700">{status}</span>;
  }
  return <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-bold text-gray-700">-</span>;
}

export default async function WhatsAppDiagnosticsPage() {
  const user = await getCurrentUser();

  if (!user?.member_id) {
    redirect('/login');
  }

  const row = await getWhatsAppConnectionByMemberId(user.member_id);
  const connection: WhatsAppConnectionPublic | null = row ? toPublicConnection(row) : null;
  const logs: WhatsAppWebhookLogRow[] = await getRecentWebhookLogs(user.member_id);

  return (
    <main className="min-h-screen bg-[#f7faf7] p-4 lg:p-8 text-gray-900">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8">
          <p className="text-sm font-semibold text-green-700">Settings / WhatsApp</p>
          <h1 className="text-3xl font-bold tracking-tight mt-1">Webhook Diagnostics</h1>
          <p className="text-gray-600 mt-2">
            Recent webhook activity, reply latency, and Meta API responses for your WhatsApp number.
          </p>
        </header>

        {connection ? (
          <section className="grid gap-4 mb-8 sm:grid-cols-2 lg:grid-cols-3">
            <ConnectionStatusCard connection={connection} />
            <PhoneStatusCard displayPhone={connection.display_phone} status={connection.status} />
            <WebhookStatusCard phoneNumberId={connection.phone_number_id} status={connection.status} />
          </section>
        ) : (
          <div className="rounded-3xl bg-white p-6 mb-8 shadow-sm ring-1 ring-black/5">
            <p className="text-gray-600">No WhatsApp connection found. Connect a number to see diagnostics.</p>
          </div>
        )}

        <section className="rounded-3xl bg-white shadow-sm ring-1 ring-black/5 overflow-hidden">
          <div className="border-b border-gray-100 px-6 py-5">
            <h2 className="text-lg font-bold text-gray-900">Recent Webhook Events</h2>
            <p className="text-sm text-gray-600 mt-1">Latest 20 incoming messages and AI replies.</p>
          </div>

          {logs.length === 0 ? (
            <div className="p-10 text-center text-gray-500">No webhook events logged yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="text-left py-3 px-5 font-semibold">Received</th>
                    <th className="text-left py-3 px-5 font-semibold">Customer</th>
                    <th className="text-left py-3 px-5 font-semibold">Message</th>
                    <th className="text-left py-3 px-5 font-semibold">AI Reply</th>
                    <th className="text-left py-3 px-5 font-semibold">Meta Status</th>
                    <th className="text-left py-3 px-5 font-semibold">Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-t border-gray-100 hover:bg-green-50/45">
                      <td className="py-4 px-5 whitespace-nowrap text-gray-700">
                        {new Date(log.received_at).toLocaleString()}
                      </td>
                      <td className="py-4 px-5 text-gray-700 font-mono">{log.customer_phone ?? '-'}</td>
                      <td className="py-4 px-5 text-gray-700 max-w-xs truncate">{log.incoming_text ?? '-'}</td>
                      <td className="py-4 px-5 text-gray-700 max-w-xs truncate">{log.ai_reply ?? '-'}</td>
                      <td className="py-4 px-5">{statusBadge(log.meta_status, log.error_message)}</td>
                      <td className="py-4 px-5 font-semibold">
                        <span className={latencyClass(log.latency_ms)}>
                          {log.latency_ms !== null ? `${log.latency_ms}ms` : '-'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
