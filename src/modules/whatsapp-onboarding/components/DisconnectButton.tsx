'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DisconnectButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDisconnect() {
    if (!confirm('Disconnect WhatsApp? Flora will stop answering messages for this number.')) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/whatsapp/connections', { method: 'DELETE' });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || 'Failed to disconnect.');
      }
      router.refresh();
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : 'Failed to disconnect.');
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleDisconnect}
        disabled={loading}
        className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-bold text-red-700 ring-1 ring-red-200 transition hover:bg-red-50 disabled:opacity-60"
      >
        {loading ? 'Disconnecting...' : 'Disconnect'}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
