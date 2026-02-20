#!/usr/bin/env bash
# Test script for market data API

set -e

echo "🧪 Testing CapexCycleOS Market Data API"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

BACKEND_URL="http://localhost:8001"

# Test 1: Health check
echo -e "${BLUE}Test 1: Health Check${NC}"
if curl -sf "${BACKEND_URL}/health" > /dev/null; then
    echo -e "${GREEN}✓ Backend is healthy${NC}"
else
    echo -e "${RED}✗ Backend health check failed${NC}"
    echo "Make sure the backend is running: cd backend && cargo run"
    exit 1
fi

echo ""

# Test 2: Single ticker (NVDA)
echo -e "${BLUE}Test 2: Fetch NVDA data (last 7 days)${NC}"
END_DATE=$(date +%Y-%m-%d)
START_DATE=$(date -v-7d +%Y-%m-%d 2>/dev/null || date -d '7 days ago' +%Y-%m-%d)

RESPONSE=$(curl -sf "${BACKEND_URL}/api/market-data/NVDA?start=${START_DATE}&end=${END_DATE}")

if [ -n "$RESPONSE" ]; then
    echo -e "${GREEN}✓ Successfully fetched NVDA data${NC}"
    echo "$RESPONSE" | head -c 500
    echo "..."
else
    echo -e "${RED}✗ Failed to fetch NVDA data${NC}"
    exit 1
fi

echo ""
echo ""

# Test 3: Batch fetch
echo -e "${BLUE}Test 3: Batch fetch (NVDA, LRCX, AMAT)${NC}"
BATCH_RESPONSE=$(curl -sf "${BACKEND_URL}/api/market-data/batch?tickers=NVDA,LRCX,AMAT&start=${START_DATE}&end=${END_DATE}")

if [ -n "$BATCH_RESPONSE" ]; then
    echo -e "${GREEN}✓ Successfully fetched batch data${NC}"
    # Count how many tickers returned
    TICKER_COUNT=$(echo "$BATCH_RESPONSE" | grep -o '"ticker"' | wc -l | tr -d ' ')
    echo "Received data for $TICKER_COUNT tickers"
else
    echo -e "${RED}✗ Failed to fetch batch data${NC}"
    exit 1
fi

echo ""
echo ""
echo -e "${GREEN}🎉 All tests passed!${NC}"
echo ""
echo "📊 Market data service is working correctly."
echo "Next: Implement WebSocket streaming for real-time updates"
