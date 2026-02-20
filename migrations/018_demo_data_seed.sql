-- Demo data for SpendCheck to showcase functionality
-- Creates a fully populated workspace with vendors, invoices, and findings

-- 1. Create demo user if not exists
INSERT INTO users (id, email, password_hash)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'demo@spendcheck.local',
    '$argon2id$v=19$m=19456,t=2,p=1$demo$demo'
) ON CONFLICT (id) DO NOTHING;

-- 2. Create demo workspace
INSERT INTO workspaces (id, user_id, name, company_name, created_at)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'ACME Corp Demo',
    'ACME Corporation',
    NOW()
) ON CONFLICT (id) DO UPDATE SET name = 'ACME Corp Demo';

-- 3. Create demo vendors (realistic SaaS and enterprise providers)
INSERT INTO vendors (id, workspace_id, vendor_name, normalized_name, total_spend, invoice_count) VALUES
    ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Amazon Web Services', 'amazon web services', 285000.00, 24),
    ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Microsoft Azure', 'microsoft azure', 145000.00, 12),
    ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Salesforce', 'salesforce', 89500.00, 4),
    ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Slack Technologies', 'slack technologies', 24000.00, 12),
    ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Zoom Video', 'zoom video', 18000.00, 12),
    ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'Datadog Inc', 'datadog inc', 36000.00, 12),
    ('10000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'Snowflake Inc', 'snowflake inc', 72000.00, 6),
    ('10000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', 'HubSpot', 'hubspot', 45000.00, 4),
    ('10000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', 'Okta Inc', 'okta inc', 28000.00, 4),
    ('10000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'DocuSign', 'docusign', 15000.00, 4),
    ('10000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'Zendesk', 'zendesk', 22000.00, 4),
    ('10000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'Twilio', 'twilio', 31000.00, 12),
    ('10000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001', 'Atlassian', 'atlassian', 19500.00, 4),
    ('10000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000001', 'Adobe Creative Cloud', 'adobe creative cloud', 12000.00, 12),
    ('10000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000001', 'Google Workspace', 'google workspace', 48000.00, 12)
ON CONFLICT (id) DO NOTHING;

-- 4. Create demo findings with realistic leak scenarios
INSERT INTO findings (id, workspace_id, vendor_id, finding_type, severity, amount, confidence, description, evidence, status, hash, created_at) VALUES
    -- Duplicate payments
    ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 
     'duplicate_payment', 'high', 24500.00, 0.95, 
     'Duplicate AWS invoice payment detected - same amount paid twice within 3 days',
     '{"original_invoice": "INV-AWS-2024-0847", "duplicate_invoice": "INV-AWS-2024-0847-DUP", "dates": ["2024-11-15", "2024-11-18"]}',
     'open', 'dup-aws-001', NOW() - INTERVAL '2 days'),
    
    ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 
     'duplicate_payment', 'high', 22375.00, 0.92,
     'Salesforce Q4 license payment processed twice',
     '{"original_invoice": "SF-2024-Q4-LIC", "duplicate_invoice": "SF-2024-Q4-LIC-R"}',
     'open', 'dup-sf-001', NOW() - INTERVAL '7 days'),

    -- Subscription drift (price creep)
    ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000006', 
     'subscription_drift', 'medium', 4200.00, 0.88,
     'Datadog monthly charge increased 14% over 6 months without contract change',
     '{"baseline": 2500, "current": 2850, "drift_percent": 14}',
     'open', 'drift-dd-001', NOW() - INTERVAL '3 days'),

    ('20000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000012', 
     'subscription_drift', 'medium', 3800.00, 0.85,
     'Twilio usage charges increased 23% without corresponding traffic increase',
     '{"baseline": 2200, "current": 2706, "drift_percent": 23}',
     'open', 'drift-twilio-001', NOW() - INTERVAL '5 days'),

    -- Spend spikes
    ('20000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 
     'spend_spike', 'high', 18500.00, 0.91,
     'Azure spending 3.2σ above monthly average - unusual compute activity',
     '{"average": 12000, "current": 30500, "std_dev": 3.2}',
     'open', 'spike-azure-001', NOW() - INTERVAL '1 day'),

    ('20000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000007', 
     'spend_spike', 'medium', 8000.00, 0.82,
     'Snowflake credit consumption 2.4σ above baseline',
     '{"average": 12000, "current": 20000, "std_dev": 2.4}',
     'investigating', 'spike-snow-001', NOW() - INTERVAL '4 days'),

    -- Zombie subscriptions
    ('20000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000011', 
     'zombie_subscription', 'high', 5500.00, 0.96,
     'Zendesk charges continue 3 months after contract expiration',
     '{"contract_end": "2024-08-31", "months_post_expiry": 3}',
     'open', 'zombie-zen-001', NOW() - INTERVAL '2 days'),

    ('20000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000010', 
     'zombie_subscription', 'medium', 3750.00, 0.89,
     'DocuSign Enterprise tier still active after downgrade request',
     '{"expected_tier": "Standard", "actual_tier": "Enterprise"}',
     'open', 'zombie-docu-001', NOW() - INTERVAL '6 days'),

    -- New vendor risk
    ('20000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', NULL, 
     'new_vendor_risk', 'low', 45000.00, 0.75,
     'New vendor "CloudSecure Pro" with $45K spend in first month',
     '{"vendor": "CloudSecure Pro", "first_invoice": "2024-11-01"}',
     'open', 'newvendor-csp-001', NOW() - INTERVAL '8 days'),

    -- Vendor duplication
    ('20000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', NULL, 
     'vendor_duplicate', 'low', 2400.00, 0.78,
     'Potential duplicate vendors: "Slack Technologies" and "Slack Inc"',
     '{"vendor1": "Slack Technologies", "vendor2": "Slack Inc", "similarity": 0.82}',
     'open', 'dupvendor-slack-001', NOW() - INTERVAL '10 days'),

    -- Resolved findings
    ('20000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000008', 
     'duplicate_payment', 'high', 11250.00, 0.97,
     'HubSpot duplicate payment recovered',
     '{"recovery_date": "2024-11-05"}',
     'resolved', 'dup-hs-001', NOW() - INTERVAL '30 days'),

    ('20000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000009', 
     'subscription_drift', 'medium', 3200.00, 0.86,
     'Okta overcharge corrected after vendor audit',
     '{"refund_amount": 3200}',
     'resolved', 'drift-okta-001', NOW() - INTERVAL '45 days')
ON CONFLICT (id) DO NOTHING;
