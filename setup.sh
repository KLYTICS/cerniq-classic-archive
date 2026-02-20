#!/bin/bash

# Setup script for Capex Cycle Quant Platform
# Run: chmod +x setup.sh && ./setup.sh

set -e

echo "🚀 Setting up Capex Cycle Quant Platform..."
echo ""

# Check Python version
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 not found. Please install Python 3.11+"
    exit 1
fi

PYTHON_VERSION=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1,2)
echo "✓ Found Python $PYTHON_VERSION"

# Create virtual environment
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
    echo "✓ Virtual environment created"
else
    echo "✓ Virtual environment already exists"
fi

# Activate virtual environment
source venv/bin/activate

# Upgrade pip
echo "📦 Upgrading pip..."
pip install --upgrade pip > /dev/null 2>&1
echo "✓ pip upgraded"

# Install dependencies
echo "📦 Installing dependencies (this may take a few minutes)..."
pip install -r requirements.txt > /dev/null 2>&1
echo "✓ Dependencies installed"

# Create data directory structure
echo "📁 Creating data directories..."
mkdir -p data/{raw,processed,cache}
mkdir -p reports
mkdir -p logs
echo "✓ Directories created"

# Create .env template if it doesn't exist
if [ ! -f ".env" ]; then
    echo "📝 Creating .env template..."
    cat > .env << EOF
# API Keys (optional, for enhanced features)
# ALPHA_VANTAGE_API_KEY=your_key_here
# FRED_API_KEY=your_key_here
# SEC_API_KEY=your_key_here

# Configuration
LOG_LEVEL=INFO
CACHE_DIR=data/cache
REPORTS_DIR=reports
EOF
    echo "✓ .env template created"
else
    echo "✓ .env file already exists"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "🎯 Next steps:"
echo "1. Activate virtual environment: source venv/bin/activate"
echo "2. Run Project 1: cd projects/01-risk-parity-ai-infra && streamlit run app.py"
echo "3. Run Project 2: cd projects/02-var-risk-reports && streamlit run app.py"
echo ""
echo "📚 Documentation:"
echo "- Main README: README.md"
echo "- Execution Plan: EXECUTION_PLAN.md"
echo "- Project READMEs: projects/*/README.md"
echo ""
echo "Happy building! 🚀"
