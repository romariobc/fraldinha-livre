-- Preserve the original report text, read flag, IDs and timestamps. No historical replies are invented.
ALTER TABLE reports ADD COLUMN status TEXT NOT NULL DEFAULT 'aberta' CHECK(status IN ('aberta','em_atendimento','resolvida'));
ALTER TABLE reports ADD COLUMN version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE reports ADD COLUMN opened_by TEXT;
ALTER TABLE reports ADD COLUMN opened_role TEXT CHECK(opened_role IN ('comprador','fornecedor'));
ALTER TABLE reports ADD COLUMN resolved_by TEXT;
ALTER TABLE reports ADD COLUMN resolved_at TEXT;
ALTER TABLE reports ADD COLUMN mutation_id TEXT;
CREATE TABLE report_messages (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL REFERENCES reports(id),
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL CHECK(actor_role IN ('comprador','fornecedor','admin')),
  message TEXT NOT NULL,
  created_at TEXT NOT NULL,
  resolution INTEGER NOT NULL DEFAULT 0 CHECK(resolution IN (0,1))
);
CREATE INDEX idx_report_messages_report ON report_messages(report_id, created_at);
