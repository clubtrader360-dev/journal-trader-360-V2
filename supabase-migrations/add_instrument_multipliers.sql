-- Migration : table instrument_multipliers + trigger mis à jour
-- À exécuter AVANT fix_pnl_with_fees_v2.sql (le trigger dépend de cette table)

CREATE TABLE IF NOT EXISTS instrument_multipliers (
    instrument  TEXT    PRIMARY KEY,
    multiplier  NUMERIC NOT NULL CHECK (multiplier > 0),
    tick_size   NUMERIC NOT NULL CHECK (tick_size > 0),
    description TEXT
);

INSERT INTO instrument_multipliers (instrument, multiplier, tick_size, description) VALUES
    ('ES',    50,      0.25,      'E-mini S&P 500'),
    ('MES',    5,      0.25,      'Micro E-mini S&P 500'),
    ('NQ',    20,      0.25,      'E-mini Nasdaq 100'),
    ('MNQ',    2,      0.25,      'Micro E-mini Nasdaq 100'),
    ('GC',   100,      0.10,      'Gold'),
    ('MGC',   10,      0.10,      'Micro Gold'),
    ('RTY',   50,      0.10,      'E-mini Russell 2000'),
    ('MRTY',   5,      0.10,      'Micro E-mini Russell 2000'),
    ('CL',  1000,      0.01,      'WTI Crude Oil'),
    ('MCL',  100,      0.01,      'Micro WTI Crude Oil'),
    ('SI',  5000,      0.005,     'Silver'),
    ('ZB',  1000,      0.03125,   '30-Year Treasury Bond'),
    ('ZN',  1000,      0.015625,  '10-Year Treasury Note'),
    ('BTC',    5,      5.0,       'CME Bitcoin Futures (5 BTC/contract)'),
    ('ETH',    0.1,    0.01,      'CME Micro Ether Futures (0.1 ETH/contract)'),
    ('DEMO',   1,      1,         'Mode démo — placeholder, fallback si manual_pnl absent')
ON CONFLICT (instrument) DO NOTHING;
