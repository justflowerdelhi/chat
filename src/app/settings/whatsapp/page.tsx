import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getWhatsAppConnectionByMemberId, toPublicConnection, type WhatsAppConnectionPublic } from '@/lib/whatsappConnection';
import ConnectWhatsAppCard from '@/modules/whatsapp-onboarding/components/ConnectWhatsAppCard';
import ConnectionStatusCard from '@/modules/whatsapp-onboarding/components/ConnectionStatusCard';
import PhoneStatusCard from '@/modules/whatsapp-onboarding/components/PhoneStatusCard';
import WebhookStatusCard from '@/modules/whatsapp-onboarding/components/WebhookStatusCard';
import PermissionsCard from '@/modules/whatsapp-onboarding/components/PermissionsCard';
import EmbeddedSignupButton from '@/modules/whatsapp-onboarding/components/EmbeddedSignupButton';
import DisconnectButton from '@/modules/whatsapp-onboarding/components/DisconnectButton';

export const dynamic = 'force-dynamic';

export default async function WhatsAppSettingsPage() {
  const user = await getCurrentUser();

  if (!user?.member_id) {
    redirect('/login');
  }

  const row = await getWhatsAppConnectionByMemberId(user.member_id);
  const connection: WhatsAppConnectionPublic | null = row ? toPublicConnection(row) : null;
  const isActive = connection?.status === 'active';

  return (
    <main className="min-h-screen bg-[#f7faf7] p-4 lg:p-8 text-gray-900">
      <div className="max-w-3xl mx-auto">
        <header className="mb-8">
          <p className="text-sm font-semibold text-green-700">Settings</p>
          <h1 className="text-3xl font-bold tracking-tight mt-1">WhatsApp</h1>
          <p className="text-gray-600 mt-2">
            Connect your flower shop to WhatsApp so Flora can answer customer messages automatically.
          </p>
        </header>

        {!isActive ? (
          <ConnectWhatsAppCard />
        ) : (
          <section className="space-y-4">
            <ConnectionStatusCard connection={connection} />
            <PhoneStatusCard displayPhone={connection.display_phone} status={connection.status} />
            <WebhookStatusCard phoneNumberId={connection.phone_number_id} status={connection.status} />
            <PermissionsCard />
            <div className="flex flex-wrap items-center gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
              <EmbeddedSignupButton mode="reconnect" />
              <DisconnectButton />
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
