import { MyContext } from '../types.js';
import { queries } from '../database/queries.js';
import { getDb } from '../database/db.js';
import { checkAndDeliverReward } from '../services/contest.js';
import { userMainMenu, getShareKeyboard } from '../keyboards/index.js';
import {
  formatDateTime,
  getTimeRemaining,
  generateReferralLink,
  escapeHtml,
} from '../utils/helpers.js';

export async function handleStart(ctx: MyContext) {
  if (!ctx.from) return;

  const db = getDb();
  const contest = queries.getActiveContest(db);
  const botInfo = ctx.me;

  // Extract referral payload (e.g., /start ref_12345678 or /start 12345678)
  const rawPayload = (ctx.match as string | undefined)?.trim();
  let referrerId: number | null = null;

  if (rawPayload) {
    const cleanPayload = rawPayload.replace(/^ref_/, '');
    const parsedId = parseInt(cleanPayload, 10);
    if (!isNaN(parsedId) && parsedId !== ctx.from.id) {
      referrerId = parsedId;
    }
  }

  // Register or update user
  const { user } = queries.upsertUser(db, {
    telegram_id: ctx.from.id,
    first_name: ctx.from.first_name,
    last_name: ctx.from.last_name,
    username: ctx.from.username,
    referred_by: referrerId,
  });

  // If user hasn't been referred yet and came via a valid referral link during an active contest
  let referrerName: string | null = null;
  if (!user.referred_by && referrerId && contest && contest.is_active) {
    const refResult = queries.registerReferral(db, referrerId, ctx.from.id);
    if (refResult.success && refResult.referrer) {
      const referrer = refResult.referrer;
      referrerName = referrer.first_name || 'Do\'stingiz';
      const progress = `${referrer.referral_count} / ${contest.target_referrals}`;

      // Notify referrer about new invite
      try {
        await ctx.api.sendMessage(
          referrer.telegram_id,
          `➕ <b>Yangi do'stingiz qo'shildi!</b> 🎉\n\n` +
            `👤 <b>${escapeHtml(ctx.from.first_name)}</b> sizning havolangiz orqali kirdi.\n` +
            `📊 Sizning hozirgi balingiz: <b>${progress}</b> ta`,
          { parse_mode: 'HTML' }
        );

        // Check if referrer reached the target to win
        if (referrer.referral_count >= contest.target_referrals && !referrer.is_winner) {
          await checkAndDeliverReward(ctx.api, db, contest, referrer.telegram_id);
        }
      } catch (err) {
        console.error('Referal xabarnoma yuborishda xatolik:', err);
      }
    }
  }

  // Send Contest Info / Welcome Banner
  if (!contest || !contest.is_active) {
    await ctx.reply(
      `👋 Assalomu alaykum, <b>${escapeHtml(ctx.from.first_name)}</b>!\n\n` +
        `Hozirda faol konkurs mavjud emas. Yangiliklarni kuzatib boring!`,
      {
        parse_mode: 'HTML',
        reply_markup: userMainMenu,
      }
    );
    return;
  }

  const timeInfo = getTimeRemaining(contest.end_time);
  const refLink = generateReferralLink(botInfo.username, ctx.from.id);

  let bannerText =
    `🎁 <b>${escapeHtml(contest.title)}</b>\n\n` +
    `${escapeHtml(contest.description)}\n\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `🎯 <b>G'olib bo'lish sharti:</b> ${contest.target_referrals} ta do'stni taklif qilish\n` +
    `🏆 <b>G'oliblar o'rni:</b> ${contest.current_winners_count} / ${contest.max_winners} ta\n` +
    `⏳ <b>Qolgan vaqt:</b> ${timeInfo.text} (${formatDateTime(contest.end_time)})\n` +
    `━━━━━━━━━━━━━━━━━━\n\n` +
    `🔗 <b>Sizning shaxsiy referal havolangiz:</b>\n` +
    `<code>${refLink}</code>\n\n` +
    `📊 <b>Sizning balingiz:</b> ${user.referral_count} / ${contest.target_referrals} ta\n` +
    (user.is_winner ? `🎉 <i>Siz g'olib bo'lgansiz!</i>\n` : ``) +
    `\n<i>Do'stlaringizga ulashing va sovg'aga ega bo'ling!</i>`;

  const shareMarkup = getShareKeyboard(botInfo.username, ctx.from.id, contest.title);

  if (contest.photo_file_id) {
    await ctx.replyWithPhoto(contest.photo_file_id, {
      caption: bannerText,
      parse_mode: 'HTML',
      reply_markup: shareMarkup,
    });
  } else {
    await ctx.reply(bannerText, {
      parse_mode: 'HTML',
      reply_markup: shareMarkup,
    });
  }

  // Also send main reply keyboard for easy navigation
  await ctx.reply('Quyidagi menyu orqali botdan foydalanishingiz mumkin:', {
    reply_markup: userMainMenu,
  });
}

