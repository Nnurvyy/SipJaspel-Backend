import { eq, and, asc, sql } from "drizzle-orm";
import { pegawai, kehadiran, kinerjaPegawai, strukturOrganisasi, jaspelDistribusi } from "../db/schema";
import { DbClient } from "../db";
import { handleReordering } from "../utils/reorder";

export class PegawaiRepository {
  constructor(private db: DbClient) {}

  async findAll() {
    return this.db.select().from(pegawai).orderBy(asc(pegawai.urutan));
  }

  async findPegawaiWithKehadiran(periode: string) {
    const listPegawai = await this.db.select().from(pegawai).orderBy(asc(pegawai.urutan));
    const listKehadiran = await this.db.select().from(kehadiran).where(eq(kehadiran.periode, periode));
    
    return listPegawai.map(p => {
      const hadirInfo = listKehadiran.find(k => k.pegawaiId === p.id);
      return {
        ...p,
        kehadiran: hadirInfo || null
      };
    });
  }

  async create(data: typeof pegawai.$inferInsert) {
    let targetUrutan = data.urutan ?? 0;
    
    // If no order is provided, put it at the very bottom
    if (targetUrutan === 0) {
      const maxRes = await this.db.select({ maxVal: sql<number>`MAX(${pegawai.urutan})` }).from(pegawai).get();
      targetUrutan = (maxRes?.maxVal || 0) + 1;
    } else {
      // Re-index shift logic
      await handleReordering(this.db, pegawai, pegawai.id, data.id!, null, targetUrutan);
    }

    const finalData = {
      ...data,
      urutan: targetUrutan,
      poinTanggungJawab: data.poinTanggungJawab ?? 0,
      poinKetenagaan: data.poinKetenagaan ?? 0,
      poinRangkapTugas: data.poinRangkapTugas ?? 0,
      poinMasaKerja: data.poinMasaKerja ?? 0,
      pphPersen: data.pphPersen ?? 0,
    };
    await this.db.insert(pegawai).values(finalData);
    return finalData;
  }

  async update(id: string, data: Partial<typeof pegawai.$inferInsert>) {
    const oldRes = await this.db.select({ urutan: pegawai.urutan }).from(pegawai).where(eq(pegawai.id, id)).get();
    
    if (data.urutan !== undefined && oldRes && data.urutan !== oldRes.urutan) {
      await handleReordering(this.db, pegawai, pegawai.id, id, oldRes.urutan, data.urutan);
    }

    await this.db.update(pegawai).set(data).where(eq(pegawai.id, id));
    return this.db.select().from(pegawai).where(eq(pegawai.id, id)).get();
  }

  async delete(id: string) {
    // Delete from related tables to maintain consistency
    await this.db.delete(kehadiran).where(eq(kehadiran.pegawaiId, id));
    await this.db.delete(kinerjaPegawai).where(eq(kinerjaPegawai.pegawaiId, id));
    
    // Delete the pegawai
    await this.db.delete(pegawai).where(eq(pegawai.id, id));
    return { success: true };
  }

  async getStruktur() {
    return this.db.select().from(strukturOrganisasi).orderBy(asc(strukturOrganisasi.urutan));
  }

  async getJaspelDistribusi(periode: string) {
    return this.db.select().from(jaspelDistribusi).where(eq(jaspelDistribusi.periode, periode));
  }
}
