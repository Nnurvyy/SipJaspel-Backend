CREATE TABLE IF NOT EXISTS `struktur_organisasi` (
	`id` text PRIMARY KEY NOT NULL,
	`jabatan` text NOT NULL,
	`pegawai_id` text,
	`nama_pejabat` text,
	`urutan` integer DEFAULT 0
);
--> statement-breakpoint
ALTER TABLE `kehadiran` ADD COLUMN `rangkap_tugas_adm` real DEFAULT 0;
