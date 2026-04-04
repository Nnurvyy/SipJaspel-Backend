import { KeuanganRepository } from "../repositories/keuangan.repository";
import { PegawaiRepository } from "../repositories/pegawai.repository";

export class JaspelService {
  constructor(
    private keuanganRepo: KeuanganRepository,
    private pegawaiRepo: PegawaiRepository
  ) {}

  async calculateKeuanganGlobal(periode: string) {
    const detail = await this.keuanganRepo.getKeuanganDetail(periode);
    
    let totalBlud = 0;
    let totalJaspel60 = 0;
    let totalOperasional40 = 0;
    let totalTidakLangsung = 0;
    let totalLangsung = 0;

    detail.forEach(d => {
        totalBlud += d.jumlahBlud;
        totalJaspel60 += d.jaspel60;
        totalOperasional40 += d.operasional40;
        totalTidakLangsung += d.tidakLangsung;
        totalLangsung += d.langsung;
    });
 
    return { 
        pendapatan: totalBlud, 
        jaspel: totalJaspel60, 
        operasional: totalOperasional40, 
        tidakLangsung: totalTidakLangsung, 
        langsung: totalLangsung,
        items: detail
    };
  }

  private getPphPercent(golongan: string | null | undefined): number {
    if (!golongan || golongan === '-') return 0;
    const g = golongan.toUpperCase();
    if (g.startsWith('IV')) return 15;
    if (g.startsWith('III')) return 5;
    return 0;
  }


  async calculateBobotKapitasi(periode: string) {
    const listPegawai = await this.pegawaiRepo.findPegawaiWithKehadiran(periode);
    const struktur = await this.pegawaiRepo.getStruktur();
    
    return listPegawai.map(p => {
      const hadirInfo = p.kehadiran;

      const countInStruktur = struktur.filter(s => s.pegawaiId === p.id).length;
      let calcPoinTJ = 0;
      if (countInStruktur === 1) calcPoinTJ = 10;
      else if (countInStruktur === 2) calcPoinTJ = 20;
      else if (countInStruktur > 2) calcPoinTJ = 30;
      const poinTanggungJawab = hadirInfo?.poinTanggungJawab ?? calcPoinTJ;

      const poinKetenagaan = hadirInfo?.poinKetenagaan ?? (p.poinKetenagaan || 0);
      const rangkapTugasAdm = hadirInfo?.rangkapTugasAdm ?? 0;

      const lamaMasaKerja = p.lamaMasaKerja || 0;
      let calcPoinMK = 2; // < 6
      if (lamaMasaKerja >= 26) calcPoinMK = 25;
      else if (lamaMasaKerja >= 21) calcPoinMK = 20;
      else if (lamaMasaKerja >= 16) calcPoinMK = 15;
      else if (lamaMasaKerja >= 11) calcPoinMK = 10;
      else if (lamaMasaKerja >= 6) calcPoinMK = 5;
      const poinMasaKerja = hadirInfo?.poinMasaKerja ?? calcPoinMK;

      let prosentaseKehadiran = 0;
      if (hadirInfo && hadirInfo.hariKerja > 0) {
        prosentaseKehadiran = hadirInfo.hariMasukKerja / hadirInfo.hariKerja;
      }
      const finalProsentase = hadirInfo?.prosentaseKehadiran ?? prosentaseKehadiran;

      const jumlahPoinKapitasi = hadirInfo?.jumlahPoinKapitasi ?? (poinTanggungJawab + poinKetenagaan + rangkapTugasAdm + calcPoinMK);
      const jumlahPoinNonKapitasi = hadirInfo?.jumlahPoinNonKapitasi ?? (poinKetenagaan + rangkapTugasAdm + calcPoinMK);
      
      const bobotKapitasi = hadirInfo?.bobotKapitasi ?? (jumlahPoinKapitasi * finalProsentase);
      const bobotNonKapitasi = hadirInfo?.bobotNonKapitasi ?? (jumlahPoinNonKapitasi * finalProsentase);

      return {
        id: p.id,
        nama: p.nama,
        nip: p.nip,
        golongan: p.golongan,
        jenisKetenagaan: p.jenisKetenagaan,
        countInStruktur,
        poinTanggungJawab,
        poinKetenagaan,
        rangkapTugasAdm,
        lamaMasaKerja,
        poinMasaKerja,
        hariMasukKerja: hadirInfo?.hariMasukKerja || 0,
        hariKerja: hadirInfo?.hariKerja || 0,
        prosentaseKehadiran: finalProsentase,
        jumlahPoinKapitasi,
        jumlahPoinNonKapitasi,
        bobotKapitasi,
        bobotNonKapitasi
      };
    });
  }

