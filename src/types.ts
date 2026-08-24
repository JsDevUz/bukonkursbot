import { Context, SessionFlavor } from 'grammy';
import { Conversation, ConversationFlavor } from '@grammyjs/conversations';

export type RewardType = 'link' | 'material';

export interface Contest {
  id: number;
  title: string;
  description: string;
  photo_file_id: string | null;
  reward_type: RewardType;
  reward_channel_id: string | null;
  reward_message: string | null; // JSON string of message { message_id, chat_id, text, etc }
  target_referrals: number;
  max_winners: number;
  current_winners_count: number;
  end_time: string; // ISO string
  is_active: number; // 1 or 0
  created_at: string;
}

export interface DbUser {
  telegram_id: number;
  first_name: string;
  last_name: string | null;
  username: string | null;
  referred_by: number | null;
  referral_count: number;
  is_winner: number; // 1 or 0
  reward_delivered: number; // 1 or 0
  joined_at: string;
}

export interface Referral {
  id: number;
  referrer_id: number;
  referred_user_id: number;
  created_at: string;
}

export interface SessionData {
  // Can be extended if needed
}

export type BaseContext = Context & SessionFlavor<SessionData>;
export type MyContext = ConversationFlavor<BaseContext>;
export type MyConversation = Conversation<MyContext, MyContext>;
