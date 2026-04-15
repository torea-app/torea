CREATE TABLE `view_event` (
	`id` text PRIMARY KEY NOT NULL,
	`recording_id` text NOT NULL,
	`share_link_id` text,
	`viewer_user_id` text,
	`visitor_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`recording_id`) REFERENCES `recording`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`share_link_id`) REFERENCES `share_link`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`viewer_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `view_event_recording_id_idx` ON `view_event` (`recording_id`);--> statement-breakpoint
CREATE INDEX `view_event_dedup_user_idx` ON `view_event` (`recording_id`,`viewer_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `view_event_dedup_visitor_idx` ON `view_event` (`recording_id`,`visitor_id`,`created_at`);