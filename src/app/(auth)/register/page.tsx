"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import Link from "next/link"
import { Loader2 } from "lucide-react"

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState("")
  const [loading, setLoading] = useState(false)

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!name.trim() || name.trim().length < 2) errs.name = "名称至少2个字符"
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "请输入有效的邮箱地址"
    if (!password || password.length < 6) errs.password = "密码至少6位"
    if (password !== confirmPassword) errs.confirmPassword = "两次密码不一致"
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setServerError("")

    if (!validate()) return

    setLoading(true)
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "注册失败")
      }

      // Auto sign in after registration
      const result = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
      })

      if (result?.error) {
        // Registration succeeded but auto-login failed, redirect to login
        router.push("/login")
      } else {
        router.push("/")
      }
      router.refresh()
    } catch (err: any) {
      setServerError(err.message || "注册失败，请重试")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="glass-card w-full max-w-md p-8">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold">注册</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            创建你的 Solution 账号
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium" htmlFor="name">
              名称 <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="你的名称"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              maxLength={50}
            />
            {errors.name && (
              <p className="mt-1 text-xs text-destructive">{errors.name}</p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium" htmlFor="email">
              邮箱 <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {errors.email && (
              <p className="mt-1 text-xs text-destructive">{errors.email}</p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium" htmlFor="password">
              密码 <span className="text-red-500">*</span>
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少6位"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              minLength={6}
            />
            {errors.password && (
              <p className="mt-1 text-xs text-destructive">{errors.password}</p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium" htmlFor="confirmPassword">
              确认密码 <span className="text-red-500">*</span>
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="再次输入密码"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              minLength={6}
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-xs text-destructive">{errors.confirmPassword}</p>
            )}
          </div>

          {serverError && (
            <div className="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">
              {serverError}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "注册中..." : "注册"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          已有账号？{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            登录
          </Link>
        </p>
      </div>
    </div>
  )
}