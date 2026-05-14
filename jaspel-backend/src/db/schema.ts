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
  pphPersen: real("pph_persen"),
  urutan: integer("urutan").default(0),
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
  
  // Override Columns
  poinTanggungJawab: integer("poin_tanggung_jawab"), // 0/10/20/30
  poinKetenagaan: real("poin_ketenagaan"),
  poinMasaKerja: real("poin_masa_kerja"),
  jumlahPoinKapitasi: real("jumlah_poin_kapitasi"),
  jumlahPoinNonKapitasi: real("jumlah_poin_non_kapitasi"),
  bobotKapitasi: real("bobot_kapitasi"),
  bobotNonKapitasi: real("bobot_non_kapitasi"),
  prosentaseKehadiran: real("prosentase_kehadiran"),

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
  poin: real("poin").notNull().default(0),
  urutan: integer("urutan").default(0),
});

// Tabel Master Bobot Staff Puskesmas
export const bobotStaff = sqliteTable("bobot_staff", {
  id: text("id").primaryKey(),
  pegawaiId: text("pegawai_id").notNull().unique(),
  jabatanUnit: text("jabatan_unit"),      // 'PJ' | 'Koordinator' | 'Tidak memiliki jabatan struktural'
  risiko: text("risiko"),                 // 'Sangat Tinggi' | 'Tinggi' | 'Sedang' | 'Rendah' | 'Sangat Rendah'
  unitKerja: text("unit_kerja"),
  status: text("status"),
  // bobot = poin_jabatan_unit + poin_risiko — dihitung di aplikasi, tidak disimpan
});

// Tabel Jumlah Tindakan per Peran (Normalized / Vertical — tidak hardcode kolom per peran)
export const kinerjaTindakanPeran = sqliteTable("kinerja_tindakan_peran", {
  id: text("id").primaryKey(),
  kinerjaPegawaiId: text("kinerja_pegawai_id").notNull(),
  unitId: text("unit_id").notNull(),
  peranKey: text("peran_key").notNull(),    // e.g. 'dokter', 'perawat', 'bidan_jaga', 'pengemudi'
  jumlahTindakan: real("jumlah_tindakan").notNull().default(0),
  adjusted: real("adjusted"),              // Nilai (Bobot * Jumlah) atau manual override
});

// Tabel Pagu Dana per Unit per Peran per Periode
export const paguUnitPeran = sqliteTable("pagu_unit_peran", {
  id: text("id").primaryKey(),
  unitId: text("unit_id").notNull(),
  periode: text("periode").notNull(),      // Format 'YYYY-MM'
  peranKey: text("peran_key").notNull(),   // e.g. 'dokter', 'perawat', 'pengelola'
  paguNonKap: real("pagu_non_kap").notNull().default(0),
  paguPadMurni: real("pagu_pad_murni").notNull().default(0),
});

// Halaman 1 CRUD Detail
export const keuanganDetail = sqliteTable("keuangan_detail", {
  id: text("id").primaryKey(),
  periode: text("periode").notNull(),
  jenisPendapatan: text("jenis_pendapatan"),
  namaLayanan: text("nama_layanan"),
  jumlahBlud: real("jumlah_blud").notNull().default(0),
  jaspel60: real("jaspel_60").notNull().default(0),
  operasional40: real("operasional_40").notNull().default(0),
  tidakLangsung: real("tidak_langsung").notNull().default(0),
  langsung: real("langsung").notNull().default(0),
});

// Penyimpanan Override untuk Halaman Print & Rekap
export const jaspelDistribusi = sqliteTable("jaspel_distribusi", {
  id: text("id").primaryKey(),
  periode: text("periode").notNull(),
  pegawaiId: text("pegawai_id").notNull(),
  
  // Print 60% Non Kapitasi
  print60NonKapJumlah: real("p60_nk_jumlah"),
  print60NonKapPphPersen: real("p60_nk_pph_persen"),
  print60NonKapPphNominal: real("p60_nk_pph_nominal"),
  print60NonKapBersih: real("p60_nk_bersih"),

  // Print 60% PAD Murni
  print60PadJumlah: real("p60_pad_jumlah"),
  print60PadPphPersen: real("p60_pad_pph_persen"),
  print60PadPphNominal: real("p60_pad_pph_nominal"),
  print60PadBersih: real("p60_pad_bersih"),

  // Print 40% Non Kapitasi
  print40NonKapJumlah: real("p40_nk_jumlah"),
  print40NonKapPphNominal: real("p40_nk_pph_nominal"),
  print40NonKapBersih: real("p40_nk_bersih"),

  // Print 40% PAD Murni
  print40PadJumlah: real("p40_pad_jumlah"),
  print40PadPphNominal: real("p40_pad_pph_nominal"),
  print40PadBersih: real("p40_pad_bersih"),

  // Print Lain-lain (TCM)
  print40LainJumlah: real("p40_lain_jumlah"),
  print40LainPphNominal: real("p40_lain_pph_nominal"),
  print40LainBersih: real("p40_lain_bersih"),


  // Rekap Final
  rekapTotalJaspel: real("rekap_total_jaspel"),
  rekapPphPersen: real("rekap_pph_persen"),
  rekapPphNominal: real("rekap_pph_nominal"),
  rekapTakeHomePay: real("rekap_take_home_pay"),
});

// Tabel khusus TCM (Lain-lain)
export const tcmStaff = sqliteTable("tcm_staff", {
  id: text("id").primaryKey(),
  periode: text("periode").notNull(),
  pegawaiId: text("pegawai_id").notNull(),
  persentase: real("persentase").notNull().default(0),
});


