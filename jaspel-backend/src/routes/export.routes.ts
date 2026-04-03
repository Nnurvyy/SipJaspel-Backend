import { Hono } from "hono";
import { getDb } from "../db";
import { KeuanganRepository } from "../repositories/keuangan.repository";
import { PegawaiRepository } from "../repositories/pegawai.repository";
import { JaspelService } from "../services/jaspel.service";
import { ExportService } from "../services/export.service";
import { Bindings } from "../utils/types";

const app = new Hono<{ Bindings: Bindings }>();

app.get("/export/rekap/:periode", async (c) => {
  const { periode } = c.req.param();
  const db = getDb(c.env.DB);
  
  const keuanganRepo = new KeuanganRepository(db);
  const pegawaiRepo = new PegawaiRepository(db);
  const jaspelService = new JaspelService(keuanganRepo, pegawaiRepo);
  const exportService = new ExportService(jaspelService);

  const buffer = await exportService.exportRekapToExcel(periode);

  c.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  c.header('Content-Disposition', `attachment; filename="Rekap_Jaspel_${periode}.xlsx"`);
  
  return c.body(buffer);
});

export default app;
