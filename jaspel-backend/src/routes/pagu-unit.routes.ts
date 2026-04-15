import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { getDb } from "../db";
import { paguUnitPeran, unitPelayanan } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { Bindings } from "../utils/types";

const app = new Hono<{ Bindings: Bindings }>();

// GET /api/pagu-unit/:unitKey/:periode — Ambil pagu per peran untuk unit dan periode tertentu
app.get("/:unitKey/:periode", async (c) => {
  const { unitKey } = c.req.param();
  const periode = "2026-01";
  const db = getDb(c.env.DB);

  // Cari unit (support slugs and different ID formats)
  const allUnits = await db.select().from(unitPelayanan);
  const unit = allUnits.find(
    (u) =>
      u.id === `unit_${unitKey}` ||
      u.id === unitKey ||
      u.nama.toLowerCase().replace(/\s+/g, "-") === unitKey
  );

  const unitId = unit?.id || (unitKey.startsWith("unit_") ? unitKey : `unit_${unitKey}`);

  const rows = await db
    .select()
    .from(paguUnitPeran)
    .where(
      and(eq(paguUnitPeran.unitId, unitId), eq(paguUnitPeran.periode, periode))
    );

  // Return sebagai map { peranKey: { paguNonKap, paguPadMurni } }
  const result: Record<string, { paguNonKap: number; paguPadMurni: number }> =
    {};
  rows.forEach((r) => {
    result[r.peranKey] = {
      paguNonKap: r.paguNonKap,
      paguPadMurni: r.paguPadMurni,
    };
  });

  return c.json(result);
});

// PUT /api/pagu-unit/:unitKey/:periode — Upsert pagu per peran
// Body: { "dokter": { paguNonKap: 5000000, paguPadMurni: 2000000 }, "perawat": {...}, ... }
const upsertSchema = z.record(
  z.string(),
  z.object({
    paguNonKap: z.coerce.number().default(0),
    paguPadMurni: z.coerce.number().default(0),
  })
);

app.put("/:unitKey/:periode", zValidator("json", upsertSchema), async (c) => {
  const { unitKey } = c.req.param();
  const periode = "2026-01";
  const body = c.req.valid("json");
  const db = getDb(c.env.DB);

  // Cari unit
  const allUnits = await db.select().from(unitPelayanan);
  const unit = allUnits.find(
    (u) =>
      u.id === `unit_${unitKey}` ||
      u.id === unitKey ||
      u.nama.toLowerCase().replace(/\s+/g, "-") === unitKey
  );

  const unitId = unit?.id || (unitKey.startsWith("unit_") ? unitKey : `unit_${unitKey}`);

  for (const [peranKey, values] of Object.entries(body)) {
    const existing = await db
      .select()
      .from(paguUnitPeran)
      .where(
        and(
          eq(paguUnitPeran.unitId, unitId),
          eq(paguUnitPeran.periode, periode),
          eq(paguUnitPeran.peranKey, peranKey)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(paguUnitPeran)
        .set({ paguNonKap: values.paguNonKap, paguPadMurni: values.paguPadMurni })
        .where(eq(paguUnitPeran.id, existing[0].id));
    } else {
      await db.insert(paguUnitPeran).values({
        id: `pagu_${unitId}_${periode}_${peranKey}`,
        unitId,
        periode,
        peranKey,
        paguNonKap: values.paguNonKap,
        paguPadMurni: values.paguPadMurni,
      });
    }
  }

  return c.json({ success: true });
});

export default app;
