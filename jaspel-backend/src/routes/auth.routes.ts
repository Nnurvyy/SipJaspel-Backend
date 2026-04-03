import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { getDb } from "../db";
import { AuthRepository } from "../repositories/auth.repository";
import { AuthService } from "../services/auth.service";
import { Bindings } from "../utils/types";
import { users, unitPelayanan } from "../db/schema";
import { eq } from "drizzle-orm";

const app = new Hono<{ Bindings: Bindings }>();

const loginSchema = z.object({
  username: z.string(),
  password: z.string() // in real app, hash it before comparing. We compare plain/hash as is here due to manual db entry.
});

app.post("/login", zValidator("json", loginSchema), async (c) => {
  const { username, password } = c.req.valid("json");
  
  const db = getDb(c.env.DB);
  const repo = new AuthRepository(db);
  const service = new AuthService(repo);

  // Fallback secret for dev
  const secret = c.env.JWT_SECRET || 'jaspel-super-secret';
  // Hash password to match seed
  const enc = new TextEncoder();
  const data = enc.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const inputHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  const token = await service.login(username, inputHash, secret);

  if (!token) {
    return c.json({ error: "Invalid username or password" }, 401);
  }

  return c.json({ token });
});

app.post("/seed", async (c) => {
  const db = getDb(c.env.DB);
  
  // Create test user evaevianti
  const user = await db.select().from(users).where(eq(users.username, "evaevianti"));
  if (user.length === 0) {
    const enc = new TextEncoder();
    const data = enc.encode("*Eva6940#");
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    await db.insert(users).values({ id: "u1_seed", username: "evaevianti", passwordHash, role: "admin" });
  }

  // Define Unit Pelayanan
  const unitDefs = [
    { key: "ugd", nama: "UGD" },
    { key: "onedaycare", nama: "One Day Care" },
    { key: "poned", nama: "PONED" },
    { key: "konseling", nama: "Konseling" },
    { key: "haji", nama: "Haji" },
    { key: "kia", nama: "KIA" },
    { key: "usg", nama: "USG" },
    { key: "kb", nama: "KB" },
    { key: "lab", nama: "LAB" },
    { key: "poliumum", nama: "Poli Umum" },
    { key: "gigi", nama: "Gigi" },
    { key: "ambulans", nama: "Ambulans" },
    // Extra Non-Kapitasi units per Excel reference
    { key: "persalinan", nama: "Persalinan & Pasca Persalinan" },
    { key: "prarujukan", nama: "Pra Rujukan / PONED" },
    { key: "rawatinap", nama: "Rawat Inap" },
    { key: "anc", nama: "ANC" },
    { key: "rawatjalan", nama: "Rawat Jalan" },
    { key: "tindakanmedis", nama: "Tindakan Medis Rawat Inap" },
    { key: "gigimulut", nama: "Gigi dan Mulut" },
    { key: "kebidanan", nama: "Kebidanan" },
    { key: "tindakanrawat", nama: "Tindakan Rawat Inap" },
  ];
  
  const existingUnits = await db.select().from(unitPelayanan);
  const existingNames = new Set(existingUnits.map(u => u.nama));
  const unitIdMap: Record<string, string> = {};
  
  for (const ud of unitDefs) {
    const unitId = `unit_${ud.key}`;
    if (!existingNames.has(ud.nama)) {
      await db.insert(unitPelayanan).values({ id: unitId, nama: ud.nama });
    }
    // also fill from existing
    const found = existingUnits.find(u => u.nama === ud.nama);
    unitIdMap[ud.key] = found ? found.id : unitId;
  }

  // Seed Keuangan (total pendapatan BLUD) for Jan 2026
  const { keuangan, pendapatanUnit, strukturOrganisasi } = await import("../db/schema");
  const existingKeu = await db.select().from(keuangan).where(eq(keuangan.periode, "2026-01"));
  if (existingKeu.length === 0) {
    await db.insert(keuangan).values({
      id: "keu_2026-01",
      periode: "2026-01",
      jumlahPendapatanBlud: 21149000, // sesuai Total PAD di gambar Excel
    });
  }

  // Seed pendapatan per unit (Non Kapitasi + PAD Murni) per Excel
  const unitPendapatanSeed = [
    // Non Kapitasi
    { key: "rawatinap",    nonKap: 1300000,  padRanap: 0 },
    { key: "anc",          nonKap: 2200000,  padRanap: 0 },
    { key: "usg",          nonKap: 3780000,  padRanap: 0 },
    // PAD Murni
    { key: "ugd",          nonKap: 0, padRanap: 1494000 },
    { key: "rawatjalan",   nonKap: 0, padRanap: 2985000 },
    { key: "tindakanmedis",nonKap: 0, padRanap: 0 },
    { key: "gigimulut",    nonKap: 0, padRanap: 1665000 },
    { key: "kebidanan",    nonKap: 0, padRanap: 500000 },
    { key: "kia",          nonKap: 0, padRanap: 1070000 },
    { key: "tindakanrawat",nonKap: 0, padRanap: 0 },
    { key: "lab",          nonKap: 0, padRanap: 5755000 },
    { key: "ambulans",     nonKap: 0, padRanap: 0 },
    { key: "usg",          nonKap: 0, padRanap: 400000 },
    { key: "haji",         nonKap: 0, padRanap: 0 },
    { key: "konseling",    nonKap: 0, padRanap: 0 },
  ];
  
  const existingPendapatan = await db.select().from(pendapatanUnit).where(eq(pendapatanUnit.periode, "2026-01"));
  
  if (existingPendapatan.length === 0) {
    const seenKeys = new Set<string>();
    for (const up of unitPendapatanSeed) {
      const unitId = unitIdMap[up.key];
      if (!unitId || seenKeys.has(up.key)) continue;
      seenKeys.add(up.key);
      if (up.nonKap > 0 || up.padRanap > 0) {
        await db.insert(pendapatanUnit).values({
          id: `pu_${up.key}_2026-01`,
          periode: "2026-01",
          unitId,
          jumlahNonKapitasi: up.nonKap,
          padRanap: up.padRanap,
        });
      }
    }
  }

  // Seed Struktur Organisasi default
  const existingStruktur = await db.select().from(strukturOrganisasi);
  if (existingStruktur.length === 0) {
    const defaultStruktur = [
      { id: "s1", jabatan: "Kepala Puskesmas", urutan: 1 },
      { id: "s2", jabatan: "Kasubag Tata Usaha", urutan: 2 },
      { id: "s3", jabatan: "PJ UKM Esensial & Perkesmas", urutan: 3 },
      { id: "s4", jabatan: "PJ UKM Pengembangan", urutan: 4 },
      { id: "s5", jabatan: "PJ UKP, Kefarmasian & Lab", urutan: 5 },
      { id: "s6", jabatan: "PJ Jaringan & Jejaring", urutan: 6 },
      { id: "s7", jabatan: "PJ Bangunan, Prasarana & Alat", urutan: 7 },
      { id: "s8", jabatan: "PJ Mutu", urutan: 8 },
    ];
    for (const s of defaultStruktur) {
      await db.insert(strukturOrganisasi).values(s);
    }
  }

  return c.json({ message: "Seed successful!" });
});

export default app;

