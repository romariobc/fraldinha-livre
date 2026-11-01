-- New purchases are explicitly marked by the server. Historical rows remain unchanged.
ALTER TABLE orders ADD COLUMN payment_mode TEXT CHECK (payment_mode IS NULL OR payment_mode = 'simulated');
