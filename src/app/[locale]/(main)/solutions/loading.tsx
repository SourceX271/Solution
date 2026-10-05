export default function DocsLoading() {
  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mb-8">
        <div className="skeleton h-9 w-48 rounded-lg mb-2" />
        <div className="skeleton h-5 w-32 rounded" />
      </div>
      <div className="flex gap-8">
        <aside className="hidden w-48 shrink-0 lg:block">
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton h-9 rounded-lg" />
            ))}
          </div>
        </aside>
        <div className="flex-1">
          <div className="flex gap-2 mb-6 lg:hidden">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton h-8 w-16 rounded-full" />
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-xl border p-5 space-y-3">
                <div className="skeleton h-5 w-20 rounded-lg" />
                <div className="skeleton h-5 w-full" />
                <div className="skeleton h-4 w-3/4" />
                <div className="skeleton h-4 w-full" />
                <div className="flex gap-3">
                  <div className="skeleton h-3 w-16" />
                  <div className="skeleton h-3 w-12" />
                </div>
                <div className="flex gap-2">
                  <div className="skeleton h-5 w-12 rounded-full" />
                  <div className="skeleton h-5 w-16 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
