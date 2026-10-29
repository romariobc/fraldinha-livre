-- No supplier is approved by migration, JWT claim, or environment allowlist.
CREATE TABLE supplier_applications (
  uid TEXT PRIMARY KEY NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','rejeitado','suspenso')),
  reason TEXT,
  version INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_supplier_applications_status ON supplier_applications(status, uid);
