import type { HARTimings } from '../types/har'

interface Props { timings: HARTimings; totalTime: number; maxTime: number }

const COLORS: Record<string, string> = {
  blocked: '#b8b5ae', dns: '#5ea3d9', connect: '#c97dd9',
  ssl: '#a57dd9', send: '#5ec9c9', wait: '#5ebf7e', receive: '#5e8fd9',
}
const ORDER = ['blocked', 'dns', 'connect', 'ssl', 'send', 'wait', 'receive']

export default function Waterfall({ timings, totalTime, maxTime }: Props) {
  const widthPct = maxTime > 0 ? (totalTime / maxTime) * 100 : 0
  const barWidth = Math.max(widthPct, 0.5)

  const segments = ORDER
    .map(key => ({ key, ms: (timings as any)[key] ?? 0 }))
    .filter(s => s.ms > 0)

  if (segments.length === 0) {
    return (
      <div className="flex items-center gap-1.5" title={`${totalTime.toFixed(2)}ms`}>
        <div className="h-2 rounded-sm bg-[#d4d2cc]" style={{ width: `${barWidth}%`, minWidth: 4 }} />
        <span className="text-[10px] text-[#8b8b82] tabular-nums">{totalTime.toFixed(2)}ms</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 group"
         title={segments.map(s => `${s.key}: ${s.ms}ms`).join('\n')}>
      <div className="h-2 rounded-sm flex overflow-hidden" style={{ width: `${barWidth}%`, minWidth: 8 }}>
        {segments.map(s => {
          const segPct = totalTime > 0 ? (s.ms / totalTime) * 100 : 0
          if (segPct < 0.3) return null
          return (
            <div key={s.key} className="h-full shrink-0 transition-opacity group-hover:opacity-75"
                 style={{ width: `${Math.max(segPct, 0.3)}%`, backgroundColor: COLORS[s.key] ?? '#b8b5ae' }} />
          )
        })}
      </div>
      <span className="text-[10px] text-[#6b6b65] tabular-nums">{totalTime.toFixed(2)}ms</span>
    </div>
  )
}
