#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Cowrie SSH Honeypot — Automated Deployment Script
# Tested on Ubuntu 22.04
# Run as a sudo-capable user (NOT root)
# ─────────────────────────────────────────────────────────────────────────────

set -e

# ── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GRN='\033[0;32m'
YEL='\033[0;33m'
BLU='\033[0;34m'
NC='\033[0m'
BOLD='\033[1m'

info()    { echo -e "${BLU}[*]${NC} $1"; }
success() { echo -e "${GRN}[✓]${NC} $1"; }
warn()    { echo -e "${YEL}[!]${NC} $1"; }
error()   { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# ── Config ───────────────────────────────────────────────────────────────────
COWRIE_USER="cowrie"
COWRIE_HOME="/home/cowrie"
COWRIE_DIR="$COWRIE_HOME/cowrie"
COWRIE_PORT="${COWRIE_PORT:-2222}"
REAL_SSH_PORT="${REAL_SSH_PORT:-22222}"
HOSTNAME="${COWRIE_HOSTNAME:-ubuntu-server}"

# ─────────────────────────────────────────────────────────────────────────────

echo -e "\n${BOLD}╔══════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║     Cowrie Honeypot Deployment Script    ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════╝${NC}\n"

# ── Preflight checks ─────────────────────────────────────────────────────────
info "Running preflight checks..."

[[ $EUID -eq 0 ]] && error "Do not run as root. Use a sudo-capable user."
command -v sudo &>/dev/null || error "sudo is required."
sudo -n true 2>/dev/null || { warn "You may be prompted for your sudo password."; }

# ── Step 1: System dependencies ──────────────────────────────────────────────
info "Installing system dependencies..."
sudo apt-get update -qq
sudo apt-get install -y -qq \
    git \
    python3-pip \
    python3-venv \
    libssl-dev \
    libffi-dev \
    build-essential \
    libpython3-dev \
    python3-minimal \
    authbind \
    iptables-persistent
success "Dependencies installed."

# ── Step 2: Move real SSH port ────────────────────────────────────────────────
CURRENT_PORT=$(grep -E "^Port " /etc/ssh/sshd_config | awk '{print $2}' || echo "22")

if [[ "$CURRENT_PORT" != "$REAL_SSH_PORT" ]]; then
    info "Moving real SSH from port $CURRENT_PORT to $REAL_SSH_PORT..."
    sudo sed -i "s/^#*Port .*/Port $REAL_SSH_PORT/" /etc/ssh/sshd_config
    # Add Port line if it doesn't exist
    grep -q "^Port" /etc/ssh/sshd_config || echo "Port $REAL_SSH_PORT" | sudo tee -a /etc/ssh/sshd_config
    sudo systemctl restart ssh
    success "Real SSH moved to port $REAL_SSH_PORT."
    warn "Make sure you can still connect on port $REAL_SSH_PORT before closing this session!"
else
    success "Real SSH already on port $REAL_SSH_PORT."
fi

# ── Step 3: Create cowrie user ────────────────────────────────────────────────
if id "$COWRIE_USER" &>/dev/null; then
    success "User '$COWRIE_USER' already exists."
else
    info "Creating cowrie user..."
    sudo adduser --disabled-password --gecos "" "$COWRIE_USER"
    success "User '$COWRIE_USER' created."
fi

# ── Step 4: Clone Cowrie ──────────────────────────────────────────────────────
if [[ -d "$COWRIE_DIR/.git" ]]; then
    info "Cowrie already cloned, pulling latest..."
    sudo -u "$COWRIE_USER" git -C "$COWRIE_DIR" pull -q
else
    info "Cloning Cowrie..."
    sudo -u "$COWRIE_USER" git clone -q http://github.com/cowrie/cowrie "$COWRIE_DIR"
fi
success "Cowrie source ready."

# ── Step 5: Python virtual environment ───────────────────────────────────────
if [[ ! -d "$COWRIE_DIR/cowrie-env" ]]; then
    info "Creating Python virtual environment..."
    sudo -u "$COWRIE_USER" python3 -m venv "$COWRIE_DIR/cowrie-env"
fi

info "Installing Python dependencies..."
sudo -u "$COWRIE_USER" bash -c "
    source $COWRIE_DIR/cowrie-env/bin/activate
    python -m pip install --upgrade pip -q
    python -m pip install -e $COWRIE_DIR -q
"
success "Python environment ready."

# ── Step 6: Configure Cowrie ──────────────────────────────────────────────────
info "Writing cowrie.cfg..."
sudo -u "$COWRIE_USER" tee "$COWRIE_DIR/etc/cowrie.cfg" > /dev/null <<EOF
[honeypot]
hostname = $HOSTNAME

[ssh]
listen_endpoints = tcp:${COWRIE_PORT}:interface=0.0.0.0
EOF
success "cowrie.cfg written."

# ── Step 7: Fake filesystem ───────────────────────────────────────────────────
info "Setting up fake filesystem..."

sudo -u "$COWRIE_USER" mkdir -p \
    "$COWRIE_DIR/myfs/etc" \
    "$COWRIE_DIR/myfs/home/admin" \
    "$COWRIE_DIR/myfs/var/www/html" \
    "$COWRIE_DIR/myfs/tmp"

# honeyfs files
sudo -u "$COWRIE_USER" tee "$COWRIE_DIR/honeyfs/etc/issue.net" > /dev/null <<'EOF'
Ubuntu 22.04.3 LTS \n \l
EOF

sudo -u "$COWRIE_USER" tee "$COWRIE_DIR/honeyfs/etc/motd" > /dev/null <<'EOF'
Welcome to Ubuntu 22.04.3 LTS (GNU/Linux 5.15.0-91-generic x86_64)

 * Documentation:  https://help.ubuntu.com
 * Management:     https://landscape.canonical.com

Last login: Mon Jan 15 03:22:11 2024 from 185.220.101.45
EOF

# Generate pickle
info "Generating filesystem pickle..."
sudo -u "$COWRIE_USER" bash -c "
    source $COWRIE_DIR/cowrie-env/bin/activate
    cd $COWRIE_DIR
    createfs -l myfs -d 5 -o custom.pickle
"

# Add to config
sudo -u "$COWRIE_USER" bash -c "
    grep -q '^\[shell\]' $COWRIE_DIR/etc/cowrie.cfg || echo '' >> $COWRIE_DIR/etc/cowrie.cfg
    grep -q 'filesystem' $COWRIE_DIR/etc/cowrie.cfg || echo -e '[shell]\nfilesystem = $COWRIE_DIR/custom.pickle' >> $COWRIE_DIR/etc/cowrie.cfg
"
success "Fake filesystem ready."

# ── Step 8: iptables — block cowrie outbound ──────────────────────────────────
info "Applying iptables rules..."
COWRIE_UID=$(id -u "$COWRIE_USER")
sudo iptables -A OUTPUT -m owner --uid-owner "$COWRIE_UID" -j DROP 2>/dev/null || \
    warn "iptables rule may already exist, skipping."
sudo netfilter-persistent save -q 2>/dev/null || true
success "Cowrie outbound traffic blocked."

# ── Step 9: Start Cowrie ──────────────────────────────────────────────────────
info "Starting Cowrie..."
sudo -u "$COWRIE_USER" bash -c "
    source $COWRIE_DIR/cowrie-env/bin/activate
    cowrie start
"

sleep 2

# Verify it's listening
if sudo ss -tlnp | grep -q ":$COWRIE_PORT"; then
    success "Cowrie is listening on port $COWRIE_PORT."
else
    warn "Cowrie may not be listening yet. Check logs:"
    warn "  tail -f $COWRIE_DIR/var/log/cowrie/cowrie.log"
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo -e "\n${GRN}${BOLD}════════════════════════════════════════${NC}"
echo -e "${GRN}${BOLD}  Deployment complete!${NC}"
echo -e "${GRN}${BOLD}════════════════════════════════════════${NC}\n"

echo -e "  Honeypot port  : ${YEL}$COWRIE_PORT${NC}"
echo -e "  Real SSH port  : ${YEL}$REAL_SSH_PORT${NC}"
echo -e "  Logs           : ${YEL}$COWRIE_DIR/var/log/cowrie/${NC}"
echo -e "  Live tail      : ${YEL}tail -f $COWRIE_DIR/var/log/cowrie/cowrie.log${NC}"
echo -e "\n  ${BLU}Next steps:${NC}"
echo -e "  1. Forward port $COWRIE_PORT on your router to this machine"
echo -e "  2. Run the dashboard: cd dashboard && npm install && npm run dev"
echo -e "  3. Or run the CLI:    python3 cli/cowrie_dashboard.py\n"
