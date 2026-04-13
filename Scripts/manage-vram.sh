#!/bin/bash

# Heard Again - VRAM Management Script
# Optimizes GPU memory usage for TTS + LLM coexistence

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Config
OLLAMA_URL="http://localhost:11435"
TTS_URL="http://localhost:4779"

show_help() {
    echo -e "${BLUE}Heard Again - VRAM Manager${NC}"
    echo ""
    echo "Usage: $0 [action]"
    echo ""
    echo "Actions:"
    echo "  status     - Show current VRAM usage and loaded models"
    echo "  free-tts   - Unload LLM models to free VRAM for TTS"
    echo "  free-llm   - Unload TTS models to free VRAM for LLM"
    echo "  optimize   - Auto-optimize for current workload"
    echo "  monitor    - Continuous VRAM monitoring"
    echo ""
    echo "Examples:"
    echo "  $0 status          # Check current state"
    echo "  $0 free-tts        # Prepare for TTS work"
    echo "  $0 optimize        # Auto-optimization"
    echo ""
}

get_vram_usage() {
    nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader,nounits 2>/dev/null | head -1
}

get_loaded_models() {
    curl -s "$OLLAMA_URL/api/ps" | jq -r '.models[] | "\(.name) (\(.size_vram/1024/1024/1024 | floor)GB)"' 2>/dev/null || echo "Unable to fetch models"
}

show_status() {
    echo -e "${BLUE}=== VRAM Status ===${NC}"
    
    local vram_info=$(get_vram_usage)
    if [ -n "$vram_info" ]; then
        local used=$(echo $vram_info | cut -d',' -f1)
        local total=$(echo $vram_info | cut -d',' -f2)
        local available=$((total - used))
        local usage_percent=$((used * 100 / total))
        
        echo "VRAM: ${used}MB / ${total}MB used (${usage_percent}%)"
        echo "Available: ${available}MB"
        
        if [ $available -lt 2048 ]; then
            echo -e "${RED}Status: LOW VRAM - TTS may fail${NC}"
        elif [ $available -lt 6144 ]; then
            echo -e "${YELLOW}Status: MODERATE VRAM${NC}"
        else
            echo -e "${GREEN}Status: GOOD VRAM${NC}"
        fi
    else
        echo -e "${YELLOW}Unable to fetch VRAM info${NC}"
    fi
    
    echo ""
    echo -e "${BLUE}=== Loaded Models ===${NC}"
    get_loaded_models
    
    echo ""
    echo -e "${BLUE}=== Service Status ===${NC}"
    if curl -s "$OLLAMA_URL/api/tags" >/dev/null 2>&1; then
        echo -e "Ollama: ${GREEN}Running${NC}"
    else
        echo -e "Ollama: ${RED}Not responding${NC}"
    fi
    
    if curl -s "$TTS_URL/api/tts/health" >/dev/null 2>&1; then
        echo -e "TTS: ${GREEN}Running${NC}"
    else
        echo -e "TTS: ${RED}Not responding${NC}"
    fi
}

free_for_tts() {
    echo -e "${YELLOW}Freeing VRAM for TTS...${NC}"
    
    # Unload all large models (>8GB)
    local models=$(curl -s "$OLLAMA_URL/api/ps" | jq -r '.models[] | select(.size_vram > 8589934592) | .name' 2>/dev/null)
    
    if [ -n "$models" ]; then
        echo "Unloading large models:"
        echo "$models" | while read model; do
            echo "  Unloading: $model"
            curl -X POST "$OLLAMA_URL/api/generate" -d "{\"model\": \"$model\", \"prompt\": \"\", \"keep_alive\": 0}" >/dev/null 2>&1
        done
    fi
    
    # Keep only small models loaded
    echo "Keeping only small models loaded"
    sleep 2
    
    echo -e "${GREEN}VRAM optimized for TTS${NC}"
    show_status
}

free_for_llm() {
    echo -e "${YELLOW}Freeing VRAM for LLM...${NC}"
    
    # Stop TTS service temporarily to free its VRAM
    if pgrep -f "tts-service" >/dev/null; then
        echo "Stopping TTS service temporarily..."
        pkill -f "tts-service" || true
        sleep 3
    fi
    
    echo -e "${GREEN}VRAM optimized for LLM${NC}"
    show_status
}

auto_optimize() {
    echo -e "${BLUE}Auto-optimizing VRAM usage...${NC}"
    
    local vram_info=$(get_vram_usage)
    if [ -n "$vram_info" ]; then
        local used=$(echo $vram_info | cut -d',' -f1)
        local total=$(echo $vram_info | cut -d',' -f2)
        local available=$((total - used))
        local usage_percent=$((used * 100 / total))
        
        echo "Current VRAM usage: ${usage_percent}%"
        
        if [ $usage_percent -gt 90 ]; then
            echo -e "${RED}High VRAM usage - freeing models${NC}"
            free_for_tts
        elif [ $usage_percent -gt 75 ]; then
            echo -e "${YELLOW}Moderate VRAM usage - checking models${NC}"
            # Check if large models are loaded
            local large_models=$(curl -s "$OLLAMA_URL/api/ps" | jq -r '.models[] | select(.size_vram > 12884901888) | .name' 2>/dev/null)
            if [ -n "$large_models" ]; then
                echo "Large models detected, unloading..."
                free_for_tts
            fi
        else
            echo -e "${GREEN}VRAM usage is optimal${NC}"
        fi
    fi
}

monitor_mode() {
    echo -e "${BLUE}Starting VRAM monitoring (Ctrl+C to stop)...${NC}"
    echo ""
    
    while true; do
        clear
        show_status
        echo ""
        echo -e "${BLUE}Last updated: $(date)${NC}"
        echo -e "${YELLOW}Press Ctrl+C to stop monitoring${NC}"
        sleep 5
    done
}

# Main logic
case "${1:-status}" in
    status)
        show_status
        ;;
    free-tts)
        free_for_tts
        ;;
    free-llm)
        free_for_llm
        ;;
    optimize)
        auto_optimize
        ;;
    monitor)
        monitor_mode
        ;;
    -h|--help|help)
        show_help
        ;;
    *)
        echo -e "${RED}Unknown action: $1${NC}"
        show_help
        exit 1
        ;;
esac