  async calculatePrint60TidakLangsung(periode: string) {
      try {
        const bobotList = await this.calculateBobotKapitasi(periode);
        const keuDetail = await this.keuanganRepo.getKeuanganDetail(periode).catch(() => []);
        const overrides = await this.pegawaiRepo.getJaspelDistribusi(periode).catch(() => []);

        const totalTlnonKap = keuDetail.filter(d => d.jenisPendapatan === 'Non Kapitasi').reduce((a, b) => a + b.tidakLangsung, 0);
        const totalTlPad = keuDetail.filter(d => d.jenisPendapatan === 'PAD Murni').reduce((a, b) => a + b.tidakLangsung, 0);

        const totalBobotNonKapAll = bobotList.reduce((acc, curr) => acc + curr.bobotNonKapitasi, 0);

        return bobotList.map(b => {
            const ov = overrides.find(o => o.pegawaiId === b.id);
            const defaultPphPercent = this.getPphPercent(b.golongan);

            const calcJaspelNK = (b.bobotNonKapitasi / (totalBobotNonKapAll || 1)) * totalTlnonKap;
            const jaspelNK = ov?.print60NonKapJumlah ?? calcJaspelNK;
            const pphPercentNK = ov?.print60NonKapPphPersen ?? defaultPphPercent;
            const pphNominalNK = ov?.print60NonKapPphNominal ?? (jaspelNK * (pphPercentNK / 100));
            const bersihNK = ov?.print60NonKapBersih ?? (jaspelNK - pphNominalNK);

            const calcJaspelPad = (b.bobotNonKapitasi / (totalBobotNonKapAll || 1)) * totalTlPad;
            const jaspelPad = ov?.print60PadJumlah ?? calcJaspelPad;
            const pphPercentPad = ov?.print60PadPphPersen ?? defaultPphPercent;
            const pphNominalPad = ov?.print60PadPphNominal ?? (jaspelPad * (pphPercentPad / 100));
            const bersihPad = ov?.print60PadBersih ?? (jaspelPad - pphNominalPad);

            return {
               id: b.id,
               nama: b.nama,
               golongan: b.golongan,
               bobot: b.bobotNonKapitasi,
               jaspelNonKap: jaspelNK,
               pphPercentNonKap: pphPercentNK,
               pphNonKap: pphNominalNK,
               bersihNonKap: bersihNK,
               jaspelPadMurni: jaspelPad,
               pphPercentPad: pphPercentPad,
               pphPadMurni: pphNominalPad,
               bersihPadMurni: bersihPad,
               isOverride: !!ov,
               // Additional Employment Data
               jenisKetenagaanPoin: b.poinKetenagaan,
               masaKerja: b.lamaMasaKerja,
               rangkapTugasAdm: b.rangkapTugasAdm,
               hariMasukKerja: b.hariMasukKerja,
               hariKerja: b.hariKerja,
               prosentaseKehadiran: b.prosentaseKehadiran,
               jumlahPoin: b.jumlahPoinKapitasi
            }
        });
      } catch (e) {
        console.error("Error in calculatePrint60TidakLangsung", e);
        return [];
      }
  }

  async calculatePrint40Langsung(periode: string) {
      try {
        const bobotList = await this.calculateBobotKapitasi(periode);
        const units = await this.calculateUnitPelayanan(periode).catch(() => []);
        const overrides = await this.pegawaiRepo.getJaspelDistribusi(periode).catch(() => []);

        return bobotList.map(b => {
            const ov = overrides.find(o => o.pegawaiId === b.id);
            
            let sumNK = 0;
            let sumPad = 0;
            const unitBreakdown: Record<string, { nonKap: number, pad: number }> = {};

            units.forEach(u => {
                const p = u.perhitunganPegawai.find(x => x.pegawaiId === b.id);
                if (p) {
                    sumNK += p.jaspelProfesiNonKap;
                    sumPad += p.jaspelProfesiPad;
                    unitBreakdown[u.unitNama] = {
                        nonKap: p.jaspelProfesiNonKap,
                        pad: p.jaspelProfesiPad
                    };
                } else {
                    unitBreakdown[u.unitNama] = { nonKap: 0, pad: 0 };
                }
            });

            const jaspelNK = ov?.print40NonKapJumlah ?? sumNK;
            const pphPercentNK = this.getPphPercent(b.golongan);
            const pphNK = ov?.print40NonKapPphNominal ?? (jaspelNK * (pphPercentNK / 100));
            const bersihNK = ov?.print40NonKapBersih ?? (jaspelNK - pphNK);

            const jaspelPad = ov?.print40PadJumlah ?? sumPad;
            const pphPercentPad = this.getPphPercent(b.golongan);
            const pphPad = ov?.print40PadPphNominal ?? (jaspelPad * (pphPercentPad / 100));
            const bersihPad = ov?.print40PadBersih ?? (jaspelPad - pphPad);

            return {
                id: b.id,
                nama: b.nama,
                golongan: b.golongan,
                jaspelNonKap: jaspelNK,
                pphNonKap: pphNK,
                bersihNonKap: bersihNK,
                jaspelPadMurni: jaspelPad,
                pphPadMurni: pphPad,
                bersihPadMurni: bersihPad,
                unitBreakdown,
                isOverride: !!ov
            };
        });
      } catch (e) {
        console.error("Error in calculatePrint40Langsung", e);
        return [];
      }
  }

