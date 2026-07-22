CREATE TABLE `order_items` (
	`order_id` text NOT NULL,
	`product_id` text NOT NULL,
	`product_name` text NOT NULL,
	`unit_price` integer NOT NULL,
	`quantity` integer NOT NULL,
	`unit` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`uid` text NOT NULL,
	`type` text NOT NULL,
	`status` text NOT NULL,
	`product` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit` text NOT NULL,
	`price` integer,
	`supplier_id` text,
	`supplier_name` text,
	`delivery_address` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_orders_uid` ON `orders` (`uid`);