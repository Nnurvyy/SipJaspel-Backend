import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { getDb } from "../db";
import { kehadiran, pegawai } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { Bindings } from "../utils/types";
import { JaspelService } from "../services/jaspel.service";
import { KeuanganRepository } from "../repositories/keuangan.repository";
import { PegawaiRepository } from "../repositories/pegawai.repository";

const app = new Hono<{ Bindings: Bindings }>();

// GET all kehadiran for a periode with auto-calc and overrides
app.get("/:periode", async (c) => {
  const { periode } = c.req.param();
  const db = getDb(c.env.DB);
  const service = new JaspelService(new KeuanganRepository(db), new PegawaiRepository(db));
  
  const result = await service.calculateBobotKapitasi(periode);
  return c.json(result);
});

// PUT update kehadiran record (upsert)
const updateSchema = z.object({
  pegawaiId: z.string(),
  hariMasukKerja: z.number().optional().default(0),
  hariKerja: z.number().optional().default(0),
  rangkapTugasAdm: z.number().optional().default(0),
  
  poinTanggungJawab: z.number().nullable().optional(),
  poinKetenagaan: z.number().nullable().optional(),
  poinMasaKerja: z.number().nullable().optional(),
  jumlahPoinKapitasi: z.number().nullable().optional(),
  jumlahPoinNonKapitasi: z.number().nullable().optional(),
  bobotKapitasi: z.number().nullable().optional(),
  bobotNonKapitasi: z.number().nullable().optional(),
  prosentaseKehadiran: z.number().nullable().optional(),
  lamaMasaKerja: z.number().optional(),
});

app.put("/:periode", zValidator("json", updateSchema), async (c) => {
  const { periode } = c.req.param();
  const body = c.req.valid("json");
  const db = getDb(c.env.DB);
  
  const existing = await db.select().from(kehadiran).where(
    and(eq(kehadiran.pegawaiId, body.pegawaiId), eq(kehadiran.periode, periode))
  ).limit(1);
  
  const dataToSet = {
    hariMasukKerja: body.hariMasukKerja,
    hariKerja: body.hariKerja,
    rangkapTugasAdm: body.rangkapTugasAdm,
    poinTanggungJawab: body.poinTanggungJawab ?? null,
    poinKetenagaan: body.poinKetenagaan ?? null,
    poinMasaKerja: body.poinMasaKerja ?? null,
    jumlahPoinKapitasi: body.jumlahPoinKapitasi ?? null,
    jumlahPoinNonKapitasi: body.jumlahPoinNonKapitasi ?? null,
    bobotKapitasi: body.bobotKapitasi ?? null,
    bobotNonKapitasi: body.bobotNonKapitasi ?? null,
    prosentaseKehadiran: body.prosentaseKehadiran ?? null,
  };

  // If lamaMasaKerja is provided, update the pegawai table
  if (body.lamaMasaKerja !== undefined) {
    await db.update(pegawai).set({ lamaMasaKerja: body.lamaMasaKerja }).where(eq(pegawai.id, body.pegawaiId));
  }

  if (existing.length > 0) {
    await db.update(kehadiran).set(dataToSet).where(eq(kehadiran.id, existing[0].id));
  } else {
    await db.insert(kehadiran).values({
      id: "keh_" + body.pegawaiId + "_" + periode,
      periode,
      pegawaiId: body.pegawaiId,
      ...dataToSet
    });
  }
  
  return c.json({ success: true });
});

export default app;
