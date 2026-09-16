CREATE TABLE `ai_agent_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`agent_name` text NOT NULL,
	`task_type` text NOT NULL,
	`status` text NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`model` text NOT NULL,
	`prompt_version` text NOT NULL,
	`token_in` integer DEFAULT 0 NOT NULL,
	`token_out` integer DEFAULT 0 NOT NULL,
	`estimated_cost` text DEFAULT '0' NOT NULL,
	`latency_ms` integer,
	`error_code` text,
	`result_summary` text,
	`correlation_id` text NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_ai_agent_runs_correlation` ON `ai_agent_runs` (`correlation_id`);--> statement-breakpoint
CREATE INDEX `idx_ai_agent_runs_user_started` ON `ai_agent_runs` (`user_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `idx_ai_agent_runs_status_started` ON `ai_agent_runs` (`status`,`started_at`);