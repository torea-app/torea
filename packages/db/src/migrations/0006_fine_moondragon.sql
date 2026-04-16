CREATE TABLE `transcription` (
	`id` text PRIMARY KEY NOT NULL,
	`recording_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`model` text NOT NULL,
	`language` text,
	`duration_seconds` real,
	`full_text` text,
	`segments` text,
	`error_message` text,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`started_at` integer,
	`completed_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`recording_id`) REFERENCES `recording`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `transcription_recording_id_idx` ON `transcription` (`recording_id`);--> statement-breakpoint
CREATE INDEX `transcription_organization_id_idx` ON `transcription` (`organization_id`);--> statement-breakpoint
CREATE INDEX `transcription_status_idx` ON `transcription` (`status`);