CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`result` text,
	`error` text,
	`lease` text,
	`lease_until` integer,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_jobs_queue` ON `jobs` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `media` (
	`id` text PRIMARY KEY NOT NULL,
	`report_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`key` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `reports`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_media_report` ON `media` (`report_id`);--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`school` text DEFAULT '' NOT NULL,
	`region` text DEFAULT '' NOT NULL,
	`date` text DEFAULT '' NOT NULL,
	`sessions` integer,
	`students` integer,
	`activity` text DEFAULT '' NOT NULL,
	`impact` text DEFAULT '' NOT NULL,
	`challenge` text DEFAULT '' NOT NULL,
	`funds_received` real,
	`funds_used` real,
	`funds_note` text DEFAULT '' NOT NULL,
	`raw` text DEFAULT '' NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`status` text DEFAULT 'review' NOT NULL,
	`issue_status` text DEFAULT 'open' NOT NULL,
	`model` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_reports_created` ON `reports` (`created_at`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
