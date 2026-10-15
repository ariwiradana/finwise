import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;
if (!connectionString && process.env.NODE_ENV === 'production') {
  throw new Error('DATABASE_URL is required in production. Copy .env.example to .env.local and configure PostgreSQL.');
}

const globalForDb = globalThis as unknown as { pgClient?: ReturnType<typeof postgres> };
const client = globalForDb.pgClient ?? (connectionString ? postgres(connectionString, { max: 5, prepare: false }) : null);
if (process.env.NODE_ENV !== 'production' && client) globalForDb.pgClient = client;

export const db = client ? drizzle(client, { schema }) : null;
export * from './schema';
