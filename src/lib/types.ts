/** Shared types for AI Through Your Eyes — GDGoC AAST Aswan. */

import type { SurveyQuestionKey } from "./questions";

/** One completed survey submission. */
export interface SurveySubmission {
  id: string;
  session_id: string;
  /** Optional nickname — never required. */
  nickname: string | null;
  question_1_answer: string;
  question_2_answer: string;
  /** Multi-select answer stored as an array of option ids. */
  question_3_answer: string[];
  question_4_answer: string;
  question_5_answer: string[];
  /** Free-text answer to the final question (max 500 chars). */
  ai_track_expectations: string;
  created_at: string;
}

/** Input shape when a student submits their survey. */
export interface NewSurveyInput {
  session_id: string;
  nickname: string;
  /** Question key → selected option id(s). Multi-select questions store arrays. */
  answers: Record<SurveyQuestionKey, string | string[]>;
  ai_track_expectations: string;
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