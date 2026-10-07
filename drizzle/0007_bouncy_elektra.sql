DELETE FROM `user_kbli`
WHERE `id` NOT IN (
  SELECT MIN(`id`)
  FROM `user_kbli`
  GROUP BY `user_id`, `kbli_code`
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_user_kbli_user_code_unique` ON `user_kbli` (`user_id`,`kbli_code`);
