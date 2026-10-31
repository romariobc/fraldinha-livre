ALTER TABLE orders ADD COLUMN request_fingerprint text;
ALTER TABLE orders ADD COLUMN mutation_id text;

CREATE TABLE order_events (
  id text PRIMARY KEY NOT NULL,
  order_id text NOT NULL REFERENCES orders(id),
  mutation_id text NOT NULL UNIQUE,
  from_status text,
  to_status text NOT NULL,
  actor_id text NOT NULL,
  request_id text,
  reason text,
  stock_effect text NOT NULL CHECK (stock_effect IN ('decrement', 'restore', 'none')),
  created_at text NOT NULL
);
CREATE INDEX idx_order_events_order_created ON order_events(order_id, created_at);
