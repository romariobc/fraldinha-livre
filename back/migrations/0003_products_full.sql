PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_products` (
	`id` text PRIMARY KEY NOT NULL,
	`price_cents` integer NOT NULL,
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
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_products`("id", "price_cents", "supplier_id") SELECT "id", "price_cents", "supplier_id" FROM `products`;--> statement-breakpoint
DROP TABLE `products`;--> statement-breakpoint
ALTER TABLE `__new_products` RENAME TO `products`;--> statement-breakpoint
PRAGMA foreign_keys=ON;