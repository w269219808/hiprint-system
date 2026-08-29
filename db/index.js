import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('未在 .env.local 中检测到 DATABASE_URL');
}

// 禁用 prepare 模式以防 Serverless 热重载冲突
const client = postgres(connectionString, { prepare: false });
export const db = drizzle(client, { schema });