import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("请输入有效的邮箱地址"),
  password: z.string().min(8, "密码至少8位"),
});

export const registerSchema = z.object({
  name: z.string().min(2, "名称至少2个字符").max(50),
  email: z.string().email("请输入有效的邮箱地址"),
  password: z
    .string()
    .min(8, "密码至少8位")
    .max(100)
    .regex(/[a-zA-Z]/, "密码需包含字母")
    .regex(/[0-9]/, "密码需包含数字"),
});

export const articleSchema = z.object({
  title: z.string().min(2, "标题至少2个字符").max(200),
  content: z.string().min(10, "内容至少10个字符").max(100000),
  excerpt: z.string().max(500).optional(),
  // The article form collects a "遇到的问题" statement and the article page
  // renders it; without this field Zod stripped it and the text was lost.
  problem: z.string().max(2000, "问题描述最多2000个字符").optional(),
  category: z.string().min(1),
  tags: z.string().optional(),
  status: z.enum(["draft", "published"]).default("published"),
});

export const questionSchema = z.object({
  title: z.string().min(5, "标题至少5个字符").max(200),
  content: z.string().min(20, "请详细描述你的问题").max(50000),
  tags: z.string().optional(),
});

export const answerSchema = z.object({
  content: z.string().min(10, "回答至少10个字符").max(50000),
});

export const commentSchema = z.object({
  content: z.string().min(1, "评论不能为空").max(2000),
});

export const softwareSchema = z.object({
  name: z.string().min(1, "名称不能为空").max(100),
  description: z.string().min(10, "描述至少10个字符").max(5000),
  url: z.string().url("请输入有效的网址").optional().or(z.literal("")),
  category: z.string().min(1),
  tags: z.string().optional(),
});

export const profileSchema = z.object({
  name: z.string().min(2, "名称至少2个字符").max(50).optional(),
  bio: z.string().max(500, "简介最多500个字符").optional(),
  image: z
    .string()
    .max(500)
    .refine(
      (value) => value === "" || /^https?:\/\//.test(value) || value.startsWith("/"),
      "头像地址无效"
    )
    .optional(),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "请填写当前密码").max(200),
  newPassword: z
    .string()
    .min(8, "新密码至少8位")
    .max(72, "新密码最多72位")
    .regex(/[a-zA-Z]/, "新密码需包含字母")
    .regex(/[0-9]/, "新密码需包含数字"),
});
