-- Emergency Supabase containment for public-schema tables without RLS.
-- Project: ahjaxqtomakzkrekoyqv

-- 1. Inspect every public table that still has RLS disabled.
select
  n.nspname as schema_name,
  c.relname as table_name
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'r'
  and n.nspname = 'public'
  and c.relrowsecurity = false
order by 1, 2;

-- 2. Generate the ALTER statements for any remaining public tables.
select format(
  'alter table %I.%I enable row level security;',
  n.nspname,
  c.relname
)
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'r'
  and n.nspname = 'public'
  and c.relrowsecurity = false
order by 1;

-- 3. Durable repo-backed lockdown for the legacy app tables.
ALTER TABLE IF EXISTS public.ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.computed_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cyclical_valuations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.financial_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.finding_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.market_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.market_data_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.outreach_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.price_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.risk_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sec_filings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tickers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.watchlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.workspaces ENABLE ROW LEVEL SECURITY;
