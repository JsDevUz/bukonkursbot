import { Api } from 'grammy';
import Database from 'better-sqlite3';
import { queries } from '../database/queries.js';
import { Contest } from '../types.js';
import { getTimeRemaining } from '../utils/helpers.js';

export async function checkAndDeliverReward(
  api: Api,
  db: Database.Database,
  contest: Contest,
  userId: number
): Promise<{ delivered: boolean; error?: string }> {
  // Check if contest is still active & valid
  const timeInfo = getTimeRemaining(contest.end_time);
  if (timeInfo.isExpired) {
    return { delivered: false, error: 'Konkurs muddati yakunlangan.' };
  }

  if (contest.current_winners_count >= contest.max_winners) {
    return { delivered: false, error: 'Maksimal g\'oliblar soniga yetildi.' };
  }

  // Try to mark as winner in database atomically
  const isMarked = queries.markUserAsWinner(db, userId, contest.id);
  if (!isMarked) {
    return { delivered: false, error: 'Foydalanuvchi allaqachon g\'olib bo\'lgan yoki o\'rinlar qolmagan.' };
  }

  try {
    if (contest.reward_type === 'link') {
      if (!contest.reward_channel_id) {
        throw new Error('Kanal ID sozlanmagan');
      }

      // Create one-time single-use invite link (member_limit: 1)
      const inviteLink = await api.createChatInviteLink(contest.reward_channel_id, {
        member_limit: 1,
        name: `G'olib ${userId} uchun havola`,
      });

      await api.sendMessage(
        userId,
        `🎉 <b>TABRIKLAYMIZ! SIZ G'OLIB BO'LDINGIZ!</b> 🎁\n\n` +
          `Siz belgilangan <b>${contest.target_referrals}</b> ta do'stingizni muvaffaqiyatli taklif qildingiz!\n\n` +
          `👇 Sizning bir martalik maxsus havolangiz:\n${inviteLink.invite_link}\n\n` +
          `<i>⚠️ Eslatma: Ushbu havola faqat bir marta ishlaydi va faqat siz uchun!</i>`,
        { parse_mode: 'HTML' }
      );
    } else if (contest.reward_type === 'material') {
      if (!contest.reward_message) {
        throw new Error('Sovrin materiali topilmadi');
      }

      const rewardData = JSON.parse(contest.reward_message) as {
        chat_id: number;
        message_id: number;
      };

      await api.sendMessage(
        userId,
        `🎉 <b>TABRIKLAYMIZ! SIZ G'OLIB BO'LDINGIZ!</b> 🎁\n\n` +
          `Siz belgilangan <b>${contest.target_referrals}</b> ta do'stingizni muvaffaqiyatli taklif qildingiz! Sovg'angiz quyida:`,
        { parse_mode: 'HTML' }
      );

      // Forward or copy the reward message to user
      await api.copyMessage(userId, rewardData.chat_id, rewardData.message_id);
    }

    queries.markRewardDelivered(db, userId);
    return { delivered: true };
  } catch (err: any) {
    console.error('Sovg\'a yuborishda xatolik:', err);
    await api.sendMessage(
      userId,
      `🎉 <b>TABRIKLAYMIZ! SIZ G'OLIB BO'LDINGIZ!</b> 🎁\n\n` +
        `Siz barcha shartlarni bajardingiz. Sovg'ani qabul qilishda texnik muammo yuzaga keldi. Tez orada admin sizga sovg'ani taqdim etadi.`,
      { parse_mode: 'HTML' }
    );
    return { delivered: false, error: err.message };
  }
}
