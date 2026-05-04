# Cowrie Threat Intelligence Dashboard

Minimal Next.js dashboard for your Cowrie SSH honeypot.

## Setup

```bash
cd cowrie-dashboard
npm install
npm run dev
```

Opens at http://localhost:3000

## Log Paths

By default reads from:
- `/home/cowrie/cowrie/var/log/cowrie/cowrie.log`
- `/home/cowrie/cowrie/var/log/cowrie/cowrie.json`

Override with environment variables:

```bash
COWRIE_LOG=/path/to/cowrie.log \
COWRIE_JSON=/path/to/cowrie.json \
npm run dev
```

Or create a `.env.local`:
```
COWRIE_LOG=/home/cowrie/cowrie/var/log/cowrie/cowrie.log
COWRIE_JSON=/home/cowrie/cowrie/var/log/cowrie/cowrie.json
```

## Features

- **Attackers** — IP table with geo, ISP, VPN/DC/Residential detection, credentials tried, commands run (click any row to expand)
- **Creds** — Top passwords and usernames across all sessions
- **Commands** — Most run commands with frequency bars
- **Timeline** — Chronological feed of logins and commands
- **Logs** — Color-coded raw log tail (last 50 lines)

Auto-refreshes every 15 seconds.

## Production

```bash
npm run build
npm start
```

Run on port 3000 (or set PORT env var). Keep it behind a firewall — only accessible from your own machine.
