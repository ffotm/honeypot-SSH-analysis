#!/usr/bin/env python3
"""
Cowrie Threat Intelligence Dashboard
Reads cowrie.log and cowrie.json, enriches IPs with geolocation + threat intel
"""

import json
import re
import sys
import os
import time
import argparse
from datetime import datetime
from collections import defaultdict, Counter
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError

# ─── ANSI Colors ───────────────────────────────────────────────────────────────
R  = "\033[0m"
B  = "\033[1m"        # bold
DIM = "\033[2m"
RED    = "\033[91m"
GRN    = "\033[92m"
YEL    = "\033[93m"
BLU    = "\033[94m"
MAG    = "\033[95m"
CYN    = "\033[96m"
WHT    = "\033[97m"
BRED   = "\033[41m"
BGGRN  = "\033[42m"
BGYEL  = "\033[43m"
BGBLU  = "\033[44m"
BGMAG  = "\033[45m"

def clear(): os.system("clear")

def banner():
    print(f"""
{RED}{B}
 ██████╗ ██████╗ ██╗    ██╗██████╗ ██╗███████╗
██╔════╝██╔═══██╗██║    ██║██╔══██╗██║██╔════╝
██║     ██║   ██║██║ █╗ ██║██████╔╝██║█████╗
██║     ██║   ██║██║███╗██║██╔══██╗██║██╔══╝
╚██████╗╚██████╔╝╚███╔███╔╝██║  ██║██║███████╗
 ╚═════╝ ╚═════╝  ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝╚══════╝
{R}{YEL}{B} Honeypot Threat Intelligence Dashboard{R}
{DIM} Cowrie SSH Honeypot Log Analyzer{R}
""")

def box(title, width=70):
    print(f"\n{CYN}{B}{'─'*width}{R}")
    print(f"{CYN}{B} ▶  {title}{R}")
    print(f"{CYN}{'─'*width}{R}")

def separator(width=70):
    print(f"{DIM}{'·'*width}{R}")

# ─── IP Enrichment ─────────────────────────────────────────────────────────────

_ip_cache = {}

def enrich_ip(ip):
    """Get geolocation + basic info from ip-api.com (free, no key needed)"""
    if ip in _ip_cache:
        return _ip_cache[ip]
    try:
        url = f"http://ip-api.com/json/{ip}?fields=status,country,regionName,city,isp,org,as,proxy,hosting,query"
        req = Request(url, headers={"User-Agent": "CowrieDashboard/1.0"})
        with urlopen(req, timeout=5) as r:
            data = json.loads(r.read().decode())
        _ip_cache[ip] = data
        return data
    except Exception:
        result = {"status": "fail", "query": ip}
        _ip_cache[ip] = result
        return result

def check_abuseipdb(ip, api_key):
    """Check IP reputation on AbuseIPDB if API key provided"""
    try:
        url = f"https://api.abuseipdb.com/api/v2/check?ipAddress={ip}&maxAgeInDays=90"
        req = Request(url, headers={
            "Key": api_key,
            "Accept": "application/json"
        })
        with urlopen(req, timeout=5) as r:
            data = json.loads(r.read().decode())
        return data.get("data", {})
    except Exception:
        return {}

def threat_level(score):
    if score >= 80:
        return f"{RED}{B}CRITICAL ({score}%){R}"
    elif score >= 50:
        return f"{YEL}{B}HIGH ({score}%){R}"
    elif score >= 20:
        return f"{MAG}MEDIUM ({score}%){R}"
    elif score > 0:
        return f"{BLU}LOW ({score}%){R}"
    else:
        return f"{GRN}CLEAN (0%){R}"

# ─── Log Parsers ───────────────────────────────────────────────────────────────

def parse_cowrie_log(path):
    """Parse cowrie.log (plain text format)"""
    events = []
    pattern = re.compile(
        r'(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)\s+\[([^\]]+)\]\s+(.*)'
    )
    try:
        with open(path, "r", errors="replace") as f:
            for line in f:
                m = pattern.match(line.strip())
                if m:
                    events.append({
                        "ts": m.group(1),
                        "component": m.group(2),
                        "message": m.group(3)
                    })
    except FileNotFoundError:
        print(f"{YEL}[!] cowrie.log not found at {path}{R}")
    return events

