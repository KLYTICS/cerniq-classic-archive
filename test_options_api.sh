#!/bin/bash

# CapexCycleOS Options API Demo
# Tests all options endpoints

BASE_URL="http://localhost:3000/api/options"

echo "🎯 CapexCycleOS Options Analytics API Demo"
echo "=========================================="
echo ""

# Test 1: Health Check
echo "✅ Test 1: Health Check"
curl -s "${BASE_URL}/health" | jq .
echo ""

# Test 2: Calculate Greeks for Call Option
echo "✅ Test 2: Calculate Call Option Greeks"
echo "Parameters: S=100, K=105, T=0.25yr, r=5%, σ=25%"
curl -s -X POST "${BASE_URL}/calculate" \
  -H "Content-Type: application/json" \
  -d '{
    "underlying": 100,
    "strike": 105,
    "timeToExpiry": 0.25,
    "riskFreeRate": 0.05,
    "volatility": 0.25,
    "optionType": "call"
  }' | jq '{price, delta, gamma, theta, vega}'
echo ""

# Test 3: Calculate Greeks for Put Option
echo "✅ Test 3: Calculate Put Option Greeks"
echo "Parameters: S=100, K=95, T=0.5yr, r=5%, σ=30%"
curl -s -X POST "${BASE_URL}/calculate" \
  -H "Content-Type: application/json" \
  -d '{
    "underlying": 100,
    "strike": 95,
    "timeToExpiry": 0.5,
    "riskFreeRate": 0.05,
    "volatility": 0.30,
    "optionType": "put"
  }' | jq '{price, delta, gamma, theta, vega}'
echo ""

# Test 4: Bull Call Spread Strategy
echo "✅ Test 4: Bull Call Spread Strategy"
echo "Buy 100 call, Sell 110 call, expires 2024-06-21"
curl -s -X POST "${BASE_URL}/strategy" \
  -H "Content-Type: application/json" \
  -d '{
    "legs": [
      {"strike": 100, "expiration": "2024-06-21", "optionType": "call", "quantity": 1, "buySell": "buy"},
      {"strike": 110, "expiration": "2024-06-21", "optionType": "call", "quantity": 1, "buySell": "sell"}
    ],
    "underlyingPrice": 105,
    "volatility": 0.25,
    "riskFreeRate": 0.05
  }' | jq '{strategyName, maxProfit, maxLoss, initialCost, breakEvens, greeks: {delta, gamma, vega}}'
echo ""

# Test 5: Long Straddle Strategy
echo "✅ Test 5: Long Straddle Strategy"
echo "Buy 100 call + Buy 100 put (volatility play)"
curl -s -X POST "${BASE_URL}/strategy" \
  -H "Content-Type: application/json" \
  -d '{
    "legs": [
      {"strike": 100, "expiration": "2024-06-21", "optionType": "call", "quantity": 1, "buySell": "buy"},
      {"strike": 100, "expiration": "2024-06-21", "optionType": "put", "quantity": 1, "buySell": "buy"}
    ],
    "underlyingPrice": 100,
    "volatility": 0.30,
    "riskFreeRate": 0.05
  }' | jq '{strategyName, maxProfit, maxLoss, initialCost, breakEvens: breakEvens[0:2], greeks: {delta, gamma, vega}}'
echo ""

# Test 6: Implied Volatility Calculation
echo "✅ Test 6: Implied Volatility (Newton-Raphson)"
echo "Given market price $5.50, solve for IV"
curl -s -X POST "${BASE_URL}/implied-volatility" \
  -H "Content-Type: application/json" \
  -d '{
    "ticker": "AAPL",
    "strike": 150,
    "expiration": "2024-06-21",
    "optionType": "call",
    "marketPrice": 5.50
  }' | jq '{impliedVolatility, iterations, error}'
echo ""

# Test 7: Get Strategy Presets
echo "✅ Test 7: Strategy Presets"
curl -s "${BASE_URL}/strategy-presets" | jq '.presets[] | {name, category, description}'
echo ""

echo "=========================================="
echo "🎯 All Options API Tests Complete!"
echo "Backend running at: http://localhost:3000"
echo "Total Endpoints: 37 (6 new options endpoints)"
echo ""
