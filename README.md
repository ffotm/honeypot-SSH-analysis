# SSH Honeypot — Threat Intelligence Platform

A production SSH honeypot built on [Cowrie](https://github.com/cowrie/cowrie) with a custom threat intelligence dashboard. Captures real attack data — credentials attempted, commands run, attacker geolocation.

---

## Stack

| Layer | Tech |
|---|---|
| Honeypot | Cowrie 2.9.x |
| Host | Arch Linux → Ubuntu VM |
| Dashboard | Next.js 14, Tailwind CSS |
| CLI Tool | Python 3 |
| IP Intel | ip-api.com, AbuseIPDB (optional) |

---

## Setup

### 1 — System Dependencies

```bash
sudo apt-get install git python3-pip python3-venv libssl-dev libffi-dev build-essential libpython3-dev python3-minimal authbind
```

### 2 — Move Real SSH Off Port 22

```bash
sudo nano /etc/ssh/sshd_config
# Set: Port 22222
sudo systemctl restart ssh
```

### 3 — Create Cowrie User

```bash
sudo adduser --disabled-password cowrie
sudo su - cowrie
```

### 4 — Clone and Install

```bash
git clone http://github.com/cowrie/cowrie
cd cowrie
python3 -m venv cowrie-env
source cowrie-env/bin/activate
python -m pip install --upgrade pip
python -m pip install -e .
```

### 5 — Configure

```bash
nano etc/cowrie.cfg
```

```ini
[honeypot]
hostname = ubuntu-server

[ssh]
listen_endpoints = tcp:2222:interface=0.0.0.0
```

### 6 — Fake Filesystem

```bash
mkdir -p ~/cowrie/myfs/etc
mkdir -p ~/cowrie/myfs/home/admin
mkdir -p ~/cowrie/myfs/var/www/html
mkdir -p ~/cowrie/myfs/tmp
```

```bash
source cowrie-env/bin/activate
createfs -l myfs -d 5 -o custom.pickle
```

Add to `etc/cowrie.cfg`:

```ini
[shell]
filesystem = /home/cowrie/cowrie/custom.pickle
```

### 7 — Customize Attacker Experience

**Pre-login banner** (`honeyfs/etc/issue.net`):
```
Ubuntu 22.04.3 LTS \n \l
```

**Post-login MOTD** (`honeyfs/etc/motd`):
```
Welcome to Ubuntu 22.04.3 LTS (GNU/Linux 5.15.0-91-generic x86_64)
Last login: Mon Jan 15 03:22:11 2024 from 185.220.101.45
```

**Fake shadow file** (`honeyfs/etc/shadow`):
```
root:$6$shadowking$hahaha_nice_try_buddy:19452:0:99999:7:::
admin:$6$trolling$did_you_really_think_this_would_work:19452:0:99999:7:::
```

**Fake command output** — create files in `src/cowrie/data/txtcmds/bin/` named after the command. Example `txtcmds/bin/df`:
```
Filesystem      Size  Used Avail Use% Mounted on
/dev/sda1        50G   12G   36G  25% /
```

### 8 — Block Cowrie Outbound Traffic

```bash
sudo iptables -A OUTPUT -m owner --uid-owner cowrie -j DROP
sudo apt install iptables-persistent
sudo netfilter-persistent save
```

### 9 — Start

```bash
source cowrie-env/bin/activate
cowrie start
tail -f var/log/cowrie/cowrie.log
```

### 10 — Expose to Internet

On your **host machine**, forward port 2222 to the VM's local IP:

```bash
# Replace 192.168.x.x with your VM's local IP
sudo iptables -t nat -A PREROUTING -p tcp --dport 2222 -j DNAT --to-destination 192.168.x.x:2222
sudo iptables -A FORWARD -p tcp -d 192.168.x.x --dport 2222 -j ACCEPT
```

Then on your **router**, forward external port 2222 to your host machine's local IP.

---

## Dashboard

```bash
cd dashboard
npm install
npm run dev
# Opens at http://localhost:3000
```

Override log paths if needed via `.env.local`:

```
COWRIE_LOG=/home/cowrie/cowrie/var/log/cowrie/cowrie.log
COWRIE_JSON=/home/cowrie/cowrie/var/log/cowrie/cowrie.json
```

---

## CLI Tool

```bash
# Full analysis
python3 cli/cowrie_dashboard.py

# Live mode
python3 cli/cowrie_dashboard.py --live

# With AbuseIPDB threat scoring (free key at abuseipdb.com)
python3 cli/cowrie_dashboard.py --abuse-key YOUR_KEY
```

---

## Useful Log Commands

```bash
tail -f ~/cowrie/var/log/cowrie/cowrie.log
grep "login attempt" ~/cowrie/var/log/cowrie/cowrie.log
grep "CMD" ~/cowrie/var/log/cowrie/cowrie.log
```

---

## Updating Cowrie

```bash
source cowrie-env/bin/activate
cowrie stop
git pull
python -m pip install --upgrade -e .
cowrie start
```

---

## References

- [Cowrie Install Docs](https://docs.cowrie.org/en/latest/INSTALL.html)
- [Cowrie Filesystem Docs](https://docs.cowrie.org/en/latest/HONEYFS.html)
- [Cowrie FAQ](https://docs.cowrie.org/en/latest/FAQ.html)
- [Honeypot Customization Cheatsheet](https://github.com/gnarcoding/cowrie_honeypot_cheatsheets/blob/main/3_troll_attackers.md)
- [AbuseIPDB](https://www.abuseipdb.com)