def parse_cowrie_json(path):
    """Parse cowrie.json (one JSON object per line)"""
    events = []
    try:
        with open(path, "r", errors="replace") as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        events.append(json.loads(line))
                    except json.JSONDecodeError:
                        pass
    except FileNotFoundError:
        print(f"{YEL}[!] cowrie.json not found at {path}{R}")
    return events

# ─── Analysis ──────────────────────────────────────────────────────────────────

def analyze(log_events, json_events):
    data = {
        "connections": defaultdict(lambda: {
            "count": 0, "sessions": [], "login_attempts": [],
            "commands": [], "first_seen": None, "last_seen": None
        }),
        "passwords": Counter(),
        "usernames": Counter(),
        "commands": Counter(),
        "total_connections": 0,
        "total_login_attempts": 0,
        "total_commands": 0,
        "sessions": {}
    }

    # Parse from plain log
    ip_re = re.compile(r'(\d+\.\d+\.\d+\.\d+)')
    login_re = re.compile(r"login attempt \[b'([^']+)'/b'([^']+)'\]")
    cmd_re = re.compile(r"CMD: (.+)")

    for e in log_events:
        msg = e["message"]
        ts  = e["ts"]

        ip_match = ip_re.search(msg)
        ip = ip_match.group(1) if ip_match else None

        if "New connection" in msg and ip:
            data["connections"][ip]["count"] += 1
            data["total_connections"] += 1
            if not data["connections"][ip]["first_seen"]:
                data["connections"][ip]["first_seen"] = ts
            data["connections"][ip]["last_seen"] = ts

        login = login_re.search(msg)
        if login and ip:
            user, pwd = login.group(1), login.group(2)
            data["connections"][ip]["login_attempts"].append((user, pwd, ts))
            data["passwords"][pwd] += 1
            data["usernames"][user] += 1
            data["total_login_attempts"] += 1

        cmd = cmd_re.search(msg)
        if cmd and ip:
            command = cmd.group(1).strip()
            data["connections"][ip]["commands"].append((command, ts))
            data["commands"][command] += 1
            data["total_commands"] += 1

    # Enrich from JSON log (more structured)
    for e in json_events:
        ip = e.get("src_ip")
        if not ip:
            continue
        etype = e.get("eventid", "")
        ts = e.get("timestamp", "")

        if "cowrie.session.connect" in etype:
            if not data["connections"][ip]["first_seen"]:
                data["connections"][ip]["first_seen"] = ts

        if "cowrie.login" in etype:
            user = e.get("username", "")
            pwd  = e.get("password", "")
            if user and pwd:
                data["connections"][ip]["login_attempts"].append((user, pwd, ts))
                data["passwords"][pwd] += 1
                data["usernames"][user] += 1

        if "cowrie.command.input" in etype:
            cmd = e.get("input", "")
            if cmd:
                data["connections"][ip]["commands"].append((cmd, ts))
                data["commands"][cmd] += 1

    return data

# ─── Display Sections ──────────────────────────────────────────────────────────

def display_summary(data):
    box("SUMMARY", 70)
    ips = len(data["connections"])
    print(f"  {B}Total Unique IPs        :{R}  {YEL}{B}{ips}{R}")
    print(f"  {B}Total Connections       :{R}  {CYN}{data['total_connections']}{R}")
    print(f"  {B}Total Login Attempts    :{R}  {RED}{data['total_login_attempts']}{R}")
    print(f"  {B}Total Commands Logged   :{R}  {MAG}{data['total_commands']}{R}")

