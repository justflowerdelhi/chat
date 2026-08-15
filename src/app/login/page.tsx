'use client';

import { useState } from 'react';

export default function LoginPage() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    const response = await fetch('/api/login', {
      method: 'POST',
      body: formData,
    });

    if (response.ok) {
      window.location.href = '/admin';
      return;
    }

    const data = await response.json().catch(() => ({ error: 'Login failed' }));
    setError(data.error || 'Login failed');
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-[#f7faf7] flex items-center justify-center px-4">
      <section className="w-full max-w-md bg-white rounded-3xl shadow-sm ring-1 ring-black/5 p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">Floraprise Admin</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700">Email</label>
            <input
              name="email"
              type="email"
              required
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700">Password</label>
            <input
              name="password"
              type="password"
              required
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-green-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-green-800 disabled:opacity-60"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  );
}
