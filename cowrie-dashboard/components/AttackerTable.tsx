'use client'
import { useState } from 'react'

function Flag({ proxy, hosting }: { proxy: boolean; hosting: boolean }) {
  if (proxy)   return <span className="mono text-xs px-1.5 py-0.5 bg-red/10 text-red border border-red/20 rounded">VPN</span>
  if (hosting) return <span className="mono text-xs px-1.5 py-0.5 bg-amber/10 text-amber border border-amber/20 rounded">DC</span>
  return <span className="mono text-xs px-1.5 py-0.5 bg-green/10 text-green border border-green/20 rounded">RES</span>
}

export default function AttackerTable({ attackers }: { attackers: any[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="space-y-1">
      {/* Header */}
      <div className="grid grid-cols-12 gap-2 px-3 py-2 mono text-xs text-dim uppercase tracking-wider border-b border-border">
        <span className="col-span-3">IP Address</span>
        <span className="col-span-3">Location</span>
        <span className="col-span-2 text-right">Connections</span>
        <span className="col-span-2 text-right">Attempts</span>
        <span className="col-span-2 text-right">Commands</span>
      </div>

      {attackers.length === 0 && (
        <div className="mono text-sm text-dim text-center py-12">no attackers logged yet</div>
      )}

      {attackers.map((a) => (
        <div key={a.ip} className="border border-border rounded overflow-hidden">
          {/* Row */}
          <button
            onClick={() => setExpanded(expanded === a.ip ? null : a.ip)}
            className="w-full grid grid-cols-12 gap-2 px-3 py-3 hover:bg-surface transition-colors text-left"
          >
            <div className="col-span-3 flex items-center gap-2">
              <span className="mono text-sm text-text">{a.ip}</span>
              {a.geo && <Flag proxy={a.geo.proxy} hosting={a.geo.hosting} />}
            </div>

            <div className="col-span-3">
              {a.geo?.status === 'success' ? (
                <span className="mono text-xs text-sub">
                  {a.geo.city}, {a.geo.country}
                </span>
              ) : (
                <span className="mono text-xs text-dim">—</span>
              )}
            </div>

            <span className="col-span-2 mono text-sm text-amber text-right">{a.connections}</span>
            <span className="col-span-2 mono text-sm text-red text-right">{a.loginAttempts.length}</span>
            <span className="col-span-2 mono text-sm text-blue text-right">{a.commands.length}</span>
          </button>

          {/* Expanded */}
          {expanded === a.ip && (
            <div className="border-t border-border bg-surface px-4 py-4 grid grid-cols-2 gap-6">
              {/* Geo */}
              {a.geo?.status === 'success' && (
                <div className="space-y-1">
                  <p className="mono text-xs text-dim uppercase tracking-wider mb-2">Intel</p>
                  <Row label="Country" value={a.geo.country} />
                  <Row label="Region"  value={a.geo.regionName} />
                  <Row label="City"    value={a.geo.city} />
                  <Row label="ISP"     value={a.geo.isp} />
                  {a.geo.org !== a.geo.isp && <Row label="Org" value={a.geo.org} />}
                  <Row label="Type"    value={a.geo.proxy ? 'VPN/Proxy' : a.geo.hosting ? 'Datacenter' : 'Residential'} />
                  <Row label="First"   value={a.firstSeen?.substring(0,19).replace('T',' ')} />
                  <Row label="Last"    value={a.lastSeen?.substring(0,19).replace('T',' ')} />
                </div>
              )}

              {/* Top creds */}
              <div className="space-y-1">
                <p className="mono text-xs text-dim uppercase tracking-wider mb-2">Top Credentials</p>
                {a.loginAttempts.slice(0, 8).map((l: any, i: number) => (
                  <div key={i} className="flex gap-2 mono text-xs">
                    <span className="text-sub w-4">{i+1}.</span>
                    <span className="text-amber">{l.user}</span>
                    <span className="text-dim">/</span>
                    <span className="text-red">{l.pass}</span>
                  </div>
                ))}
              </div>

              {/* Commands */}
              {a.commands.length > 0 && (
                <div className="col-span-2 space-y-1">
                  <p className="mono text-xs text-dim uppercase tracking-wider mb-2">Commands Run</p>
                  <div className="grid grid-cols-2 gap-1">
                    {a.commands.slice(0, 10).map((c: any, i: number) => (
                      <div key={i} className="mono text-xs text-blue bg-bg rounded px-2 py-1 truncate">
                        {c.cmd}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 mono text-xs">
      <span className="text-dim w-16 shrink-0">{label}</span>
      <span className="text-sub">{value}</span>
    </div>
  )
}
