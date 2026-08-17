CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`supplier_id` text NOT NULL,
	`client_id` text NOT NULL,
	`message` text NOT NULL,
	`read` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_reports_order_id` ON `reports` (`order_id`);--> statement-breakpoint
CREATE INDEX `idx_reports_client_id` ON `reports` (`client_id`);