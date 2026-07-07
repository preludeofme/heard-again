#!/bin/bash

# Heard Again - Live Log Tailing Script
# Usage: ./Scripts/logs.sh [service] [lines]
#   service: all (default), main, tts
#   lines: number of lines to show (default: 50)

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Config
MAIN_APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICE="${1:-all}"
LINES="${2:-50}"

# Log file paths
MAIN_LOG="$MAIN_APP_DIR/logs/main-app.log"
TTS_LOG="$MAIN_APP_DIR/logs/tts-service.log"

show_help() {
    echo -e "${BLUE}Heard Again - Log Tailing Script${NC}"
    echo ""
    echo "Usage: ./Scripts/logs.sh [service] [lines]"
    echo ""
    echo "Services:"
    echo "  all   - Tail all service logs (default)"
    echo "  main  - Tail main app logs only"
    echo "  tts   - Tail TTS service logs only"
    echo ""
    echo "Examples:"
    echo "  ./Scripts/logs.sh           # Tail all logs"
    echo "  ./Scripts/logs.sh tts       # Tail TTS logs only"
    echo "  ./Scripts/logs.sh tts 100   # Tail last 100 lines of TTS logs"
    echo ""
}

tail_logs() {
    local name=$1
    local file=$2
    local color=$3

    if [ -f "$file" ]; then
        echo -e "${color}=== $name ===${NC}"
        tail -n "$LINES" "$file" 2>/dev/null || echo "(file not accessible)"
        echo ""
    else
        echo -e "${YELLOW}⚠ $name log not found: $file${NC}"
    fi
}

# Show help if requested
if [ "$SERVICE" = "-h" ] || [ "$SERVICE" = "--help" ]; then
    show_help
    exit 0
fi

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Heard Again - Service Logs ($LINES lines)${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

case "$SERVICE" in
    main|app)
        tail_logs "Main App" "$MAIN_LOG" "$GREEN"
        ;;
    tts|voice)
        tail_logs "TTS Service" "$TTS_LOG" "$YELLOW"
        ;;
    all)
        tail_logs "Main App" "$MAIN_LOG" "$GREEN"
        tail_logs "TTS Service" "$TTS_LOG" "$YELLOW"
        ;;
    *)
        echo -e "${RED}Unknown service: $SERVICE${NC}"
        show_help
        exit 1
        ;;
esac

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}Tip: Run with 'watch' to auto-refresh:${NC} watch -n 2 ./Scripts/logs.sh tts"
echo ""
