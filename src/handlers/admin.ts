import { MyContext } from '../types.js';
import { queries } from '../database/queries.js';
import { getDb } from '../database/db.js';
import { adminMainMenu } from '../keyboards/index.js';
import { formatDateTime, getTimeRemaining, escapeHtml } from '../utils/helpers.js';
import { config } from '../config.js';

export async function handleAdminCommand(ctx: MyContext) {
  if (!ctx.from || !config.isAdmin(ctx.from.id)) {
    return ctx.reply('⛔️ Kechirasiz, siz bot administratori emassiz.');
  }

  const db = getDb();
  const contest = queries.getActiveContest(db);
  const stats = queries.getContestStats(db);

  let msg = `👑 <b>ADMIN BOSHQARUV PANELI</b>\n\n`;

  if (contest) {
    const timeInfo = getTimeRemaining(contest.end_time);
    msg +=
      `🟢 <b>Faol konkurs:</b> ${escapeHtml(contest.title)}\n` +
      `🎁 <b>Sovg'a turi:</b> ${contest.reward_type === 'link' ? 'Kanal havolasi' : 'Material/Post'}\n` +
      `🎯 <b>Kerakli ball:</b> ${contest.target_referrals} ta do'st\n` +
      `🏆 <b>G'oliblar:</b> ${contest.current_winners_count} / ${contest.max_winners} ta\n` +
      `⌛️ <b>Qolgan vaqt:</b> ${timeInfo.text} (${formatDateTime(contest.end_time)})\n\n`;
  } else {
    msg += `⚪️ <b>Hozirda faol konkurs yo'q.</b> Yangi konkurs yaratishingiz mumkin.\n\n`;
  }

  msg +=
    `📊 <b>Umumiy statistika:</b>\n` +
    `👥 Jami qatnashchilar: <b>${stats.totalUsers}</b>\n` +
    `🔗 Jami taklif qilinganlar: <b>${stats.totalReferrals}</b>\n` +
    `🎉 G'oliblar soni: <b>${stats.winnersCount}</b>\n\n` +
    `Quyidagi amallardan birini tanlang:`;

  await ctx.reply(msg, {
    parse_mode: 'HTML',
    reply_markup: adminMainMenu,
  });
}

export async function handleAdminStatsCallback(ctx: MyContext) {
  if (!ctx.from || !config.isAdmin(ctx.from.id)) return;
  await ctx.answerCallbackQuery();

  const db = getDb();
  const contest = queries.getActiveContest(db);
  const leaderboard = queries.getLeaderboard(db, 15);
  const stats = queries.getContestStats(db);

  let msg = `📊 <b>KONKURS STATISTIKASI VA REYTING</b>\n\n`;
  msg +=
    `👥 Jami qatnashchilar: <b>${stats.totalUsers}</b> ta\n` +
    `🔗 Taklif qilingan do'stlar: <b>${stats.totalReferrals}</b> ta\n` +
    `🏆 G'olib bo'lganlar: <b>${stats.winnersCount}</b> ta\n\n`;

  if (contest) {
    const timeInfo = getTimeRemaining(contest.end_time);
    msg += `📌 <b>Faol konkurs:</b> ${escapeHtml(contest.title)}\n`;
    msg += `⏳ <b>Tugash vaqti:</b> ${timeInfo.text}\n\n`;
  }

  msg += `<b>🏅 TOP-15 TAKLIF QILGANLAR (LEADERBOARD):</b>\n`;
  if (leaderboard.length === 0) {
    msg += `<i>Hozircha hech kim odam taklif qilmagan.</i>\n`;
  } else {
    leaderboard.forEach((u, idx) => {
      const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
      const name = escapeHtml(u.first_name || 'Foydalanuvchi');
      const uname = u.username ? `@${u.username}` : `ID: ${u.telegram_id}`;
      const winnerBadge = u.is_winner ? ' 🎁 (G\'olib)' : '';
      msg += `${medal} <b>${name}</b> (${uname}) — <b>${u.referral_count}</b> ta${winnerBadge}\n`;
    });
  }

  await ctx.reply(msg, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [[{ text: '🔙 Admin menyuga qaytish', callback_data: 'admin_back' }]],
    },
  });
}

export async function handleAdminWinnersCallback(ctx: MyContext) {
  if (!ctx.from || !config.isAdmin(ctx.from.id)) return;
  await ctx.answerCallbackQuery();

  const db = getDb();
  const winners = queries.getWinners(db);

  let msg = `🏆 <b>G'OLIBLAR RO'YXATI</b>\n\n`;
  if (winners.length === 0) {
    msg += `<i>Hozircha g'oliblar mavjud emas.</i>`;
  } else {
    winners.forEach((w, idx) => {
      const name = escapeHtml(w.first_name || 'Foydalanuvchi');
      const uname = w.username ? `@${w.username}` : `ID: ${w.telegram_id}`;
      const deliveredStatus = w.reward_delivered ? '✅ Sovg\'a berildi' : '⏳ Kutilmoqda';
      msg += `${idx + 1}. <b>${name}</b> (${uname}) — Ball: <b>${w.referral_count}</b> [${deliveredStatus}]\n`;
    });
  }

  await ctx.reply(msg, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [[{ text: '🔙 Admin menyuga qaytish', callback_data: 'admin_back' }]],
    },
  });
}

export async function handleAdminStopContestCallback(ctx: MyContext) {
  if (!ctx.from || !config.isAdmin(ctx.from.id)) return;
  await ctx.answerCallbackQuery();

  const db = getDb();
  const contest = queries.getActiveContest(db);

  if (!contest) {
    await ctx.reply('⚪️ Hozirda faol konkurs mavjud emas.');
    return;
  }

  await ctx.reply(
    `🛑 <b>"${escapeHtml(contest.title)}"</b> konkursini rostdan ham to'xtatmoqchimisiz?`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Ha, konkursni to\'xtatish', callback_data: `confirm_stop_${contest.id}` }],
          [{ text: 'Bekor qilish', callback_data: 'cancel_action' }],
        ],
      },
    }
  );
}

export async function handleConfirmStopContest(ctx: MyContext, contestId: number) {
  if (!ctx.from || !config.isAdmin(ctx.from.id)) return;
  await ctx.answerCallbackQuery();

  const db = getDb();
  queries.endContest(db, contestId);

  await ctx.reply('✅ Konkurs to\'xtatildi.', {
    reply_markup: {
      inline_keyboard: [[{ text: '👑 Admin menyu', callback_data: 'admin_back' }]],
    },
  });
}
