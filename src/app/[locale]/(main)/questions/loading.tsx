export default function QuestionsLoading() {
  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mb-8">
        <div className="skeleton h-9 w-48 rounded-lg mb-2" />
        <div className="skeleton h-5 w-32 rounded" />
      </div>
      <div className="flex gap-2 mb-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="skeleton h-8 w-20 rounded-full" />
        ))}
      </div>
      <div className="space-y-3">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="rounded-xl border p-5 space-y-3">
            <div className="flex gap-4">
              <div className="flex gap-4 shrink-0">
                <div className="skeleton h-14 w-12 rounded-lg" />
                <div className="skeleton h-14 w-12 rounded-lg" />
              </div>
              <div className="flex-1 space-y-3">
                <div className="skeleton h-5 w-3/4" />
                <div className="skeleton h-4 w-full" />
                <div className="flex gap-2">
                  <div className="skeleton h-4 w-16 rounded-full" />
                  <div className="skeleton h-4 w-20 rounded-full" />
                  <div className="skeleton h-4 w-12 rounded-full ml-auto" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