def display_top_attackers(data, abuse_key=None, limit=10):
    box(f"TOP {limit} ATTACKERS — IP INTELLIGENCE", 70)

    sorted_ips = sorted(
        data["connections"].items(),
        key=lambda x: x[1]["count"],
        reverse=True
    )[:limit]

    for rank, (ip, info) in enumerate(sorted_ips, 1):
        print(f"\n  {B}{YEL}#{rank}  {ip}{R}")

        # Geo/ISP info
        print(f"  {DIM}Fetching intelligence...{R}", end="\r")
        geo = enrich_ip(ip)

        if geo.get("status") == "success":
            country  = geo.get("country", "?")
            region   = geo.get("regionName", "?")
            city     = geo.get("city", "?")
            isp      = geo.get("isp", "?")
            org      = geo.get("org", "?")
            is_proxy = geo.get("proxy", False)
            is_host  = geo.get("hosting", False)

            flags = []
            if is_proxy: flags.append(f"{RED}[VPN/PROXY]{R}")
            if is_host:  flags.append(f"{YEL}[HOSTING/DC]{R}")
            flag_str = "  ".join(flags) if flags else f"{GRN}[RESIDENTIAL]{R}"

            print(f"  {'':3}📍 {B}{city}, {region}, {country}{R}  {flag_str}     ")
            print(f"  {'':3}🏢 ISP: {CYN}{isp}{R}")
            if org != isp:
                print(f"  {'':3}🏛  ORG: {DIM}{org}{R}")
        else:
            print(f"  {'':3}📍 {DIM}Geolocation unavailable{R}     ")

        # AbuseIPDB
        if abuse_key:
            abuse = check_abuseipdb(ip, abuse_key)
            score = abuse.get("abuseConfidenceScore", 0)
            reports = abuse.get("totalReports", 0)
            print(f"  {'':3}🔴 Abuse Score: {threat_level(score)}  ({reports} reports)")

        # Stats
        attempts = len(info["login_attempts"])
        cmds     = len(info["commands"])
        print(f"  {'':3}🔗 Connections: {B}{info['count']}{R}  |  "
              f"Login Attempts: {RED}{attempts}{R}  |  "
              f"Commands Run: {MAG}{cmds}{R}")

        if info["first_seen"]:
            print(f"  {'':3}🕐 First: {DIM}{info['first_seen'][:19].replace('T',' ')}{R}  "
                  f"Last: {DIM}{info['last_seen'][:19].replace('T',' ') if info['last_seen'] else '?'}{R}")

        # Top passwords tried by this IP
        if info["login_attempts"]:
            top_creds = Counter((u, p) for u, p, _ in info["login_attempts"]).most_common(3)
            cred_str = "  ".join([f"{YEL}{u}{R}/{RED}{p}{R}" for (u,p),_ in top_creds])
            print(f"  {'':3}🔑 Top Creds: {cred_str}")

        # Commands
        if info["commands"]:
            top_cmds = [c for c, _ in info["commands"][:3]]
            print(f"  {'':3}💻 Commands: {MAG}" + f"  |  ".join(top_cmds[:3]) + f"{R}")

        separator()

def display_credentials(data, limit=15):
    box("CREDENTIAL ANALYSIS — PASSWORDS & USERNAMES", 70)

    print(f"\n  {B}{RED}Top {limit} Passwords Attempted:{R}")
    for i, (pwd, count) in enumerate(data["passwords"].most_common(limit), 1):
        bar = "█" * min(count, 40)
        print(f"  {DIM}{i:>2}.{R}  {RED}{pwd:<30}{R}  {YEL}{bar}{R} {count}")

    print(f"\n  {B}{BLU}Top {limit} Usernames Attempted:{R}")
    for i, (user, count) in enumerate(data["usernames"].most_common(limit), 1):
        bar = "█" * min(count, 40)
        print(f"  {DIM}{i:>2}.{R}  {BLU}{user:<30}{R}  {YEL}{bar}{R} {count}")

def display_commands(data, limit=15):
    box("TOP COMMANDS RUN BY ATTACKERS", 70)
    for i, (cmd, count) in enumerate(data["commands"].most_common(limit), 1):
        bar = "█" * min(count, 30)
        print(f"  {DIM}{i:>2}.{R}  {MAG}{cmd:<45}{R}  {GRN}{bar}{R} {count}")

def display_timeline(data, limit=20):
    box("RECENT ACTIVITY TIMELINE", 70)

    events = []
    for ip, info in data["connections"].items():
        for user, pwd, ts in info["login_attempts"]:
            events.append((ts, ip, "LOGIN", f"{YEL}{user}{R}/{RED}{pwd}{R}"))
        for cmd, ts in info["commands"]:
            events.append((ts, ip, "CMD", f"{MAG}{cmd}{R}"))

    events.sort(key=lambda x: x[0], reverse=True)

    for ts, ip, etype, detail in events[:limit]:
        ts_fmt = ts[:19].replace("T", " ") if ts else "?"
        etype_col = RED if etype == "LOGIN" else MAG
        print(f"  {DIM}{ts_fmt}{R}  {etype_col}{B}{etype:<6}{R}  {CYN}{ip:<18}{R}  {detail}")

