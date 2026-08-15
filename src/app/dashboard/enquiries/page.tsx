import Link from 'next/link';
import type { QueryResultRow } from 'pg';
import { getCurrentUser } from '@/lib/auth';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

interface EnquiryListRow extends QueryResultRow {
  id: string;
  created_at: string;
  customer_name: string | null;
  occasion: string | null;
  budget: string | null;
  delivery_date: string | null;
  delivery_city: string | null;
  priority: string;
  status: string;
}

async function getEnquiries(memberId: number) {
  const result = await db.query<EnquiryListRow>(
    `SELECT e.id, e.created_at, e.customer_name, e.occasion, e.budget, e.delivery_date,
            e.delivery_city, e.priority, e.status
     FROM enquiries e
     JOIN chat_sessions cs ON cs.id = e.conversation_id
     WHERE cs.user_id = $1
     ORDER BY e.created_at DESC`,
    [memberId]
  );

  return result.rows;
}

function display(value: string | null) {
  return value && value.trim().length > 0 ? value : '-';
}

export default async function CustomerEnquiriesPage() {
  const user = await getCurrentUser();

  if (!user || !user.member_id) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 lg:p-8">
        <div className="max-w-6xl mx-auto bg-white border rounded-2xl p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">Customer Enquiries</h1>
          <p className="text-gray-600 mt-2">Please sign in to view customer enquiries.</p>
        </div>
      </div>
    );
  }

  const enquiries = await getEnquiries(user.member_id);

  return (
    <main className="min-h-screen bg-gray-50 p-4 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Customer Enquiries</h1>
            <p className="text-sm text-gray-600 mt-1">Newest enquiries from completed Flora conversations.</p>
          </div>
          <Link href="/dashboard/florist-mitra" className="text-sm font-semibold text-green-700 hover:text-green-800">
            Back to Chat
          </Link>
        </div>

        <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
          {enquiries.length === 0 ? (
            <div className="p-8 text-center">
              <h2 className="text-lg font-bold text-gray-900">No enquiries yet</h2>
              <p className="text-gray-600 mt-2">Completed customer conversations will appear here automatically.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Customer</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Occasion</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Budget</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Delivery Date</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">City</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Priority</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {enquiries.map((enquiry) => (
                    <tr key={enquiry.id} className="border-b hover:bg-green-50 transition">
                      <td className="py-3 px-4 font-semibold text-gray-900">
                        <Link href={`/dashboard/enquiries/${enquiry.id}`} className="hover:text-green-700">
                          {display(enquiry.customer_name)}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-gray-700">{display(enquiry.occasion)}</td>
                      <td className="py-3 px-4 text-gray-700">{display(enquiry.budget)}</td>
                      <td className="py-3 px-4 text-gray-700">{display(enquiry.delivery_date)}</td>
                      <td className="py-3 px-4 text-gray-700">{display(enquiry.delivery_city)}</td>
                      <td className="py-3 px-4 text-gray-700">{enquiry.priority}</td>
                      <td className="py-3 px-4 text-gray-700">{enquiry.status}</td>
                      <td className="py-3 px-4 text-gray-700">{new Date(enquiry.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}