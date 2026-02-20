#!/usr/bin/env python3
import psycopg2
import sys

# Database connection
conn_string = "postgresql://capexcycle:dev_password_change_in_prod@localhost:5433/capexcycle"

# Read migration file
migration_path = "/Users/money/Desktop/CapexCycleOS/migrations/014_universal_ticker_support.sql"

try:
    conn = psycopg2.connect(conn_string)
    cur = conn.cursor()
    
    with open(migration_path, 'r') as f:
        migration_sql = f.read()
    
    # Execute migration
    cur.execute(migration_sql)
    conn.commit()
    
    # Verify tables created
    cur.execute("SELECT COUNT(*) FROM tickers")
    count = cur.fetchone()[0]
    print(f"✅ Migration applied successfully! Tickers table has {count} rows.")
    
    cur.close()
    conn.close()
    
except Exception as e:
    print(f"❌ Error: {e}")
    sys.exit(1)
