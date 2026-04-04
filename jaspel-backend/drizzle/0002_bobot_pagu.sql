-- Migration: Tambah tabel bobot_staff, kinerja_tindakan_peran, pagu_unit_peran
--> statement-breakpoint
CREATE TABLE `bobot_staff` (
	`id` text PRIMARY KEY NOT NULL,
	`pegawai_id` text NOT NULL,
	`jabatan_unit` text,
	`risiko` text,
	`unit_kerja` text,
	`status` text,
	UNIQUE(`pegawai_id`)
);
--> statement-breakpoint
CREATE TABLE `kinerja_tindakan_peran` (
	`id` text PRIMARY KEY NOT NULL,
	`kinerja_pegawai_id` text NOT NULL,
	`unit_id` text NOT NULL,
	`peran_key` text NOT NULL,
	`jumlah_tindakan` real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pagu_unit_peran` (
	`id` text PRIMARY KEY NOT NULL,
	`unit_id` text NOT NULL,
	`periode` text NOT NULL,
	`peran_key` text NOT NULL,
	`pagu_non_kap` real DEFAULT 0 NOT NULL,
	`pagu_pad_murni` real DEFAULT 0 NOT NULL
);
