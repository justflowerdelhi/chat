interface WebhookStatusCardProps {
  phoneNumberId: string;
  status: string;
}

export default function WebhookStatusCard({ phoneNumberId, status }: WebhookStatusCardProps) {
  const isActive = status === 'active';

  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
      <div className="flex items-center gap-4">
        <div
          className={`grid h-12 w-12 place-items-center rounded-2xl text-2xl ${
            isActive ? 'bg-green-50' : 'bg-amber-50'
          }`}
        >
          🔗
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-gray-900">Webhook Status</h2>
          <p className="text-sm text-gray-600 mt-1">
            {isActive
              ? 'Incoming WhatsApp messages are routed to Flora.'
              : 'Webhook is not active. Reconnect WhatsApp to receive messages.'}
          </p>
        </div>
      </div>
      {phoneNumberId && (
        <div className="mt-4 rounded-xl bg-gray-50 p-3 text-xs text-gray-500 break-all">
          Phone Number ID: <span className="font-mono">{phoneNumberId}</span>
        </div>
      )}
    </div>
  );
}
