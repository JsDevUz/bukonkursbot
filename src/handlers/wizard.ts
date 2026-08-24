import { MyConversation, MyContext, RewardType } from '../types.js';
import { queries } from '../database/queries.js';
import { getDb } from '../database/db.js';
import { rewardTypeKeyboard, cancelKeyboard } from '../keyboards/index.js';
import { formatDateTime } from '../utils/helpers.js';

export async function createContestWizard(conversation: MyConversation, ctx: MyContext) {
  const db = getDb();
  const activeContest = queries.getActiveContest(db);

  if (activeContest) {
    await ctx.reply(
      `⚠️ <b>Diqqat!</b> Hozirda faol konkurs mavjud:\n` +
        `📌 <b>${activeContest.title}</b> (Tugash vaqti: ${formatDateTime(activeContest.end_time)})\n\n` +
        `Yangi konkurs yaratsangiz, eski konkurs yakunlanadi va foydalanuvchilarning referal ballari yangilanadi.\n\n` +
        `Davom etishni xohlaysizmi?`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Ha, yangi konkurs yaratish', callback_data: 'confirm_new_contest' }],
            [{ text: '❌ Bekor qilish', callback_data: 'cancel_action' }],
          ],
        },
      }
    );

    const confirmation = await conversation.waitForCallbackQuery([
      'confirm_new_contest',
      'cancel_action',
    ]);
    if (confirmation.callbackQuery.data === 'cancel_action') {
      await confirmation.answerCallbackQuery();
      await confirmation.editMessageText('❌ Konkurs yaratish bekor qilindi.');
      return;
    }
    await confirmation.answerCallbackQuery();
  }

  // 1. Konkurs sarlavhasi va matni / rasmi
  await ctx.reply(
    `📝 <b>1-Qadam: Konkurs posti</b>\n\n` +
      `Konkurs postini yuboring. Rasm va uning tagida izoh (caption) yoki shunchaki matn yuborishingiz mumkin.`,
    {
      parse_mode: 'HTML',
      reply_markup: cancelKeyboard,
    }
  );

  let title = 'Telegram Konkurs';
  let description = '';
  let photo_file_id: string | null = null;

  const postMsg = await conversation.waitFor([
    'message:text',
    'message:photo',
    'callback_query:data',
  ]);

  if (postMsg.callbackQuery && postMsg.callbackQuery.data === 'cancel_action') {
    await postMsg.answerCallbackQuery();
    await postMsg.editMessageText('❌ Konkurs yaratish bekor qilindi.');
    return;
  }

  if (postMsg.message?.photo) {
    const photos = postMsg.message.photo;
    photo_file_id = photos[photos.length - 1].file_id;
    description = postMsg.message.caption || 'Konkursda ishtirok eting va sovg\'alarga ega bo\'ling!';
    title = description.split('\n')[0].substring(0, 50);
  } else if (postMsg.message?.text) {
    description = postMsg.message.text;
    title = description.split('\n')[0].substring(0, 50);
  } else {
    await ctx.reply('❌ Noto\'g\'ri format. Matn yoki rasm yuborilmadi. Jarayon to\'xtatildi.');
    return;
  }

  // 2. Sovrun turi tanlash
  await ctx.reply(
    `🎁 <b>2-Qadam: Sovrun turini tanlang</b>\n\n` +
      `• <b>Kanalga Link:</b> Bot g'oliblarga maxsus 1 kishilik bir martalik yopiq kanal havolasini beradi.\n` +
      `• <b>Kitob / Material:</b> Siz forward qilgan yoki yuborgan post/faylni bot g'oliblarga yuboradi.`,
    {
      parse_mode: 'HTML',
      reply_markup: rewardTypeKeyboard,
    }
  );

  const rewardTypeQuery = await conversation.waitForCallbackQuery([
    'reward_type_link',
    'reward_type_material',
    'cancel_action',
  ]);

  if (rewardTypeQuery.callbackQuery.data === 'cancel_action') {
    await rewardTypeQuery.answerCallbackQuery();
    await rewardTypeQuery.editMessageText('❌ Bekor qilindi.');
    return;
  }

  const reward_type: RewardType =
    rewardTypeQuery.callbackQuery.data === 'reward_type_link' ? 'link' : 'material';
  await rewardTypeQuery.answerCallbackQuery();

  let reward_channel_id: string | null = null;
  let reward_message: string | null = null;

  if (reward_type === 'link') {
    await ctx.reply(
      `🔗 <b>Kanal ID yoki @username kiriting</b>\n\n` +
        `<i>Eslatma: Bot ushbu kanalda ADMIN bo'lishi va "Foydalanuvchilarni taklif qilish / Invite users" huquqiga ega bo'lishi kerak!</i>\n\n` +
        `Masalan: <code>@meningkanalim</code> yoki <code>-1001234567890</code>`,
      { parse_mode: 'HTML', reply_markup: cancelKeyboard }
    );

    const channelMsg = await conversation.waitFor(['message:text', 'callback_query:data']);
    if (channelMsg.callbackQuery?.data === 'cancel_action') {
      await channelMsg.answerCallbackQuery();
      await channelMsg.editMessageText('❌ Bekor qilindi.');
      return;
    }
    reward_channel_id = channelMsg.message?.text?.trim() || null;

    if (!reward_channel_id) {
      await ctx.reply('❌ Kanal kiritilmadi.');
      return;
    }
  } else {
    await ctx.reply(
      `📚 <b>Sovg'a materialini yuboring</b>\n\n` +
        `G'oliblarga beriladigan postni shu yerga FORWARD qiling yoki fayl/audio/video/matn yuboring:`,
      { parse_mode: 'HTML', reply_markup: cancelKeyboard }
    );

    const materialMsg = await conversation.waitFor(['message', 'callback_query:data']);
    if (materialMsg.callbackQuery?.data === 'cancel_action') {
      await materialMsg.answerCallbackQuery();
      await materialMsg.editMessageText('❌ Bekor qilindi.');
      return;
    }

    if (!materialMsg.message) {
      await ctx.reply('❌ Xabar qabul qilinmadi.');
      return;
    }

    reward_message = JSON.stringify({
      chat_id: materialMsg.message.chat.id,
      message_id: materialMsg.message.message_id,
    });
  }

  // 3. Sovg'a uchun odam soni
  await ctx.reply(
    `👥 <b>3-Qadam: Sovg'a uchun kerakli odamlar soni</b>\n\n` +
      `Foydalanuvchi sovg'aga ega bo'lishi uchun nechta do'stini taklif qilishi kerak? (Masalan: <code>5</code>)`,
    { parse_mode: 'HTML', reply_markup: cancelKeyboard }
  );

  let target_referrals = 5;
  while (true) {
    const targetMsg = await conversation.waitFor(['message:text', 'callback_query:data']);
    if (targetMsg.callbackQuery?.data === 'cancel_action') {
      await targetMsg.answerCallbackQuery();
      await targetMsg.editMessageText('❌ Bekor qilindi.');
      return;
    }
    const val = parseInt(targetMsg.message?.text || '', 10);
    if (!isNaN(val) && val > 0) {
      target_referrals = val;
      break;
    }
    await ctx.reply('⚠️ Iltimos, musbat butun son kiriting (Masalan: 5):');
  }

  // 4. G'oliblar soni (max)
  await ctx.reply(
    `🏆 <b>4-Qadam: Maksimal g'oliblar soni</b>\n\n` +
      `Nechta g'olibga sovg'a taqdim etiladi? (Masalan: <code>50</code>)`,
    { parse_mode: 'HTML', reply_markup: cancelKeyboard }
  );

  let max_winners = 50;
  while (true) {
    const maxMsg = await conversation.waitFor(['message:text', 'callback_query:data']);
    if (maxMsg.callbackQuery?.data === 'cancel_action') {
      await maxMsg.answerCallbackQuery();
      await maxMsg.editMessageText('❌ Bekor qilindi.');
      return;
    }
    const val = parseInt(maxMsg.message?.text || '', 10);
    if (!isNaN(val) && val > 0) {
      max_winners = val;
      break;
    }
    await ctx.reply('⚠️ Iltimos, musbat butun son kiriting (Masalan: 50):');
  }

  // 5. Konkurs muddati
  await ctx.reply(
    `⏳ <b>5-Qadam: Konkurs muddati</b>\n\n` +
      `Konkurs qancha vaqt davom etadi? Variantlardan tanlang yoki soatda kiriting (Masalan: <code>48</code>):\n\n` +
      `• <code>24</code> = 1 kun\n` +
      `• <code>48</code> = 2 kun\n` +
      `• <code>72</code> = 3 kun\n` +
      `• <code>168</code> = 7 kun (1 hafta)`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '24 soat (1 kun)', callback_data: 'duration_24' },
            { text: '48 soat (2 kun)', callback_data: 'duration_48' },
          ],
          [
            { text: '72 soat (3 kun)', callback_data: 'duration_72' },
            { text: '7 kun (1 hafta)', callback_data: 'duration_168' },
          ],
          [{ text: '❌ Bekor qilish', callback_data: 'cancel_action' }],
        ],
      },
    }
  );

  let hours = 48;
  const durationMsg = await conversation.waitFor(['message:text', 'callback_query:data']);
  if (durationMsg.callbackQuery) {
    const data = durationMsg.callbackQuery.data;
    if (data === 'cancel_action') {
      await durationMsg.answerCallbackQuery();
      await durationMsg.editMessageText('❌ Bekor qilindi.');
      return;
    }
    await durationMsg.answerCallbackQuery();
    if (data === 'duration_24') hours = 24;
    else if (data === 'duration_48') hours = 48;
    else if (data === 'duration_72') hours = 72;
    else if (data === 'duration_168') hours = 168;
  } else if (durationMsg.message?.text) {
    const val = parseInt(durationMsg.message.text, 10);
    if (!isNaN(val) && val > 0) {
      hours = val;
    }
  }

  const endTime = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

  // 6. Saqlash va ishga tushirish
  const created = queries.createNewContest(db, {
    title,
    description,
    photo_file_id,
    reward_type,
    reward_channel_id,
    reward_message,
    target_referrals,
    max_winners,
    end_time: endTime,
  });

  await ctx.reply(
    `✅ <b>YANGI KONKURS MUVAFFAQIYATLI ISHGA TUSHIRILDI!</b> 🚀\n\n` +
      `📌 <b>Sarlavha:</b> ${created.title}\n` +
      `🎁 <b>Sovg'a turi:</b> ${created.reward_type === 'link' ? 'Kanalga bir martalik link' : 'Tayyor material/kitob'}\n` +
      `👥 <b>Kerakli do'stlar soni:</b> ${created.target_referrals} ta\n` +
      `🏆 <b>Maksimal g'oliblar:</b> ${created.max_winners} ta\n` +
      `⌛️ <b>Tugash vaqti:</b> ${formatDateTime(created.end_time)}\n\n` +
      `Foydalanuvchilar endi /start bosib konkursda qatnashishi mumkin.`,
    { parse_mode: 'HTML' }
  );
}
