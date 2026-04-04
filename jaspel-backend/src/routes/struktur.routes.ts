import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { getDb } from "../db";
import { strukturOrganisasi, pegawai } from "../db/schema";
import { eq, sql, asc } from "drizzle-orm";
import { handleReordering } from "../utils/reorder";
import { Bindings } from "../utils/types";

const app = new Hono<{ Bindings: Bindings }>();

// GET all struktur with pegawai names
app.get("/", async (c) => {
  const db = getDb(c.env.DB);
  const items = await db.select().from(strukturOrganisasi).orderBy(asc(strukturOrganisasi.urutan));
  const allPegawai = await db.select({ id: pegawai.id, nama: pegawai.nama }).from(pegawai).orderBy(asc(pegawai.urutan));
  
  const result = items.map(item => {
    const peg = item.pegawaiId ? allPegawai.find(p => p.id === item.pegawaiId) : null;
    return {
      ...item,
      namaPejabatResolved: peg ? peg.nama : (item.namaPejabat || '-'),
    };
  });
  
  return c.json(result);
});

// POST create
const createSchema = z.object({
  jabatan: z.string().min(1),
  pegawaiId: z.string().nullable().optional(),
  namaPejabat: z.string().nullable().optional(),
  urutan: z.coerce.number().optional(),
});

app.post("/", zValidator("json", createSchema), async (c) => {
  const body = c.req.valid("json");
  const db = getDb(c.env.DB);
  const id = "struk_" + Date.now();
  
  let targetUrutan = body.urutan ?? 0;
  if (targetUrutan === 0) {
    const maxRes = await db.select({ maxVal: sql<number>`MAX(${strukturOrganisasi.urutan})` }).from(strukturOrganisasi).get();
    targetUrutan = (maxRes?.maxVal || 0) + 1;
  } else {
    await handleReordering(db, strukturOrganisasi, strukturOrganisasi.id, id, null, targetUrutan);
  }

  await db.insert(strukturOrganisasi).values({
    id,
    jabatan: body.jabatan,
    pegawaiId: body.pegawaiId ?? null,
    namaPejabat: body.namaPejabat ?? null,
    urutan: targetUrutan,
  });
  return c.json({ id, ...body, urutan: targetUrutan });
});

// PUT update
app.put("/:id", zValidator("json", createSchema), async (c) => {
  const db = getDb(c.env.DB);
  const { id } = c.req.param();
  const body = c.req.valid("json");

  const oldRes = await db.select({ urutan: strukturOrganisasi.urutan }).from(strukturOrganisasi).where(eq(strukturOrganisasi.id, id)).get();
  
  if (body.urutan !== undefined && oldRes && body.urutan !== oldRes.urutan) {
    await handleReordering(db, strukturOrganisasi, strukturOrganisasi.id, id, oldRes.urutan, body.urutan);
  }

  await db.update(strukturOrganisasi).set({
    jabatan: body.jabatan,
    pegawaiId: body.pegawaiId ?? null,
    namaPejabat: body.namaPejabat ?? null,
    urutan: body.urutan ?? 0,
  }).where(eq(strukturOrganisasi.id, id));
  return c.json({ success: true });
});

// DELETE
app.delete("/:id", async (c) => {
  const db = getDb(c.env.DB);
  const { id } = c.req.param();
  await db.delete(strukturOrganisasi).where(eq(strukturOrganisasi.id, id));
  return c.json({ success: true });
});

export default app;
