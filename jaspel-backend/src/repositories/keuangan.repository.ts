import { eq, and } from "drizzle-orm";
import { keuangan, pendapatanUnit, unitPelayanan, kinerjaPegawai, keuanganDetail, kinerjaTindakanPeran, paguUnitPeran } from "../db/schema";
import { DbClient } from "../db";

export class KeuanganRepository {
  constructor(private db: DbClient) {}

  async getKeuanganByPeriode(periode: string) {
    const result = await this.db.select().from(keuangan).where(eq(keuangan.periode, periode)).limit(1);
    return result[0] || null;
  }

  async getPendapatanUnit(periode: string) {
    return this.db.select().from(pendapatanUnit).where(eq(pendapatanUnit.periode, periode));
  }

  async getUnits() {
    return this.db.select().from(unitPelayanan);
  }

  async getKinerjaPegawai(periode: string) {
    return this.db.select().from(kinerjaPegawai).where(eq(kinerjaPegawai.periode, periode));
  }

  async getKeuanganDetail(periode: string) {
    return this.db.select().from(keuanganDetail).where(eq(keuanganDetail.periode, periode));
  }

  async getKinerjaTindakanPeran(unitId: string) {
    return this.db.select().from(kinerjaTindakanPeran).where(eq(kinerjaTindakanPeran.unitId, unitId));
  }

  async getPaguUnitPeran(unitId: string, periode: string) {
    return this.db.select().from(paguUnitPeran).where(and(eq(paguUnitPeran.unitId, unitId), eq(paguUnitPeran.periode, periode)));
  }
}
