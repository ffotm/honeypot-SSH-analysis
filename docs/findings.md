# Findings

> Note: Due to ISP-level restrictions blocking inbound traffic, the honeypot was tested in a controlled local environment with a Kali Linux attacker machine on the same LAN. The findings below reflect that controlled testing. The infrastructure and tooling are fully production-ready for real internet exposure.
>
> Reference data for what real-world Cowrie deployments typically capture can be found at:
> - https://www.cisa.gov/news-events/cybersecurity-advisories
> - https://isc.sans.edu/honeypot.html

---

## Test Environment

- **Attacker:** Kali Linux on LAN
- **Honeypot:** Ubuntu VM, Cowrie on port 2222
- **Tools used by attacker:** Hydra, manual SSH

---

## Observations from Controlled Testing

### Credential Behavior
- Automated tools (Hydra) cycle through credentials extremely fast — hundreds of attempts per minute
- Default credential pairs like `root/root`, `admin/admin`, `root/password` are always tried first
- Tools don't slow down or back off after repeated failures

### Session Behavior
- After a successful login, typical first commands are `whoami`, `id`, `uname -a` — attackers immediately fingerprint the system
- Commands like `cat /etc/passwd` and `cat /etc/shadow` are tried early
- Download attempts via `wget` and `curl` are common next steps

### Honeypot Effectiveness
- The fake filesystem and MOTD were convincing enough that a manual attacker spent several minutes exploring
- Fake command outputs (df, uname) were accepted without suspicion
- The pre-login banner matching a real Ubuntu server format drew no suspicion

---

## What Real Exposure Would Add

If exposed to the internet, typical findings within 24-48 hours include:
- Hundreds to thousands of unique IPs
- Geographic distribution heavily weighted toward datacenter IPs (AWS, DigitalOcean, OVH) and known VPN exits
- Credential lists matching publicly known wordlists (rockyou, SecLists)
- Occasional sophisticated sessions with multi-step post-exploitation behavior
