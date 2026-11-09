"""Exercise SQLite backup and recovery using only newly generated local fixtures."""

from contextlib import closing
from hashlib import sha256
import json
from pathlib import Path
import sqlite3
from tempfile import mkdtemp
from time import perf_counter

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "qa-artifacts"
DATE = "2026-11-08T12:00:00Z"


def validate(connection):
    assert connection.execute("PRAGMA integrity_check").fetchall() == [("ok",)]
    assert connection.execute("PRAGMA foreign_key_check").fetchall() == []
    snapshot = "\n".join(connection.iterdump()).encode()
    return sha256(snapshot).hexdigest()


def seed_legacy(connection):
    connection.execute("""
        INSERT INTO orders (id,uid,type,status,product,quantity,unit,price,delivery_address,created_at)
        VALUES ('legacy-order','qa-buyer','compra-direta','entregue','Legado',1,'un',100,'{}',?)
    """, (DATE,))
    connection.execute("""
        INSERT INTO reports (id,order_id,supplier_id,client_id,message,created_at)
        VALUES ('legacy-report','legacy-order','qa-supplier','qa-buyer','Texto legado',?)
    """, (DATE,))
    connection.commit()


def seed_current(connection):
    connection.executescript(f"""
        INSERT INTO supplier_applications (uid,status,created_at,updated_at)
        VALUES ('qa-supplier','aprovado','{DATE}','{DATE}');
        INSERT INTO products (id,price_cents,supplier_id,name,quantity,slug)
        VALUES ('qa-item',100,'qa-supplier','Item fictício',8,'mp11-ficticio');
        INSERT INTO orders
          (id,uid,type,status,product,quantity,unit,price,supplier_id,delivery_address,created_at,payment_mode)
        VALUES ('qa-order','qa-buyer','compra-direta','entregue','Item fictício',2,'un',200,
          'qa-supplier','{{}}','{DATE}','simulated');
        INSERT INTO order_items (order_id,product_id,product_name,unit_price,quantity,unit)
        VALUES ('qa-order','qa-item','Item fictício',100,2,'un');
        INSERT INTO order_events (id,order_id,mutation_id,to_status,actor_id,stock_effect,created_at)
        VALUES ('qa-event','qa-order','qa-mutation','entregue','qa-supplier','none','{DATE}');
        INSERT INTO reports (id,order_id,supplier_id,client_id,message,created_at,status,version,resolved_by,resolved_at)
        VALUES ('qa-report','qa-order','qa-supplier','qa-buyer','Ocorrência fictícia','{DATE}','resolvida',1,'qa-admin','{DATE}');
        INSERT INTO report_messages (id,report_id,actor_id,actor_role,message,created_at,resolution)
        VALUES ('qa-reply','qa-report','qa-admin','admin','Resolução fictícia','{DATE}',1);
        INSERT INTO audit_logs (id,actor_id,actor_role,target_type,target_id,action,reason,request_id,created_at)
        VALUES ('qa-audit','qa-admin','admin','report','qa-report','report.resolved','Motivo fictício','qa-trace','{DATE}');
        INSERT INTO notifications (source_type,source_id,recipient_uid,kind,order_id,report_id,detail,created_at)
        VALUES ('occurrence','qa-reply','qa-buyer','occurrence_reply','qa-order','qa-report','Aviso fictício','{DATE}');
    """)


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    run = Path(mkdtemp(prefix="mp11-restore-", dir=OUTPUT))
    migrations = sorted((ROOT / "back" / "migrations").glob("*.sql"))
    assert migrations, "migration chain is missing"
    with closing(sqlite3.connect(run / "source.sqlite")) as source:
        source.execute("PRAGMA foreign_keys=ON")
        for migration in migrations:
            if migration.name.startswith("0013_"):
                seed_legacy(source)
            source.executescript(migration.read_text(encoding="utf-8"))
        source.execute("PRAGMA foreign_keys=ON")
        seed_current(source)
        assert source.execute(
            "SELECT supplier_id,payment_mode FROM orders WHERE id='legacy-order'"
        ).fetchone() == (None, None)
        assert source.execute(
            "SELECT message,status,version FROM reports WHERE id='legacy-report'"
        ).fetchone() == ("Texto legado", "aberta", 0)
        before = validate(source)
        started = perf_counter()
        with closing(sqlite3.connect(run / "backup.sqlite")) as backup:
            source.backup(backup)
        backup_seconds = perf_counter() - started
        backup_at = started

        # Write after the checkpoint to simulate a damaged source.
        with source:
            source.execute("UPDATE products SET quantity=0 WHERE id='qa-item'")
        assert validate(source) != before
        incident_at = perf_counter()

    started = perf_counter()
    with closing(sqlite3.connect(run / "backup.sqlite")) as backup:
        with closing(sqlite3.connect(run / "restored.sqlite")) as restored:
            backup.backup(restored)
            assert validate(restored) == before
            assert restored.execute(
                "SELECT quantity FROM products WHERE id='qa-item'"
            ).fetchone() == (8,)
            counts = {}
            for table in ("products", "orders", "order_items", "order_events", "reports",
                          "report_messages", "audit_logs", "notifications", "supplier_applications"):
                counts[table] = restored.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
    report = {
        "sqlite_version": sqlite3.sqlite_version,
        "migrations": len(migrations),
        "migration_sha256": {m.name: sha256(m.read_bytes()).hexdigest() for m in migrations},
        "integrity": "ok",
        "foreign_key_violations": 0,
        "logical_sha256": before,
        "backup_file_sha256": sha256((run / "backup.sqlite").read_bytes()).hexdigest(),
        "counts": counts,
        "backup_seconds": round(backup_seconds, 6),
        "restore_and_validation_seconds": round(perf_counter() - started, 6),
        "observed_data_loss_window_seconds": round(incident_at - backup_at, 6),
        "post_backup_mutations_excluded": 1,
    }
    (run / "result.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({**report, "migration_sha256": "see result.json", "evidence": str(run)}, indent=2))


if __name__ == "__main__":
    main()
