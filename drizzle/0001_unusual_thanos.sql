CREATE TABLE `monitoring_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`metric_key` text NOT NULL,
	`metric_value` text NOT NULL,
	`unit` text NOT NULL,
	`status` text NOT NULL,
	`captured_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_monitoring_metric_captured` ON `monitoring_snapshots` (`metric_key`,`captured_at`);--> statement-breakpoint
ALTER TABLE `admin_access_logs` ADD `purpose` text;--> statement-breakpoint
ALTER TABLE `admin_access_logs` ADD `correlation_id` text;--> statement-breakpoint
ALTER TABLE `openai_credentials` ADD `encrypted_username` text;--> statement-breakpoint
ALTER TABLE `openai_credentials` ADD `encrypted_password` text;--> statement-breakpoint
ALTER TABLE `openai_credentials` ADD `encryption_version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `openai_credentials` ADD `verified_at` text;