# ─── Live Mode ─────────────────────────────────────────────────────────────────

def live_mode(log_path, json_path, abuse_key=None, interval=10):
    print(f"\n{GRN}{B}[LIVE MODE] Watching logs every {interval}s — Ctrl+C to exit{R}\n")
    seen_lines = 0
    try:
        while True:
            try:
                with open(log_path, "r", errors="replace") as f:
                    lines = f.readlines()
                new_lines = lines[seen_lines:]
                seen_lines = len(lines)

                if new_lines:
                    print(f"\n{GRN}[{datetime.now().strftime('%H:%M:%S')}] {len(new_lines)} new log lines{R}")
                    ip_re    = re.compile(r'(\d+\.\d+\.\d+\.\d+)')
                    login_re = re.compile(r"login attempt \[b'([^']+)'/b'([^']+)'\]")
                    cmd_re   = re.compile(r"CMD: (.+)")

                    for line in new_lines:
                        line = line.strip()
                        ip_m = ip_re.search(line)
                        ip   = ip_m.group(1) if ip_m else "?"

                        if "New connection" in line:
                            geo = enrich_ip(ip)
                            loc = f"{geo.get('city','?')}, {geo.get('country','?')}" if geo.get("status")=="success" else "?"
                            print(f"  {CYN}[CONNECT]{R}  {B}{ip}{R}  📍{loc}")

                        login = login_re.search(line)
                        if login:
                            print(f"  {RED}[LOGIN  ]{R}  {B}{ip}{R}  user={YEL}{login.group(1)}{R} pass={RED}{login.group(2)}{R}")

                        cmd = cmd_re.search(line)
                        if cmd:
                            print(f"  {MAG}[CMD    ]{R}  {B}{ip}{R}  {MAG}{cmd.group(1)}{R}")
                else:
                    print(f"{DIM}[{datetime.now().strftime('%H:%M:%S')}] No new activity...{R}", end="\r")

                time.sleep(interval)
            except FileNotFoundError:
                print(f"{RED}[!] Log file not found: {log_path}{R}")
                time.sleep(interval)
    except KeyboardInterrupt:
        print(f"\n\n{YEL}[!] Live mode stopped.{R}\n")

# ─── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Cowrie Honeypot Threat Intelligence Dashboard"
    )
    parser.add_argument("--log",   default="/home/cowrie/cowrie/var/log/cowrie/cowrie.log",
                        help="Path to cowrie.log")
    parser.add_argument("--json",  default="/home/cowrie/cowrie/var/log/cowrie/cowrie.json",
                        help="Path to cowrie.json")
    parser.add_argument("--abuse-key", default=None,
                        help="AbuseIPDB API key for threat scoring (optional)")
    parser.add_argument("--live",  action="store_true",
                        help="Live mode: tail logs in real-time")
    parser.add_argument("--interval", type=int, default=10,
                        help="Live mode refresh interval in seconds (default: 10)")
    parser.add_argument("--top",   type=int, default=10,
                        help="Number of top attackers to show (default: 10)")
    args = parser.parse_args()

    clear()
    banner()

    if args.live:
        live_mode(args.log, args.json, args.abuse_key, args.interval)
        return

    print(f"{DIM}Loading logs...{R}")
    log_events  = parse_cowrie_log(args.log)
    json_events = parse_cowrie_json(args.json)

    total = len(log_events) + len(json_events)
    print(f"{GRN}[✓] Loaded {len(log_events)} log lines + {len(json_events)} JSON events ({total} total){R}")

    if total == 0:
        print(f"{RED}[!] No events found. Check your log paths.{R}\n")
        return

    data = analyze(log_events, json_events)

    display_summary(data)
    display_top_attackers(data, abuse_key=args.abuse_key, limit=args.top)
    display_credentials(data)
    display_commands(data)
    display_timeline(data)

    print(f"\n{GRN}{B}[✓] Analysis complete.{R}\n")
    if not args.abuse_key:
        print(f"{DIM}  Tip: Add --abuse-key YOUR_KEY to get AbuseIPDB threat scores.{R}")
        print(f"{DIM}  Get a free key at https://www.abuseipdb.com/register{R}\n")

if __name__ == "__main__":
    main()