import { MyContext } from '../types.js';

export function formatDateTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleString('uz-UZ', {
      timeZone: 'Asia/Tashkent',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

export function getTimeRemaining(isoString: string): {
  isExpired: boolean;
  text: string;
} {
  const target = new Date(isoString).getTime();
  const now = Date.now();
  const diff = target - now;

  if (diff <= 0) {
    return { isExpired: true, text: 'Vaqt tugagan ⌛️' };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);

  const parts = [];
  if (days > 0) parts.push(`${days} kun`);
  if (hours > 0) parts.push(`${hours} soat`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes} daqiqa`);

  return { isExpired: false, text: parts.join(' ') };
}

export function generateReferralLink(botUsername: string, userId: number): string {
  return `https://t.me/${botUsername}?start=ref_${userId}`;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function generateProgressBar(current: number, total: number, barLength: number = 8): string {
  if (total <= 0) return '▰'.repeat(barLength);
  const percentage = Math.min(1, Math.max(0, current / total));
  const filled = Math.round(percentage * barLength);
  const empty = barLength - filled;
  const percentText = Math.round(percentage * 100);
  return `${'▰'.repeat(filled)}${'▱'.repeat(empty)} ${percentText}%`;
}

export async function safeEditMessage(
  ctx: MyContext,
  text: string,
  replyMarkup?: any
): Promise<void> {
  try {
    if (ctx.callbackQuery?.message?.caption !== undefined) {
      await ctx.editMessageCaption({
        caption: text.length > 1024 ? text.substring(0, 1020) + '...' : text,
        parse_mode: 'HTML',
        reply_markup: replyMarkup,
      });
    } else if (ctx.callbackQuery?.message) {
      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        reply_markup: replyMarkup,
      });
    } else {
      await ctx.reply(text, {
        parse_mode: 'HTML',
        reply_markup: replyMarkup,
      });
    }
  } catch (err: any) {
    if (!err.message?.includes('message is not modified')) {
      await ctx.reply(text, {
        parse_mode: 'HTML',
        reply_markup: replyMarkup,
      });
    }
  }
}
