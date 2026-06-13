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
