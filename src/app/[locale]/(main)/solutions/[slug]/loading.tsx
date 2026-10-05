export default function ArticleLoading() {
  return (
    <div className="container mx-auto px-4 py-8 animate-fade-in">
      <div className="skeleton h-4 w-64 rounded mb-6" />
      <div className="flex gap-10">
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="space-y-1.5">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton h-6 rounded" />
            ))}
          </div>
        </aside>
        <div className="flex-1 space-y-6">
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="skeleton h-6 w-20 rounded-lg" />
              <div className="skeleton h-6 w-16 rounded-full" />
            </div>
            <div className="skeleton h-10 w-3/4" />
            <div className="flex gap-3">
              <div className="skeleton h-4 w-24" />
              <div className="skeleton h-4 w-32" />
              <div className="skeleton h-4 w-20" />
            </div>
          </div>
          <div className="space-y-3">
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-5/6" />
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-3/4" />
          </div>
          <div className="skeleton h-40 w-full rounded-xl" />
          <div className="space-y-3">
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-2/3" />
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-4/5" />
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-3/4" />
          </div>
        </div>
      </div>
    </div>
  )
}
