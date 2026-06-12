import type { Metadata } from "next";

export const metadata: Metadata = { title: "关于我们" };

export default function AboutPage() {
  return (
    <div className="container mx-auto max-w-2xl px-4 py-16 animate-fade-in">
      <h1 className="text-3xl font-bold gradient-text mb-6">关于我们</h1>
      <div className="prose-custom max-w-none">
        <p>Solution 是一个面向开发者的技术社区平台，致力于为开发者提供高质量的解决方案、问答互助和优秀的开发工具推荐。</p>
        <p>我们的目标是构建一个开放、协作的技术知识库，帮助每个开发者更高效地解决问题。</p>
        <h2>核心功能</h2>
        <ul>
          <li>解决方案 - 浏览和分享技术解决方案</li>
          <li>问答社区 - 提出疑问，获得专业解答</li>
          <li>软件推荐 - 发现和评价优秀的开发工具</li>
          <li>多语言支持 - 中文 / English</li>
        </ul>
      </div>
    </div>
  )
}
