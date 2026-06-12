import type { Metadata } from "next";

export const metadata: Metadata = { title: "隐私政策" };

export default function PrivacyPage() {
  return (
    <div className="container mx-auto max-w-2xl px-4 py-16 animate-fade-in">
      <h1 className="text-3xl font-bold gradient-text mb-6">隐私政策</h1>
      <div className="prose-custom max-w-none">
        <p>我们重视你的隐私。本隐私政策说明了我们如何收集、使用和保护你的个人信息。</p>
        <h2>信息收集</h2>
        <ul>
          <li>注册时需要提供邮箱地址和密码</li>
          <li>通过 GitHub / Google 登录时获取基本资料</li>
          <li>发布内容时自动记录时间戳</li>
        </ul>
        <h2>信息使用</h2>
        <ul>
          <li>提供和改善社区服务</li>
          <li>展示你的个人资料和发布的内容</li>
          <li>发送通知（如评论回复、答案更新）</li>
        </ul>
        <h2>信息安全</h2>
        <p>我们采用行业标准的安全措施保护你的数据。密码使用加密存储。</p>
        <h2>联系我们</h2>
        <p>如有隐私相关问题，请访问联系我们页面。</p>
      </div>
    </div>
  )
}