  async calculateRekapan(periode: string) {
      const p60 = await this.calculatePrint60TidakLangsung(periode);
      const p40 = await this.calculatePrint40Langsung(periode);
      const overrides = await this.pegawaiRepo.getJaspelDistribusi(periode);
      const listPegawai = await this.pegawaiRepo.findAll();

      return listPegawai.map(p => {
          const b60 = p60.find(x => x.id === p.id);
          const b40 = p40.find(x => x.id === p.id);
          const ov = overrides.find(o => o.pegawaiId === p.id);

          const tlNK = b60?.jaspelNonKap || 0;
          const tlPad = b60?.jaspelPadMurni || 0;
          const totalTL = tlNK + tlPad;

          const lNK = b40?.jaspelNonKap || 0;
          const lPad = b40?.jaspelPadMurni || 0;
          const totalL = lNK + lPad;

          const totalJaspel = ov?.rekapTotalJaspel ?? (totalTL + totalL);
          const pphPercent = ov?.rekapPphPersen ?? this.getPphPercent(p.golongan);
          const pphNominal = ov?.rekapPphNominal ?? (totalJaspel * (pphPercent / 100));
          const takeHomePay = ov?.rekapTakeHomePay ?? (totalJaspel - pphNominal);

          return {
              pegawaiId: p.id,
              nama: p.nama,
              golongan: p.golongan,
              tlNonKap: tlNK,
              tlPad,
              totalTL,
              lgsgNonKap: lNK,
              lgsgPad: lPad,
              totalL,
              totalJaspel,
              pphPercent,
              pphNominal,
              takeHomePay,
              isOverride: !!ov
          };
      });
  }

  async calculateUnitPelayanan(periode: string) {
    const keuDetail = await this.keuanganRepo.getKeuanganDetail(periode);
    const bobotList = await this.calculateBobotKapitasi(periode);
    const kinerjaPegawai = await this.keuanganRepo.getKinerjaPegawai(periode);
    const units = await this.keuanganRepo.getUnits();
    
    const results = [];
    for (const u of units) {
      const details = keuDetail.filter(d => d.namaLayanan === u.nama);
      
      const sumBludNK = details.filter(d => d.jenisPendapatan === 'Non Kapitasi').reduce((a, b) => a + b.jumlahBlud, 0);
      const sumBludPad = details.filter(d => d.jenisPendapatan === 'PAD Murni').reduce((a, b) => a + b.jumlahBlud, 0);
      
      const langsungNonKapitasi = details.filter(d => d.jenisPendapatan === 'Non Kapitasi').reduce((a, b) => a + b.langsung, 0);
      const langsungPadRanap = details.filter(d => d.jenisPendapatan === 'PAD Murni').reduce((a, b) => a + b.langsung, 0);

      const kinerjaDiUnit = kinerjaPegawai.filter(k => k.unitId === u.id).map(k => {
        const bobotPegawai = bobotList.find(b => b.id === k.pegawaiId)?.bobotNonKapitasi || 0;
        return { ...k, bobotPegawai };
      });

      // 1. Fetch Role-based Pagu (Percentages) for this unit
      const paguData = await this.keuanganRepo.getPaguUnitPeran(u.id, periode);
      const allUnitActions = await this.keuanganRepo.getKinerjaTindakanPeran(u.id);

      const roleBuckets: Record<string, { nk: number; pad: number }> = {};
      const roleTotalAdjWeight: Record<string, number> = {};

      paguData.forEach((p) => {
        roleBuckets[p.peranKey] = {
          nk: (p.paguNonKap / 100) * langsungNonKapitasi,
          pad: (p.paguPadMurni / 100) * langsungPadRanap,
        };
      });

      // Calculate Total Adjusted Weight for each Role Bucket
      allUnitActions.forEach((a) => {
        const emp = kinerjaDiUnit.find((k) => k.id === a.kinerjaPegawaiId);
        if (emp) {
          // If a manual adjusted value is present in the DB, use it.
          // Otherwise, apply the new formulas.
          let adjusted = a.adjusted;
          
          if (adjusted === null || adjusted === undefined) {
             const isAdminRole = a.peranKey === 'pengelola' || a.peranKey === 'manajemen_poned';
             if (isAdminRole) {
                adjusted = a.jumlahTindakan * 10;
             } else {
                adjusted = (emp.bobotPegawai || 0) * a.jumlahTindakan;
             }
          }

          // Store for subsequent distribution step
          (a as any).finalAdjusted = adjusted;
          roleTotalAdjWeight[a.peranKey] = (roleTotalAdjWeight[a.peranKey] || 0) + adjusted;
        }
      });

      // Distribute each bucket to employees
      const employeeEarnings: Record<string, { nk: number; pad: number }> = {};
      allUnitActions.forEach((a) => {
        const emp = kinerjaDiUnit.find((k) => k.id === a.kinerjaPegawaiId);
        if (emp && roleBuckets[a.peranKey]) {
          const finalAdjusted = (a as any).finalAdjusted || 0;
          const totalAdjWeight = roleTotalAdjWeight[a.peranKey] || 1;
          
          const nkShare = (finalAdjusted / totalAdjWeight) * roleBuckets[a.peranKey].nk;
          const padShare = (finalAdjusted / totalAdjWeight) * roleBuckets[a.peranKey].pad;

          if (!employeeEarnings[emp.pegawaiId]) {
            employeeEarnings[emp.pegawaiId] = { nk: 0, pad: 0 };
          }
          employeeEarnings[emp.pegawaiId].nk += nkShare;
          employeeEarnings[emp.pegawaiId].pad += padShare;
        }
      });

      const perhitunganPegawai = kinerjaDiUnit.map((k) => {
        const earnings = employeeEarnings[k.pegawaiId] || { nk: 0, pad: 0 };
        return {
          pegawaiId: k.pegawaiId,
          jaspelProfesiNonKap: earnings.nk,
          jaspelProfesiPad: earnings.pad,
        };
      });

      results.push({
        unitId: u.id,
        unitNama: u.nama,
        jumlahNonKapitasi: sumBludNK,
        padRanap: sumBludPad,
        langsungNonKapitasi,
        langsungPadRanap,
        perhitunganPegawai
      });
    }
    return results;
  }

