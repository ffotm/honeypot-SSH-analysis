# Architecture

## Network Topology

```
Internet
    │
    │  port 2222
    ▼
┌─────────────────────────────────────┐
│         Router (port forwarding)    │
│         external 2222 → host 2222   │
└─────────────────┬───────────────────┘
                  │
    ┌─────────────▼─────────────────────────────┐
    │           Arch Linux Host                  │
    │                                            │
    │  iptables DNAT: 2222 → VM 2222             │
    │  Real SSH: port 22222 (LAN only)           │
    │                                            │
    │   ┌────────────────────────────────────┐   │
    │   │         Ubuntu VM                  │   │
    │   │                                    │   │
    │   │  ┌──────────────────────────────┐  │   │
    │   │  │   Cowrie SSH Honeypot        │  │   │
    │   │  │   (cowrie user)              │  │   │
    │   │  │   port 2222                  │  │   │
    │   │  │                              │  │   │
    │   │  │   var/log/cowrie/            │  │   │
    │   │  │   ├── cowrie.log             │  │   │
    │   │  │   └── cowrie.json            │  │   │
    │   │  └──────────┬───────────────────┘  │   │
    │   │             │ reads                │   │
    │   │  ┌──────────▼───────────────────┐  │   │
    │   │  │  Next.js Dashboard :3000     │  │   │
    │   │  │  Python CLI tool             │  │   │
    │   │  └──────────────────────────────┘  │   │
    │   │                                    │   │
    │   │  iptables blocks cowrie outbound   │   │
    │   └────────────────────────────────────┘   │
    └───────────────────────────────────────────-┘
                  │
    ┌─────────────▼──────────┐
    │   Kali Linux (LAN)     │
    │   attacker / testing   │
    └────────────────────────┘
```

## Data Flow

1. Attacker connects to port 2222 from the internet
2. Router forwards to host, host iptables DNATs to VM
3. Cowrie accepts the connection and presents a fake SSH server
4. Every credential attempt and command is written to `cowrie.log` and `cowrie.json`
5. Next.js dashboard reads both files via a server-side API route, parses them, and enriches IPs with geolocation from ip-api.com
6. CLI tool does the same but renders in the terminal with live tail mode

## Security Boundaries

- Cowrie runs as a dedicated non-root `cowrie` user
- Cowrie user outbound traffic is blocked via iptables — no attacker can download anything or pivot
- Real SSH on port 22222 is not port-forwarded, only reachable from LAN
- Honeypot filesystem is entirely virtual — no real files are accessible
