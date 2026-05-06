#!/bin/bash
# Cowrie SSH Honeypot — Deployment Script
# Run as a sudo-capable user, not root
# Ubuntu 22.04

set -e

COWRIE_PORT="${COWRIE_PORT:-2222}"
REAL_SSH_PORT="${REAL_SSH_PORT:-22222}"
COWRIE_HOSTNAME="${COWRIE_HOSTNAME:-ubuntu-server}"
COWRIE_DIR="/home/cowrie/cowrie"

# ── Preflight ─────────────────────────────────────────────────────────────────
if [[ $EUID -eq 0 ]]; then
    echo "Error: do not run as root." >&2
    exit 1
fi

if ! command -v sudo &>/dev/null; then
    echo "Error: sudo is not available." >&2
    exit 1
fi

# ── Dependencies ──────────────────────────────────────────────────────────────
echo "[1/8] Installing dependencies..."
if ! sudo apt-get update -qq; then
    echo "Error ($?): apt-get update failed." >&2
    exit 1
fi

if ! sudo apt-get install -y git python3-pip python3-venv libssl-dev libffi-dev \
    build-essential libpython3-dev python3-minimal authbind iptables-persistent; then
    echo "Error ($?): failed to install dependencies." >&2
    exit 1
fi

# ── Clone Cowrie ──────────────────────────────────────────────────────────────
echo "[2/8] Setting up cowrie user and cloning..."

if id "cowrie" &>/dev/null; then
    echo "  User 'cowrie' already exists, skipping."
else
    if ! sudo adduser --disabled-password --gecos "" cowrie; then
        echo "Error ($?): failed to create cowrie user." >&2
        exit 1
    fi
fi

if [[ -d "$COWRIE_DIR/.git" ]]; then
    echo "  Cowrie already cloned, pulling latest..."
    if ! sudo -u cowrie git -C "$COWRIE_DIR" pull -q; then
        echo "Error ($?): git pull failed." >&2
        exit 1
    fi
else
    if ! sudo -u cowrie git clone http://github.com/cowrie/cowrie "$COWRIE_DIR"; then
        echo "Error ($?): git clone failed." >&2
        exit 1
    fi
fi

# ── Virtual environment ───────────────────────────────────────────────────────
echo "[3/8] Setting up virtual environment..."

if [[ -d "$COWRIE_DIR/cowrie-env" ]]; then
    echo "  Virtual environment already exists, skipping."
else
    if ! sudo -u cowrie python3 -m venv "$COWRIE_DIR/cowrie-env"; then
        echo "Error ($?): failed to create virtual environment." >&2
        exit 1
    fi
fi

if ! sudo -u cowrie bash -c "
    source $COWRIE_DIR/cowrie-env/bin/activate
    python -m pip install --upgrade pip -q
    python -m pip install -e $COWRIE_DIR -q
"; then
    echo "Error ($?): pip install failed." >&2
    exit 1
fi

# ── Move real SSH ─────────────────────────────────────────────────────────────
echo "[4/8] Configuring real SSH port..."

CURRENT_PORT=$(grep -E "^Port " /etc/ssh/sshd_config | awk '{print $2}' || echo "22")

if [[ "$CURRENT_PORT" == "$REAL_SSH_PORT" ]]; then
    echo "  SSH already on port $REAL_SSH_PORT, skipping."
else
    sudo sed -i "s/^#*Port .*/Port $REAL_SSH_PORT/" /etc/ssh/sshd_config
    grep -q "^Port" /etc/ssh/sshd_config || echo "Port $REAL_SSH_PORT" | sudo tee -a /etc/ssh/sshd_config

    if ! sudo systemctl restart ssh; then
        echo "Error ($?): failed to restart SSH." >&2
        exit 1
    fi

    # Verify SSH is reachable on new port
    sleep 2
    if ! nc -z localhost "$REAL_SSH_PORT" 2>/dev/null; then
        echo "Error: SSH does not appear to be listening on port $REAL_SSH_PORT after restart." >&2
        echo "  Check: sudo systemctl status ssh" >&2
        exit 1
    fi

    echo "  SSH moved to port $REAL_SSH_PORT and confirmed reachable."
