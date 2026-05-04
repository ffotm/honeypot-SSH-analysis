'use client'

import { useEffect, useState, useCallback } from 'react'
import StatCard from '@/components/StatCard'
import AttackerTable from '@/components/AttackerTable'
import CredentialList from '@/components/CredentialList'
import CommandList from '@/components/CommandList'
import Timeline from '@/components/Timeline'
import LogFeed from '@/components/LogFeed'

export default function Dashboard() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [tab, setTab] = useState<'attackers' | 'creds' | 'commands' | 'timeline' | 'logs'>('attackers')

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/data')
      const json = await res.json()
      setData(json)
      setLastUpdated(new Date())
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 15000)
    return () => clearInterval(interval)
  }, [fetchData])

  return (
    <div className="min-h-screen bg-bg text-text">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-red animate-pulse-dot" />
          <span className="mono text-sm font-medium tracking-widest uppercase text-sub">
            Cowrie
          </span>
          <span className="text-border">|</span>
          <span className="mono text-sm text-dim">Threat Intelligence</span>
        </div>
        <div className="flex items-center gap-4">
          {lastUpdated && (
            <span className="mono text-xs text-dim">
              updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchData}
            className="mono text-xs text-sub hover:text-text transition-colors px-3 py-1 border border-border hover:border-muted rounded"
          >
            refresh
          </button>
        </div>
      </header>

      <main className="px-6 py-6 max-w-7xl mx-auto space-y-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <span className="mono text-dim text-sm animate-pulse">loading logs...</span>
          </div>
        ) : data?.error ? (
          <div className="border border-red/20 bg-red/5 rounded p-6 mono text-sm text-red">
            {data.error}
          </div>
        ) : (
          <>
            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-fade-in">
              <StatCard label="Unique IPs"         value={data.uniqueIPs}           accent="red" />
              <StatCard label="Connections"        value={data.totalConnections}     accent="amber" />
              <StatCard label="Login Attempts"     value={data.totalLoginAttempts}   accent="red" />
              <StatCard label="Commands Logged"    value={data.totalCommands}        accent="blue" />
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-border">
              {(['attackers', 'creds', 'commands', 'timeline', 'logs'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`mono text-xs px-4 py-2 transition-colors border-b-2 -mb-px ${
                    tab === t
                      ? 'border-text text-text'
                      : 'border-transparent text-dim hover:text-sub'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="animate-slide-up">
              {tab === 'attackers'  && <AttackerTable  attackers={data.attackers} />}
              {tab === 'creds'      && <CredentialList passwords={data.topPasswords} usernames={data.topUsernames} />}
              {tab === 'commands'   && <CommandList    commands={data.topCommands} />}
              {tab === 'timeline'   && <Timeline       events={data.timeline} />}
              {tab === 'logs'       && <LogFeed        lines={data.recentRaw} />}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
