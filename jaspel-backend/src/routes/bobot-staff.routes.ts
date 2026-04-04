import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { getDb } from "../db";
import { bobotStaff, pegawai } from "../db/schema";
import { eq } from "drizzle-orm";
import { Bindings } from "../utils/types";

const app = new Hono<{ Bindings: Bindings }>();

// Helper: Hitung poin jabatan unit
function getPoinJabatanUnit(jabatan: string | null | undefined): number {
  if (!jabatan) return 0;
  if (jabatan === "PJ") return 3;
  if (jabatan === "Koordinator") return 2;
  if (jabatan === "Tidak memiliki jabatan struktural") return 1;
  return 0;
}

// Helper: Hitung poin risiko
function getPoinRisiko(risiko: string | null | undefined): number {
  if (!risiko) return 0;
  if (risiko === "Sangat Tinggi") return 5;
  if (risiko === "Tinggi") return 4;
  if (risiko === "Sedang") return 3;
  if (risiko === "Rendah") return 2;
  if (risiko === "Sangat Rendah") return 1;
  return 0;
}

// GET /api/bobot-staff — Ambil semua pegawai dengan data bobot mereka
app.get("/", async (c) => {
  const db = getDb(c.env.DB);

  const listPegawai = await db.select().from(pegawai);
  const listBobot = await db.select().from(bobotStaff);

  const result = listPegawai.map((p, idx) => {
    const bobot = listBobot.find((b) => b.pegawaiId === p.id);
    const poinJabatan = getPoinJabatanUnit(bobot?.jabatanUnit);
    const poinRisiko = getPoinRisiko(bobot?.risiko);
    return {
      no: idx + 1,
      pegawaiId: p.id,
      nama: p.nama,
      jabatanUnit: bobot?.jabatanUnit || "",
      risiko: bobot?.risiko || "",
      unitKerja: bobot?.unitKerja || "",
      status: bobot?.status || "",
      poinJabatan,
      poinRisiko,
      bobot: poinJabatan + poinRisiko,
    };
  });

  return c.json(result);
});

// PUT /api/bobot-staff/:pegawaiId — Update jabatanUnit, risiko, unitKerja, status
const updateSchema = z.object({
  jabatanUnit: z.string().optional().default(""),
  risiko: z.string().optional().default(""),
  unitKerja: z.string().optional().default(""),
  status: z.string().optional().default(""),
});

app.put("/:pegawaiId", zValidator("json", updateSchema), async (c) => {
  const { pegawaiId } = c.req.param();
  const body = c.req.valid("json");
  const db = getDb(c.env.DB);

  const existing = await db
    .select()
    .from(bobotStaff)
    .where(eq(bobotStaff.pegawaiId, pegawaiId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(bobotStaff)
      .set({
        jabatanUnit: body.jabatanUnit,
        risiko: body.risiko,
        unitKerja: body.unitKerja,
        status: body.status,
      })
      .where(eq(bobotStaff.pegawaiId, pegawaiId));
  } else {
    await db.insert(bobotStaff).values({
      id: `bobot_${pegawaiId}`,
      pegawaiId,
      jabatanUnit: body.jabatanUnit,
      risiko: body.risiko,
      unitKerja: body.unitKerja,
      status: body.status,
    });
  }

  // Kembalikan bobot yang baru dihitung
  const poinJabatan = getPoinJabatanUnit(body.jabatanUnit);
  const poinRisiko = getPoinRisiko(body.risiko);
  return c.json({ success: true, bobot: poinJabatan + poinRisiko });
});

export default app;