export async function handleMyScore(ctx: MyContext) {
  if (!ctx.from) return;
  const db = getDb();
  const user = queries.getUser(db, ctx.from.id);
  const contest = queries.getActiveContest(db);
  const botInfo = ctx.me;

  if (!contest || !contest.is_active) {
    await ctx.reply('⚪️ Hozirda faol konkurs mavjud emas.');
    return;
  }

  const count = user ? user.referral_count : 0;
  const target = contest.target_referrals;
  const remaining = Math.max(0, target - count);
  const refLink = generateReferralLink(botInfo.username, ctx.from.id);

  let msg =
    `📊 <b>SIZNING KO'RSATKICHLARINGIZ:</b>\n\n` +
    `👤 <b>Ism:</b> ${escapeHtml(ctx.from.first_name)}\n` +
    `👥 <b>Taklif qilgan do'stlaringiz:</b> <b>${count}</b> ta\n` +
    `🎯 <b>Kerakli do'stlar soni:</b> <b>${target}</b> ta\n`;

  if (user?.is_winner) {
    msg += `🎉 <b>Holat:</b> G'olib bo'lgansiz! 🎁\n`;
  } else if (remaining === 0) {
    msg += `🎉 <b>Holat:</b> Shart bajarilgan! Sovg'angiz berilmoqda...\n`;
    await checkAndDeliverReward(ctx.api, db, contest, ctx.from.id);
  } else {
    msg += `⚡️ Sovg'aga erishish uchun yana <b>${remaining}</b> ta do'stingizni taklif qiling!\n`;
  }

  msg += `\n🔗 <b>Sizning taklif havolangiz:</b>\n<code>${refLink}</code>`;

  await ctx.reply(msg, {
    parse_mode: 'HTML',
    reply_markup: getShareKeyboard(botInfo.username, ctx.from.id, contest.title),
  });
}

export async function handleReferralLinkMenu(ctx: MyContext) {
  if (!ctx.from) return;
  const db = getDb();
  const contest = queries.getActiveContest(db);
  const botInfo = ctx.me;

  const refLink = generateReferralLink(botInfo.username, ctx.from.id);
  const title = contest ? contest.title : 'Telegram Konkurs';

  const msg =
    `🔗 <b>SIZNING SHAXSIY REFERAL HAVOLANGIZ:</b>\n\n` +
    `<code>${refLink}</code>\n\n` +
    `Ushbu havolani do'stlaringizga, guruhlarga yoki kanallarga tarqating. Havolangiz orqali botga kirgan har bir inson sizga 1 ball keltiradi!`;

  await ctx.reply(msg, {
    parse_mode: 'HTML',
    reply_markup: getShareKeyboard(botInfo.username, ctx.from.id, title),
  });
}

export async function handleLeaderboard(ctx: MyContext) {
  const db = getDb();
  const leaderboard = queries.getLeaderboard(db, 10);
  const contest = queries.getActiveContest(db);

  let msg = `🏆 <b>KONKURS YETAKCHILARI (TOP-10):</b>\n\n`;

  if (leaderboard.length === 0) {
    msg += `<i>Hozircha ball to'plagan ishtirokchilar yo'q. Birinchi bo'lib do'stlaringizni taklif qiling!</i>`;
  } else {
    leaderboard.forEach((u, idx) => {
      const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
      const name = escapeHtml(u.first_name || 'Foydalanuvchi');
      const winnerStatus = u.is_winner ? ' 🎁' : '';
      msg += `${medal} <b>${name}</b> — <b>${u.referral_count}</b> ta taklif${winnerStatus}\n`;
    });
  }

  if (contest) {
    msg += `\n🎯 Sovg'a uchun talab: <b>${contest.target_referrals}</b> ta do'st.`;
  }

  await ctx.reply(msg, { parse_mode: 'HTML' });
}

export async function handleRules(ctx: MyContext) {
  const db = getDb();
  const contest = queries.getActiveContest(db);

  if (!contest) {
    await ctx.reply('⚪️ Hozirda faol konkurs yo\'q.');
    return;
  }

  const timeInfo = getTimeRemaining(contest.end_time);

  const msg =
    `ℹ️ <b>KONKURS QOIDALARI:</b>\n\n` +
    `1. O'zingizning shaxsiy referal havolangizni oling.\n` +
    `2. Havolani do'stlaringizga va tanishlaringizga yuboring.\n` +
    `3. <b>${contest.target_referrals}</b> ta do'stingiz botga kirishi bilan sizga avtomatik tarzda sovg'a taqdim etiladi!\n` +
    `4. Sovg'alar soni cheklangan: maksimal <b>${contest.max_winners}</b> ta g'olibga beriladi.\n` +
    `5. Konkurs muddati: <b>${timeInfo.text}</b> qoldi (${formatDateTime(contest.end_time)} gacha).\n\n` +
    `⚠️ <i>Har qanday firibgarlik (nakrutka yoki soxta hisoblar) aniqlansa, ishtirokchi chetlashtiriladi.</i>`;

  await ctx.reply(msg, { parse_mode: 'HTML' });
}
