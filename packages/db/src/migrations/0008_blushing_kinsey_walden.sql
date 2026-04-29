CREATE TABLE `drive_export` (
	`id` text PRIMARY KEY NOT NULL,
	`recording_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`connected_account_user_id` text NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`triggered_by` text NOT NULL,
	`drive_file_id` text,
	`drive_web_view_link` text,
	`error_code` text,
	`error_message` text,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`bytes_uploaded` integer DEFAULT 0 NOT NULL,
	`bytes_total` integer,
	`started_at` integer,
	`completed_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`recording_id`) REFERENCES `recording`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`connected_account_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `drive_export_recording_id_idx` ON `drive_export` (`recording_id`);--> statement-breakpoint
CREATE INDEX `drive_export_organization_id_idx` ON `drive_export` (`organization_id`);--> statement-breakpoint
CREATE INDEX `drive_export_status_idx` ON `drive_export` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `drive_export_recording_kind_uidx` ON `drive_export` (`recording_id`,`kind`);--> statement-breakpoint
CREATE TABLE `google_drive_account` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`google_subject` text NOT NULL,
	`google_email` text NOT NULL,
	`access_token_encrypted` text NOT NULL,
	`refresh_token_encrypted` text NOT NULL,
	`scope` text NOT NULL,
	`access_token_expires_at` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`root_folder_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `google_drive_account_user_id_unique` ON `google_drive_account` (`user_id`);--> statement-breakpoint
CREATE INDEX `google_drive_account_user_id_idx` ON `google_drive_account` (`user_id`);--> statement-breakpoint
CREATE INDEX `google_drive_account_status_idx` ON `google_drive_account` (`status`);--> statement-breakpoint
CREATE TABLE `user_integration_preference` (
	`user_id` text PRIMARY KEY NOT NULL,
	`auto_save_to_drive` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
