#!/bin/bash
# Health Check Script for Heard Again Services
# Run this to check the status of all services

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Service ports
MAIN_APP_PORT=4777
TTS_SERVICE_PORT=8101

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Heard Again - Service Health Check${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Track results
PASSED=0
FAILED=0

# Function to check if a port is listening
check_port() {
    local port=$1
    local name=$2
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} $name (port $port) - LISTENING"
        return 0
    else
        echo -e "  ${RED}✗${NC} $name (port $port) - NOT LISTENING"
        return 1
    fi
}

# Function to test HTTP endpoint
test_endpoint() {
    local url=$1
    local name=$2
    local timeout=${3:-5}
    
    response=$(curl -s -o /dev/null -w "%{http_code}" --max-time $timeout "$url" 2>/dev/null || echo "000")
    
    if [ "$response" = "200" ] || [ "$response" = "201" ]; then
        echo -e "    ${GREEN}✓${NC} $name - HTTP $response"
        return 0
    elif [ "$response" = "000" ]; then
        echo -e "    ${RED}✗${NC} $name - CONNECTION FAILED"
        return 1
    else
        echo -e "    ${YELLOW}⚠${NC} $name - HTTP $response"
        return 1
    fi
}

# Function to test JSON endpoint with fallback
test_json_endpoint_with_fallback() {
    local primary_url=$1
    local fallback_url=$2
    local name=$3
    local jq_filter=${4:-.}
    
    echo -e "${BLUE}Testing $name${NC}"
    echo -e "  Primary: $primary_url"
    
    response=$(curl -s --max-time 5 "$primary_url" 2>/dev/null || echo '')
    
    # If primary fails, try fallback
    if [ -z "$response" ] || ! echo "$response" | jq -e . >/dev/null 2>&1; then
        if [ -n "$fallback_url" ]; then
            echo -e "  ${YELLOW}⚠ Primary failed, trying fallback${NC}"
            echo -e "  Fallback: $fallback_url"
            response=$(curl -s --max-time 5 "$fallback_url" 2>/dev/null || echo '{"error": "connection failed"}')
        else
            response='{"error": "connection failed"}'
        fi
    fi
    
    # Check if response is valid JSON
    if echo "$response" | jq -e . >/dev/null 2>&1; then
        echo -e "  ${GREEN}✓ Valid JSON response${NC}"
        echo -e "  ${BLUE}Response preview:${NC}"
        echo "$response" | jq "$jq_filter" 2>/dev/null | head -20
        ((PASSED++))
        return 0
    else
        echo -e "  ${RED}✗ Invalid or no response${NC}"
        echo -e "  Raw: $response" | head -100
        ((FAILED++))
        return 1
    fi
    echo ""
}

# Simple JSON endpoint test (no fallback)
test_json_endpoint() {
    local url=$1
    local name=$2
    local jq_filter=${3:-.}
    
    echo -e "${BLUE}  URL: $url${NC}"
    
    response=$(curl -s --max-time 5 "$url" 2>/dev/null || echo '{"error": "connection failed"}')
    
    # Check if response is valid JSON
    if echo "$response" | jq -e . >/dev/null 2>&1; then
        echo -e "  ${GREEN}✓ Valid JSON response${NC}"
        echo -e "  ${BLUE}Response preview:${NC}"
        echo "$response" | jq "$jq_filter" 2>/dev/null | head -20
        ((PASSED++))
        return 0
    else
        echo -e "  ${RED}✗ Invalid or no response${NC}"
        echo -e "  Raw: $response" | head -100
        ((FAILED++))
        return 1
    fi
}

# ============================================
# PORT CHECKS
# ============================================
echo -e "${YELLOW}PORT STATUS CHECKS${NC}"
echo ""

check_port $MAIN_APP_PORT "Main App"
check_port $TTS_SERVICE_PORT "TTS Service"

echo ""

# ============================================
# HEALTH ENDPOINT TESTS
# ============================================
echo -e "${YELLOW}HEALTH ENDPOINT TESTS${NC}"
echo ""

echo -e "${BLUE}1. Main App Health${NC}"
test_json_endpoint_with_fallback "http://localhost:$MAIN_APP_PORT/api/instance/health" "http://your-tailscale-node-name.ts.net:$MAIN_APP_PORT/api/instance/health" "Main App" '.data // .'

echo ""
echo -e "${BLUE}2. TTS Service Health${NC}"
test_json_endpoint "http://localhost:$TTS_SERVICE_PORT/api/tts/health" "TTS Service" '.status // .'

# ============================================
# ADDITIONAL API TESTS
# ============================================
echo ""
echo -e "${YELLOW}ADDITIONAL API TESTS${NC}"
echo ""

echo -e "${BLUE}3. Voice Models API (Main App)${NC}"
echo -e "  GET http://localhost:$MAIN_APP_PORT/api/voice/models"
voice_response=$(curl -s "http://localhost:$MAIN_APP_PORT/api/voice/models" --max-time 5 2>/dev/null || echo '{"error": "connection failed"}')

if echo "$voice_response" | jq -e '.models // .voiceProfiles // empty' >/dev/null 2>&1; then
    echo -e "  ${GREEN}✓ Voice models endpoint working${NC}"
    ((PASSED++))
else
    echo -e "  ${YELLOW}⚠ Voice models endpoint issue${NC}"
    echo "  Response: $voice_response" | head -100
    ((FAILED++))
fi

# ============================================
# DOCKER STATUS
# ============================================
echo ""
echo -e "${YELLOW}DOCKER CONTAINERS${NC}"
echo ""

if command -v docker &> /dev/null; then
    echo -e "${BLUE}Relevant containers:${NC}"
    docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}" 2>/dev/null | grep -E "tts|postgres|redis" || echo "  No matching containers found"
else
    echo -e "  ${YELLOW}Docker not available${NC}"
fi

# ============================================
# SUMMARY
# ============================================
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  HEALTH CHECK SUMMARY${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${GREEN}Passed: $PASSED${NC}"
echo -e "  ${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "  ${GREEN}✓ All services are healthy!${NC}"
    exit 0
else
    echo -e "  ${YELLOW}⚠ Some services need attention${NC}"
    echo ""
    echo -e "  ${BLUE}Quick fixes:${NC}"
    echo "    Start all:       ./scripts/start-dev.sh"
    exit 1
fi
