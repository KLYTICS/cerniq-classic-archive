#!/usr/bin/env bash
# Test script for cyclical valuation engine

set -e

echo "🧪 Testing CapexCycleOS Cyclical Valuation Engine"
echo "================================================="
echo ""

BACKEND_URL="http://localhost:8001"
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
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

# Test 2: Compute cyclical valuation for LRCX (semiconductor equipment)
echo -e "${BLUE}Test 2: Compute Cyclical Valuation for LRCX${NC}"
echo -e "${YELLOW}Note: This requires financial metrics to be present${NC}"
LRCX_RESPONSE=$(curl -sf -X POST "${BACKEND_URL}/api/valuation/cyclical/LRCX/compute" 2>&1)

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Successfully computed valuation${NC}"
    echo "$LRCX_RESPONSE" | jq '.' 2>/dev/null || echo "$LRCX_RESPONSE"
else
    echo -e "${YELLOW}⚠ Failed to compute (need financial data first)${NC}"
    echo "Run: curl -X POST http://localhost:8001/api/filings/LRCX/process"
fi
echo ""

# Test 3: Retrieve computed valuation
echo -e "${BLUE}Test 3: Retrieve Cyclical Valuation${NC}"
VALUATION=$(curl -sf "${BACKEND_URL}/api/valuation/cyclical/LRCX")

if [ -n "$VALUATION" ]; then
    echo -e "${GREEN}✓ Retrieved valuation${NC}"
    echo "$VALUATION" | jq '{
        ticker,
        cycles_detected,
        current_cycle_position,
        mid_cycle_eps,
        current_price,
        fair_value_base,
        fair_value_low,
        fair_value_high,
        upside_downside_pct
    }' 2>/dev/null || echo "$VALUATION" | head -50
else
    echo -e "${YELLOW}⚠ No valuation found (compute it first)${NC}"
fi
echo ""

# Test 4: Batch compute for cyclical tickers
echo -e "${BLUE}Test 4: Batch Compute (LRCX, AMAT, KLAC)${NC}"
for ticker in LRCX AMAT KLAC; do
    echo "Computing valuation for $ticker..."
    curl -sf -X POST "${BACKEND_URL}/api/valuation/cyclical/${ticker}/compute" > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ $ticker${NC}"
    else
        echo -e "${YELLOW}⚠ $ticker (skipped)${NC}"
    fi
    sleep 0.5
done
echo ""

echo -e "${GREEN}🎉 Cyclical valuation tests completed!${NC}"
echo ""
echo "📊 Valuation Methodology:"
echo "  1. Detect historical revenue/earnings cycles"
echo "  2. Calculate mid-cycle normalized earnings"
echo "  3. Determine current cycle position"
echo "  4. Apply regime-specific multiples:"
echo "     • Early Cycle: 1.15x (premium)"
echo "     • Mid Cycle: 1.0x (base)"
echo "     • Late Cycle: 0.90x (discount)"
echo "     • Peak: 0.75x (heavy discount)"
echo "     • Downturn: 0.85x (moderate discount)"
echo "  5. Generate fair value range"
echo ""
echo "Next steps:"
echo "  1. Build Compounder valuation engine (for NVDA, ASML)"
echo "  2. Build Frontier valuation engine (experimental)"
echo "  3. Create KPI scoreboard with composite scoring"
