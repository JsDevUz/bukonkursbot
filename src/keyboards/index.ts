import { InlineKeyboard } from 'grammy';
import { generateReferralLink } from '../utils/helpers.js';

export function getUserInlineDashboard(botUsername: string, userId: number, contestTitle: string) {
  const refLink = generateReferralLink(botUsername, userId);
  const shareText = encodeURIComponent(
    `🎁 "${contestTitle}" konkursida qatnashing va qimmatbaho sovg'aga ega bo'ling!\n👉 Havola: ${refLink}`
  );
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${shareText}`;

  return new InlineKeyboard()
    .url('🚀 Do\'stlarga ulashish', shareUrl)
    .row()
    .text('📊 Mening ballim & Natija', 'user_score')
    .text('🏆 TOP-10 Reyting', 'user_leaderboard')
    .row()
    .text('🎁 Sovg\'ani tekshirish', 'user_claim')
    .text('ℹ️ Qoidalar', 'user_rules')
    .row()
    .text('🔄 Yangilash', 'user_refresh');
}

export const userBackToMenuKeyboard = new InlineKeyboard()
  .text('🔙 Asosiy menyuga qaytish', 'user_back_to_menu');

export function getShareKeyboard(botUsername: string, userId: number, contestTitle: string) {
  return getUserInlineDashboard(botUsername, userId, contestTitle);
}

export const adminMainMenu = new InlineKeyboard()
  .text('➕ Yangi konkurs yaratish', 'admin_create_contest')
  .row()
  .text('📊 Statistika & Reyting', 'admin_stats')
  .text('🏆 G\'oliblar', 'admin_winners')
  .row()
  .text('📢 Barchaga xabar yuborish', 'admin_broadcast')
  .row()
  .text('🛑 Faol konkursni to\'xtatish', 'admin_stop_contest');

export const cancelKeyboard = new InlineKeyboard().text('❌ Bekor qilish', 'cancel_action');

export const rewardTypeKeyboard = new InlineKeyboard()
  .text('🔗 Kanalga Bir martalik Link', 'reward_type_link')
  .row()
  .text('📚 Kitob / Fayl / Material (Post)', 'reward_type_material')
  .row()
  .text('❌ Bekor qilish', 'cancel_action');
