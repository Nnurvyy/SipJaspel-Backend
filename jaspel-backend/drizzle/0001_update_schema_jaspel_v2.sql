CREATE TABLE `bobot_staff` (
	`id` text PRIMARY KEY NOT NULL,
	`pegawai_id` text NOT NULL,
	`jabatan_unit` text,
	`risiko` text,
	`unit_kerja` text,
	`status` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bobot_staff_pegawai_id_unique` ON `bobot_staff` (`pegawai_id`);--> statement-breakpoint
CREATE TABLE `jaspel_distribusi` (
	`id` text PRIMARY KEY NOT NULL,
	`periode` text NOT NULL,
	`pegawai_id` text NOT NULL,
	`p60_nk_jumlah` real,
	`p60_nk_pph_persen` real,
	`p60_nk_pph_nominal` real,
	`p60_nk_bersih` real,
	`p60_pad_jumlah` real,
	`p60_pad_pph_persen` real,
	`p60_pad_pph_nominal` real,
	`p60_pad_bersih` real,
	`p40_nk_jumlah` real,
	`p40_nk_pph_nominal` real,
	`p40_nk_bersih` real,
	`p40_pad_jumlah` real,
	`p40_pad_pph_nominal` real,
	`p40_pad_bersih` real,
	`rekap_total_jaspel` real,
	`rekap_pph_persen` real,
	`rekap_pph_nominal` real,
	`rekap_take_home_pay` real
);
--> statement-breakpoint
CREATE TABLE `keuangan_detail` (
	`id` text PRIMARY KEY NOT NULL,
	`periode` text NOT NULL,
	`jenis_pendapatan` text,
	`nama_layanan` text,
	`jumlah_blud` real DEFAULT 0 NOT NULL,
	`jaspel_60` real DEFAULT 0 NOT NULL,
	`operasional_40` real DEFAULT 0 NOT NULL,
	`tidak_langsung` real DEFAULT 0 NOT NULL,
	`langsung` real DEFAULT 0 NOT NULL
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
--> statement-breakpoint
ALTER TABLE `kehadiran` ADD `poin_tanggung_jawab` integer;--> statement-breakpoint
ALTER TABLE `kehadiran` ADD `poin_ketenagaan` real;--> statement-breakpoint
ALTER TABLE `kehadiran` ADD `poin_masa_kerja` real;--> statement-breakpoint
ALTER TABLE `kehadiran` ADD `jumlah_poin_kapitasi` real;--> statement-breakpoint
ALTER TABLE `kehadiran` ADD `jumlah_poin_non_kapitasi` real;--> statement-breakpoint
ALTER TABLE `kehadiran` ADD `bobot_kapitasi` real;--> statement-breakpoint
ALTER TABLE `kehadiran` ADD `bobot_non_kapitasi` real;--> statement-breakpoint
ALTER TABLE `kehadiran` ADD `prosentase_kehadiran` real;--> statement-breakpoint
ALTER TABLE `pegawai` ADD `pph_persen` real;