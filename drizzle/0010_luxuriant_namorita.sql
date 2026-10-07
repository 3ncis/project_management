CREATE TABLE IF NOT EXISTS `ai_agent_steps` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`correlation_id` text NOT NULL,
	`node_key` text NOT NULL,
	`node_label` text NOT NULL,
	`status` text NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`detail` text,
	`started_at` text,
	`completed_at` text,
	`duration_ms` integer,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_ai_agent_steps_run_node` ON `ai_agent_steps` (`correlation_id`,`node_key`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_ai_agent_steps_updated` ON `ai_agent_steps` (`updated_at`);
