import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { getDb } from "../db";
import {
  kinerjaPegawai,
  kinerjaTindakanPeran,
  pegawai,
  unitPelayanan,
  bobotStaff,
} from "../db/schema";
import { eq, and, asc } from "drizzle-orm";
import { Bindings } from "../utils/types";

const app = new Hono<{ Bindings: Bindings }>();

// Helper: Hitung poin jabatan unit
function getPoinJabatanUnit(jabatan: string | null | undefined): number {
  if (!jabatan) return 0;
  if (jabatan === "PJ") return 3;
  if (jabatan === "Koordinator" || jabatan === "Koordinator Pelayanan") return 2;
  if (jabatan === "Tidak memiliki jabatan struktural") return 1;
  return 0;
}

// Helper: Hitung poin risiko
function getPoinRisiko(risiko: string | null | undefined): number {
  if (!risiko) return 0;
  if (risiko === "Sangat Tinggi") return 5;
  if (risiko === "Tinggi") return 4;
  if (risiko === "Sedang") return 3;
  if (risiko === "Rendah") return 2;
  if (risiko === "Sangat Rendah") return 1;
  return 0;
}

// GET /api/unit-kinerja/:unitKey/:periode
// Kembalikan semua pegawai + kinerja tindakan per peran (normalized) + bobot dari master bobot_staff
app.get("/:unitKey/:periode", async (c) => {
  const { unitKey } = c.req.param();
  const periode = "2026-01";
  const db = getDb(c.env.DB);

  // Cari unit
  const allUnits = await db.select().from(unitPelayanan);
  const unit = allUnits.find(
    (u) =>
      u.id === `unit_${unitKey}` ||
      u.id === unitKey ||
      u.nama.toLowerCase().replace(/\s+/g, "-") === unitKey
  );

  const listPegawai = await db.select().from(pegawai).orderBy(asc(pegawai.urutan));
  const listBobot = await db.select().from(bobotStaff);

  let kinerjaPegawaiList: any[] = [];
  let tindakanPeranList: any[] = [];

  if (unit) {
    kinerjaPegawaiList = await db
      .select()
      .from(kinerjaPegawai)
      .where(
        and(
          eq(kinerjaPegawai.periode, periode),
          eq(kinerjaPegawai.unitId, unit.id)
        )
      );

    // Ambil semua tindakan per peran untuk unit + periode ini
    tindakanPeranList = await db
      .select()
      .from(kinerjaTindakanPeran)
      .where(eq(kinerjaTindakanPeran.unitId, unit.id));
  }

  const result = listPegawai.map((p, idx) => {
    const kinerja = kinerjaPegawaiList.find((k) => k.pegawaiId === p.id);
    const bobotData = listBobot.find((b) => b.pegawaiId === p.id);
    const poinJabatan = getPoinJabatanUnit(bobotData?.jabatanUnit);
    const poinRisiko = getPoinRisiko(bobotData?.risiko);
    const bobot = poinJabatan + poinRisiko;

    // Ambil tindakan per peran & adjusted untuk pegawai + unit ini
    const tindakanMap: Record<string, number> = {};
    const adjustedMap: Record<string, number | null> = {};
    if (kinerja) {
      const tindakanPegawai = tindakanPeranList.filter(
        (t) => t.kinerjaPegawaiId === kinerja.id
      );
      tindakanPegawai.forEach((t) => {
        tindakanMap[t.peranKey] = t.jumlahTindakan;
        adjustedMap[t.peranKey] = t.adjusted;
      });
    }

    return {
      id: kinerja?.id || null,
      no: idx + 1,
      pegawaiId: p.id,
      nama: p.nama,
      golongan: p.golongan,
      jenisKetenagaan: p.jenisKetenagaan,
      bobot,
      tindakanPeran: tindakanMap, // { dokter: 12, perawat: 5, ... }
      adjustedPeran: adjustedMap,  // { dokter: 120, ... }
    };
  });

  return c.json({
    pegawai: result,
    unitId: unit?.id || null,
    unitNama: unit?.nama || unitKey,
  });
});

// PUT /api/unit-kinerja/:periode — Upsert kinerja + tindakan per peran
const updateSchema = z.object({
  pegawaiId: z.string(),
  unitId: z.string(),
  // tindakanPeran: map peranKey -> jumlahTindakan
  tindakanPeran: z.record(z.string(), z.coerce.number()).optional().default({}),
  // adjustedPeran: map peranKey -> manual adjusted value
  adjustedPeran: z.record(z.string(), z.coerce.number().nullable()).optional().default({}),
});

app.put("/:periode", zValidator("json", updateSchema), async (c) => {
  const periode = "2026-01";
  const body = c.req.valid("json");
  const db = getDb(c.env.DB);

  // Upsert kinerja_pegawai (record induk)
  const existing = await db
    .select()
    .from(kinerjaPegawai)
    .where(
      and(
        eq(kinerjaPegawai.pegawaiId, body.pegawaiId),
        eq(kinerjaPegawai.periode, periode),
        eq(kinerjaPegawai.unitId, body.unitId)
      )
    )
    .limit(1);

  let kinerjaId: string;
  if (existing.length > 0) {
    kinerjaId = existing[0].id;
    await db
      .update(kinerjaPegawai)
      .set({ jumlahTindakan: 0 }) // legacy field, keep at 0
      .where(eq(kinerjaPegawai.id, kinerjaId));
  } else {
    kinerjaId = `kinerja_${body.pegawaiId}_${body.unitId}_${periode}`;
    await db.insert(kinerjaPegawai).values({
      id: kinerjaId,
      periode,
      pegawaiId: body.pegawaiId,
      unitId: body.unitId,
      jumlahTindakan: 0,
    });
  }

  // Upsert tindakan per peran (normalized)
  for (const [peranKey, jumlah] of Object.entries(body.tindakanPeran)) {
    const existingTindakan = await db
      .select()
      .from(kinerjaTindakanPeran)
      .where(
        and(
          eq(kinerjaTindakanPeran.kinerjaPegawaiId, kinerjaId),
          eq(kinerjaTindakanPeran.unitId, body.unitId),
          eq(kinerjaTindakanPeran.peranKey, peranKey)
        )
      )
      .limit(1);

    const adjValue = body.adjustedPeran[peranKey] !== undefined ? body.adjustedPeran[peranKey] : null;

    if (existingTindakan.length > 0) {
      await db
        .update(kinerjaTindakanPeran)
        .set({ jumlahTindakan: jumlah, adjusted: adjValue })
        .where(eq(kinerjaTindakanPeran.id, existingTindakan[0].id));
    } else {
      await db.insert(kinerjaTindakanPeran).values({
        id: `tindakan_${kinerjaId}_${peranKey}`,
        kinerjaPegawaiId: kinerjaId,
        unitId: body.unitId,
        peranKey,
        jumlahTindakan: jumlah,
        adjusted: adjValue,
      });
    }
  }

  return c.json({ success: true });
});

export default app;
