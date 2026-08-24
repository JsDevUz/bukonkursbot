import Database from 'better-sqlite3';
import { Contest, DbUser, RewardType } from '../types.js';

export const queries = {
  // Contest queries
  getActiveContest(db: Database.Database): Contest | null {
    const row = db
      .prepare('SELECT * FROM contests WHERE is_active = 1 ORDER BY id DESC LIMIT 1')
      .get() as Contest | undefined;
    return row || null;
  },

  createNewContest(
    db: Database.Database,
    data: {
      title: string;
      description: string;
      photo_file_id: string | null;
      reward_type: RewardType;
      reward_channel_id: string | null;
      reward_message: string | null;
      target_referrals: number;
      max_winners: number;
      end_time: string;
    }
  ): Contest {
    const transaction = db.transaction(() => {
      // Deactivate all previous contests
      db.prepare('UPDATE contests SET is_active = 0 WHERE is_active = 1').run();

      // Reset user contest stats (or clear users & referrals for fresh contest)
      db.prepare('DELETE FROM referrals').run();
      db.prepare(
        'UPDATE users SET referral_count = 0, is_winner = 0, reward_delivered = 0, referred_by = NULL'
      ).run();

      // Insert new contest
      const stmt = db.prepare(`
        INSERT INTO contests (
          title, description, photo_file_id, reward_type, reward_channel_id,
          reward_message, target_referrals, max_winners, current_winners_count,
          end_time, is_active
        ) VALUES (
          @title, @description, @photo_file_id, @reward_type, @reward_channel_id,
          @reward_message, @target_referrals, @max_winners, 0,
          @end_time, 1
        )
      `);

      const result = stmt.run(data);
      const inserted = db
        .prepare('SELECT * FROM contests WHERE id = ?')
        .get(result.lastInsertRowid) as Contest;
      return inserted;
    });

    return transaction();
  },

  endContest(db: Database.Database, contestId: number): void {
    db.prepare('UPDATE contests SET is_active = 0 WHERE id = ?').run(contestId);
  },

  // User queries
  getUser(db: Database.Database, telegramId: number): DbUser | null {
    const row = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId) as
      | DbUser
      | undefined;
    return row || null;
  },

  upsertUser(
    db: Database.Database,
    user: {
      telegram_id: number;
      first_name: string;
      last_name?: string | null;
      username?: string | null;
      referred_by?: number | null;
    }
  ): { user: DbUser; isNew: boolean } {
    const existing = this.getUser(db, user.telegram_id);
    if (existing) {
      db.prepare(
        `UPDATE users SET first_name = @first_name, last_name = @last_name, username = @username WHERE telegram_id = @telegram_id`
      ).run({
        first_name: user.first_name,
        last_name: user.last_name || null,
        username: user.username || null,
        telegram_id: user.telegram_id,
      });
      return { user: this.getUser(db, user.telegram_id)!, isNew: false };
    }

    db.prepare(
      `INSERT INTO users (telegram_id, first_name, last_name, username, referred_by, referral_count, is_winner, reward_delivered)
       VALUES (@telegram_id, @first_name, @last_name, @username, @referred_by, 0, 0, 0)`
    ).run({
      telegram_id: user.telegram_id,
      first_name: user.first_name,
      last_name: user.last_name || null,
      username: user.username || null,
      referred_by: user.referred_by || null,
    });

    return { user: this.getUser(db, user.telegram_id)!, isNew: true };
  },

  registerReferral(
    db: Database.Database,
    referrerId: number,
    referredUserId: number
  ): { success: boolean; referrer: DbUser | null } {
    if (referrerId === referredUserId) {
      return { success: false, referrer: null };
    }

    const transaction = db.transaction(() => {
      // Check if this referred user already exists in referrals table
      const existingRef = db
        .prepare('SELECT id FROM referrals WHERE referred_user_id = ?')
        .get(referredUserId);
      if (existingRef) {
        return { success: false, referrer: null };
      }

      // Check referrer existence
      const referrer = db
        .prepare('SELECT * FROM users WHERE telegram_id = ?')
        .get(referrerId) as DbUser | undefined;

      if (!referrer) {
        return { success: false, referrer: null };
      }

      // Record referral
      db.prepare(
        'INSERT INTO referrals (referrer_id, referred_user_id) VALUES (?, ?)'
      ).run(referrerId, referredUserId);

      // Increment referrer's count
      db.prepare(
        'UPDATE users SET referral_count = referral_count + 1 WHERE telegram_id = ?'
      ).run(referrerId);

      const updatedReferrer = db
        .prepare('SELECT * FROM users WHERE telegram_id = ?')
        .get(referrerId) as DbUser;

      return { success: true, referrer: updatedReferrer };
    });

    return transaction();
  },

  markUserAsWinner(db: Database.Database, telegramId: number, contestId: number): boolean {
    const transaction = db.transaction(() => {
      const contest = db
        .prepare('SELECT * FROM contests WHERE id = ?')
        .get(contestId) as Contest | undefined;

      if (!contest || !contest.is_active) return false;
      if (contest.current_winners_count >= contest.max_winners) return false;

      const user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId) as
        | DbUser
        | undefined;
      if (!user || user.is_winner) return false;

      // Mark winner
      db.prepare('UPDATE users SET is_winner = 1 WHERE telegram_id = ?').run(telegramId);
      db.prepare(
        'UPDATE contests SET current_winners_count = current_winners_count + 1 WHERE id = ?'
      ).run(contestId);

      return true;
    });

    return transaction();
  },

  markRewardDelivered(db: Database.Database, telegramId: number): void {
    db.prepare('UPDATE users SET reward_delivered = 1 WHERE telegram_id = ?').run(telegramId);
  },

  getLeaderboard(db: Database.Database, limit = 10): DbUser[] {
    return db
      .prepare('SELECT * FROM users WHERE referral_count > 0 ORDER BY referral_count DESC LIMIT ?')
      .all(limit) as DbUser[];
  },

  getWinners(db: Database.Database): DbUser[] {
    return db
      .prepare('SELECT * FROM users WHERE is_winner = 1 ORDER BY referral_count DESC')
      .all() as DbUser[];
  },

  getContestStats(db: Database.Database): {
    totalUsers: number;
    totalReferrals: number;
    winnersCount: number;
  } {
    const totalUsersRow = db.prepare('SELECT COUNT(*) as count FROM users').get() as {
      count: number;
    };
    const totalReferralsRow = db.prepare('SELECT COUNT(*) as count FROM referrals').get() as {
      count: number;
    };
    const winnersRow = db
      .prepare('SELECT COUNT(*) as count FROM users WHERE is_winner = 1')
      .get() as { count: number };

    return {
      totalUsers: totalUsersRow?.count || 0,
      totalReferrals: totalReferralsRow?.count || 0,
      winnersCount: winnersRow?.count || 0,
    };
  },
};
