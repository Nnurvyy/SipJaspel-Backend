import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("admin"),
});

export const pegawai = sqliteTable("pegawai", {
  id: text("id").primaryKey(),
  nip: text("nip"),
  nama: text("nama").notNull(),
  nomorRekening: text("nomor_rekening"),
  namaBank: text("nama_bank").default("BJB"),
  npwp: text("npwp"),
  golongan: text("golongan").notNull(), // 'IV', 'III', 'II', 'Non-PNS' dsb
  jabatan: text("jabatan"),
  pangkatGolongan: text("pangkat_golongan"),
  jenisKetenagaan: text("jenis_ketenagaan").notNull(),
  penanggungJawab: text("penanggung_jawab"),
  tmt: text("tmt"),
  lamaMasaKerja: integer("lama_masa_kerja").default(0),
  masaKerja: integer("masa_kerja").default(0),
  
  poinTanggungJawab: real("poin_tanggung_jawab").notNull().default(0),
  poinKetenagaan: real("poin_ketenagaan").notNull().default(0),
  poinRangkapTugas: real("poin_rangkap_tugas").notNull().default(0),
  poinMasaKerja: real("poin_masa_kerja").notNull().default(0),
});

export const unitPelayanan = sqliteTable("unit_pelayanan", {
  id: text("id").primaryKey(),
  nama: text("nama").notNull(), 
});

export const keuangan = sqliteTable("keuangan", {
  id: text("id").primaryKey(),
  periode: text("periode").notNull(), // Format 'YYYY-MM'
  jumlahPendapatanBlud: real("jumlah_pendapatan_blud").notNull(),
});

export const kehadiran = sqliteTable("kehadiran", {
  id: text("id").primaryKey(),
  periode: text("periode").notNull(),
  pegawaiId: text("pegawai_id").notNull(),
  hariMasukKerja: integer("hari_masuk_kerja").notNull().default(0),
  hariKerja: integer("hari_kerja").notNull().default(0),
  tanggungJawabProgram: text("tanggung_jawab_program"),
  rangkapTugasAdm: real("rangkap_tugas_adm").default(0),
  bobotSdm1: real("bobot_sdm1").default(0),
  bobotSdm2: real("bobot_sdm2").default(0),
  bobotSdm3: real("bobot_sdm3").default(0),
  bobotSdm4: real("bobot_sdm4").default(0),
});

export const pendapatanUnit = sqliteTable("pendapatan_unit", {
  id: text("id").primaryKey(),
  periode: text("periode").notNull(),
  unitId: text("unit_id").notNull(),
  jumlahNonKapitasi: real("jumlah_non_kapitasi").notNull().default(0),
  padRanap: real("pad_ranap").notNull().default(0),
});

export const kinerjaPegawai = sqliteTable("kinerja_pegawai", {
  id: text("id").primaryKey(),
  periode: text("periode").notNull(),
  pegawaiId: text("pegawai_id").notNull(),
  unitId: text("unit_id").notNull(),
  
  bobot: real("bobot").default(0),
  jumlahTindakan: real("jumlah_tindakan").notNull().default(0),
  
  jaspelDokter: real("jaspel_dokter").default(0),
  jaspelPerawat: real("jaspel_perawat").default(0),
  jaspelBidanJaga: real("jaspel_bidan_jaga").default(0),
  jaspelBidanAsalBulin: real("jaspel_bidan_asal_bulin").default(0),
  jaspelPendampingRujukan: real("jaspel_pendamping_rujukan").default(0),
  jaspelPenolongPersalinan: real("jaspel_penolong_persalinan").default(0),
  jaspelManajemenPoned: real("jaspel_manajemen_poned").default(0),
  jaspelPetugas: real("jaspel_petugas").default(0),
  jaspelAtlm: real("jaspel_atlm").default(0),
  jaspelPengemudi: real("jaspel_pengemudi").default(0),
  
  pointPengelolaBlud: real("point_pengelola_blud").default(0),
  jaspelPengelola: real("jaspel_pengelola").default(0),
});

export const strukturOrganisasi = sqliteTable("struktur_organisasi", {
  id: text("id").primaryKey(),
  jabatan: text("jabatan").notNull(),
  pegawaiId: text("pegawai_id"), // FK ke pegawai
  namaPejabat: text("nama_pejabat"), // fallback jika tidak pilih dari pegawai
  urutan: integer("urutan").default(0),
});
