import { Hono } from "hono";
import { getDb } from "../db";
import { KeuanganRepository } from "../repositories/keuangan.repository";
import { PegawaiRepository } from "../repositories/pegawai.repository";
import { JaspelService } from "../services/jaspel.service";
import { ExportService } from "../services/export.service";
import { Bindings } from "../utils/types";

const app = new Hono<{ Bindings: Bindings }>();

app.get("/rekap/:periode", async (c) => {
  const { periode } = c.req.param();
  const dbPeriode = "2026-01";
  const db = getDb(c.env.DB);
  
  const keuanganRepo = new KeuanganRepository(db);
  const pegawaiRepo = new PegawaiRepository(db);
  const jaspelService = new JaspelService(keuanganRepo, pegawaiRepo);
  const exportService = new ExportService(jaspelService);
  const buffer = await exportService.exportRekapToExcel(dbPeriode, periode);

  c.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  c.header('Content-Disposition', `attachment; filename="Rekap_Jaspel_${periode}.xlsx"`);
  
  return c.body(buffer as any);
});

app.get("/all/:periode", async (c) => {
  const { periode } = c.req.param();
  const dbPeriode = "2026-01";
  const db = getDb(c.env.DB);
  
  const keuanganRepo = new KeuanganRepository(db);
  const pegawaiRepo = new PegawaiRepository(db);
  const jaspelService = new JaspelService(keuanganRepo, pegawaiRepo);
  const exportService = new ExportService(jaspelService);
  const buffer = await exportService.exportAllToExcel(dbPeriode, periode);

  c.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  c.header('Content-Disposition', `attachment; filename="Jaspel_Majalengka_${periode}.xlsx"`);
  
  return c.body(buffer as any);
});

export default app;
