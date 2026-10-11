/** Shared types for AI Spin & Share. */

export type ChallengeType = "ai_is" | "my_ai_story" | "if_i_built_ai";

export type ModerationStatus = "visible" | "hidden";

export interface Submission {
  id: string;
  session_id: string;
  student_name: string;
  challenge_type: ChallengeType;
  answer: string;
  moderation_status: ModerationStatus;
  created_at: string;
}

export interface GameSession {
  id: string;
  name: string;
  status: "active" | "ended";
  allow_repeat_participation: boolean;
  registration_url: string | null;
  created_at: string;
  ended_at: string | null;
}

export interface SessionConfigUpdate {
  allow_repeat_participation?: boolean;
  registration_url?: string | null;
}

export const CHALLENGE_TYPES: ChallengeType[] = [
  "ai_is",
  "my_ai_story",
  "if_i_built_ai",
];