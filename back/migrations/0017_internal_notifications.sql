-- Future recorded events only. No recipients or historical events are inferred.
CREATE TABLE notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type TEXT NOT NULL CHECK(source_type IN ('order','supplier','occurrence')),
  source_id TEXT NOT NULL,
  recipient_uid TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('new_order','order_status','order_cancelled','supplier_decision','occurrence_reply')),
  order_id TEXT,
  report_id TEXT,
  detail TEXT NOT NULL,
  created_at TEXT NOT NULL,
  read_at TEXT,
  UNIQUE(source_type, source_id, recipient_uid)
);
CREATE INDEX idx_notifications_recipient_id ON notifications(recipient_uid, id DESC);
CREATE INDEX idx_notifications_unread ON notifications(recipient_uid, id) WHERE read_at IS NULL;
