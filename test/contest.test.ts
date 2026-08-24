import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '../src/database/db.js';
import { queries } from '../src/database/queries.js';

const testDbPath = path.join(process.cwd(), 'data', 'test.db');
if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}

console.log('🧪 Konkurs Bot testlari boshlanmoqda...');

const db = getDb(testDbPath);

// 1. Contest Creation Test
console.log('1️⃣ Konkurs yaratish testi...');
const contest = queries.createNewContest(db, {
  title: 'Test Konkurs 2026',
  description: '5 ta do\'stingizni taklif qiling va sovg\'a oling!',
  photo_file_id: null,
  reward_type: 'link',
  reward_channel_id: '@my_private_channel',
  reward_message: null,
  target_referrals: 3,
  max_winners: 2,
  end_time: new Date(Date.now() + 86400000).toISOString(),
});

assert.strictEqual(contest.title, 'Test Konkurs 2026');
assert.strictEqual(contest.target_referrals, 3);
assert.strictEqual(contest.max_winners, 2);
assert.strictEqual(contest.is_active, 1);
console.log('   ✅ Konkurs muvaffaqiyatli yaratildi.');

// 2. User Registration Test
console.log('2️⃣ Foydalanuvchilarni ro\'yxatdan o\'tkazish testi...');
const u1 = queries.upsertUser(db, { telegram_id: 100, first_name: 'Ali' });
const u2 = queries.upsertUser(db, { telegram_id: 200, first_name: 'Vali' });
const u3 = queries.upsertUser(db, { telegram_id: 300, first_name: 'Gani' });
const u4 = queries.upsertUser(db, { telegram_id: 400, first_name: 'Sami' });

assert.strictEqual(u1.isNew, true);
assert.strictEqual(u1.user.telegram_id, 100);
console.log('   ✅ Foydalanuvchilar saqlandi.');

// 3. Referral Tracking & Anti-Cheat
console.log('3️⃣ Referal va takliflar hisobi testi...');

// Self-referral should fail
const selfRef = queries.registerReferral(db, 100, 100);
assert.strictEqual(selfRef.success, false);

// Ali invites Vali
const ref1 = queries.registerReferral(db, 100, 200);
assert.strictEqual(ref1.success, true);
assert.strictEqual(ref1.referrer?.referral_count, 1);

// Duplicate referral of Vali should fail
const ref1Duplicate = queries.registerReferral(db, 100, 200);
assert.strictEqual(ref1Duplicate.success, false);

// Ali invites Gani and Sami
queries.registerReferral(db, 100, 300);
const ref3 = queries.registerReferral(db, 100, 400);
assert.strictEqual(ref3.referrer?.referral_count, 3);
console.log('   ✅ Referallar to\'g\'ri hisoblandi va firibgarlik tekshiruvlari ishladi.');

// 4. Winner Marking
console.log('4️⃣ G\'oliblarni belgilash testi...');
const markedWinner = queries.markUserAsWinner(db, 100, contest.id);
assert.strictEqual(markedWinner, true);

const activeContestAfterWin = queries.getActiveContest(db);
assert.strictEqual(activeContestAfterWin?.current_winners_count, 1);

// Leaderboard and Stats
const leaderboard = queries.getLeaderboard(db);
assert.strictEqual(leaderboard[0].telegram_id, 100);
assert.strictEqual(leaderboard[0].referral_count, 3);
assert.strictEqual(leaderboard[0].is_winner, 1);

const stats = queries.getContestStats(db);
assert.strictEqual(stats.totalUsers, 4);
assert.strictEqual(stats.totalReferrals, 3);
assert.strictEqual(stats.winnersCount, 1);

console.log('   ✅ Statistika va reyting to\'g\'ri ishlayapti.');

// Clean test db
db.close();
if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}

console.log('\n🎉 Barcha testlar muvaffaqiyatli o\'tdi! (ALL TESTS PASSED)');
