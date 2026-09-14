ALTER TABLE `orders` ADD `idempotency_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `orders_idempotency_key_unique` ON `orders` (`idempotency_key`);