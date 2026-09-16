CREATE TABLE `nib_documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`object_key` text NOT NULL,
	`original_filename` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`ocr_text` text NOT NULL,
	`status` text NOT NULL,
	`extracted_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_nib_documents_object_key` ON `nib_documents` (`object_key`);--> statement-breakpoint
CREATE INDEX `idx_nib_documents_user_created` ON `nib_documents` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `opportunity_notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`opportunity_id` integer NOT NULL,
	`is_read` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`opportunity_id`) REFERENCES `procurement_opportunities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_notifications_user_opportunity` ON `opportunity_notifications` (`user_id`,`opportunity_id`);--> statement-breakpoint
CREATE INDEX `idx_notifications_user_read_created` ON `opportunity_notifications` (`user_id`,`is_read`,`created_at`);--> statement-breakpoint
CREATE TABLE `user_kbli` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`nib_document_id` integer NOT NULL,
	`kbli_code` text NOT NULL,
	`confidence` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`nib_document_id`) REFERENCES `nib_documents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_user_kbli_document_code` ON `user_kbli` (`nib_document_id`,`kbli_code`);--> statement-breakpoint
CREATE INDEX `idx_user_kbli_user_code` ON `user_kbli` (`user_id`,`kbli_code`);--> statement-breakpoint
ALTER TABLE `opportunity_matches` ADD `decision` text DEFAULT 'REVIEW' NOT NULL;--> statement-breakpoint
ALTER TABLE `opportunity_matches` ADD `rating` integer DEFAULT 0 NOT NULL;