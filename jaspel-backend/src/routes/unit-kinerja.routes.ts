import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { getDb } from "../db";
import { kinerjaPegawai, pegawai, unitPelayanan, pendapatanUnit } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { Bindings } from "../utils/types";

const app = new Hono<{ Bindings: Bindings }>();

// GET kinerja for a unit in a periode, merged with pegawai data
// Route: GET /api/unit-kinerja/:unitKey/:periode
app.get("/:unitKey/:periode", async (c) => {
  const { unitKey, periode } = c.req.param();
  const db = getDb(c.env.DB);

  // Find unit
  const allUnits = await db.select().from(unitPelayanan);
  const unit = allUnits.find(u => u.id === `unit_${unitKey}` || u.id === unitKey || u.nama.toLowerCase().replace(/\s+/g, '-') === unitKey);

  const listPegawai = await db.select().from(pegawai);
  
  let kinerjaPegawaiList: any[] = [];
  let padData = { nonKap: 0, padMurni: 0 };

  if (unit) {
    kinerjaPegawaiList = await db.select().from(kinerjaPegawai)
      .where(and(eq(kinerjaPegawai.periode, periode), eq(kinerjaPegawai.unitId, unit.id)));
    
    const pendapatan = await db.select().from(pendapatanUnit)
      .where(and(eq(pendapatanUnit.periode, periode), eq(pendapatanUnit.unitId, unit.id)));
    if (pendapatan.length > 0) {
      padData = { nonKap: pendapatan[0].jumlahNonKapitasi, padMurni: pendapatan[0].padRanap };
    }
  }

  const result = listPegawai.map((p, idx) => {
    const kinerja = kinerjaPegawaiList.find(k => k.pegawaiId === p.id);
    return {
      id: kinerja?.id || null,
      no: idx + 1,
      pegawaiId: p.id,
      nama: p.nama,
      golongan: p.golongan,
      jenisKetenagaan: p.jenisKetenagaan,
      bobot: kinerja?.bobot ?? 0,
      jumlahTindakanDokter: (kinerja as any)?.jumlahTindakanDokter ?? 0,
      jumlahTindakanPerawat: (kinerja as any)?.jumlahTindakanPerawat ?? 0,
      jumlahKonsultasiDokter: (kinerja as any)?.jumlahKonsultasiDokter ?? 0,
      jumlahJaga: (kinerja as any)?.jumlahJaga ?? 0,
      jumlahBulin: (kinerja as any)?.jumlahBulin ?? 0,
      jumlahRujukan: (kinerja as any)?.jumlahRujukan ?? 0,
      jumlahPersalinan: (kinerja as any)?.jumlahPersalinan ?? 0,
      jumlahManajemenPoned: (kinerja as any)?.jumlahManajemenPoned ?? 0,
      jumlahKonsultasiPetugas: (kinerja as any)?.jumlahKonsultasiPetugas ?? 0,
      pointPengelolaBlud: kinerja?.pointPengelolaBlud ?? 0,
      jaspelDokter: kinerja?.jaspelDokter ?? 0,
      jaspelPerawat: kinerja?.jaspelPerawat ?? 0,
      jaspelBidanJaga: kinerja?.jaspelBidanJaga ?? 0,
      jaspelBidanAsalBulin: kinerja?.jaspelBidanAsalBulin ?? 0,
      jaspelPendampingRujukan: kinerja?.jaspelPendampingRujukan ?? 0,
      jaspelPenolongPersalinan: kinerja?.jaspelPenolongPersalinan ?? 0,
      jaspelManajemenPoned: kinerja?.jaspelManajemenPoned ?? 0,
      jaspelPetugas: kinerja?.jaspelPetugas ?? 0,
      jaspelAtlm: kinerja?.jaspelAtlm ?? 0,
      jaspelPengelola: kinerja?.jaspelPengelola ?? 0,
      totalJaspelNonKap: 0, // calculated on frontend
      totalJaspelPadMurni: 0,
      totalJaspel: 0,
    };
  });

  return c.json({ pegawai: result, padData, unitId: unit?.id || null, unitNama: unit?.nama || unitKey });
});

// PUT upsert kinerja per pegawai per unit
const updateSchema = z.object({
  pegawaiId: z.string(),
  unitId: z.string(),
  bobot: z.coerce.number().optional(),
  jumlahTindakanDokter: z.coerce.number().optional(),
  jumlahTindakanPerawat: z.coerce.number().optional(),
  jumlahKonsultasiDokter: z.coerce.number().optional(),
  jumlahJaga: z.coerce.number().optional(),
  jumlahBulin: z.coerce.number().optional(),
  jumlahRujukan: z.coerce.number().optional(),
  jumlahPersalinan: z.coerce.number().optional(),
  jumlahManajemenPoned: z.coerce.number().optional(),
  jumlahKonsultasiPetugas: z.coerce.number().optional(),
  pointPengelolaBlud: z.coerce.number().optional(),
  jaspelDokter: z.coerce.number().optional(),
  jaspelPerawat: z.coerce.number().optional(),
  jaspelBidanJaga: z.coerce.number().optional(),
  jaspelBidanAsalBulin: z.coerce.number().optional(),
  jaspelPendampingRujukan: z.coerce.number().optional(),
  jaspelPenolongPersalinan: z.coerce.number().optional(),
  jaspelManajemenPoned: z.coerce.number().optional(),
  jaspelPetugas: z.coerce.number().optional(),
  jaspelAtlm: z.coerce.number().optional(),
  jaspelPengelola: z.coerce.number().optional(),
});

app.put("/:periode", zValidator("json", updateSchema), async (c) => {
  const { periode } = c.req.param();
  const body = c.req.valid("json");
  const db = getDb(c.env.DB);

  const existing = await db.select().from(kinerjaPegawai)
    .where(and(
      eq(kinerjaPegawai.pegawaiId, body.pegawaiId),
      eq(kinerjaPegawai.periode, periode),
      eq(kinerjaPegawai.unitId, body.unitId)
    )).limit(1);

  const values = {
    bobot: body.bobot ?? 0,
    jumlahTindakan: (body.jumlahTindakanDokter ?? 0) + (body.jumlahTindakanPerawat ?? 0),
    jaspelDokter: body.jaspelDokter ?? 0,
    jaspelPerawat: body.jaspelPerawat ?? 0,
    jaspelBidanJaga: body.jaspelBidanJaga ?? 0,
    jaspelBidanAsalBulin: body.jaspelBidanAsalBulin ?? 0,
    jaspelPendampingRujukan: body.jaspelPendampingRujukan ?? 0,
    jaspelPenolongPersalinan: body.jaspelPenolongPersalinan ?? 0,
    jaspelManajemenPoned: body.jaspelManajemenPoned ?? 0,
    jaspelPetugas: body.jaspelPetugas ?? 0,
    jaspelAtlm: body.jaspelAtlm ?? 0,
    jaspelPengelola: body.jaspelPengelola ?? 0,
    pointPengelolaBlud: body.pointPengelolaBlud ?? 0,
  };

  if (existing.length > 0) {
    await db.update(kinerjaPegawai).set(values).where(eq(kinerjaPegawai.id, existing[0].id));
  } else {
    await db.insert(kinerjaPegawai).values({
      id: `kinerja_${body.pegawaiId}_${body.unitId}_${periode}`,
      periode,
      pegawaiId: body.pegawaiId,
      unitId: body.unitId,
      ...values,
    });
  }

  return c.json({ success: true });
});

export default app;
