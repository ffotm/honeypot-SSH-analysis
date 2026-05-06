#!/bin/bash
# Cowrie Honeypot — Attack Simulation Script
# Run from Kali or any attacker machine on the same network
# Requires: hydra, seclists, ssh

set -e

TARGET="${TARGET:-192.168.1.x}"
HONEYPOT_PORT="${HONEYPOT_PORT:-2222}"
SECLISTS="${SECLISTS:-/usr/share/seclists}"
USERLIST="$SECLISTS/Usernames/top-usernames-shortlist.txt"
PASSLIST="$SECLISTS/Passwords/Common-Credentials/10k-most-common.txt"

# ── Preflight ─────────────────────────────────────────────────────────────────
if [[ "$TARGET" == "192.168.1.x" ]]; then
    echo "Error: set your target IP before running." >&2
    echo "  Usage: TARGET=192.168.x.x ./test.sh" >&2
    exit 1
fi

if ! command -v hydra &>/dev/null; then
    echo "Error: hydra is not installed." >&2
    echo "  Install: sudo apt-get install hydra" >&2
    exit 1
fi

if ! command -v ssh &>/dev/null; then
    echo "Error: ssh client not found." >&2
    exit 1
fi

if [[ ! -f "$USERLIST" ]]; then
    echo "Error: username list not found at $USERLIST" >&2
    echo "  Install SecLists: sudo apt-get install seclists" >&2
    echo "  Or clone: git clone https://github.com/danielmiessler/SecLists $SECLISTS" >&2
    exit 1
fi

if [[ ! -f "$PASSLIST" ]]; then
    echo "Error: password list not found at $PASSLIST" >&2
    exit 1
fi

# ── Verify honeypot is reachable ──────────────────────────────────────────────
echo "[1/3] Checking honeypot is reachable on $TARGET:$HONEYPOT_PORT..."

if ! nc -z -w5 "$TARGET" "$HONEYPOT_PORT" 2>/dev/null; then
    echo "Error: cannot reach $TARGET on port $HONEYPOT_PORT." >&2
    echo "  Make sure Cowrie is running on the target machine." >&2
    exit 1
fi

echo "  Honeypot reachable."

# ── Hydra brute force ─────────────────────────────────────────────────────────
echo "[2/3] Running Hydra brute force against $TARGET:$HONEYPOT_PORT..."
echo "  Userlist : $USERLIST"
echo "  Passlist : $PASSLIST"
echo ""

hydra -L "$USERLIST" \
      -P "$PASSLIST" \
      -s "$HONEYPOT_PORT" \
      -t 4 \
      -f \
      ssh://"$TARGET"

# ── Manual SSH ────────────────────────────────────────────────────────────────
echo ""
echo "[3/3] Connecting manually via SSH to simulate attacker session..."
echo "  Try credentials like root/root or admin/admin"
echo "  Type 'exit' when done."
echo ""

ssh -p "$HONEYPOT_PORT" \
    -o StrictHostKeyChecking=no \
    -o UserKnownHostsFile=/dev/null \
    root@"$TARGET"

echo ""
echo "Done. Check Cowrie logs on the honeypot:"
echo "  tail -f /home/cowrie/cowrie/var/log/cowrie/cowrie.log"
echo "  grep 'login attempt' /home/cowrie/cowrie/var/log/cowrie/cowrie.log"