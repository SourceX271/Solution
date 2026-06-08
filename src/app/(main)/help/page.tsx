import type { Metadata } from "next";

export const metadata: Metadata = { title: "帮助中心" };

export default function HelpPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-16">
      <h1 className="mb-6 text-3xl font-bold">帮助中心</h1>
      <div className="prose-custom">
        <h2>常见问题</h2>
        <h3>如何提问？</h3>
        <p>登录后点击问答页面中的提问按钮，填写标题和详细描述即可发布问题。</p>
        <h3>如何发布文档？</h3>
        <p>登录后进入管理后台，在内容管理中可以创建和发布文章。</p>
        <h3>如何使用搜索？</h3>
        <p>在顶部搜索栏输入关键词，可以搜索文章、问题和软件。</p>
      </div>
    </div>
  );
}
