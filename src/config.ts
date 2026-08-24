import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN || '';
if (!BOT_TOKEN && process.env.NODE_ENV !== 'test') {
  console.warn('⚠️ OGOHLANTIRISH: BOT_TOKEN o\'rnatilmagan! Iltimos .env faylni to\'ldiring.');
}

const adminIdsRaw = process.env.ADMIN_IDS || '';
const ADMIN_IDS: number[] = adminIdsRaw
  .split(',')
  .map((id) => parseInt(id.trim(), 10))
  .filter((id) => !isNaN(id));

export const config = {
  botToken: BOT_TOKEN,
  adminIds: ADMIN_IDS,
  dbPath: process.env.DB_PATH || path.join(process.cwd(), 'data', 'contest.db'),
  useWebhook: process.env.USE_WEBHOOK === 'true',
  domain: process.env.DOMAIN || '',
  port: parseInt(process.env.PORT || '3000', 10),
  webhookSecret: process.env.WEBHOOK_SECRET || 'secret_bot_token_token',
  isAdmin: (id: number) => ADMIN_IDS.includes(id),
};
