CREATE TABLE `procurement_search_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`source_id` integer NOT NULL,
	`status` text DEFAULT 'QUEUED' NOT NULL,
	`result_count` integer DEFAULT 0 NOT NULL,
	`correlation_id` text NOT NULL,
	`error_message` text,
	`triggered_at` text NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_id`) REFERENCES `procurement_sources`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_procurement_search_runs_correlation` ON `procurement_search_runs` (`correlation_id`);--> statement-breakpoint
CREATE INDEX `idx_procurement_search_runs_user_triggered` ON `procurement_search_runs` (`user_id`,`triggered_at`);--> statement-breakpoint
CREATE INDEX `idx_procurement_search_runs_status_triggered` ON `procurement_search_runs` (`status`,`triggered_at`);--> statement-breakpoint
CREATE TABLE `procurement_sources` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`label` text NOT NULL,
	`source_url` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_by_admin_id` integer NOT NULL,
	`last_triggered_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`created_by_admin_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_procurement_sources_url` ON `procurement_sources` (`source_url`);--> statement-breakpoint
CREATE INDEX `idx_procurement_sources_status_updated` ON `procurement_sources` (`status`,`updated_at`);