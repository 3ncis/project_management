CREATE TABLE `bid_tracker` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`opportunity_id` integer NOT NULL,
	`stage` text NOT NULL,
	`next_action` text,
	`due_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`opportunity_id`) REFERENCES `procurement_opportunities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_bid_tracker_user_opportunity` ON `bid_tracker` (`user_id`,`opportunity_id`);--> statement-breakpoint
CREATE INDEX `idx_bid_tracker_user_stage` ON `bid_tracker` (`user_id`,`stage`);--> statement-breakpoint
CREATE INDEX `idx_bid_tracker_due` ON `bid_tracker` (`due_at`);--> statement-breakpoint
CREATE TABLE `opportunity_matches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`opportunity_id` integer NOT NULL,
	`match_score` integer NOT NULL,
	`confidence` integer NOT NULL,
	`reasons` text NOT NULL,
	`risk_flags` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`opportunity_id`) REFERENCES `procurement_opportunities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_opportunity_matches_user_opportunity` ON `opportunity_matches` (`user_id`,`opportunity_id`);--> statement-breakpoint
CREATE INDEX `idx_opportunity_matches_user_score` ON `opportunity_matches` (`user_id`,`match_score`);--> statement-breakpoint
CREATE TABLE `procurement_opportunities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source` text NOT NULL,
	`source_url` text NOT NULL,
	`procurement_type` text NOT NULL,
	`tender_code` text NOT NULL,
	`title` text NOT NULL,
	`lpse` text NOT NULL,
	`work_unit` text NOT NULL,
	`region` text NOT NULL,
	`category` text NOT NULL,
	`hps_value` integer NOT NULL,
	`hps_display` text NOT NULL,
	`schedule_status` text NOT NULL,
	`start_at` text,
	`end_at` text,
	`project_location` text NOT NULL,
	`source_last_seen_at` text NOT NULL,
	`fingerprint` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_procurement_fingerprint` ON `procurement_opportunities` (`fingerprint`);--> statement-breakpoint
CREATE INDEX `idx_procurement_type_status` ON `procurement_opportunities` (`procurement_type`,`schedule_status`);--> statement-breakpoint
CREATE INDEX `idx_procurement_end` ON `procurement_opportunities` (`end_at`);