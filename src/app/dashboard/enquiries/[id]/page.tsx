import Link from 'next/link';
import type { QueryResultRow } from 'pg';
import { getCurrentUser } from '@/lib/auth';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

interface EnquiryDetailRow extends QueryResultRow {
  id: string;
  created_at: string;
  customer_name: string | null;
  phone: string | null;
  occasion: string | null;
  budget: string | null;
  delivery_date: string | null;
  delivery_city: string | null;
  recipient: string | null;
  recommended_products: string | null;
  special_instructions: string | null;
  summary: Record<string, unknown> | null;
  lead_quality: string | null;
  conversation_confidence: number | null;
  priority: string;
  status: string;
}

async function getEnquiry(id: string, memberId: number) {
  const result = await db.query<EnquiryDetailRow>(
    `SELECT e.*
     FROM enquiries e
     JOIN chat_sessions cs ON cs.id = e.conversation_id
     WHERE e.id = $1 AND cs.user_id = $2`,
    [id, memberId]
  );

  return result.rows[0] ?? null;
}

function display(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return '-';
  }

  return String(value).trim().length > 0 ? String(value) : '-';
}

function summaryValue(summary: Record<string, unknown> | null, key: string) {
  const value = summary?.[key];
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string').join(', ');
  }

  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function DetailItem({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-900 mt-1">{display(value)}</dd>
    </div>
  );
}

export default async function EnquiryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();

  if (!user || !user.member_id) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 lg:p-8">
        <div className="max-w-4xl mx-auto bg-white border rounded-2xl p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">Customer Details</h1>
          <p className="text-gray-600 mt-2">Please sign in to view this enquiry.</p>
        </div>
      </div>
    );
  }

  const { id } = await params;
  const enquiry = await getEnquiry(id, user.member_id);

  if (!enquiry) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 lg:p-8">
        <div className="max-w-4xl mx-auto bg-white border rounded-2xl p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">Enquiry not found</h1>
          <Link href="/dashboard/enquiries" className="inline-block mt-4 text-sm font-semibold text-green-700 hover:text-green-800">
            Back to Enquiries
          </Link>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 lg:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Customer Details</h1>
            <p className="text-sm text-gray-600 mt-1">Read-only enquiry captured from Flora Receptionist.</p>
          </div>
          <Link href="/dashboard/enquiries" className="text-sm font-semibold text-green-700 hover:text-green-800">
            Back to Enquiries
          </Link>
        </div>

        <div className="grid gap-4 lg:gap-6">
          <section className="bg-white border rounded-2xl shadow-sm p-5 lg:p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Customer Details</h2>
            <dl className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <DetailItem label="Customer" value={enquiry.customer_name} />
              <DetailItem label="Phone" value={enquiry.phone} />
              <DetailItem label="Recipient" value={enquiry.recipient} />
              <DetailItem label="Occasion" value={enquiry.occasion} />
              <DetailItem label="Budget" value={enquiry.budget} />
              <DetailItem label="Delivery Date" value={enquiry.delivery_date} />
              <DetailItem label="City" value={enquiry.delivery_city} />
              <DetailItem label="Priority" value={enquiry.priority} />
              <DetailItem label="Status" value={enquiry.status} />
            </dl>
          </section>

          <section className="bg-white border rounded-2xl shadow-sm p-5 lg:p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">AI Summary</h2>
            <p className="text-sm text-gray-700 leading-6">{display(summaryValue(enquiry.summary, 'summaryText'))}</p>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
              <DetailItem label="Lead Quality" value={enquiry.lead_quality} />
              <DetailItem label="Conversation Confidence" value={enquiry.conversation_confidence === null ? null : `${enquiry.conversation_confidence}%`} />
            </dl>
          </section>

          <section className="bg-white border rounded-2xl shadow-sm p-5 lg:p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Recommended Products</h2>
            <p className="text-sm text-gray-700 leading-6">{display(enquiry.recommended_products)}</p>
          </section>

          <section className="bg-white border rounded-2xl shadow-sm p-5 lg:p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Missing Information</h2>
            <p className="text-sm text-gray-700 leading-6">{display(summaryValue(enquiry.summary, 'missingInformation'))}</p>
          </section>

          <section className="bg-white border rounded-2xl shadow-sm p-5 lg:p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Suggested Next Action</h2>
            <p className="text-sm text-gray-700 leading-6">{display(summaryValue(enquiry.summary, 'suggestedNextAction'))}</p>
          </section>

          <section className="bg-white border rounded-2xl shadow-sm p-5 lg:p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Special Instructions</h2>
            <p className="text-sm text-gray-700 leading-6">{display(enquiry.special_instructions)}</p>
          </section>
        </div>
      </div>
    </main>
  );
}