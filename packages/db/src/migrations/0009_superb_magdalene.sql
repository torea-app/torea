CREATE TABLE `subscription` (
	`id` text PRIMARY KEY NOT NULL,
	`plan` text NOT NULL,
	`reference_id` text NOT NULL,
	`stripe_customer_id` text,
	`stripe_subscription_id` text,
	`status` text DEFAULT 'incomplete' NOT NULL,
	`period_start` integer,
	`period_end` integer,
	`trial_start` integer,
	`trial_end` integer,
	`cancel_at_period_end` integer DEFAULT false,
	`cancel_at` integer,
	`canceled_at` integer,
	`ended_at` integer,
	`seats` integer,
	`billing_interval` text,
	`stripe_schedule_id` text,
	FOREIGN KEY (`reference_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `subscription_referenceId_idx` ON `subscription` (`reference_id`);--> statement-breakpoint
CREATE INDEX `subscription_stripeCustomerId_idx` ON `subscription` (`stripe_customer_id`);--> statement-breakpoint
CREATE INDEX `subscription_status_idx` ON `subscription` (`status`);--> statement-breakpoint
CREATE TABLE `usage_quota` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`period_start` integer NOT NULL,
	`plan` text NOT NULL,
	`recording_minutes_used_x1000` integer DEFAULT 0 NOT NULL,
	`recording_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `usage_quota_user_period_uidx` ON `usage_quota` (`user_id`,`period_start`);--> statement-breakpoint
CREATE INDEX `usage_quota_userId_idx` ON `usage_quota` (`user_id`);--> statement-breakpoint
ALTER TABLE `user` ADD `stripe_customer_id` text;