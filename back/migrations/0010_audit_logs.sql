CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` text PRIMARY KEY NOT NULL,
  `actor_id` text NOT NULL,
  `actor_role` text NOT NULL,
  `target_type` text NOT NULL,
  `target_id` text NOT NULL,
  `action` text NOT NULL,
  `reason` text NOT NULL,
  `metadata` text,
  `request_id` text NOT NULL,
  `created_at` text NOT NULL
);

CREATE INDEX IF NOT EXISTS `idx_audit_logs_target` ON `audit_logs` (`target_type`, `target_id`);
CREATE INDEX IF NOT EXISTS `idx_audit_logs_actor` ON `audit_logs` (`actor_id`);
CREATE INDEX IF NOT EXISTS `idx_audit_logs_action` ON `audit_logs` (`action`);
CREATE INDEX IF NOT EXISTS `idx_audit_logs_created_at` ON `audit_logs` (`created_at`);
