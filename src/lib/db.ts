import { Pool, QueryResult, QueryResultRow } from 'pg';

const connectionString = process.env.DATABASE_URL;

declare global {
  var pgPool: Pool | null | undefined;
}

const pool: Pool | null = connectionString
  ? global.pgPool ?? new Pool({
      connectionString,
      connectionTimeoutMillis: 5000,
      query_timeout: 5000,
      statement_timeout: 5000,
    })
  : null;

if (process.env.NODE_ENV !== 'production' && connectionString) {
  global.pgPool = pool;
}

function getPool(): Pool {
  if (!pool) {
    throw new Error('DATABASE_URL must be set in environment variables');
  }

  return pool;
}

const db = {
  query: async <T extends QueryResultRow = QueryResultRow>(...args: unknown[]): Promise<QueryResult<T>> => {
    const pool = getPool();
    const queryFn = pool.query.bind(pool) as (...args: unknown[]) => Promise<QueryResult<T>>;
    return queryFn(...args);
  },
};

export default db;
