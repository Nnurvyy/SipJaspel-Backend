import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { getDb } from "../db";
import { jaspelDistribusi } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { Bindings } from "../utils/types";
import { JaspelService } from "../services/jaspel.service";
import { KeuanganRepository } from "../repositories/keuangan.repository";
import { PegawaiRepository } from "../repositories/pegawai.repository";

const app = new Hono<{ Bindings: Bindings }>();

// GET reports
app.get("/print-60/:periode", async (c) => {
  const periode = "2026-01";
  const db = getDb(c.env.DB);
  const service = new JaspelService(new KeuanganRepository(db), new PegawaiRepository(db));
  return c.json(await service.calculatePrint60TidakLangsung(periode));
});

app.get("/print-40/:periode", async (c) => {
  const periode = "2026-01";
  const db = getDb(c.env.DB);
  const service = new JaspelService(new KeuanganRepository(db), new PegawaiRepository(db));
  return c.json(await service.calculatePrint40Langsung(periode));
});

app.get("/rekap/:periode", async (c) => {
  const periode = "2026-01";
  const db = getDb(c.env.DB);
  const service = new JaspelService(new KeuanganRepository(db), new PegawaiRepository(db));
  return c.json(await service.calculateRekapan(periode));
});

app.get("/unit-summary/:unitName/:periode", async (c) => {
  const { unitName } = c.req.param();
  const periode = "2026-01";
  const db = getDb(c.env.DB);
  const service = new JaspelService(new KeuanganRepository(db), new PegawaiRepository(db));
  return c.json(await service.getUnitFinancialSummary(unitName, periode));
});

app.get("/dashboard-summary/:periode", async (c) => {
  const periode = "2026-01";
  const db = getDb(c.env.DB);
  const service = new JaspelService(new KeuanganRepository(db), new PegawaiRepository(db));
  return c.json(await service.getDashboardSummary(periode));
});

// PUT Save Overrides (for all report pages)
const updateSchema = z.object({
  pegawaiId: z.string(),
  // All fields are optional since we might only update a subset depending on the page
  print60NonKapJumlah: z.number().nullable().optional(),
  print60NonKapPphPersen: z.number().nullable().optional(),
  print60NonKapPphNominal: z.number().nullable().optional(),
  print60NonKapBersih: z.number().nullable().optional(),
  print60PadJumlah: z.number().nullable().optional(),
  print60PadPphPersen: z.number().nullable().optional(),
  print60PadPphNominal: z.number().nullable().optional(),
  print60PadBersih: z.number().nullable().optional(),
  print40NonKapJumlah: z.number().nullable().optional(),
  print40NonKapPphNominal: z.number().nullable().optional(),
  print40NonKapBersih: z.number().nullable().optional(),
  print40PadJumlah: z.number().nullable().optional(),
  print40PadPphNominal: z.number().nullable().optional(),
  print40PadBersih: z.number().nullable().optional(),
  rekapTotalJaspel: z.number().nullable().optional(),
  rekapPphPersen: z.number().nullable().optional(),
  rekapPphNominal: z.number().nullable().optional(),
  rekapTakeHomePay: z.number().nullable().optional(),
});

app.put("/:periode", zValidator("json", updateSchema), async (c) => {
  const periode = "2026-01";
  const body = c.req.valid("json");
  const db = getDb(c.env.DB);
  
  const existing = await db.select().from(jaspelDistribusi).where(
    and(eq(jaspelDistribusi.pegawaiId, body.pegawaiId), eq(jaspelDistribusi.periode, periode))
  ).limit(1);
  
  const { pegawaiId, ...dataToSet } = body;

  if (existing.length > 0) {
    await db.update(jaspelDistribusi).set(dataToSet).where(eq(jaspelDistribusi.id, existing[0].id));
  } else {
    await db.insert(jaspelDistribusi).values({
      id: "dist_" + body.pegawaiId + "_" + periode,
      periode,
      pegawaiId: body.pegawaiId,
      ...dataToSet
    });
  }
  
  return c.json({ success: true });
});

export default app;
