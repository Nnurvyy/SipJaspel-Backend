import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { getDb } from "../db";
import { kehadiran, pegawai } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { Bindings } from "../utils/types";

const app = new Hono<{ Bindings: Bindings }>();

// GET all kehadiran for a periode with pegawai data merged
app.get("/:periode", async (c) => {
  const { periode } = c.req.param();
  const db = getDb(c.env.DB);
  const listPegawai = await db.select().from(pegawai);
  const listKehadiran = await db.select().from(kehadiran).where(eq(kehadiran.periode, periode));
  
  const result = listPegawai.map((p, idx) => {
    const keh = listKehadiran.find(k => k.pegawaiId === p.id);
    return {
      id: keh?.id || null,
      urutan: idx + 1,
      pegawaiId: p.id,
      nama: p.nama,
      golongan: p.golongan,
      jenisKetenagaan: p.jenisKetenagaan,
      lamaMasaKerja: p.lamaMasaKerja,
      masaKerja: p.masaKerja,
      poinTanggungJawab: p.poinTanggungJawab,
      poinKetenagaan: p.poinKetenagaan,
      poinRangkapTugas: p.poinRangkapTugas,
      poinMasaKerja: p.poinMasaKerja,
      // from kehadiran table
      hariMasukKerja: keh?.hariMasukKerja ?? 0,
      hariKerja: keh?.hariKerja ?? 0,
      tanggungJawabProgram: keh?.tanggungJawabProgram ?? null,
      rangkapTugasAdm: keh?.rangkapTugasAdm ?? 0,
      // computed
      prosentaseKehadiran: keh && keh.hariKerja > 0 ? keh.hariMasukKerja / keh.hariKerja : 0,
      jumlahPoinKapitasi: p.poinTanggungJawab + p.poinKetenagaan + p.poinRangkapTugas + p.poinMasaKerja,
    };
  });
  
  return c.json(result);
});

// PUT update kehadiran record (upsert)
const updateSchema = z.object({
  pegawaiId: z.string(),
  hariMasukKerja: z.number().optional().default(0),
  hariKerja: z.number().optional().default(0),
  tanggungJawabProgram: z.string().optional().nullable(),
  rangkapTugasAdm: z.number().optional().default(0),
});

app.put("/:periode", zValidator("json", updateSchema), async (c) => {
  const { periode } = c.req.param();
  const body = c.req.valid("json");
  const db = getDb(c.env.DB);
  
  const existing = await db.select().from(kehadiran).where(
    and(eq(kehadiran.pegawaiId, body.pegawaiId), eq(kehadiran.periode, periode))
  ).limit(1);
  
  if (existing.length > 0) {
    await db.update(kehadiran).set({
      hariMasukKerja: body.hariMasukKerja,
      hariKerja: body.hariKerja,
      tanggungJawabProgram: body.tanggungJawabProgram || null,
      rangkapTugasAdm: body.rangkapTugasAdm,
    }).where(eq(kehadiran.id, existing[0].id));
  } else {
    await db.insert(kehadiran).values({
      id: "keh_" + body.pegawaiId + "_" + periode,
      periode,
      pegawaiId: body.pegawaiId,
      hariMasukKerja: body.hariMasukKerja,
      hariKerja: body.hariKerja,
      tanggungJawabProgram: body.tanggungJawabProgram || null,
      rangkapTugasAdm: body.rangkapTugasAdm,
    });
  }
  
  return c.json({ success: true });
});

export default app;
