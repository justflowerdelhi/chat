'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

interface Enquiry {
  id: string;
  created_at: string;
  customer_name: string | null;
  occasion: string | null;
  budget: string | null;
  delivery_date: string | null;
  delivery_city: string | null;
  priority: 'Low' | 'Medium' | 'High';
  status: 'Pending' | 'Contacted' | 'Closed';
}

interface ReceptionStats {
  todayConversations: number;
  todayEnquiries: number;
  pendingFollowUps: number;
  closedToday: number;
}

interface EnquiriesResponse {
  enquiries: Enquiry[];
  floristName: string | null;
  stats: ReceptionStats;
}

interface ToastState {
  occasion: string;
  budget: string;
}

const emptyStats: ReceptionStats = {
  todayConversations: 0,
  todayEnquiries: 0,
  pendingFollowUps: 0,
  closedToday: 0,
};

function display(value: string | null | undefined) {
  return value && value.trim().length > 0 ? value : '-';
}

function greeting(name: string | null) {
  const hour = new Date().getHours();
  const label = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  return name && name.trim().length > 0 ? `${label} ${name}` : label;
}

function timeLabel(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function priorityClass(priority: Enquiry['priority']) {
  if (priority === 'High') {
    return 'bg-red-50 text-red-700 ring-red-100';
  }

  if (priority === 'Medium') {
    return 'bg-orange-50 text-orange-700 ring-orange-100';
  }

  return 'bg-green-50 text-green-700 ring-green-100';
}

function playNotificationSound() {
  const audioGlobal = globalThis as typeof globalThis & {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  const AudioContextClass = audioGlobal.AudioContext || audioGlobal.webkitAudioContext;
  if (!AudioContextClass) {
    return;
  }

  const audioContext = new AudioContextClass();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(660, audioContext.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(440, audioContext.currentTime + 0.18);
  gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.08, audioContext.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.22);

  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.24);
}

export default function ReceptionDesk() {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [stats, setStats] = useState<ReceptionStats>(emptyStats);
  const [floristName, setFloristName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<ToastState | null>(null);
  const knownLatestIdRef = useRef<string | null>(null);
  const hasLoadedRef = useRef(false);

  async function fetchReceptionDesk() {
    try {
      const response = await fetch('../api/enquiries', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Unable to load enquiries');
      }

      const data = await response.json() as EnquiriesResponse;
      const latest = data.enquiries[0];

      if (hasLoadedRef.current && latest && knownLatestIdRef.current && latest.id !== knownLatestIdRef.current) {
        setToast({
          occasion: display(latest.occasion) === '-' ? 'New enquiry' : `${latest.occasion} enquiry`,
          budget: display(latest.budget),
        });
        playNotificationSound();
        window.setTimeout(() => setToast(null), 5200);
      }

      knownLatestIdRef.current = latest?.id ?? null;
      hasLoadedRef.current = true;
      setEnquiries(data.enquiries);
      setStats(data.stats || emptyStats);
      setFloristName(data.floristName || null);
      setError('');
    } catch {
      setError('Please sign in to view the reception desk.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(fetchReceptionDesk);
    const interval = window.setInterval(fetchReceptionDesk, 15000);
    return () => window.clearInterval(interval);
  }, []);

  async function updateStatus(id: string, status: Enquiry['status']) {
    const previous = enquiries;
    setEnquiries((items) => items.map((item) => item.id === id ? { ...item, status } : item));

    try {
      const response = await fetch(`../api/enquiries/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error('Unable to update enquiry');
      }

      fetchReceptionDesk();
    } catch {
      setEnquiries(previous);
      setError('Could not update the enquiry. Please try again.');
    }
  }

  const recentEnquiries = enquiries.slice(0, 10);

  return (
    <main className="min-h-screen bg-[#f7faf7] p-4 lg:p-8 text-gray-900">
      <div className="max-w-7xl mx-auto">
        <header className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-green-700">Reception Desk</p>
            <h1 className="text-3xl lg:text-4xl font-bold tracking-tight mt-1">{greeting(floristName)}</h1>
            <p className="text-gray-600 mt-2">Here&apos;s what&apos;s happening in your flower shop today.</p>
          </div>
          <div className="flex gap-3 text-sm">
            <Link href="/dashboard/florist-mitra" className="rounded-full bg-white px-4 py-2 font-semibold text-green-700 shadow-sm ring-1 ring-green-100 hover:bg-green-50">
              Open Chat
            </Link>
            <Link href="/dashboard/enquiries" className="rounded-full bg-white px-4 py-2 font-semibold text-gray-700 shadow-sm ring-1 ring-gray-100 hover:bg-gray-50">
              All Enquiries
            </Link>
          </div>
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <SummaryCard label="Today's Conversations" value={stats.todayConversations} />
          <SummaryCard label="Today's Enquiries" value={stats.todayEnquiries} />
          <SummaryCard label="Pending Follow-ups" value={stats.pendingFollowUps} />
          <SummaryCard label="Closed Today" value={stats.closedToday} />
        </section>

        <section className="bg-white rounded-3xl shadow-sm ring-1 ring-black/5 overflow-hidden">
          <div className="px-5 lg:px-6 py-5 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Recent Enquiries</h2>
              <p className="text-sm text-gray-500 mt-1">Latest 10 customer enquiries, refreshed every 15 seconds.</p>
            </div>
            <span className="hidden sm:inline-flex rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">Live</span>
          </div>

          {loading ? (
            <div className="p-10 text-center text-gray-500">Loading reception desk...</div>
          ) : error ? (
            <div className="p-10 text-center text-gray-600">{error}</div>
          ) : recentEnquiries.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-4xl mb-4">🌸</div>
              <h3 className="text-xl font-bold text-gray-900">No enquiries yet today.</h3>
              <p className="text-gray-600 mt-2">Flora is ready to welcome your next customer.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="text-left py-3 px-5 font-semibold">Customer Name</th>
                    <th className="text-left py-3 px-5 font-semibold">Occasion</th>
                    <th className="text-left py-3 px-5 font-semibold">Budget</th>
                    <th className="text-left py-3 px-5 font-semibold">Delivery Date</th>
                    <th className="text-left py-3 px-5 font-semibold">Priority</th>
                    <th className="text-left py-3 px-5 font-semibold">Created Time</th>
                    <th className="text-left py-3 px-5 font-semibold">Status</th>
                    <th className="text-left py-3 px-5 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recentEnquiries.map((enquiry) => (
                    <tr key={enquiry.id} className="border-t border-gray-100 hover:bg-green-50/45">
                      <td className="py-4 px-5 font-semibold">
                        <Link href={`/dashboard/enquiries/${enquiry.id}`} className="hover:text-green-700">
                          {display(enquiry.customer_name)}
                        </Link>
                      </td>
                      <td className="py-4 px-5 text-gray-700">{display(enquiry.occasion)}</td>
                      <td className="py-4 px-5 text-gray-700">{display(enquiry.budget)}</td>
                      <td className="py-4 px-5 text-gray-700">{display(enquiry.delivery_date)}</td>
                      <td className="py-4 px-5">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 ${priorityClass(enquiry.priority)}`}>
                          {enquiry.priority}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-gray-700">{timeLabel(enquiry.created_at)}</td>
                      <td className="py-4 px-5 text-gray-700">{enquiry.status}</td>
                      <td className="py-4 px-5">
                        <div className="flex flex-wrap gap-2">
                          <ActionButton label="Contacted" onClick={() => updateStatus(enquiry.id, 'Contacted')} />
                          <ActionButton label="Follow-up" onClick={() => updateStatus(enquiry.id, 'Pending')} />
                          <ActionButton label="Closed" onClick={() => updateStatus(enquiry.id, 'Closed')} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {toast && (
        <div className="fixed right-5 top-5 z-50 w-[320px] rounded-3xl bg-white p-4 shadow-2xl ring-1 ring-green-100">
          <div className="flex gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-green-50 text-2xl">🌸</div>
            <div>
              <p className="font-bold text-gray-900">New enquiry received</p>
              <p className="text-sm text-gray-700 mt-1">{toast.occasion}</p>
              <p className="text-sm text-gray-500 mt-1">Estimated Budget {toast.budget}</p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <p className="text-sm font-semibold text-gray-500">{label}</p>
      <p className="text-3xl font-bold text-gray-900 mt-3">{value}</p>
    </div>
  );
}

function ActionButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50"
    >
      {label}
    </button>
  );
}