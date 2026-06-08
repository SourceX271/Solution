import type { Metadata } from "next";

export const metadata: Metadata = { title: "联系我们" };

export default function ContactPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-16">
      <h1 className="mb-6 text-3xl font-bold">联系我们</h1>
      <div className="prose-custom">
        <p>欢迎通过以下方式与我们取得联系：</p>
        <ul>
          <li>📧 邮箱：support@solution.com</li>
          <li>📞 电话：400-000-0000</li>
          <li>📍 地址：北京市海淀区</li>
        </ul>
        <h2>反馈建议</h2>
        <p>我们非常重视您的反馈。如有任何建议或问题，请随时通过以上方式联系我们。</p>
      </div>
    </div>
  );
}
