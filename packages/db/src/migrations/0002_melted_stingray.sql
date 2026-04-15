CREATE TABLE `share_link` (
	`id` text PRIMARY KEY NOT NULL,
	`recording_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`created_by_user_id` text NOT NULL,
	`type` text NOT NULL,
	`password_hash` text,
	`password_salt` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`recording_id`) REFERENCES `recording`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `share_link_recording_id_idx` ON `share_link` (`recording_id`);--> statement-breakpoint
CREATE INDEX `share_link_organization_id_idx` ON `share_link` (`organization_id`);