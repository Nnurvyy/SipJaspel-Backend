import { KeuanganRepository } from "../repositories/keuangan.repository";
import { PegawaiRepository } from "../repositories/pegawai.repository";

export class JaspelService {
  constructor(
    private keuanganRepo: KeuanganRepository,
    private pegawaiRepo: PegawaiRepository
  ) {}

  private getPoinJabatanUnit(jabatan: string | null | undefined): number {
    if (!jabatan) return 0;
    if (jabatan === "PJ") return 3;
    if (jabatan === "Koordinator" || jabatan === "Koordinator Pelayanan") return 2;
    if (jabatan === "Tidak memiliki jabatan struktural") return 1;
    return 0;
  }

  private getPoinRisiko(risiko: string | null | undefined): number {
    if (!risiko) return 0;
    if (risiko === "Sangat Tinggi") return 5;
    if (risiko === "Tinggi") return 4;
    if (risiko === "Sedang") return 3;
    if (risiko === "Rendah") return 2;
    if (risiko === "Sangat Rendah") return 1;
    return 0;
  }

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
    return 2.5;
  }


  async calculateBobotKapitasi(periode: string) {
    const listPegawai = await this.pegawaiRepo.findPegawaiWithKehadiran(periode);
    const struktur = await this.pegawaiRepo.getStruktur();
    
    return listPegawai.map(p => {
      const hadirInfo = p.kehadiran;

      const listStruktur = struktur.filter(s => s.pegawaiId === p.id);
      const countInStruktur = listStruktur.length;
      const sumPoinStruktur = listStruktur.reduce((acc, curr) => acc + (curr.poin || 0), 0);
      
      const poinTanggungJawab = hadirInfo?.poinTanggungJawab ?? sumPoinStruktur;

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
        sumStruktur: sumPoinStruktur,
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
    const bobotStaffData = await this.pegawaiRepo.getAllBobotStaff();
    
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
      let paguData = await this.keuanganRepo.getPaguUnitPeran(u.id, periode);

      const UNIT_CONFIGS: Record<string, any[]> = {
        'ugd': [
            { key: 'dokter', label: 'Dokter', paguNonKap: 20, paguPadMurni: 20 },
            { key: 'perawat', label: 'Perawat', paguNonKap: 70, paguPadMurni: 70 },
            { key: 'pengelola', label: 'Pejabat Pengelola BLUD', paguNonKap: 10, paguPadMurni: 10 },
        ],
        'one day care': [
            { key: 'dokter', label: 'Dokter', paguNonKap: 30, paguPadMurni: 30 },
            { key: 'perawat', label: 'Perawat', paguNonKap: 60, paguPadMurni: 60 },
            { key: 'pengelola', label: 'Pejabat Pengelola BLUD', paguNonKap: 10, paguPadMurni: 10 },
        ],
        'poned': [
            { key: 'dokter', label: 'Dokter', paguNonKap: 10, paguPadMurni: 10 },
            { key: 'bidan_jaga', label: 'Bidan Jaga', paguNonKap: 55, paguPadMurni: 55 },
            { key: 'bidan_asal_bulin', label: 'Bidan Asal Bulin', paguNonKap: 5, paguPadMurni: 5 },
            { key: 'pendamping_rujukan', label: 'Pendamping Rujukan', paguNonKap: 5, paguPadMurni: 5 },
            { key: 'penolong_persalinan', label: 'Penolong Persalinan', paguNonKap: 10, paguPadMurni: 10 },
            { key: 'manajemen_poned', label: 'Manajemen PONED', paguNonKap: 5, paguPadMurni: 5 },
            { key: 'pengelola', label: 'Pejabat Pengelola BLUD', paguNonKap: 10, paguPadMurni: 10 },
        ],
        'konseling': [
            { key: 'dokter', label: 'Dokter', paguNonKap: 30, paguPadMurni: 30 },
            { key: 'petugas', label: 'Petugas Konseling', paguNonKap: 60, paguPadMurni: 60 },
            { key: 'pengelola', label: 'Pejabat Pengelola BLUD', paguNonKap: 10, paguPadMurni: 10 },
        ],
        'haji': [
            { key: 'dokter', label: 'Dokter', paguNonKap: 30, paguPadMurni: 30 },
            { key: 'perawat_bidan', label: 'Perawat/Bidan', paguNonKap: 60, paguPadMurni: 60 },
            { key: 'pengelola', label: 'Pejabat Pengelola BLUD', paguNonKap: 10, paguPadMurni: 10 },
        ],
        'kia': [
            { key: 'dokter', label: 'Dokter', paguNonKap: 30, paguPadMurni: 30 },
            { key: 'perawat_bidan', label: 'Perawat/Bidan', paguNonKap: 60, paguPadMurni: 60 },
            { key: 'pengelola', label: 'Pejabat Pengelola BLUD', paguNonKap: 10, paguPadMurni: 10 },
        ],
        'usg': [
            { key: 'dokter', label: 'Dokter', paguNonKap: 35, paguPadMurni: 35 },
            { key: 'perawat_bidan', label: 'Perawat/Bidan', paguNonKap: 55, paguPadMurni: 55 },
            { key: 'pengelola', label: 'Pejabat Pengelola BLUD', paguNonKap: 10, paguPadMurni: 10 },
        ],
        'kb': [
            { key: 'dokter', label: 'Dokter', paguNonKap: 30, paguPadMurni: 30 },
            { key: 'perawat_bidan', label: 'Perawat/Bidan', paguNonKap: 60, paguPadMurni: 60 },
            { key: 'pengelola', label: 'Pejabat Pengelola BLUD', paguNonKap: 10, paguPadMurni: 10 },
        ],
        'lab': [
            { key: 'dokter', label: 'Dokter', paguNonKap: 20, paguPadMurni: 20 },
            { key: 'atlm', label: 'ATLM', paguNonKap: 70, paguPadMurni: 70 },
            { key: 'pengelola', label: 'Pejabat Pengelola BLUD', paguNonKap: 10, paguPadMurni: 10 },
        ],
        'poli umum': [
            { key: 'dokter', label: 'Dokter', paguNonKap: 30, paguPadMurni: 30 },
            { key: 'perawat', label: 'Perawat', paguNonKap: 60, paguPadMurni: 60 },
            { key: 'pengelola', label: 'Pejabat Pengelola BLUD', paguNonKap: 10, paguPadMurni: 10 },
        ],
        'gigi': [
            { key: 'dokter', label: 'Dokter', paguNonKap: 50, paguPadMurni: 50 },
            { key: 'perawat', label: 'Perawat Gigi', paguNonKap: 40, paguPadMurni: 40 },
            { key: 'pengelola', label: 'Pejabat Pengelola BLUD', paguNonKap: 10, paguPadMurni: 10 },
        ],
        'poli gigi': [
            { key: 'dokter', label: 'Dokter', paguNonKap: 50, paguPadMurni: 50 },
            { key: 'perawat', label: 'Perawat Gigi', paguNonKap: 40, paguPadMurni: 40 },
            { key: 'pengelola', label: 'Pejabat Pengelola BLUD', paguNonKap: 10, paguPadMurni: 10 },
        ],
        'ambulans': [
            { key: 'perawat_bidan', label: 'Perawat/Bidan', paguNonKap: 50, paguPadMurni: 50 },
            { key: 'pengemudi', label: 'Pengemudi', paguNonKap: 40, paguPadMurni: 40 },
            { key: 'pengelola', label: 'Pejabat Pengelola BLUD', paguNonKap: 10, paguPadMurni: 10 },
        ]
      };

      if (paguData.length === 0) {
          const defaults = UNIT_CONFIGS[u.nama.toLowerCase().trim()] || [];
          paguData = defaults.map(dc => ({
              id: 'tmp', unitId: u.id, periode: periode, peranKey: dc.key, paguNonKap: dc.paguNonKap, paguPadMurni: dc.paguPadMurni
          }));
      }

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
      const employeeEarnings: Record<string, { nk: number; pad: number; roles: Record<string, { tindakan: number; adjusted: number; jaspelNK: number; jaspelPad: number }> }> = {};
      allUnitActions.forEach((a) => {
        const emp = kinerjaDiUnit.find((k) => k.id === a.kinerjaPegawaiId);
        if (emp && roleBuckets[a.peranKey]) {
          const finalAdjusted = (a as any).finalAdjusted || 0;
          const totalAdjWeight = roleTotalAdjWeight[a.peranKey] || 1;
          
          const nkShare = (finalAdjusted / totalAdjWeight) * roleBuckets[a.peranKey].nk;
          const padShare = (finalAdjusted / totalAdjWeight) * roleBuckets[a.peranKey].pad;

          if (!employeeEarnings[emp.pegawaiId]) {
            employeeEarnings[emp.pegawaiId] = { nk: 0, pad: 0, roles: {} };
          }
          employeeEarnings[emp.pegawaiId].nk += nkShare;
          employeeEarnings[emp.pegawaiId].pad += padShare;
          employeeEarnings[emp.pegawaiId].roles[a.peranKey] = {
             tindakan: a.jumlahTindakan,
             adjusted: finalAdjusted,
             jaspelNK: nkShare,
             jaspelPad: padShare
          };
        }
      });

      const perhitunganPegawai = bobotList.map((b) => {
        const earnings = employeeEarnings[b.id] || { nk: 0, pad: 0, roles: {} };
        const stf = bobotStaffData.find(st => st.pegawaiId === b.id);
        const calcBobotMaster = this.getPoinJabatanUnit(stf?.jabatanUnit) + this.getPoinRisiko(stf?.risiko);
        return {
          pegawaiId: b.id,
          bobotPegawai: calcBobotMaster || 0,
          jaspelProfesiNonKap: earnings.nk,
          jaspelProfesiPad: earnings.pad,
          roles: earnings.roles
        };
      });

      results.push({
        unitId: u.id,
        unitNama: u.nama,
        jumlahNonKapitasi: sumBludNK,
        padRanap: sumBludPad,
        langsungNonKapitasi,
        langsungPadRanap,
        paguData,
        roleBuckets,
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
