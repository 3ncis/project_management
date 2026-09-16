CREATE TABLE `activity_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`event_type` text NOT NULL,
	`detail` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_activity_created` ON `activity_events` (`created_at`);--> statement-breakpoint
CREATE TABLE `admin_access_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`admin_user_id` integer NOT NULL,
	`action` text NOT NULL,
	`target_user_id` integer,
	`created_at` text NOT NULL,
	FOREIGN KEY (`admin_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_admin_logs_created` ON `admin_access_logs` (`created_at`);--> statement-breakpoint
CREATE TABLE `applications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`company` text NOT NULL,
	`role_title` text NOT NULL,
	`stage` text NOT NULL,
	`match_score` integer NOT NULL,
	`next_action` text,
	`next_action_at` text,
	`source` text DEFAULT 'AI Recommendation' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_applications_user_updated` ON `applications` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_applications_user_stage` ON `applications` (`user_id`,`stage`);--> statement-breakpoint
CREATE TABLE `openai_credentials` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`masked_username` text NOT NULL,
	`password_secret_ref` text NOT NULL,
	`connection_status` text DEFAULT 'connected' NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_openai_credentials_user` ON `openai_credentials` (`user_id`);--> statement-breakpoint
CREATE TABLE `recommendations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`company` text NOT NULL,
	`role_title` text NOT NULL,
	`location` text NOT NULL,
	`work_mode` text NOT NULL,
	`match_score` integer NOT NULL,
	`salary_range` text NOT NULL,
	`skills` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_recommendations_user_match` ON `recommendations` (`user_id`,`match_score`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`headline` text DEFAULT '' NOT NULL,
	`location` text DEFAULT 'Indonesia' NOT NULL,
	`profile_completion` integer DEFAULT 0 NOT NULL,
	`last_login_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_slug` ON `users` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_email` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `idx_users_role_status` ON `users` (`role`,`status`);