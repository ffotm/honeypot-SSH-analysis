export default function CommandList({ commands }: { commands: { value: string; count: number }[] }) {
  const max = commands[0]?.count ?? 1

  return (
    <div>
      <p className="mono text-xs text-dim uppercase tracking-wider mb-4">Top Commands</p>
      <div className="space-y-2">
        {commands.map((c, i) => {
          const pct = Math.max(4, Math.round((c.count / max) * 100))
          return (
            <div key={i} className="flex items-center gap-4 group">
              <span className="mono text-xs text-dim w-5 shrink-0">{i + 1}.</span>
              <div className="flex-1 relative bg-surface border border-border rounded overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-blue/10"
                  style={{ width: `${pct}%` }}
                />
                <span className="relative mono text-sm text-blue px-3 py-1.5 block truncate">
                  {c.value}
                </span>
              </div>
              <span className="mono text-xs text-dim w-8 text-right shrink-0">{c.count}</span>
            </div>
          )
        })}
        {commands.length === 0 && <p className="mono text-xs text-dim">no commands logged</p>}
      </div>
    </div>
  )
}
