import { eq, and } from "drizzle-orm";
import { pegawai, kehadiran, kinerjaPegawai, strukturOrganisasi, jaspelDistribusi } from "../db/schema";
import { DbClient } from "../db";

export class PegawaiRepository {
  constructor(private db: DbClient) {}

  async findAll() {
    return this.db.select().from(pegawai);
  }

  async findPegawaiWithKehadiran(periode: string) {
    const listPegawai = await this.db.select().from(pegawai);
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
    const finalData = {
      ...data,
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
    return this.db.select().from(strukturOrganisasi);
  }

  async getJaspelDistribusi(periode: string) {
    return this.db.select().from(jaspelDistribusi).where(eq(jaspelDistribusi.periode, periode));
  }
}
