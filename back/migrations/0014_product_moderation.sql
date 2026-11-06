-- Keep supplier publication separate from an administrator's moderation decision.
ALTER TABLE products ADD COLUMN moderation_blocked INTEGER NOT NULL DEFAULT 0 CHECK (moderation_blocked IN (0, 1));

-- Preserve the latest recorded admin decision, including legacy supplier republication.
UPDATE products SET moderation_blocked = 1 WHERE (
  SELECT a.action FROM audit_logs a
  WHERE a.target_type = 'product' AND a.target_id = products.id
    AND a.action IN ('product.activated', 'product.deactivated')
  ORDER BY a.rowid DESC LIMIT 1
) = 'product.deactivated';
