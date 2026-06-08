import type { Session } from "next-auth";

// ─── Auth ───────────────────────────────────────────
export interface SessionUser {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role: "USER" | "ADMIN";
}

export interface AuthSession extends Session {
  user: SessionUser;
}

// ─── API ────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

// ─── Content ────────────────────────────────────────
export type ContentType = "article" | "question" | "software";

export type ContentStatus = "draft" | "published";

export type ArticleCategory = "tutorial" | "guide" | "reference" | "news" | "tool";

export type SoftwareCategory = "tool" | "library" | "service" | "other";

export type QuestionStatus = "open" | "answered" | "closed";
