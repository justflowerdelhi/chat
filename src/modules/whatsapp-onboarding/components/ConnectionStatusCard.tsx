import { type WhatsAppConnectionPublic } from '@/lib/whatsappConnection';

interface ConnectionStatusCardProps {
  connection: WhatsAppConnectionPublic;
}

export default function ConnectionStatusCard({ connection }: ConnectionStatusCardProps) {
  const isActive = connection.status === 'active';

  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
      <div className="flex items-center gap-4">
        <div
          className={`grid h-12 w-12 place-items-center rounded-2xl text-2xl ${
            isActive ? 'bg-green-50' : 'bg-amber-50'
          }`}
        >
          {isActive ? '✅' : '⚠️'}
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-gray-900">Connection Status</h2>
          <p className="text-sm text-gray-600 mt-1">
            {isActive
              ? 'WhatsApp is connected and AI replies are active.'
              : `Connection is currently ${connection.status}. Reconnect to restore service.`}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            isActive
              ? 'bg-green-100 text-green-700'
              : 'bg-amber-100 text-amber-700'
          }`}
        >
          {connection.status}
        </span>
      </div>
    </div>
  );
}
