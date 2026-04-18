CREATE TABLE `webhook_delivery` (
	`id` text PRIMARY KEY NOT NULL,
	`endpoint_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`event_name` text NOT NULL,
	`event_version` text DEFAULT 'v1' NOT NULL,
	`event_id` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 6 NOT NULL,
	`next_attempt_at` integer,
	`last_status_code` integer,
	`last_response_body` text,
	`last_error_message` text,
	`duration_ms` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`endpoint_id`) REFERENCES `webhook_endpoint`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `webhook_delivery_endpoint_id_idx` ON `webhook_delivery` (`endpoint_id`);--> statement-breakpoint
CREATE INDEX `webhook_delivery_organization_id_idx` ON `webhook_delivery` (`organization_id`);--> statement-breakpoint
CREATE INDEX `webhook_delivery_status_idx` ON `webhook_delivery` (`status`);--> statement-breakpoint
CREATE INDEX `webhook_delivery_created_at_idx` ON `webhook_delivery` (`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `webhook_delivery_endpoint_event_uq` ON `webhook_delivery` (`endpoint_id`,`event_id`);--> statement-breakpoint
CREATE TABLE `webhook_endpoint` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`created_by_user_id` text NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`description` text,
	`events` text NOT NULL,
	`secret_hash` text NOT NULL,
	`secret_prefix` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`disabled_reason` text,
	`consecutive_failures` integer DEFAULT 0 NOT NULL,
	`last_success_at` integer,
	`last_failure_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `webhook_endpoint_organization_id_idx` ON `webhook_endpoint` (`organization_id`);--> statement-breakpoint
CREATE INDEX `webhook_endpoint_status_idx` ON `webhook_endpoint` (`status`);