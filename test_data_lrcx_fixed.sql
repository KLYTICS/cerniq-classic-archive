-- First create SEC filings records
INSERT INTO sec_filings (ticker, cik, form_type, filing_date, fiscal_period, fiscal_year, accession_number, filing_url, processed)
VALUES
('LRCX', '0000707549', '10-Q', '2020-05-01', 'Q1', 2020, '0000707549-20-000010', 'https://sec.gov/Archives/edgar/data/707549/000070754920000010', true),
('LRCX', '0000707549', '10-Q', '2020-08-01', 'Q2', 2020, '0000707549-20-000020', 'https://sec.gov/Archives/edgar/data/707549/000070754920000020', true),
('LRCX', '0000707549', '10-Q', '2020-11-01', 'Q3', 2020, '0000707549-20-000030', 'https://sec.gov/Archives/edgar/data/707549/000070754920000030', true),
('LRCX', '0000707549', '10-K', '2021-02-01', 'Q4', 2020, '0000707549-21-000040', 'https://sec.gov/Archives/edgar/data/707549/000070754921000040', true),
('LRCX', '0000707549', '10-Q', '2021-05-01', 'Q1', 2021, '0000707549-21-000050', 'https://sec.gov/Archives/edgar/data/707549/000070754921000050', true),
('LRCX', '0000707549', '10-Q', '2021-08-01', 'Q2', 2021, '0000707549-21-000060', 'https://sec.gov/Archives/edgar/data/707549/000070754921000060', true),
('LRCX', '0000707549', '10-Q', '2021-11-01', 'Q3', 2021, '0000707549-21-000070', 'https://sec.gov/Archives/edgar/data/707549/000070754921000070', true),
('LRCX', '0000707549', '10-K', '2022-02-01', 'Q4', 2021, '0000707549-22-000080', 'https://sec.gov/Archives/edgar/data/707549/000070754922000080', true),
('LRCX', '0000707549', '10-Q', '2022-05-01', 'Q1', 2022, '0000707549-22-000090', 'https://sec.gov/Archives/edgar/data/707549/000070754922000090', true),
('LRCX', '0000707549', '10-Q', '2022-08-01', 'Q2', 2022, '0000707549-22-000100', 'https://sec.gov/Archives/edgar/data/707549/000070754922000100', true),
('LRCX', '0000707549', '10-Q', '2022-11-01', 'Q3', 2022, '0000707549-22-000110', 'https://sec.gov/Archives/edgar/data/707549/000070754922000110', true),
('LRCX', '0000707549', '10-K', '2023-02-01', 'Q4', 2022, '0000707549-23-000120', 'https://sec.gov/Archives/edgar/data/707549/000070754923000120', true),
('LRCX', '0000707549', '10-Q', '2023-05-01', 'Q1', 2023, '0000707549-23-000130', 'https://sec.gov/Archives/edgar/data/707549/000070754923000130', true),
('LRCX', '0000707549', '10-Q', '2023-08-01', 'Q2', 2023, '0000707549-23-000140', 'https://sec.gov/Archives/edgar/data/707549/000070754923000140', true),
('LRCX', '0000707549', '10-Q', '2023-11-01', 'Q3', 2023, '0000707549-23-000150', 'https://sec.gov/Archives/edgar/data/707549/000070754923000150', true),
('LRCX', '0000707549', '10-K', '2024-02-01', 'Q4', 2023, '0000707549-24-000160', 'https://sec.gov/Archives/edgar/data/707549/000070754924000160', true);

-- Then insert financial metrics
INSERT INTO financial_metrics (
    filing_id, ticker, period_end,
    revenue, gross_profit, operating_income, net_income,
    eps_basic, eps_diluted, shares_outstanding,
    total_assets, total_liabilities, shareholders_equity
)
SELECT 
    sf.id, sf.ticker, 
    CASE sf.fiscal_period
        WHEN 'Q1' THEN (sf.fiscal_year || '-03-31')::DATE
        WHEN 'Q2' THEN (sf.fiscal_year || '-06-30')::DATE
        WHEN 'Q3' THEN (sf.fiscal_year || '-09-30')::DATE
        WHEN 'Q4' THEN (sf.fiscal_year || '-12-31')::DATE
    END,
    revenue, gross_profit, operating_income, net_income,
    eps_basic, eps_diluted, shares_outstanding,
    total_assets, total_liabilities, shareholders_equity
FROM sec_filings sf
CROSS JOIN LATERAL (
    VALUES
    (1, 2360000000, 1062000000, 498000000, 421000000, 2.95, 2.92, 143500000, 12500000000, 7200000000, 5300000000),
    (2, 2690000000, 1215000000, 597000000, 512000000, 3.58, 3.54, 144800000, 12800000000, 7300000000, 5500000000),
    (3, 3180000000, 1445000000, 752000000, 635000000, 4.43, 4.38, 145000000, 13200000000, 7400000000, 5800000000),
    (4, 3850000000, 1780000000, 1025000000, 865000000, 6.02, 5.98, 144000000, 14100000000, 7700000000, 6400000000),
    (5, 4150000000, 1935000000, 1165000000, 985000000, 6.87, 6.82, 143500000, 14800000000, 7900000000, 6900000000),
    (6, 4640000000, 2180000000, 1385000000, 1180000000, 8.23, 8.17, 143600000, 15600000000, 8200000000, 7400000000),
    (7, 4580000000, 2150000000, 1340000000, 1135000000, 7.92, 7.86, 143400000, 15900000000, 8400000000, 7500000000),
    (8, 4230000000, 1985000000, 1190000000, 1005000000, 7.01, 6.96, 143200000, 15500000000, 8100000000, 7400000000),
    (9, 3850000000, 1795000000, 1045000000, 885000000, 6.17, 6.12, 143100000, 15200000000, 7900000000, 7300000000),
    (10, 3410000000, 1575000000, 875000000, 735000000, 5.12, 5.08, 143500000, 14800000000, 7600000000, 7200000000),
    (11, 2980000000, 1340000000, 685000000, 575000000, 4.01, 3.97, 144000000, 14300000000, 7300000000, 7000000000),
    (12, 2650000000, 1185000000, 545000000, 455000000, 3.16, 3.13, 144500000, 13900000000, 7000000000, 6900000000),
    (13, 2420000000, 1070000000, 445000000, 370000000, 2.57, 2.54, 144800000, 13600000000, 6800000000, 6800000000),
    (14, 2650000000, 1195000000, 530000000, 445000000, 3.08, 3.05, 144900000, 13800000000, 6900000000, 6900000000),
    (15, 2980000000, 1345000000, 665000000, 560000000, 3.87, 3.84, 144700000, 14100000000, 7100000000, 7000000000),
    (16, 3350000000, 1520000000, 795000000, 670000000, 4.63, 4.59, 144600000, 14500000000, 7300000000, 7200000000)
) AS metrics(row_num, revenue, gross_profit, operating_income, net_income, eps_basic, eps_diluted, shares_outstanding, total_assets, total_liabilities, shareholders_equity)
WHERE sf.ticker = 'LRCX'
ORDER BY sf.fiscal_year, sf.fiscal_period;

-- Verify the data
SELECT  
    period_end,
    revenue / 1000000 as revenue_millions,
    net_income / 1000000 as net_income_millions,
    eps_diluted
FROM financial_metrics
WHERE ticker = 'LRCX'
ORDER BY period_end ASC;
