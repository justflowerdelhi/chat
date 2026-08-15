interface PhoneStatusCardProps {
  displayPhone: string | null;
  status: string;
}

export default function PhoneStatusCard({ displayPhone, status }: PhoneStatusCardProps) {
  const isActive = status === 'active';

  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
      <div className="flex items-center gap-4">
        <div
          className={`grid h-12 w-12 place-items-center rounded-2xl text-2xl ${
            isActive ? 'bg-green-50' : 'bg-amber-50'
          }`}
        >
          📱
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-gray-900">Phone Number</h2>
          <p className="text-sm text-gray-600 mt-1">
            {displayPhone || 'Phone number not available'}
          </p>
        </div>
      </div>
    </div>
  );
}