  async getUnitFinancialSummary(unitName: string, periode: string) {
    const detail = await this.keuanganRepo.getKeuanganDetail(periode);
    const unitDetails = detail.filter(d => d.namaLayanan?.toLowerCase() === unitName.toLowerCase());

    const summary = {
      nonKapitasi: { total: 0, tidakLangsung: 0, langsung: 0 },
      padMurni: { total: 0, tidakLangsung: 0, langsung: 0 }
    };

    unitDetails.forEach(d => {
      if (d.jenisPendapatan === 'Non Kapitasi') {
        summary.nonKapitasi.total += d.jaspel60;
        summary.nonKapitasi.tidakLangsung += d.tidakLangsung;
        summary.nonKapitasi.langsung += d.langsung;
      } else if (d.jenisPendapatan === 'PAD Murni') {
        summary.padMurni.total += d.jaspel60;
        summary.padMurni.tidakLangsung += d.tidakLangsung;
        summary.padMurni.langsung += d.langsung;
      }
    });

    return summary;
  }

  async getDashboardSummary(periode: string) {
    const detail = await this.keuanganRepo.getKeuanganDetail(periode);
    const listPegawai = await this.pegawaiRepo.findAll();
    const rekapan = await this.calculateRekapan(periode);

    const summary = {
      totalPegawai: listPegawai.length,
      totalJaspelPad: 0,
      nonKapitasi: { total: 0, tidakLangsung: 0, langsung: 0 },
      padMurni: { total: 0, tidakLangsung: 0, langsung: 0 },
      topUnits: [] as { name: string, value: number }[],
      topEarners: rekapan.sort((a, b) => b.takeHomePay - a.takeHomePay).slice(0, 5)
    };

    const unitMap: Record<string, number> = {};

    detail.forEach(d => {
      summary.totalJaspelPad += d.jaspel60;
      
      if (d.jenisPendapatan === 'Non Kapitasi') {
        summary.nonKapitasi.total += d.jaspel60;
        summary.nonKapitasi.tidakLangsung += d.tidakLangsung;
        summary.nonKapitasi.langsung += d.langsung;
      } else if (d.jenisPendapatan === 'PAD Murni') {
        summary.padMurni.total += d.jaspel60;
        summary.padMurni.tidakLangsung += d.tidakLangsung;
        summary.padMurni.langsung += d.langsung;
      }

      if (d.namaLayanan) {
        unitMap[d.namaLayanan] = (unitMap[d.namaLayanan] || 0) + d.jumlahBlud;
      }
    });

    summary.topUnits = Object.entries(unitMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    return summary;
  }
}
