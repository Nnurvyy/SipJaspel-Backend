import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { getDb } from "../db";
import { tcmStaff, pegawai } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { Bindings } from "../utils/types";

const app = new Hono<{ Bindings: Bindings }>();

const schema = z.object({
  id: z.string().optional(),
  periode: z.string(),
  pegawaiId: z.string(),
  persentase: z.number().min(0).max(100),
});

// GET all for a period
app.get("/:periode", async (c) => {
  const dbPeriode = "2026-01";
  const db = getDb(c.env.DB);
  const data = await db.select({
      id: tcmStaff.id,
      periode: tcmStaff.periode,
      pegawaiId: tcmStaff.pegawaiId,
      persentase: tcmStaff.persentase,
      namaKaryawan: pegawai.nama
  })
  .from(tcmStaff)
  .leftJoin(pegawai, eq(tcmStaff.pegawaiId, pegawai.id))
  .where(eq(tcmStaff.periode, dbPeriode));
  
  return c.json(data);
});

// POST Create
app.post("/", zValidator("json", schema), async (c) => {
  const body = c.req.valid("json");
  const db = getDb(c.env.DB);
  const id = body.id || "tcm_" + Date.now();
  
  await db.insert(tcmStaff).values({
    ...body,
    periode: "2026-01", // Force period
    id,
  });

  return c.json({ id, ...body, periode: "2026-01" });
});

// PUT Update
app.put("/:id", zValidator("json", schema.omit({ id: true })), async (c) => {
  const { id } = c.req.param();
  const body = c.req.valid("json");
  const db = getDb(c.env.DB);

  await db.update(tcmStaff).set(body).where(eq(tcmStaff.id, id));
  return c.json({ success: true });
});

// DELETE
app.delete("/:id", async (c) => {
  const { id } = c.req.param();
  const db = getDb(c.env.DB);
  await db.delete(tcmStaff).where(eq(tcmStaff.id, id));
  return c.json({ success: true });
});

export default app;
