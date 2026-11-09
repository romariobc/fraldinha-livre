-- Aggregate inventory for reconciliation. Run against the verified environment.
SELECT
  (SELECT count(*) FROM orders WHERE supplier_id IS NULL OR trim(supplier_id) = '')
    AS orders_without_supplier,
  (SELECT count(*) FROM orders WHERE payment_mode IS NULL)
    AS orders_without_explicit_payment_mode,
  (SELECT count(*) FROM orders o WHERE NOT EXISTS (SELECT 1 FROM order_events e WHERE e.order_id = o.id))
    AS orders_without_recorded_events,
  (SELECT count(*) FROM reports WHERE opened_by IS NULL)
    AS legacy_occurrences_without_author,
  (SELECT count(*) FROM products WHERE supplier_id IN ('sup-001', 'sup-002', 'sup-003', 'sup-004'))
    AS historical_seed_products,
  (SELECT count(*) FROM products p JOIN supplier_applications a ON a.uid = p.supplier_id
    WHERE p.supplier_id IN ('sup-001', 'sup-002', 'sup-003', 'sup-004')
      AND p.active = 1 AND p.moderation_blocked = 0 AND a.status = 'aprovado')
    AS seed_products_eligible_for_public_catalog;
