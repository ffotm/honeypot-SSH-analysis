import fs from 'fs'
import path from 'path'

export interface AttackerInfo {
  ip: string
  connections: number
  loginAttempts: { user: string; pass: string; ts: string }[]
  commands: { cmd: string; ts: string }[]
  firstSeen: string
  lastSeen: string
  geo?: GeoInfo
}

export interface GeoInfo {
  country: string
  regionName: string
  city: string
  isp: string
  org: string
  proxy: boolean
  hosting: boolean
  status: string
}

export interface DashboardData {
  totalConnections: number
  totalLoginAttempts: number
  totalCommands: number
  uniqueIPs: number
  attackers: AttackerInfo[]
  topPasswords: { value: string; count: number }[]
  topUsernames: { value: string; count: number }[]
  topCommands: { value: string; count: number }[]
  timeline: { ts: string; ip: string; type: string; detail: string }[]
  recentRaw: string[]
}

function parseTimestamp(ts: string): string {
  return ts?.replace('T', ' ').substring(0, 19) ?? ''
}

export function parseLogs(logPath: string, jsonPath: string): DashboardData {
  const attackers: Record<string, AttackerInfo> = {}
  const passwords: Record<string, number> = {}
  const usernames: Record<string, number> = {}
  const commands: Record<string, number> = {}
  const timeline: DashboardData['timeline'] = []
  const recentRaw: string[] = []

  let totalConnections = 0
  let totalLoginAttempts = 0
  let totalCommands = 0

  // ── Parse plain log ──────────────────────────────────────────────────────────
  try {
    const content = fs.readFileSync(logPath, 'utf-8')
    const lines = content.split('\n').filter(Boolean)
    const last50 = lines.slice(-50).reverse()
    recentRaw.push(...last50)

    const ipRe    = /(\d+\.\d+\.\d+\.\d+)/
    const loginRe = /login attempt \[b'([^']+)'\/b'([^']+)'\]/
    const cmdRe   = /CMD: (.+)/
    const tsRe    = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)/

    for (const line of lines) {
      const tsM = tsRe.exec(line)
      const ts  = tsM ? tsM[1] : ''
      const ipM = ipRe.exec(line)
      const ip  = ipM ? ipM[1] : null
      if (!ip) continue

      if (!attackers[ip]) {
        attackers[ip] = { ip, connections: 0, loginAttempts: [], commands: [], firstSeen: ts, lastSeen: ts }
      }
      attackers[ip].lastSeen = ts

      if (line.includes('New connection')) {
        attackers[ip].connections++
        totalConnections++
        if (!attackers[ip].firstSeen) attackers[ip].firstSeen = ts
      }

      const loginM = loginRe.exec(line)
      if (loginM) {
        const [, user, pass] = loginM
        attackers[ip].loginAttempts.push({ user, pass, ts })
        passwords[pass] = (passwords[pass] || 0) + 1
        usernames[user] = (usernames[user] || 0) + 1
        totalLoginAttempts++
        timeline.push({ ts, ip, type: 'LOGIN', detail: `${user} / ${pass}` })
      }

      const cmdM = cmdRe.exec(line)
      if (cmdM) {
        const cmd = cmdM[1].trim()
        attackers[ip].commands.push({ cmd, ts })
        commands[cmd] = (commands[cmd] || 0) + 1
        totalCommands++
        timeline.push({ ts, ip, type: 'CMD', detail: cmd })
      }
    }
  } catch {}

  // ── Parse JSON log ───────────────────────────────────────────────────────────
  try {
    const content = fs.readFileSync(jsonPath, 'utf-8')
    for (const line of content.split('\n').filter(Boolean)) {
      try {
        const e = JSON.parse(line)
        const ip = e.src_ip
        if (!ip) continue

        if (!attackers[ip]) {
          attackers[ip] = { ip, connections: 0, loginAttempts: [], commands: [], firstSeen: e.timestamp ?? '', lastSeen: e.timestamp ?? '' }
        }

        const eid = e.eventid ?? ''
        if (eid.includes('login') && e.username && e.password) {
          attackers[ip].loginAttempts.push({ user: e.username, pass: e.password, ts: e.timestamp })
          passwords[e.password] = (passwords[e.password] || 0) + 1
          usernames[e.username] = (usernames[e.username] || 0) + 1
        }
        if (eid.includes('command') && e.input) {
          attackers[ip].commands.push({ cmd: e.input, ts: e.timestamp })
          commands[e.input] = (commands[e.input] || 0) + 1
        }
      } catch {}
    }
  } catch {}

  const topPasswords = Object.entries(passwords).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([value, count]) => ({ value, count }))
  const topUsernames = Object.entries(usernames).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([value, count]) => ({ value, count }))
  const topCommands  = Object.entries(commands).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([value, count]) => ({ value, count }))

  const sortedAttackers = Object.values(attackers)
    .sort((a, b) => b.connections - a.connections)

  timeline.sort((a, b) => b.ts.localeCompare(a.ts))

  return {
    totalConnections,
    totalLoginAttempts,
    totalCommands,
    uniqueIPs: Object.keys(attackers).length,
    attackers: sortedAttackers,
    topPasswords,
    topUsernames,
    topCommands,
    timeline: timeline.slice(0, 30),
    recentRaw,
  }
}
