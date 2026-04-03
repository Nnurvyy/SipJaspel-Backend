import { eq, and } from "drizzle-orm";
import { pegawai, kehadiran, kinerjaPegawai } from "../db/schema";
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
    await this.db.insert(pegawai).values(data);
    return data;
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
}
