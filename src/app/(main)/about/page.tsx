import type { Metadata } from "next";

export const metadata: Metadata = { title: "关于我们" };

export default function AboutPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-16">
      <h1 className="mb-6 text-3xl font-bold">关于我们</h1>
      <div className="prose-custom">
        <p>Solution 是一个社区驱动的技术文档与问答平台，致力于帮助用户解决电脑使用中的各类问题。</p>
        <h2>我们的使命</h2>
        <p>让每个人都能轻松找到技术问题的解决方案，构建开放共享的知识社区。</p>
        <h2>核心功能</h2>
        <ul>
          <li>📄 技术文档 — 系统化的教程和指南</li>
          <li>❓ 问答社区 — 提问、回答、采纳最佳方案</li>
          <li>🛠️ 软件推荐 — 发现实用的工具和软件</li>
        </ul>
      </div>
    </div>
  );
}
