import { defineConfig } from 'drizzle-kit';
import { loadEnvConfig } from '@next/env';

// 让 Next.js 自动加载项目根目录下的 .env.local 变量
loadEnvConfig(process.cwd());

export default defineConfig({
  schema: './db/schema.js',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});