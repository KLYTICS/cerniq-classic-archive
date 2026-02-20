-- Simple test data for LRCX
-- Delete existing
TRUNCATE TABLE financial_metrics CASCADE;
TRUNCATE TABLE sec_filings CASCADE;

-- Manual insert for sec_filings
DO $$
DECLARE
  filing_id INT;
BEGIN
  -- Filing 1
  INSERT INTO sec_filings (ticker, cik, form_type, filing_date, fiscal_period, fiscal_year, accession_number, filing_url, processed) 
  VALUES ('LRCX', '0000707549', '10-Q', '2020-05-01', 'Q1', 2020, 'lrcx-20q1', 'http://test', true) RETURNING id INTO filing_id;
  INSERT INTO financial_metrics (filing_id, ticker, period_end, revenue, net_income, eps_diluted, shares_outstanding) 
  VALUES (filing_id, 'LRCX', '2020-03-31', 2360000000, 421000000, 2.92, 143500000);
  
  -- Filing 2
  INSERT INTO sec_filings (ticker, cik, form_type, filing_date, fiscal_period, fiscal_year, accession_number, filing_url, processed)
  VALUES ('LRCX', '0000707549', '10-Q', '2020-08-01', 'Q2', 2020, 'lrcx-20q2', 'http://test', true) RETURNING id INTO filing_id;
  INSERT INTO financial_metrics (filing_id, ticker, period_end, revenue, net_income, eps_diluted, shares_outstanding)
  VALUES (filing_id, 'LRCX', '2020-06-30', 2690000000, 512000000, 3.54, 144800000);
  
  -- Filing 3
  INSERT INTO sec_filings (ticker, cik, form_type, filing_date, fiscal_period, fiscal_year, accession_number, filing_url, processed)
  VALUES ('LRCX', '0000707549', '10-Q', '2020-11-01', 'Q3', 2020, 'lrcx-20q3', 'http://test', true) RETURNING id INTO filing_id;
  INSERT INTO financial_metrics (filing_id, ticker, period_end, revenue, net_income, eps_diluted, shares_outstanding)
  VALUES (filing_id, 'LRCX', '2020-09-30', 3180000000, 635000000, 4.38, 145000000);
  
  -- Filing 4
  INSERT INTO sec_filings (ticker, cik, form_type, filing_date, fiscal_period, fiscal_year, accession_number, filing_url, processed)
  VALUES ('LRCX', '0000707549', '10-K', '2021-02-01', 'Q4', 2020, 'lrcx-20q4', 'http://test', true) RETURNING id INTO filing_id;
  INSERT INTO financial_metrics (filing_id, ticker, period_end, revenue, net_income, eps_diluted, shares_outstanding)
  VALUES (filing_id, 'LRCX', '2020-12-31', 3850000000, 865000000, 5.98, 144000000);
  
  -- Filing 5
  INSERT INTO sec_filings (ticker, cik, form_type, filing_date, fiscal_period, fiscal_year, accession_number, filing_url, processed)
  VALUES ('LRCX', '0000707549', '10-Q', '2021-05-01', 'Q1', 2021, 'lrcx-21q1', 'http://test', true) RETURNING id INTO filing_id;
  INSERT INTO financial_metrics (filing_id, ticker, period_end, revenue, net_income, eps_diluted, shares_outstanding)
  VALUES (filing_id, 'LRCX', '2021-03-31', 4150000000, 985000000, 6.82, 143500000);
  
  -- Filing 6
  INSERT INTO sec_filings (ticker, cik, form_type, filing_date, fiscal_period, fiscal_year, accession_number, filing_url, processed)
  VALUES ('LRCX', '0000707549', '10-Q', '2021-08-01', 'Q2', 2021, 'lrcx-21q2', 'http://test', true) RETURNING id INTO filing_id;
  INSERT INTO financial_metrics (filing_id, ticker, period_end, revenue, net_income, eps_diluted, shares_outstanding)
  VALUES (filing_id, 'LRCX', '2021-06-30', 4640000000, 1180000000, 8.17, 143600000);
  
  -- Filing 7
  INSERT INTO sec_filings (ticker, cik, form_type, filing_date, fiscal_period, fiscal_year, accession_number, filing_url, processed)
  VALUES ('LRCX', '0000707549', '10-Q', '2021-11-01', 'Q3', 2021, 'lrcx-21q3', 'http://test', true) RETURNING id INTO filing_id;
  INSERT INTO financial_metrics (filing_id, ticker, period_end, revenue, net_income, eps_diluted, shares_outstanding)
  VALUES (filing_id, 'LRCX', '2021-09-30', 4580000000, 1135000000, 7.86, 143400000);
  
  -- Filing 8
  INSERT INTO sec_filings (ticker, cik, form_type, filing_date, fiscal_period, fiscal_year, accession_number, filing_url, processed)
  VALUES ('LRCX', '0000707549', '10-K', '2022-02-01', 'Q4', 2021, 'lrcx-21q4', 'http://test', true) RETURNING id INTO filing_id;
  INSERT INTO financial_metrics (filing_id, ticker, period_end, revenue, net_income, eps_diluted, shares_outstanding)
  VALUES (filing_id, 'LRCX', '2021-12-31', 4230000000, 1005000000, 6.96, 143200000);
  
  -- Filing 9
  INSERT INTO sec_filings (ticker, cik, form_type, filing_date, fiscal_period, fiscal_year, accession_number, filing_url, processed)
  VALUES ('LRCX', '0000707549', '10-Q', '2022-05-01', 'Q1', 2022, 'lrcx-22q1', 'http://test', true) RETURNING id INTO filing_id;
  INSERT INTO financial_metrics (filing_id, ticker, period_end, revenue, net_income, eps_diluted, shares_outstanding)
  VALUES (filing_id, 'LRCX', '2022-03-31', 3850000000, 885000000, 6.12, 143100000);
  
  -- Filing 10
  INSERT INTO sec_filings (ticker, cik, form_type, filing_date, fiscal_period, fiscal_year, accession_number, filing_url, processed)
  VALUES ('LRCX', '0000707549', '10-Q', '2022-08-01', 'Q2', 2022, 'lrcx-22q2', 'http://test', true) RETURNING id INTO filing_id;
  INSERT INTO financial_metrics (filing_id, ticker, period_end, revenue, net_income, eps_diluted, shares_outstanding)
  VALUES (filing_id, 'LRCX', '2022-06-30', 3410000000, 735000000, 5.08, 143500000);
  
  -- Filing 11
  INSERT INTO sec_filings (ticker, cik, form_type, filing_date, fiscal_period, fiscal_year, accession_number, filing_url, processed)
  VALUES ('LRCX', '0000707549', '10-Q', '2022-11-01', 'Q3', 2022, 'lrcx-22q3', 'http://test', true) RETURNING id INTO filing_id;
  INSERT INTO financial_metrics (filing_id, ticker, period_end, revenue, net_income, eps_diluted, shares_outstanding)
  VALUES (filing_id, 'LRCX', '2022-09-30', 2980000000, 575000000, 3.97, 144000000);
  
  -- Filing 12
  INSERT INTO sec_filings (ticker, cik, form_type, filing_date, fiscal_period, fiscal_year, accession_number, filing_url, processed)
  VALUES ('LRCX', '0000707549', '10-K', '2023-02-01', 'Q4', 2022, 'lrcx-22q4', 'http://test', true) RETURNING id INTO filing_id;
  INSERT INTO financial_metrics (filing_id, ticker, period_end, revenue, net_income, eps_diluted, shares_outstanding)
  VALUES (filing_id, 'LRCX', '2022-12-31', 2650000000, 455000000, 3.13, 144500000);
  
  -- Filing 13
  INSERT INTO sec_filings (ticker, cik, form_type, filing_date, fiscal_period, fiscal_year, accession_number, filing_url, processed)
  VALUES ('LRCX', '0000707549', '10-Q', '2023-05-01', 'Q1', 2023, 'lrcx-23q1', 'http://test', true) RETURNING id INTO filing_id;
  INSERT INTO financial_metrics (filing_id, ticker, period_end, revenue, net_income, eps_diluted, shares_outstanding)
  VALUES (filing_id, 'LRCX', '2023-03-31', 2420000000, 370000000, 2.54, 144800000);
  
  -- Filing 14
  INSERT INTO sec_filings (ticker, cik, form_type, filing_date, fiscal_period, fiscal_year, accession_number, filing_url, processed)
  VALUES ('LRCX', '0000707549', '10-Q', '2023-08-01', 'Q2', 2023, 'lrcx-23q2', 'http://test', true) RETURNING id INTO filing_id;
  INSERT INTO financial_metrics (filing_id, ticker, period_end, revenue, net_income, eps_diluted, shares_outstanding)
  VALUES (filing_id, 'LRCX', '2023-06-30', 2650000000, 445000000, 3.05, 144900000);
  
  -- Filing 15
  INSERT INTO sec_filings (ticker, cik, form_type, filing_date, fiscal_period, fiscal_year, accession_number, filing_url, processed)
  VALUES ('LRCX', '0000707549', '10-Q', '2023-11-01', 'Q3', 2023, 'lrcx-23q3', 'http://test', true) RETURNING id INTO filing_id;
  INSERT INTO financial_metrics (filing_id, ticker, period_end, revenue, net_income, eps_diluted, shares_outstanding)
  VALUES (filing_id, 'LRCX', '2023-09-30', 2980000000, 560000000, 3.84, 144700000);
  
  -- Filing 16
  INSERT INTO sec_filings (ticker, cik, form_type, filing_date, fiscal_period, fiscal_year, accession_number, filing_url, processed)
  VALUES ('LRCX', '0000707549', '10-K', '2024-02-01', 'Q4', 2023, 'lrcx-23q4', 'http://test', true) RETURNING id INTO filing_id;
  INSERT INTO financial_metrics (filing_id, ticker, period_end, revenue, net_income, eps_diluted, shares_outstanding)
  VALUES (filing_id, 'LRCX', '2023-12-31', 3350000000, 670000000, 4.59, 144600000);
END $$;

-- Verify
SELECT COUNT(*) as total FROM financial_metrics WHERE ticker = 'LRCX';
SELECT period_end, revenue/1000000 as rev_mil, net_income/1000000 as ni_mil FROM financial_metrics WHERE ticker='LRCX' ORDER BY period_end;