fi

# ── Configure Cowrie ──────────────────────────────────────────────────────────
echo "[5/8] Writing cowrie.cfg..."

if [[ -f "$COWRIE_DIR/etc/cowrie.cfg" ]] && grep -q "listen_endpoints" "$COWRIE_DIR/etc/cowrie.cfg"; then
    echo "  cowrie.cfg already configured, skipping."
else
    if ! sudo -u cowrie tee "$COWRIE_DIR/etc/cowrie.cfg" > /dev/null <<CONF
[honeypot]
hostname = $COWRIE_HOSTNAME

[ssh]
listen_endpoints = tcp:${COWRIE_PORT}:interface=0.0.0.0
CONF
    then
        echo "Error ($?): failed to write cowrie.cfg." >&2
        exit 1
    fi
fi

# ── Fake filesystem ───────────────────────────────────────────────────────────
echo "[6/8] Building fake filesystem..."

sudo -u cowrie mkdir -p \
    "$COWRIE_DIR/myfs/etc" \
    "$COWRIE_DIR/myfs/home/admin" \
    "$COWRIE_DIR/myfs/var/www/html" \
    "$COWRIE_DIR/myfs/tmp"

if [[ -f "$COWRIE_DIR/custom.pickle" ]]; then
    echo "  custom.pickle already exists, skipping createfs."
else
    if ! sudo -u cowrie bash -c "
        source $COWRIE_DIR/cowrie-env/bin/activate
        cd $COWRIE_DIR
        createfs -l myfs -d 5 -o custom.pickle
    "; then
        echo "Error ($?): createfs failed." >&2
        exit 1
    fi
fi

if ! grep -q "filesystem" "$COWRIE_DIR/etc/cowrie.cfg"; then
    sudo -u cowrie bash -c "
        echo '[shell]' >> $COWRIE_DIR/etc/cowrie.cfg
        echo 'filesystem = $COWRIE_DIR/custom.pickle' >> $COWRIE_DIR/etc/cowrie.cfg
    "
fi

# ── iptables ──────────────────────────────────────────────────────────────────
echo "[7/8] Applying iptables rules..."

COWRIE_UID=$(id -u cowrie)

if sudo iptables -C OUTPUT -m owner --uid-owner "$COWRIE_UID" -j DROP 2>/dev/null; then
    echo "  iptables rule already exists, skipping."
else
    if ! sudo iptables -A OUTPUT -m owner --uid-owner "$COWRIE_UID" -j DROP; then
        echo "Error ($?): failed to apply iptables rule." >&2
        exit 1
    fi
    sudo netfilter-persistent save
fi

# ── Start Cowrie ──────────────────────────────────────────────────────────────
echo "[8/8] Starting Cowrie..."

if sudo -u cowrie bash -c "
    source $COWRIE_DIR/cowrie-env/bin/activate
    cowrie status
" 2>&1 | grep -q "running"; then
    echo "  Cowrie is already running, skipping."
else
    if ! sudo -u cowrie bash -c "
        source $COWRIE_DIR/cowrie-env/bin/activate
        cowrie start
    "; then
        echo "Error ($?): failed to start Cowrie." >&2
        exit 1
    fi

    sleep 3

    if ! sudo ss -tlnp | grep -q ":$COWRIE_PORT"; then
        echo "Error: Cowrie does not appear to be listening on port $COWRIE_PORT." >&2
        echo "  Check: tail -f $COWRIE_DIR/var/log/cowrie/cowrie.log" >&2
        exit 1
    fi

    echo "  Cowrie confirmed listening on port $COWRIE_PORT."
fi

echo ""
echo "Done."
echo "  Honeypot port : $COWRIE_PORT"
echo "  Real SSH port : $REAL_SSH_PORT"
echo "  Logs          : tail -f $COWRIE_DIR/var/log/cowrie/cowrie.log"