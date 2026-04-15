CREATE TABLE `recording` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`status` text DEFAULT 'uploading' NOT NULL,
	`r2_key` text NOT NULL,
	`upload_id` text NOT NULL,
	`file_size` integer,
	`duration_ms` integer,
	`mime_type` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `recording_organizationId_idx` ON `recording` (`organization_id`);--> statement-breakpoint
CREATE INDEX `recording_userId_idx` ON `recording` (`user_id`);--> statement-breakpoint
CREATE INDEX `recording_status_idx` ON `recording` (`status`);