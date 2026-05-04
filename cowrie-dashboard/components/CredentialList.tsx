function Bar({ count, max, color }: { count: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max(4, Math.round((count / max) * 100)) : 4
  return (
    <div className="h-1 bg-muted rounded overflow-hidden w-full mt-1">
      <div className={`h-full rounded ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export default function CredentialList({
  passwords, usernames
}: {
  passwords: { value: string; count: number }[]
  usernames: { value: string; count: number }[]
}) {
  const maxPwd = passwords[0]?.count ?? 1
  const maxUsr = usernames[0]?.count ?? 1

  return (
    <div className="grid grid-cols-2 gap-6">
      <div>
        <p className="mono text-xs text-dim uppercase tracking-wider mb-4">Top Passwords</p>
        <div className="space-y-3">
          {passwords.map((p, i) => (
            <div key={i}>
              <div className="flex justify-between items-baseline">
                <span className="mono text-sm text-red">{p.value || '(empty)'}</span>
                <span className="mono text-xs text-dim">{p.count}</span>
              </div>
              <Bar count={p.count} max={maxPwd} color="bg-red" />
            </div>
          ))}
          {passwords.length === 0 && <p className="mono text-xs text-dim">no data</p>}
        </div>
      </div>

      <div>
        <p className="mono text-xs text-dim uppercase tracking-wider mb-4">Top Usernames</p>
        <div className="space-y-3">
          {usernames.map((u, i) => (
            <div key={i}>
              <div className="flex justify-between items-baseline">
                <span className="mono text-sm text-amber">{u.value || '(empty)'}</span>
                <span className="mono text-xs text-dim">{u.count}</span>
              </div>
              <Bar count={u.count} max={maxUsr} color="bg-amber" />
            </div>
          ))}
          {usernames.length === 0 && <p className="mono text-xs text-dim">no data</p>}
        </div>
      </div>
    </div>
  )
}
