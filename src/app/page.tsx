import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <section className="w-full max-w-3xl bg-white border rounded-2xl shadow-sm p-6 lg:p-10 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl">
          🌸
        </div>
        <p className="text-sm font-semibold text-green-700 mb-2">Flora Receptionist</p>
        <h1 className="text-3xl lg:text-5xl font-bold text-gray-900 mb-4">
          Your Smart Receptionist for Florists.
        </h1>
        <p className="text-gray-600 max-w-xl mx-auto mb-6">
          Available 24×7 to welcome customers, answer enquiries, recommend flowers and capture leads for florist businesses.
        </p>
        <Link
          href="/dashboard/florist-mitra"
          className="inline-flex items-center justify-center rounded-xl bg-green-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-green-800"
        >
          Start Conversation
        </Link>
        <p className="text-xs text-gray-500 mt-6">Powered by Floraprise</p>
      </section>
    </main>
  );
}