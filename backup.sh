#!/bin/bash
# Database Backup Script for Medical Assistant

set -e

# Configuration
DB_NAME="medical_assistant"
BACKUP_DIR="/opt/backups/medical-assistant"
RETENTION_DAYS=30
DATE=$(date +%Y%m%d_%H%M%S)

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[BACKUP]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Create backup directory
mkdir -p $BACKUP_DIR

log "Starting database backup..."

# Full database backup
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_full_${DATE}.sql"
pg_dump -h localhost -U postgres $DB_NAME > $BACKUP_FILE

if [ $? -eq 0 ]; then
    log "✅ Full backup created: $BACKUP_FILE"
    
    # Compress backup
    gzip $BACKUP_FILE
    log "✅ Backup compressed: ${BACKUP_FILE}.gz"
    
    # Create metadata file
    cat > "$BACKUP_DIR/backup_${DATE}.info" <<EOF
Backup Date: $(date)
Database: $DB_NAME
File: ${BACKUP_FILE}.gz
Size: $(du -h ${BACKUP_FILE}.gz | cut -f1)
Type: Full Database Backup
EOF
    
else
    warn "Backup may have failed, check $BACKUP_FILE"
    exit 1
fi

# Clean old backups
log "Cleaning backups older than $RETENTION_DAYS days..."
find $BACKUP_DIR -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -name "*.info" -mtime +$RETENTION_DAYS -delete
log "✅ Old backups cleaned"

# Log backup summary
BACKUP_COUNT=$(find $BACKUP_DIR -name "*.sql.gz" | wc -l)
BACKUP_SIZE=$(du -sh $BACKUP_DIR | cut -f1)
log "📊 Backup Summary:"
log "   Total backups: $BACKUP_COUNT"
log "   Total size: $BACKUP_SIZE"
log "   Latest: ${BACKUP_FILE}.gz"

log "✅ Backup completed successfully!"
