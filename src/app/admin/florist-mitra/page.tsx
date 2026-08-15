import db from '@/lib/db';
import type { QueryResultRow } from 'pg';

export const dynamic = 'force-dynamic';

interface TopUserRow extends QueryResultRow {
  business_name: string;
  membership_number: string;
  questions: number;
}

async function getUsageStats() {
  const currentMonth = new Date().toISOString().slice(0, 7);
  
  const totalUsage = await db.query(
    'SELECT SUM(questions) as total FROM member_usage'
  );
  
  const monthlyUsage = await db.query(
    'SELECT SUM(questions) as total FROM member_usage WHERE month = $1',
    [currentMonth]
  );
  
  const topUsers = await db.query<TopUserRow>(
    `SELECT mu.month, mu.questions, m.business_name, m.membership_number
     FROM member_usage mu
     JOIN members m ON mu.user_id = m.id
     WHERE mu.month = $1
     ORDER BY mu.questions DESC
     LIMIT 10`,
    [currentMonth]
  );
  
  const totalSessions = await db.query(
    'SELECT COUNT(*) as count FROM chat_sessions'
  );
  
  const monthlySessions = await db.query(
    `SELECT COUNT(*) as count 
     FROM chat_sessions 
     WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)`
  );
  
  return {
    totalQuestions: totalUsage.rows[0]?.total || 0,
    monthlyQuestions: monthlyUsage.rows[0]?.total || 0,
    topUsers: topUsers.rows,
    totalSessions: totalSessions.rows[0]?.count || 0,
    monthlySessions: monthlySessions.rows[0]?.count || 0,
  };
}

export default async function AdminFloristMitra() {
  const stats = await getUsageStats();

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">Flora Receptionist Admin</h1>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-600 mb-2">Total Questions (All Time)</h3>
          <p className="text-3xl font-bold text-green-900">{stats.totalQuestions}</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-600 mb-2">Questions This Month</h3>
          <p className="text-3xl font-bold text-green-900">{stats.monthlyQuestions}</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-600 mb-2">Total Sessions</h3>
          <p className="text-3xl font-bold text-green-900">{stats.totalSessions}</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-600 mb-2">Sessions This Month</h3>
          <p className="text-3xl font-bold text-green-900">{stats.monthlySessions}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Top Users This Month</h2>
        
        {stats.topUsers.length === 0 ? (
          <p className="text-gray-500">No usage data for this month yet</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Member</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Membership No</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Questions</th>
              </tr>
            </thead>
            <tbody>
              {stats.topUsers.map((user: TopUserRow, idx: number) => (
                <tr key={idx} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4">{user.business_name}</td>
                  <td className="py-3 px-4 text-gray-600">{user.membership_number}</td>
                  <td className="py-3 px-4 text-right font-semibold">{user.questions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-8 bg-blue-50 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-blue-900 mb-2">Usage Limits</h3>
        <p className="text-blue-800">
          Each member has a limit of 50 questions per month. The system automatically tracks usage 
          and prevents members from exceeding their limit. Limits reset on the 1st of each month.
        </p>
      </div>
    </div>
  );
}
