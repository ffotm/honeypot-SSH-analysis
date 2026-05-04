import { NextResponse } from 'next/server'
import { parseLogs } from '@/lib/parser'

const LOG_PATH  = process.env.COWRIE_LOG  ?? '/home/cowrie/cowrie/var/log/cowrie/cowrie.log'
const JSON_PATH = process.env.COWRIE_JSON ?? '/home/cowrie/cowrie/var/log/cowrie/cowrie.json'

// Simple in-memory geo cache
const geoCache: Record<string, any> = {}

async function getGeo(ip: string) {
  if (geoCache[ip]) return geoCache[ip]
  try {
    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,country,regionName,city,isp,org,proxy,hosting`,
      { next: { revalidate: 3600 } }
    )
    const data = await res.json()
    geoCache[ip] = data
    return data
  } catch {
    return { status: 'fail' }
  }
}

export async function GET() {
  try {
    const data = parseLogs(LOG_PATH, JSON_PATH)

    // Enrich top 10 IPs with geo
    const top10 = data.attackers.slice(0, 10)
    await Promise.all(
      top10.map(async (a) => {
        a.geo = await getGeo(a.ip)
      })
    )

    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
