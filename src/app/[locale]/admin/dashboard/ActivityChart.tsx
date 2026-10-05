import { cn } from "@/lib/utils"

export interface ActivityPoint {
  label: string
  users: number
  articles: number
  questions: number
  comments: number
}

interface ActivityChartProps {
  data: ActivityPoint[]
  title: string
  description: string
  seriesLabels: { users: string; articles: string; questions: string; comments: string }
  emptyLabel: string
}

const SERIES = ["users", "articles", "questions", "comments"] as const
type SeriesKey = (typeof SERIES)[number]

const SERIES_COLOR: Record<SeriesKey, { swatch: string; fill: string }> = {
  users: { swatch: "bg-sky-500", fill: "fill-sky-500" },
  articles: { swatch: "bg-emerald-500", fill: "fill-emerald-500" },
  questions: { swatch: "bg-amber-500", fill: "fill-amber-500" },
  comments: { swatch: "bg-pink-500", fill: "fill-pink-500" },
}

/**
 * Dependency-free stacked bar chart (server-rendered SVG).
 * The same values are exposed as a visually hidden table so the data does not
 * depend on colour alone.
 */
export function ActivityChart({ data, title, description, seriesLabels, emptyLabel }: ActivityChartProps) {
  const max = Math.max(
    1,
    ...data.map((point) => point.users + point.articles + point.questions + point.comments)
  )
  const height = 120
  const barWidth = 100 / Math.max(data.length, 1)
  const hasActivity = data.some(
    (point) => point.users + point.articles + point.questions + point.comments > 0
  )

  return (
    <figure className="space-y-3">
      <figcaption className="space-y-1">
        <p className="text-xs text-muted-foreground">{description}</p>
      </figcaption>

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {SERIES.map((series) => (
          <span key={series} className="inline-flex items-center gap-1.5">
            <span className={cn("h-2.5 w-2.5 rounded-sm", SERIES_COLOR[series].swatch)} />
            {seriesLabels[series]}
          </span>
        ))}
      </div>

      {!hasActivity ? (
        <p className="flex h-32 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          {emptyLabel}
        </p>
      ) : (
        <svg
          viewBox={`0 0 100 ${height}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`${title}. ${description}`}
          className="h-32 w-full overflow-visible"
        >
          {data.map((point, index) => {
            const scale = (value: number) => (value / max) * (height - 8)
            const x = index * barWidth + barWidth * 0.15
            const width = barWidth * 0.7
            let cursor = height
            const total = point.users + point.articles + point.questions + point.comments

            return (
              <g key={point.label}>
                <title>{`${point.label}: ${total}`}</title>
                <rect x={x} y={0} width={width} height={height} className="fill-muted/40" rx={1.5} />
                {SERIES.map((series) => {
                  const value = point[series]
                  if (value <= 0) return null
                  const segmentHeight = scale(value)
                  cursor -= segmentHeight
                  return (
                    <rect
                      key={series}
                      x={x}
                      y={cursor}
                      width={width}
                      height={segmentHeight}
                      className={SERIES_COLOR[series].fill}
                      rx={1.5}
                    />
                  )
                })}
              </g>
            )
          })}
        </svg>
      )}

      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>

      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">{description}</th>
            {SERIES.map((series) => (
              <th key={series} scope="col">
                {seriesLabels[series]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((point) => (
            <tr key={point.label}>
              <th scope="row">{point.label}</th>
              {SERIES.map((series) => (
                <td key={series}>{point[series]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
