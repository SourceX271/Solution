import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "帮助中心" };

export default function HelpPage() {
  return (
    <div className="container mx-auto max-w-2xl px-4 py-16 animate-fade-in">
      <h1 className="text-3xl font-bold gradient-text mb-6">帮助中心</h1>
      <div className="prose-custom max-w-none">
        <h2>如何使用 Solution</h2>
        <ol>
          <li><Link href="/register" className="text-primary hover:underline">注册账号</Link> 加入社区</li>
          <li>浏览 <Link href="/docs" className="text-primary hover:underline">解决方案</Link> 学习技术知识</li>
          <li>在 <Link href="/questions" className="text-primary hover:underline">问答</Link> 中提问或回答问题</li>
          <li>在 <Link href="/software" className="text-primary hover:underline">软件</Link> 中发现和评价开发工具</li>
        </ol>
        <h2>发布内容</h2>
        <p>登录后，你可以在相应的板块发布解决方案、提问或推荐软件。所有内容都支持 Markdown 富文本格式。</p>
        <h2>社区规范</h2>
        <ul>
          <li>友善交流，互相尊重</li>
          <li>发布原创或经过授权的技术内容</li>
          <li>回答问题请尽量详细和准确</li>
        </ul>
        <p>如有更多问题，请 <Link href="/contact" className="text-primary hover:underline">联系我们</Link>。</p>
      </div>
    </div>
  )
}
