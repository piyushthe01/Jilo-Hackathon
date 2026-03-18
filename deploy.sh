#!/bin/bash
# Production Deployment Script for Medical Assistant

set -e  # Exit on error

echo "🏥 Medical Assistant Production Deployment"
echo "=========================================="

# Configuration
APP_NAME="medical-assistant"
DEPLOY_DIR="/opt/medical-assistant"
USER="medicalapp"
SERVICE_NAME="medical-assistant"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   error "This script should not be run as root"
   exit 1
fi

log "Step 1: Checking prerequisites..."

# Check Python version
python_version=$(python3 --version 2>&1 | awk '{print $2}')
required_version="3.9"
if [ "$(printf '%s\n' "$required_version" "$python_version" | sort -V | head -n1)" != "$required_version" ]; then 
    error "Python 3.9+ required, found $python_version"
    exit 1
fi
log "✅ Python version check passed"

# Check PostgreSQL
if ! command -v psql &> /dev/null; then
    error "PostgreSQL is not installed"
    exit 1
fi
log "✅ PostgreSQL found"

# Check if .env file exists
if [ ! -f ".env" ]; then
    error ".env file not found. Please configure environment variables."
    exit 1
fi
log "✅ Environment file found"

log "Step 2: Setting up deployment directory..."
sudo mkdir -p $DEPLOY_DIR
sudo chown $USER:$USER $DEPLOY_DIR

log "Step 3: Copying application files..."
cp -r app/ $DEPLOY_DIR/
cp requirements.txt $DEPLOY_DIR/
cp .env $DEPLOY_DIR/
cp -r app/data/ $DEPLOY_DIR/app/

log "Step 4: Creating virtual environment..."
cd $DEPLOY_DIR
python3 -m venv venv
source venv/bin/activate

log "Step 5: Installing dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

log "Step 6: Setting up database..."
# Create database if it doesn't exist
DB_NAME=$(grep DATABASE_URL .env | cut -d'/' -f4 | cut -d'?' -f1)
if [ -z "$DB_NAME" ]; then
    DB_NAME="medical_assistant"
fi

sudo -u postgres psql -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || warn "Database may already exist"
sudo -u postgres psql -c "CREATE USER $USER WITH PASSWORD 'medicalapp_pass';" 2>/dev/null || warn "User may already exist"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $USER;"

log "Step 7: Running database migrations..."
cd $DEPLOY_DIR
python3 -c "from app.database import Base, engine; from app import models; Base.metadata.create_all(bind=engine)"

log "Step 8: Testing application..."
python3 test_connections_fixed.py || warn "Some connection tests failed - check configuration"

log "Step 9: Creating systemd service..."
sudo tee /etc/systemd/system/$SERVICE_NAME.service > /dev/null <<EOF
[Unit]
Description=Medical Assistant API
After=network.target postgresql.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$DEPLOY_DIR
Environment=PATH=$DEPLOY_DIR/venv/bin
ExecStart=$DEPLOY_DIR/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

log "Step 10: Setting up log rotation..."
sudo tee /etc/logrotate.d/$SERVICE_NAME > /dev/null <<EOF
/var/log/medical-assistant/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0644 $USER $USER
    sharedscripts
    postrotate
        systemctl reload $SERVICE_NAME
    endscript
}
EOF

sudo mkdir -p /var/log/medical-assistant
sudo chown $USER:$USER /var/log/medical-assistant

log "Step 11: Creating health check script..."
cat > $DEPLOY_DIR/health_check.sh <<'EOF'
#!/bin/bash
# Health check script
response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health)
if [ $response -eq 200 ]; then
    echo "Health check: PASSED"
    exit 0
else
    echo "Health check: FAILED (HTTP $response)"
    exit 1
fi
EOF
chmod +x $DEPLOY_DIR/health_check.sh

log "Step 12: Starting service..."
sudo systemctl daemon-reload
sudo systemctl enable $SERVICE_NAME
sudo systemctl start $SERVICE_NAME

sleep 5

if systemctl is-active --quiet $SERVICE_NAME; then
    log "✅ Service started successfully"
else
    error "Service failed to start. Check logs: sudo journalctl -u $SERVICE_NAME"
    exit 1
fi

log "Step 13: Setting up firewall..."
if command -v ufw &> /dev/null; then
    sudo ufw allow 8000/tcp
    log "✅ Firewall configured (UFW)"
fi

log "=========================================="
log "🎉 DEPLOYMENT COMPLETE!"
log "=========================================="
log "Application URL: http://localhost:8000"
log "Health Check: http://localhost:8000/health"
log "API Documentation: http://localhost:8000/docs"
log ""
log "Useful commands:"
log "  sudo systemctl status $SERVICE_NAME"
log "  sudo systemctl restart $SERVICE_NAME"
log "  sudo journalctl -u $SERVICE_NAME -f"
log "  $DEPLOY_DIR/health_check.sh"
