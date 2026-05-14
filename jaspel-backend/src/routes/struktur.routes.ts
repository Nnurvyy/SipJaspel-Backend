import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { getDb } from "../db";
import { strukturOrganisasi, pegawai } from "../db/schema";
import { eq, sql, asc, inArray } from "drizzle-orm";
import { handleReordering } from "../utils/reorder";
import { Bindings } from "../utils/types";

const app = new Hono<{ Bindings: Bindings }>();

// GET all struktur dengan data dikelompokkan per pegawai (grouped by pegawaiId, urutan dari pegawai)
app.get("/", async (c) => {
  const db = getDb(c.env.DB);
  const allPegawai = await db.select().from(pegawai).orderBy(asc(pegawai.urutan));
  const items = await db.select().from(strukturOrganisasi).orderBy(asc(strukturOrganisasi.urutan));

  // Group jabatan per pegawaiId
  const jabatanByPegawai: Record<string, typeof items> = {};
  for (const item of items) {
    const key = item.pegawaiId || `_fallback_${item.id}`;
    if (!jabatanByPegawai[key]) jabatanByPegawai[key] = [];
    jabatanByPegawai[key].push(item);
  }

  // Build result: tiap baris adalah 1 pegawai (urutan dari tabel pegawai)
  const result = allPegawai.map((peg) => {
    const jabatanList = jabatanByPegawai[peg.id] || [];
    const jabatan1 = jabatanList[0] || null;
    const jabatan2 = jabatanList[1] || null;
    const jabatan3 = jabatanList[2] || null;

    const poin1 = jabatan1 ? (jabatan1.poin || 0) : 0;
    const poin2 = jabatan2 ? (jabatan2.poin || 0) : 0;
    const poin3 = jabatan3 ? (jabatan3.poin || 0) : 0;
    const jumlahPoin = poin1 + poin2 + poin3;

    return {
      pegawaiId: peg.id,
      nama: peg.nama,
      jabatan1Id: jabatan1?.id || null,
      jabatan1: jabatan1?.jabatan || null,
      poin1,
      jabatan2Id: jabatan2?.id || null,
      jabatan2: jabatan2?.jabatan || null,
      poin2,
      jabatan3Id: jabatan3?.id || null,
      jabatan3: jabatan3?.jabatan || null,
      poin3,
      jumlahPoin,
    };
  });

  return c.json(result);
});

// GET legacy format (untuk backward compatibility dengan export)
app.get("/legacy", async (c) => {
  const db = getDb(c.env.DB);
  const items = await db.select().from(strukturOrganisasi).orderBy(asc(strukturOrganisasi.urutan));
  const allPegawai = await db.select({ id: pegawai.id, nama: pegawai.nama }).from(pegawai).orderBy(asc(pegawai.urutan));

  const result = items.map((item) => {
    const peg = item.pegawaiId ? allPegawai.find((p) => p.id === item.pegawaiId) : null;
    return {
      ...item,
      namaPejabatResolved: peg ? peg.nama : (item.namaPejabat || "-"),
    };
  });

  return c.json(result);
});

// PUT update jabatan per baris pegawai (bulk: update/create/delete jabatan 1, 2, 3)
const updateRowSchema = z.object({
  pegawaiId: z.string(),
  jabatan1Id: z.string().nullable().optional(),
  jabatan1: z.string().nullable().optional(),
  poin1: z.coerce.number().optional(),
  jabatan2Id: z.string().nullable().optional(),
  jabatan2: z.string().nullable().optional(),
  poin2: z.coerce.number().optional(),
  jabatan3Id: z.string().nullable().optional(),
  jabatan3: z.string().nullable().optional(),
  poin3: z.coerce.number().optional(),
});

app.put("/row/:pegawaiId", zValidator("json", updateRowSchema), async (c) => {
  const db = getDb(c.env.DB);
  const { pegawaiId } = c.req.param();
  const body = c.req.valid("json");

  const jabatanSlots = [
    { id: body.jabatan1Id, jabatan: body.jabatan1, poin: body.poin1 },
    { id: body.jabatan2Id, jabatan: body.jabatan2, poin: body.poin2 },
    { id: body.jabatan3Id, jabatan: body.jabatan3, poin: body.poin3 },
  ];

  // 1. Delete ALL existing jabatan for this employee first
  // This is the safest way to handle "slots" and ensures no ghost/odd records remain.
  await db.delete(strukturOrganisasi).where(eq(strukturOrganisasi.pegawaiId, pegawaiId));

  // 2. Prepare and Insert only the valid (non-empty) slots
  const validSlots = jabatanSlots.filter(s => s.jabatan && s.jabatan.trim());
  
  if (validSlots.length > 0) {
    // Get max urutan globally to keep new items at the end
    const maxRes = await db
      .select({ maxVal: sql<number>`MAX(${strukturOrganisasi.urutan})` })
      .from(strukturOrganisasi)
      .get();
    let currentUrutan = (maxRes?.maxVal || 0) + 1;

    for (const slot of validSlots) {
      const newId = `struk_${pegawaiId}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      await db.insert(strukturOrganisasi).values({
        id: newId,
        jabatan: slot.jabatan!.trim(),
        pegawaiId,
        namaPejabat: null,
        poin: slot.poin || 0,
        urutan: currentUrutan++,
      });
    }
  }

  return c.json({ success: true });
});

// POST create (legacy support, tetap ada)
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

// PUT update (legacy)
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
