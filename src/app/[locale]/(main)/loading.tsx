export default function HomeLoading() {
  return (
    <div className="min-h-screen">
      {/* Hero skeleton */}
      <div className="relative overflow-hidden">
        <div className="container mx-auto px-4 py-24 text-center">
          <div className="skeleton h-6 w-48 rounded-full mx-auto mb-6" />
          <div className="skeleton h-12 w-3/4 max-w-lg mx-auto mb-4" />
          <div className="skeleton h-16 w-2/3 max-w-md mx-auto mb-6" />
          <div className="skeleton h-12 w-full max-w-lg mx-auto rounded-full" />
        </div>
      </div>
      {/* Stats */}
      <div className="border-b">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="stat-card flex flex-col items-center p-4">
                <div className="skeleton h-10 w-10 rounded-xl mb-3" />
                <div className="skeleton h-8 w-16 mb-1" />
                <div className="skeleton h-3 w-12" />
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Content */}
      <div className="container mx-auto px-4 py-10">
        <div className="flex flex-col gap-8 lg:flex-row">
          <div className="flex-1">
            <div className="flex gap-2 mb-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="skeleton h-8 w-20 rounded-full" />
              ))}
            </div>
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="rounded-xl border p-5 space-y-3">
                  <div className="skeleton h-5 w-16 rounded-lg" />
                  <div className="skeleton h-5 w-3/4" />
                  <div className="skeleton h-4 w-full" />
                  <div className="flex gap-2">
                    <div className="skeleton h-5 w-12 rounded-full" />
                    <div className="skeleton h-5 w-16 rounded-full" />
                    <div className="skeleton h-4 w-24 ml-auto" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <aside className="w-full lg:w-64 lg:shrink-0">
            <div className="rounded-xl border p-5 space-y-2">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="skeleton h-7 rounded-full" style={{ width: `${60 + Math.random() * 40}%` }} />
              ))}
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
