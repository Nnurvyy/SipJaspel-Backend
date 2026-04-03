CREATE TABLE `kehadiran` (
	`id` text PRIMARY KEY NOT NULL,
	`periode` text NOT NULL,
	`pegawai_id` text NOT NULL,
	`hari_masuk_kerja` integer DEFAULT 0 NOT NULL,
	`hari_kerja` integer DEFAULT 0 NOT NULL,
	`tanggung_jawab_program` text,
	`bobot_sdm1` real DEFAULT 0,
	`bobot_sdm2` real DEFAULT 0,
	`bobot_sdm3` real DEFAULT 0,
	`bobot_sdm4` real DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE `keuangan` (
	`id` text PRIMARY KEY NOT NULL,
	`periode` text NOT NULL,
	`jumlah_pendapatan_blud` real NOT NULL
);
--> statement-breakpoint
CREATE TABLE `kinerja_pegawai` (
	`id` text PRIMARY KEY NOT NULL,
	`periode` text NOT NULL,
	`pegawai_id` text NOT NULL,
	`unit_id` text NOT NULL,
	`bobot` real DEFAULT 0,
	`jumlah_tindakan` real DEFAULT 0 NOT NULL,
	`jaspel_dokter` real DEFAULT 0,
	`jaspel_perawat` real DEFAULT 0,
	`jaspel_bidan_jaga` real DEFAULT 0,
	`jaspel_bidan_asal_bulin` real DEFAULT 0,
	`jaspel_pendamping_rujukan` real DEFAULT 0,
	`jaspel_penolong_persalinan` real DEFAULT 0,
	`jaspel_manajemen_poned` real DEFAULT 0,
	`jaspel_petugas` real DEFAULT 0,
	`jaspel_atlm` real DEFAULT 0,
	`jaspel_pengemudi` real DEFAULT 0,
	`point_pengelola_blud` real DEFAULT 0,
	`jaspel_pengelola` real DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE `pegawai` (
	`id` text PRIMARY KEY NOT NULL,
	`nip` text,
	`nama` text NOT NULL,
	`nomor_rekening` text,
	`nama_bank` text DEFAULT 'BJB',
	`npwp` text,
	`golongan` text NOT NULL,
	`jabatan` text,
	`pangkat_golongan` text,
	`jenis_ketenagaan` text NOT NULL,
	`penanggung_jawab` text,
	`tmt` text,
	`lama_masa_kerja` integer DEFAULT 0,
	`masa_kerja` integer DEFAULT 0,
	`poin_tanggung_jawab` real DEFAULT 0 NOT NULL,
	`poin_ketenagaan` real DEFAULT 0 NOT NULL,
	`poin_rangkap_tugas` real DEFAULT 0 NOT NULL,
	`poin_masa_kerja` real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pendapatan_unit` (
	`id` text PRIMARY KEY NOT NULL,
	`periode` text NOT NULL,
	`unit_id` text NOT NULL,
	`jumlah_non_kapitasi` real DEFAULT 0 NOT NULL,
	`pad_ranap` real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `unit_pelayanan` (
	`id` text PRIMARY KEY NOT NULL,
	`nama` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'admin' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);