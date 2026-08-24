import { MyContext } from '../types.js';
import { queries } from '../database/queries.js';
import { getDb } from '../database/db.js';
import { checkAndDeliverReward } from '../services/contest.js';
import {
  userMainMenu,
  getUserInlineDashboard,
  userBackToMenuKeyboard,
} from '../keyboards/index.js';
import {
  formatDateTime,
  getTimeRemaining,
  generateReferralLink,
  escapeHtml,
  generateProgressBar,
} from '../utils/helpers.js';

export function getDashboardText(
  user: {
    telegram_id: number;
    first_name: string;
    referral_count: number;
    is_winner: number;
  },
  contest: {
    title: string;
    description: string;
    target_referrals: number;
    max_winners: number;
    current_winners_count: number;
    end_time: string;
    reward_type: string;
  },
  botUsername: string
): string {
  const timeInfo = getTimeRemaining(contest.end_time);
  const refLink = generateReferralLink(botUsername, user.telegram_id);
  const progressBar = generateProgressBar(user.referral_count, contest.target_referrals, 8);
  const remaining = Math.max(0, contest.target_referrals - user.referral_count);

  let text =
    `✨ <b>${escapeHtml(contest.title).toUpperCase()}</b> ✨\n\n` +
    `📖 ${escapeHtml(contest.description)}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🎁 <b>Sovg'a turi:</b> ${contest.reward_type === 'link' ? '🔗 Maxsus kanalga 1 martalik link' : '📚 Eksklyuziv material / kitob'}\n` +
    `🎯 <b>Talab:</b> ${contest.target_referrals} ta do'stni taklif qilish\n` +
    `🏆 <b>G'oliblar o'rni:</b> <b>${contest.current_winners_count} / ${contest.max_winners}</b> ta band\n` +
    `⏳ <b>Qolgan vaqt:</b> <b>${timeInfo.text}</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `👤 <b>ISHTIROKCHI STATISTIKASI:</b>\n` +
    `📊 <b>Progress:</b> <code>[${progressBar}]</code>\n` +
    `👥 <b>Taklif qilinganlar:</b> <b>${user.referral_count} / ${contest.target_referrals}</b> ta do'st\n`;

  if (user.is_winner) {
    text += `🎉 <b>Holat:</b> <b>G'OLIB BO'LDINGIZ! 🎁</b>\n`;
  } else if (remaining === 0) {
    text += `🎉 <b>Holat:</b> Shart bajarildi! Sovg'angizni oling!\n`;
  } else {
    text += `⚡️ <i>Sovg'ani yutib olish uchun yana <b>${remaining}</b> ta do'stingizni taklif qiling!</i>\n`;
  }

  text +=
    `\n🔗 <b>Sizning shaxsiy referal havolangiz:</b>\n` +
    `<code>${refLink}</code>\n\n` +
    `👇 <i>Do'stlaringizga ulashish uchun quyidagi tugmani bosing:</i>`;

  return text;
}

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
  if (!user.referred_by && referrerId && contest && contest.is_active) {
    const refResult = queries.registerReferral(db, referrerId, ctx.from.id);
    if (refResult.success && refResult.referrer) {
      const referrer = refResult.referrer;
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
        `⚪️ <b>Hozirda faol konkurs mavjud emas.</b>\n` +
        `Tez orada ajoyib sovg'alar bilan yangi konkurs boshlanadi. Yangiliklarni kuzatib boring!`,
      {
        parse_mode: 'HTML',
        reply_markup: userMainMenu,
      }
    );
    return;
  }

  const bannerText = getDashboardText(user, contest, botInfo.username);
  const inlineMenu = getUserInlineDashboard(botInfo.username, ctx.from.id, contest.title);

  if (contest.photo_file_id) {
    try {
      await ctx.replyWithPhoto(contest.photo_file_id, {
        caption: bannerText.length > 1024 ? bannerText.substring(0, 1020) + '...' : bannerText,
        parse_mode: 'HTML',
        reply_markup: inlineMenu,
      });
    } catch (photoErr) {
      console.warn('Rasm yuborishda xatolik, matn yuborilmoqda:', photoErr);
      await ctx.reply(bannerText, {
        parse_mode: 'HTML',
        reply_markup: inlineMenu,
      });
    }
  } else {
    await ctx.reply(bannerText, {
      parse_mode: 'HTML',
      reply_markup: inlineMenu,
    });
  }

  // Also send bottom keyboard for instant access
  await ctx.reply('👇 Tezkor menyudan ham foydalanishingiz mumkin:', {
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
  const progressBar = generateProgressBar(count, target, 8);

  let msg =
    `📊 <b>SHAXSIY STATISTIKA VA BALLAR:</b>\n\n` +
    `👤 <b>Ism:</b> ${escapeHtml(ctx.from.first_name)}\n` +
    `🆔 <b>ID:</b> <code>${ctx.from.id}</code>\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📈 <b>Progress:</b> <code>[${progressBar}]</code>\n` +
    `👥 <b>Taklif qilingan do'stlar:</b> <b>${count}</b> ta\n` +
    `🎯 <b>Kerakli do'stlar soni:</b> <b>${target}</b> ta\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  if (user?.is_winner) {
    msg += `🎉 <b>Holat:</b> <b>SIZ G'OLIB BO'LGANSIZ! 🎁</b>\n`;
  } else if (remaining === 0) {
    msg += `🎉 <b>Holat:</b> Shart bajarildi! Sovg'angiz berilmoqda...\n`;
    await checkAndDeliverReward(ctx.api, db, contest, ctx.from.id);
  } else {
    msg += `⚡️ Sovg'ani yutib olish uchun yana <b>${remaining}</b> ta do'st taklif qiling!\n`;
  }

  msg += `\n🔗 <b>Sizning taklif havolangiz:</b>\n<code>${refLink}</code>`;

  await ctx.reply(msg, {
    parse_mode: 'HTML',
    reply_markup: getUserInlineDashboard(botInfo.username, ctx.from.id, contest.title),
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
    `🚀 <b>SIZNING SHAXSIY REFERAL HAVOLANGIZ:</b>\n\n` +
    `<code>${refLink}</code>\n\n` +
    `📌 <b>Qanday ishlaydi?</b>\n` +
    `1. Quyidagi <b>"🚀 Do'stlarga ulashish"</b> tugmasini bosing;\n` +
    `2. Do'stlaringiz yoki guruhlarga yuboring;\n` +
    `3. Havolangiz orqali botga kirgan har bir inson uchun sizga <b>1 ball</b> beriladi!`;

  await ctx.reply(msg, {
    parse_mode: 'HTML',
    reply_markup: getUserInlineDashboard(botInfo.username, ctx.from.id, title),
  });
}

export async function handleLeaderboard(ctx: MyContext) {
  const db = getDb();
  const leaderboard = queries.getLeaderboard(db, 10);
  const contest = queries.getActiveContest(db);

  let msg = `🏆 <b>KONKURS YETAKCHILARI (TOP-10):</b>\n\n`;

  if (leaderboard.length === 0) {
    msg += `<i>Hozircha hech kim odam taklif qilmagan. Birinchi bo'lib do'stlaringizni taklif qiling va sovg'aga ega bo'ling!</i>\n`;
  } else {
    leaderboard.forEach((u, idx) => {
      const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `<b>${idx + 1}.</b>`;
      const name = escapeHtml(u.first_name || 'Foydalanuvchi');
      const winnerStatus = u.is_winner ? ' 🎁 (G\'olib)' : '';
      msg += `${medal} <b>${name}</b> — <b>${u.referral_count}</b> ta taklif${winnerStatus}\n`;
    });
  }

  if (contest) {
    msg += `\n🎯 <i>Sovg'a uchun talab: <b>${contest.target_referrals}</b> ta taklif.</i>`;
  }

  await ctx.reply(msg, {
    parse_mode: 'HTML',
    reply_markup: userBackToMenuKeyboard,
  });
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
    `ℹ️ <b>KONKURS QOIDALARI VA SHARTLARI:</b>\n\n` +
    `1️⃣ <b>Referal havola:</b> O'zingizning shaxsiy havolangizni oling.\n` +
    `2️⃣ <b>Do'stlarni jalb qilish:</b> Havolani tanishlaringiz va guruhlarga yuboring.\n` +
    `3️⃣ <b>Sovg'ani olish:</b> <b>${contest.target_referrals}</b> ta do'stingiz botga kirishi bilan bot sizga avtomatik sovg'ani taqdim etadi!\n` +
    `4️⃣ <b>Cheklangan o'rinlar:</b> Jami maksimal <b>${contest.max_winners}</b> ta g'olibga sovg'a beriladi.\n` +
    `5️⃣ <b>Muddati:</b> Konkurs tugashiga <b>${timeInfo.text}</b> qoldi (${formatDateTime(contest.end_time)} gacha).\n\n` +
    `⚠️ <i>DIQQAT: Nakrutka, soxta yoki bot hisoblarni qo'shish qat'iyan taqiqlanadi!</i>`;

  await ctx.reply(msg, {
    parse_mode: 'HTML',
    reply_markup: userBackToMenuKeyboard,
  });
}

// INLINE CALLBACK HANDLERS
export async function handleUserScoreCallback(ctx: MyContext) {
  await ctx.answerCallbackQuery();
  await handleMyScore(ctx);
}

export async function handleUserLeaderboardCallback(ctx: MyContext) {
  await ctx.answerCallbackQuery();
  await handleLeaderboard(ctx);
}

export async function handleUserClaimCallback(ctx: MyContext) {
  if (!ctx.from) return;
  const db = getDb();
  const user = queries.getUser(db, ctx.from.id);
  const contest = queries.getActiveContest(db);

  if (!contest || !contest.is_active) {
    await ctx.answerCallbackQuery({ text: 'Hozirda faol konkurs yo\'q', show_alert: true });
    return;
  }

  const count = user ? user.referral_count : 0;
  if (user?.is_winner) {
    await ctx.answerCallbackQuery({ text: 'Siz allaqachon sovg\'ani qabul qilgansiz! 🎁', show_alert: true });
  } else if (count >= contest.target_referrals) {
    await ctx.answerCallbackQuery({ text: 'Tabriklaymiz! Sovg\'angiz tekshirilmoqda...', show_alert: false });
    await checkAndDeliverReward(ctx.api, db, contest, ctx.from.id);
  } else {
    const remaining = contest.target_referrals - count;
    await ctx.answerCallbackQuery({
      text: `Sizda hozircha ${count}/${contest.target_referrals} ta taklif bor. Yana ${remaining} ta do'stingizni taklif qiling!`,
      show_alert: true,
    });
  }
}

export async function handleUserRulesCallback(ctx: MyContext) {
  await ctx.answerCallbackQuery();
  await handleRules(ctx);
}

export async function handleUserRefreshCallback(ctx: MyContext) {
  if (!ctx.from) return;
  const db = getDb();
  const user = queries.getUser(db, ctx.from.id);
  const contest = queries.getActiveContest(db);
  const botInfo = ctx.me;

  await ctx.answerCallbackQuery({ text: '✅ Ma\'lumotlar yangilandi!' });

  if (!contest || !contest.is_active || !user) {
    await handleStart(ctx);
    return;
  }

  const bannerText = getDashboardText(user, contest, botInfo.username);
  const inlineMenu = getUserInlineDashboard(botInfo.username, ctx.from.id, contest.title);

  try {
    if (ctx.callbackQuery?.message?.text) {
      await ctx.editMessageText(bannerText, {
        parse_mode: 'HTML',
        reply_markup: inlineMenu,
      });
    } else if (ctx.callbackQuery?.message?.caption) {
      await ctx.editMessageCaption({
        caption: bannerText.length > 1024 ? bannerText.substring(0, 1020) + '...' : bannerText,
        parse_mode: 'HTML',
        reply_markup: inlineMenu,
      });
    }
  } catch {
    // Message not modified or cannot edit
  }
}

export async function handleUserBackToMenu(ctx: MyContext) {
  await ctx.answerCallbackQuery();
  await handleStart(ctx);
}
