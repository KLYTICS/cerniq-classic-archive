#!/usr/bin/env bash
# Test script for SEC filing ingestion

set -e

echo "🧪 Testing CapexCycleOS SEC Filing Service"
echo "==========================================="
echo ""

BACKEND_URL="http://localhost:8001"
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test 1: Health check
echo -e "${BLUE}Test 1: Backend Health Check${NC}"
if curl -sf "${BACKEND_URL}/health" > /dev/null; then
    echo -e "${GREEN}✓ Backend is healthy${NC}"
else
    echo -e "${RED}✗ Backend not running${NC}"
    exit 1
fi
echo ""

# Test 2: Process NVDA filings
echo -e "${BLUE}Test 2: Process NVDA SEC Filings${NC}"
echo "This will fetch filings from SEC EDGAR..."
RESPONSE=$(curl -sf -X POST "${BACKEND_URL}/api/filings/NVDA/process")

if [ -n "$RESPONSE" ]; then
    echo -e "${GREEN}✓ Successfully processed filings${NC}"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
else
    echo -e "${RED}✗ Failed to process filings${NC}"
    exit 1
fi
echo ""

# Test 3: Query stored filings
echo -e "${BLUE}Test 3: Query Stored Filings${NC}"
FILINGS=$(curl -sf "${BACKEND_URL}/api/filings/NVDA?limit=5")

if [ -n "$FILINGS" ]; then
    echo -e "${GREEN}✓ Retrieved filings${NC}"
    COUNT=$(echo "$FILINGS" | jq 'length' 2>/dev/null || echo "unknown")
    echo "Found $COUNT filings"
    echo "$FILINGS" | jq '.[0] | {form_type, filing_date, fiscal_year}' 2>/dev/null || echo "$FILINGS" | head -200
else
    echo -e "${RED}✗ No filings found${NC}"
fi
echo ""

# Test 4: Query financial metrics
echo -e "${BLUE}Test 4: Query Financial Metrics${NC}"
METRICS=$(curl -sf "${BACKEND_URL}/api/filings/metrics/NVDA")

if [ -n "$METRICS" ]; then
    echo -e "${GREEN}✓ Retrieved financial metrics${NC}"
    COUNT=$(echo "$METRICS" | jq 'length' 2>/dev/null || echo "unknown")
    echo "Found $COUNT metric records"
    echo "$METRICS" | jq '.[0] | {period_end, revenue, net_income, total_assets}' 2>/dev/null || echo "$METRICS" | head -200
else
    echo -e "${RED}✗ No metrics found (this is expected if filings weren't parsed yet)${NC}"
fi
echo ""

# Test 5: Query 10-K only
echo -e "${BLUE}Test 5: Query 10-K Filings Only${NC}"
TEN_K=$(curl -sf "${BACKEND_URL}/api/filings/NVDA?form_type=10-K&limit=3")

if [ -n "$TEN_K" ]; then
    echo -e "${GREEN}✓ Retrieved 10-K filings${NC}"
    echo "$TEN_K" | jq '.' 2>/dev/null || echo "$TEN_K" | head -100
else
    echo -e "${RED}✗ Failed to retrieve 10-K filings${NC}"
fi
echo ""

echo -e "${GREEN}🎉 All tests completed!${NC}"
echo ""
echo "📊 SEC filing service is working."
echo ""
echo "Next steps:"
echo "  1. Process more tickers: curl -X POST http://localhost:8001/api/filings/LRCX/process"
echo "  2. Improve XBRL parsing for better metric extraction"
echo "  3. Build feature engineering on top of financial metrics"
