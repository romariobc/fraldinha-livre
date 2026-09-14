PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_products` (
	`id` text PRIMARY KEY NOT NULL,
	`price_cents` integer NOT NULL,
	`old_price_cents` integer,
	`supplier_id` text NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`brand` text DEFAULT '' NOT NULL,
	`size` text DEFAULT '' NOT NULL,
	`quantity` integer DEFAULT 0 NOT NULL,
	`slug` text DEFAULT '' NOT NULL,
	`categoria` text DEFAULT '' NOT NULL,
	`descricao` text DEFAULT '' NOT NULL,
	`atributos` text DEFAULT '{}' NOT NULL,
	`badge` text,
	`supplier_email` text,
	`active` integer DEFAULT true NOT NULL,
	`image_url` text,
	CONSTRAINT "products_quantity_check" CHECK("__new_products"."quantity" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_products`("id", "price_cents", "old_price_cents", "supplier_id", "name", "brand", "size", "quantity", "slug", "categoria", "descricao", "atributos", "badge", "supplier_email", "active", "image_url") SELECT "id", "price_cents", "old_price_cents", "supplier_id", "name", "brand", "size", "quantity", "slug", "categoria", "descricao", "atributos", "badge", "supplier_email", "active", "image_url" FROM `products`;--> statement-breakpoint
DROP TABLE `products`;--> statement-breakpoint
ALTER TABLE `__new_products` RENAME TO `products`;--> statement-breakpoint
PRAGMA foreign_keys=ON;