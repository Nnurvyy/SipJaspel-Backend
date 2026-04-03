import { Hono } from "hono";
import { getDb } from "../db";
import { JaspelService } from "../services/jaspel.service";
import { KeuanganRepository } from "../repositories/keuangan.repository";
import { PegawaiRepository } from "../repositories/pegawai.repository";
import { Bindings } from "../utils/types";

const app = new Hono<{ Bindings: Bindings }>();

app.get("/keuangan/:periode", async (c) => {
  const { periode } = c.req.param();
  const db = getDb(c.env.DB);
  const service = new JaspelService(new KeuanganRepository(db), new PegawaiRepository(db));
  
  const result = await service.calculateKeuanganGlobal(periode);
  return c.json(result);
});

app.get("/bobot-kapitasi/:periode", async (c) => {
  const { periode } = c.req.param();
  const db = getDb(c.env.DB);
  const service = new JaspelService(new KeuanganRepository(db), new PegawaiRepository(db));
  return c.json(await service.calculateBobotKapitasi(periode));
});

app.get("/unit-pelayanan/:periode", async (c) => {
  const { periode } = c.req.param();
  const db = getDb(c.env.DB);
  const service = new JaspelService(new KeuanganRepository(db), new PegawaiRepository(db));
  return c.json(await service.calculateUnitPelayanan(periode));
});

app.get("/print-60/:periode", async (c) => {
  const { periode } = c.req.param();
  const db = getDb(c.env.DB);
  const service = new JaspelService(new KeuanganRepository(db), new PegawaiRepository(db));
  return c.json(await service.calculatePrint60TidakLangsung(periode));
});

app.get("/rekap/:periode", async (c) => {
  const { periode } = c.req.param();
  const db = getDb(c.env.DB);
  const service = new JaspelService(new KeuanganRepository(db), new PegawaiRepository(db));
  return c.json(await service.calculateRekapan(periode));
});

export default app;
