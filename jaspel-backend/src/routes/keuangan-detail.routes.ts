import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { getDb } from "../db";
import { keuanganDetail } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { Bindings } from "../utils/types";

const app = new Hono<{ Bindings: Bindings }>();

const schema = z.object({
  id: z.string().optional(),
  periode: z.string(),
  jenisPendapatan: z.string().optional().nullable(),
  namaLayanan: z.string().optional().nullable(),
  jumlahBlud: z.number().default(0),
  jaspel60: z.number().default(0),
  operasional40: z.number().default(0),
  tidakLangsung: z.number().default(0),
  langsung: z.number().default(0),
});

// GET all for a period
app.get("/:periode", async (c) => {
  const { periode } = c.req.param();
  const db = getDb(c.env.DB);
  const data = await db.select().from(keuanganDetail).where(eq(keuanganDetail.periode, periode));
  return c.json(data);
});

// POST Create
app.post("/", zValidator("json", schema), async (c) => {
  const body = c.req.valid("json");
  const db = getDb(c.env.DB);
  const id = body.id || "keu_" + Date.now();
  
  await db.insert(keuanganDetail).values({
    ...body,
    id,
  });

  return c.json({ id, ...body });
});

// PUT Update
app.put("/:id", zValidator("json", schema.omit({ id: true })), async (c) => {
  const { id } = c.req.param();
  const body = c.req.valid("json");
  const db = getDb(c.env.DB);

  await db.update(keuanganDetail).set(body).where(eq(keuanganDetail.id, id));
  return c.json({ success: true });
});

// DELETE
app.delete("/:id", async (c) => {
  const { id } = c.req.param();
  const db = getDb(c.env.DB);
  await db.delete(keuanganDetail).where(eq(keuanganDetail.id, id));
  return c.json({ success: true });
});

export default app;
