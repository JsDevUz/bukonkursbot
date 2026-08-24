import { MyConversation, MyContext } from '../types.js';
import { queries } from '../database/queries.js';
import { getDb } from '../database/db.js';
import { cancelKeyboard } from '../keyboards/index.js';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function broadcastWizard(conversation: MyConversation, ctx: MyContext) {
  const db = getDb();
  const userIds = queries.getAllUserIds(db);

  if (userIds.length === 0) {
    await ctx.reply('⚪️ Botingizda hali birorta ham foydalanuvchi mavjud emas.');
    return;
  }

  await ctx.reply(
    `📢 <b>BARCHAGA XABAR YUBORISH (XABARNOMA)</b>\n\n` +
      `👥 Jami foydalanuvchilar soni: <b>${userIds.length}</b> ta\n\n` +
      `Yubormoqchi bo'lgan xabaringizni yozing yoki boshqa kanaldan <b>FORWARD (yo'naltirish)</b> qiling:\n` +
      `<i>(Matn, rasm, video, audio, ovozli xabar, fayl yoki post barchasi qo'llab-quvvatlanadi)</i>`,
    {
      parse_mode: 'HTML',
      reply_markup: cancelKeyboard,
    }
  );

  const incomingMsg = await conversation.waitFor(['message', 'callback_query:data']);

  if (incomingMsg.callbackQuery?.data === 'cancel_action') {
    await incomingMsg.answerCallbackQuery();
    await incomingMsg.editMessageText('❌ Xabar yuborish bekor qilindi.');
    return;
  }

  if (!incomingMsg.message) {
    await ctx.reply('❌ Noto\'g\'ri xabar formati.');
    return;
  }

  const messageId = incomingMsg.message.message_id;
  const chatId = incomingMsg.message.chat.id;

  // Ask sending method: Clean Copy vs Original Forward
  await ctx.reply(
    `⚙️ <b>Yuborish usulini tanlang:</b>\n\n` +
      `1️⃣ <b>Ko'chirib yuborish (Copy):</b> Xabar toza chiqadi (kanal nomi yoki "Forwarded" yozuvi ko'rinmaydi).\n` +
      `2️⃣ <b>To'g'ridan-to'g'ri Forward:</b> Asl kanal nomi/muallifi bilan forward qilinadi.`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📋 Ko\'chirib yuborish (Tavsiya etiladi)', callback_data: 'send_mode_copy' }],
          [{ text: '↗️ Asl postni Forward qilish', callback_data: 'send_mode_forward' }],
          [{ text: '❌ Bekor qilish', callback_data: 'cancel_action' }],
        ],
      },
    }
  );

  const modeQuery = await conversation.waitForCallbackQuery([
    'send_mode_copy',
    'send_mode_forward',
    'cancel_action',
  ]);

  if (modeQuery.callbackQuery.data === 'cancel_action') {
    await modeQuery.answerCallbackQuery();
    await modeQuery.editMessageText('❌ Bekor qilindi.');
    return;
  }

  const isForward = modeQuery.callbackQuery.data === 'send_mode_forward';
  await modeQuery.answerCallbackQuery();

  const statusMsg = await ctx.reply(
    `⏳ <b>Xabarnoma yuborilmoqda...</b>\n\n` +
      `👥 Jami: <b>${userIds.length}</b> ta\n` +
      `✅ Yetkazildi: <b>0</b>\n` +
      `❌ Yetkazilmadi: <b>0</b>\n\n` +
      `<i>Xavfsiz interval (50ms) bilan yuborilmoqda...</i>`,
    { parse_mode: 'HTML' }
  );

  let sent = 0;
  let failed = 0;
  let lastStatusUpdate = Date.now();

  for (let i = 0; i < userIds.length; i++) {
    const targetUserId = userIds[i];

    try {
      if (isForward) {
        await ctx.api.forwardMessage(targetUserId, chatId, messageId);
      } else {
        await ctx.api.copyMessage(targetUserId, chatId, messageId);
      }
      sent++;
    } catch (err: any) {
      failed++;
      // If Telegram rate limits (429), wait specified time
      if (err?.parameters?.retry_after) {
        console.warn(`Rate limit hit, waiting ${err.parameters.retry_after}s...`);
        await sleep(err.parameters.retry_after * 1000);
      }
    }

    // Interval between each message (50ms = 20 messages per second, safe and fast)
    await sleep(50);

    // Update status progress every 50 users or 3 seconds
    if (Date.now() - lastStatusUpdate > 3000 || i === userIds.length - 1) {
      lastStatusUpdate = Date.now();
      await ctx.api
        .editMessageText(
          statusMsg.chat.id,
          statusMsg.message_id,
          `⏳ <b>Xabarnoma yuborilmoqda...</b> (${i + 1}/${userIds.length})\n\n` +
            `👥 Jami: <b>${userIds.length}</b> ta\n` +
            `✅ Yetkazildi: <b>${sent}</b>\n` +
            `❌ Yetkazilmadi (bloklagan): <b>${failed}</b>`,
          { parse_mode: 'HTML' }
        )
        .catch(() => {});
    }
  }

  // Final summary
  await ctx.api
    .editMessageText(
      statusMsg.chat.id,
      statusMsg.message_id,
      `✅ <b>XABARNOMA MUVAFFAQIYATLI YAKUNLANDI!</b> 🎉\n\n` +
        `👥 Jami foydalanuvchilar: <b>${userIds.length}</b> ta\n` +
        `✅ Muvaffaqiyatli yetkazildi: <b>${sent}</b> ta\n` +
        `❌ Yetkazilmadi (botni bloklaganlar): <b>${failed}</b> ta`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: '👑 Admin menyu', callback_data: 'admin_back' }]],
        },
      }
    )
    .catch(() => {});
}
