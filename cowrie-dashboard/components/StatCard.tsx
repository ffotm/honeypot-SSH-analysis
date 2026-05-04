type Accent = 'red' | 'amber' | 'green' | 'blue'

const accentMap: Record<Accent, string> = {
  red:   'text-red',
  amber: 'text-amber',
  green: 'text-green',
  blue:  'text-blue',
}

export default function StatCard({
  label, value, accent = 'blue'
}: {
  label: string
  value: number
  accent?: Accent
}) {
  return (
    <div className="border border-border bg-surface rounded p-4 space-y-1">
      <p className="mono text-xs text-dim uppercase tracking-wider">{label}</p>
      <p className={`mono text-2xl font-medium ${accentMap[accent]}`}>
        {value.toLocaleString()}
      </p>
    </div>
  )
}
