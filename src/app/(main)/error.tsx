"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="container mx-auto flex min-h-[400px] flex-col items-center justify-center px-4 text-center">
      <h2 className="mb-2 text-2xl font-bold">页面加载出错</h2>
      <p className="mb-6 text-muted-foreground">{error.message || "请稍后重试"}</p>
      <button
        onClick={reset}
        className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        重试
      </button>
    </div>
  );
}
