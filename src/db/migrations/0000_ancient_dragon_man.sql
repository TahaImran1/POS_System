CREATE TABLE `cash_drops` (
	`drop_id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`type` text NOT NULL,
	`amount` real NOT NULL,
	`reason` text,
	`created_at` integer,
	FOREIGN KEY (`session_id`) REFERENCES `cash_sessions`(`session_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `cash_sessions` (
	`session_id` text PRIMARY KEY NOT NULL,
	`node_id` text NOT NULL,
	`cashier_name` text NOT NULL,
	`opening_balance` real DEFAULT 0 NOT NULL,
	`expected_closing_balance` real DEFAULT 0,
	`closing_cash_counted` real,
	`cash_variance` real,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`opened_at` integer,
	`closed_at` integer,
	FOREIGN KEY (`node_id`) REFERENCES `nodes`(`node_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `inventory` (
	`inventory_id` text PRIMARY KEY NOT NULL,
	`node_id` text NOT NULL,
	`product_id` text NOT NULL,
	`quantity` real DEFAULT 0 NOT NULL,
	`min_stock_alert` real DEFAULT 0 NOT NULL,
	`last_updated` integer,
	FOREIGN KEY (`node_id`) REFERENCES `nodes`(`node_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`product_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `nodes` (
	`node_id` text PRIMARY KEY NOT NULL,
	`parent_node_id` text,
	`node_type` text NOT NULL,
	`location_name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pricelist_items` (
	`item_id` text PRIMARY KEY NOT NULL,
	`pricelist_id` text NOT NULL,
	`product_id` text NOT NULL,
	`fixed_price` real NOT NULL,
	FOREIGN KEY (`pricelist_id`) REFERENCES `pricelists`(`pricelist_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`product_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `pricelists` (
	`pricelist_id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`currency` text DEFAULT 'PKR' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `product_bom` (
	`bom_id` text PRIMARY KEY NOT NULL,
	`parent_product_id` text NOT NULL,
	`ingredient_product_id` text NOT NULL,
	`quantity_required` real NOT NULL,
	`uom` text NOT NULL,
	FOREIGN KEY (`parent_product_id`) REFERENCES `products`(`product_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ingredient_product_id`) REFERENCES `products`(`product_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `product_taxes` (
	`product_tax_id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`tax_group_id` text NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`product_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tax_group_id`) REFERENCES `tax_groups`(`tax_group_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `products` (
	`product_id` text PRIMARY KEY NOT NULL,
	`barcode` text,
	`name` text NOT NULL,
	`product_type` text NOT NULL,
	`default_price` real DEFAULT 0 NOT NULL,
	`uom` text DEFAULT 'PCS' NOT NULL,
	`image` text,
	`description` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_barcode_unique` ON `products` (`barcode`);--> statement-breakpoint
CREATE TABLE `sale_item_modifiers` (
	`modifier_id` text PRIMARY KEY NOT NULL,
	`sale_item_id` text NOT NULL,
	`modifier_name` text NOT NULL,
	`price_override` real NOT NULL,
	FOREIGN KEY (`sale_item_id`) REFERENCES `sale_items`(`sale_item_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sale_items` (
	`sale_item_id` text PRIMARY KEY NOT NULL,
	`sale_id` text NOT NULL,
	`product_id` text NOT NULL,
	`quantity` real NOT NULL,
	`unit_price` real NOT NULL,
	`tax_amount` real NOT NULL,
	`line_total` real NOT NULL,
	FOREIGN KEY (`sale_id`) REFERENCES `sales`(`sale_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`product_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sales` (
	`sale_id` text PRIMARY KEY NOT NULL,
	`node_id` text NOT NULL,
	`session_id` text NOT NULL,
	`subtotal` real NOT NULL,
	`tax_total` real NOT NULL,
	`discount_total` real NOT NULL,
	`net_total` real NOT NULL,
	`payment_method` text NOT NULL,
	`order_type` text DEFAULT 'TAKEAWAY' NOT NULL,
	`extra_attributes` text,
	`created_at` integer,
	FOREIGN KEY (`node_id`) REFERENCES `nodes`(`node_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`session_id`) REFERENCES `cash_sessions`(`session_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sync_events` (
	`event_id` text PRIMARY KEY NOT NULL,
	`origin_node_id` text NOT NULL,
	`table_name` text NOT NULL,
	`action` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`origin_node_id`) REFERENCES `nodes`(`node_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sync_ledger` (
	`sync_id` text PRIMARY KEY NOT NULL,
	`source_node_id` text NOT NULL,
	`target_node_id` text NOT NULL,
	`last_synced_event_id` text,
	`last_sync_time` integer,
	FOREIGN KEY (`source_node_id`) REFERENCES `nodes`(`node_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_node_id`) REFERENCES `nodes`(`node_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`last_synced_event_id`) REFERENCES `sync_events`(`event_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tax_groups` (
	`tax_group_id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`rate_percentage` real NOT NULL,
	`is_inclusive` integer NOT NULL
);
