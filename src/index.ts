import { Bot, session, webhookCallback } from 'grammy';
import { conversations, createConversation } from '@grammyjs/conversations';
import http from 'http';
import { config } from './config.js';
import { MyContext } from './types.js';
import { getDb } from './database/db.js';
import { createContestWizard } from './handlers/wizard.js';
import {
  handleAdminCommand,
  handleAdminStatsCallback,
  handleAdminWinnersCallback,
  handleAdminStopContestCallback,
  handleConfirmStopContest,
} from './handlers/admin.js';
import {
  handleStart,
  handleMyScore,
  handleReferralLinkMenu,
  handleLeaderboard,
  handleRules,
} from './handlers/start.js';

async function bootstrap() {
  console.log('🚀 Konkurs Boti ishga tushirilmoqda...');

  // Initialize DB
  getDb();

  const bot = new Bot<MyContext>(config.botToken);
  await bot.init();
  console.log(`🤖 Bot ma'lumotlari muvaffaqiyatli yuklandi: @${bot.botInfo.username}`);

  // Session and Conversations Middleware
  bot.use(
    session({
      initial: () => ({}),
    })
  );
  bot.use(conversations());

  // Register Conversation
  bot.use(createConversation(createContestWizard));

  // Commands
  bot.command('start', handleStart);
  bot.command('admin', handleAdminCommand);

  // Keyboard button text handlers
  bot.hears('🔗 Referal havolam', handleReferralLinkMenu);
  bot.hears('📊 Mening ballim', handleMyScore);
  bot.hears('🏆 Reyting & G\'oliblar', handleLeaderboard);
  bot.hears('ℹ️ Qoidalar', handleRules);

  // Admin callback handlers
  bot.callbackQuery('admin_create_contest', async (ctx) => {
    if (!ctx.from || !config.isAdmin(ctx.from.id)) return;
    await ctx.answerCallbackQuery();
    await ctx.conversation.enter('createContestWizard');
  });

  bot.callbackQuery('admin_stats', handleAdminStatsCallback);
  bot.callbackQuery('admin_winners', handleAdminWinnersCallback);
  bot.callbackQuery('admin_stop_contest', handleAdminStopContestCallback);
  bot.callbackQuery('admin_back', handleAdminCommand);

  bot.callbackQuery(/^confirm_stop_(\d+)$/, async (ctx) => {
    const contestId = parseInt(ctx.match[1], 10);
    await handleConfirmStopContest(ctx, contestId);
  });

  // User callback handlers
  bot.callbackQuery('check_my_score', async (ctx) => {
    await ctx.answerCallbackQuery();
    await handleMyScore(ctx);
  });

  bot.callbackQuery('cancel_action', async (ctx) => {
    await ctx.answerCallbackQuery('Bekor qilindi');
    await ctx.deleteMessage().catch(() => {});
  });

  // Catch errors
  bot.catch((err) => {
    console.error('❌ Botda xatolik yuz berdi:', err);
  });

  // Mode: Webhook or Polling
  if (config.useWebhook) {
    const webhookPath = `/webhook/${config.webhookSecret}`;
    const webhookUrl = `https://${config.domain}${webhookPath}`;

    const handleUpdate = webhookCallback(bot, 'http', {
      secretToken: config.webhookSecret,
    });

    const server = http.createServer((req, res) => {
      const url = req.url || '';
      console.log(`📡 [HTTP ${req.method}] ${url}`);

      if (url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', time: new Date().toISOString() }));
        return;
      }

      if (url.startsWith(webhookPath) && req.method === 'POST') {
        return handleUpdate(req, res);
      } else {
        console.warn(`⚠️ Noto'g'ri so'rov keldi: ${req.method} ${url}`);
        res.writeHead(404);
        res.end();
      }
    });

    server.listen(config.port, '0.0.0.0', async () => {
      console.log(`🌐 Webhook server ishga tushdi: port ${config.port}`);
      try {
        await bot.api.setWebhook(webhookUrl, {
          secret_token: config.webhookSecret,
          drop_pending_updates: true,
        });
        console.log(`✅ Webhook muvaffaqiyatli sozlandi: ${webhookUrl}`);

        const webhookInfo = await bot.api.getWebhookInfo();
        console.log('ℹ️ Webhook Info:', {
          url: webhookInfo.url,
          pending_update_count: webhookInfo.pending_update_count,
          last_error_message: webhookInfo.last_error_message,
        });
      } catch (e) {
        console.error('❌ Webhook o\'rnatishda xatolik:', e);
      }
    });
  } else {
    // Delete any existing webhook before starting long polling
    try {
      await bot.api.deleteWebhook({ drop_pending_updates: true });
    } catch (e) {
      // ignore
    }

    console.log('⚡️ Long polling rejimida bot ishga tushdi...');
    bot.start({
      onStart: (botInfo) => {
        console.log(`🤖 Bot @${botInfo.username} sifatida muvaffaqiyatli ishga tushdi!`);
      },
    });
  }
}

bootstrap().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
