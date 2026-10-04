import { z } from "zod";

/**
 * Validation messages are translated, so every schema is a factory that takes a
 * translator for the `validation` namespace. Route handlers build the schema
 * with the request locale:
 *
 * @example
 * const t = await getApiT("validation");
 * const parsed = getArticleSchema(t).safeParse(body);
 */
export type MessageTranslator = (
  key: string,
  values?: Record<string, string | number>
) => string;

/** Fallback used by non-request contexts (tests, scripts): the key itself. */
const identityTranslator: MessageTranslator = (key) => key;

export const getLoginSchema = (t: MessageTranslator = identityTranslator) =>
  z.object({
    email: z.string().email(t("emailInvalid")),
    password: z.string().min(8, t("passwordMin")),
  });

export const getRegisterSchema = (t: MessageTranslator = identityTranslator) =>
  z.object({
    name: z.string().min(2, t("nameMin2")).max(50),
    email: z.string().email(t("emailInvalid")),
    password: z
      .string()
      .min(8, t("passwordMin"))
      .max(100)
      .regex(/[a-zA-Z]/, t("passwordLetter"))
      .regex(/[0-9]/, t("passwordDigit")),
  });

export const getArticleSchema = (t: MessageTranslator = identityTranslator) =>
  z.object({
    title: z.string().min(2, t("titleMin2")).max(200),
    content: z.string().min(10, t("contentMin10")).max(100000),
    excerpt: z.string().max(500).optional(),
    // The article form collects a "遇到的问题" statement and the article page
    // renders it; without this field Zod stripped it and the text was lost.
    problem: z.string().max(2000, t("problemMax2000")).optional(),
    category: z.string().min(1),
    tags: z.string().optional(),
    status: z.enum(["draft", "published"]).default("published"),
  });

export const getQuestionSchema = (t: MessageTranslator = identityTranslator) =>
  z.object({
    title: z.string().min(5, t("titleMin5")).max(200),
    content: z.string().min(20, t("contentMin20")).max(50000),
    tags: z.string().optional(),
  });

export const getAnswerSchema = (t: MessageTranslator = identityTranslator) =>
  z.object({
    content: z.string().min(10, t("answerMin10")).max(50000),
  });

export const getCommentSchema = (t: MessageTranslator = identityTranslator) =>
  z.object({
    content: z.string().min(1, t("commentRequired")).max(2000),
  });

export const getSoftwareSchema = (t: MessageTranslator = identityTranslator) =>
  z.object({
    name: z.string().min(1, t("nameRequired")).max(100),
    description: z.string().min(10, t("descriptionMin10")).max(5000),
    url: z.string().url(t("urlInvalid")).optional().or(z.literal("")),
    category: z.string().min(1),
    tags: z.string().optional(),
  });

export const getProfileSchema = (t: MessageTranslator = identityTranslator) =>
  z.object({
    name: z.string().min(2, t("nameMin2")).max(50).optional(),
    bio: z.string().max(500, t("bioMax500")).optional(),
    image: z
      .string()
      .max(500)
      .refine(
        (value) => value === "" || /^https?:\/\//.test(value) || value.startsWith("/"),
        t("avatarInvalid")
      )
      .optional(),
  });

export const getPasswordChangeSchema = (t: MessageTranslator = identityTranslator) =>
  z.object({
    currentPassword: z.string().min(1, t("currentPasswordRequired")).max(200),
    newPassword: z
      .string()
      .min(8, t("newPasswordMin8"))
      .max(72, t("newPasswordMax72"))
      .regex(/[a-zA-Z]/, t("newPasswordLetter"))
      .regex(/[0-9]/, t("newPasswordDigit")),
  });
