export default function Timeline({ events }: { events: any[] }) {
  return (
    <div>
      <p className="mono text-xs text-dim uppercase tracking-wider mb-4">Recent Activity</p>
      <div className="space-y-1">
        {events.map((e, i) => (
          <div key={i} className="flex items-start gap-4 py-2 border-b border-border/50 last:border-0">
            <span className="mono text-xs text-dim shrink-0 w-36">
              {e.ts?.substring(0, 19).replace('T', ' ')}
            </span>
            <span className={`mono text-xs shrink-0 w-14 ${
              e.type === 'LOGIN' ? 'text-red' : 'text-blue'
            }`}>
              {e.type}
            </span>
            <span className="mono text-xs text-amber shrink-0 w-36">{e.ip}</span>
            <span className="mono text-xs text-sub truncate">{e.detail}</span>
          </div>
        ))}
        {events.length === 0 && <p className="mono text-xs text-dim">no events yet</p>}
      </div>
    </div>
  )
}
