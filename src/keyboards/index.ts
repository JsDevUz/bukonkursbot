import { InlineKeyboard, Keyboard } from 'grammy';
import { generateReferralLink } from '../utils/helpers.js';

export const userMainMenu = new Keyboard()
  .text('🔗 Referal havolam')
  .text('📊 Mening ballim')
  .row()
  .text('🏆 Reyting & G\'oliblar')
  .text('ℹ️ Qoidalar')
  .resized();

export function getShareKeyboard(botUsername: string, userId: number, contestTitle: string) {
  const refLink = generateReferralLink(botUsername, userId);
  const shareText = encodeURIComponent(
    `🎁 "${contestTitle}" konkursida qatnashing va qimmatbaho sovg'aga ega bo'ling!\n👉 Havola: ${refLink}`
  );
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${shareText}`;

  return new InlineKeyboard()
    .url('↗️ Do\'stlarga ulashish', shareUrl)
    .row()
    .text('🔄 Ballni tekshirish', 'check_my_score');
}

export const adminMainMenu = new InlineKeyboard()
  .text('➕ Yangi konkurs yaratish', 'admin_create_contest')
  .row()
  .text('📊 Statistika & Reyting', 'admin_stats')
  .row()
  .text('🏆 G\'oliblar ro\'yxati', 'admin_winners')
  .row()
  .text('🛑 Faol konkursni to\'xtatish', 'admin_stop_contest');

export const cancelKeyboard = new InlineKeyboard().text('❌ Bekor qilish', 'cancel_action');

export const rewardTypeKeyboard = new InlineKeyboard()
  .text('🔗 Kanalga Bir martalik Link', 'reward_type_link')
  .row()
  .text('📚 Kitob / Fayl / Material (Post)', 'reward_type_material')
  .row()
  .text('❌ Bekor qilish', 'cancel_action');
