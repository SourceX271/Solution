import type { Metadata } from "next";

export const metadata: Metadata = { title: "隐私政策" };

export default function PrivacyPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-16">
      <h1 className="mb-6 text-3xl font-bold">隐私政策</h1>
      <div className="prose-custom">
        <p>最后更新日期：2024年1月</p>
        <h2>信息收集</h2>
        <p>我们仅在您注册账户时收集必要的个人信息（用户名、邮箱地址），用于提供平台服务。</p>
        <h2>信息使用</h2>
        <p>您的个人信息仅用于账户管理和平台功能，不会出售或分享给第三方。</p>
        <h2>数据安全</h2>
        <p>我们采用行业标准的安全措施保护您的数据。</p>
        <h2>联系我们</h2>
        <p>如有隐私相关问题，请通过 support@solution.com 与我们联系。</p>
      </div>
    </div>
  );
}
