export default function SoftwareLoading() {
  return (
    <div className="container mx-auto px-4 py-8 animate-fade-in">
      <div className="skeleton h-4 w-40 rounded mb-6" />
      <div className="flex gap-10">
        <div className="flex-1 space-y-6">
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="skeleton h-6 w-16 rounded-lg" />
              <div className="skeleton h-6 w-20 rounded-full" />
            </div>
            <div className="skeleton h-10 w-1/2" />
            <div className="flex gap-3">
              <div className="skeleton h-4 w-24" />
              <div className="skeleton h-4 w-32" />
              <div className="skeleton h-4 w-20" />
            </div>
            <div className="skeleton h-8 w-32" />
          </div>
          <div className="space-y-2">
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-5/6" />
            <div className="skeleton h-4 w-3/4" />
          </div>
        </div>
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="skeleton h-6 rounded" />
            ))}
          </div>
        </aside>
      </div>
    </div>
  )
}
