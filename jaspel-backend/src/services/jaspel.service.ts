import { KeuanganRepository } from "../repositories/keuangan.repository";
import { PegawaiRepository } from "../repositories/pegawai.repository";

export class JaspelService {
  constructor(
    private keuanganRepo: KeuanganRepository,
    private pegawaiRepo: PegawaiRepository
  ) {}

  async calculateKeuanganGlobal(periode: string) {
    const dataKeuangan = await this.keuanganRepo.getKeuanganByPeriode(periode);
    const pendapatan = dataKeuangan ? dataKeuangan.jumlahPendapatanBlud : 0;
    
    const jaspel = pendapatan * 0.6;
    const operasional = pendapatan * 0.4;
    const tidakLangsung = jaspel * 0.6;
    const langsung = jaspel * 0.4;

    return { pendapatan, jaspel, operasional, tidakLangsung, langsung };
  }

  async calculateBobotKapitasi(periode: string) {
    const listPegawai = await this.pegawaiRepo.findPegawaiWithKehadiran(periode);
    
    return listPegawai.map(p => {
      const hadirInfo = p.kehadiran;
      let prosentaseKehadiran = 0;
      if (hadirInfo && hadirInfo.hariKerja > 0) {
        prosentaseKehadiran = hadirInfo.hariMasukKerja / hadirInfo.hariKerja;
      }

      const jumlahPoin = p.poinTanggungJawab + p.poinKetenagaan + p.poinRangkapTugas + p.poinMasaKerja;
      const bobot = jumlahPoin * prosentaseKehadiran;

      return {
        id: p.id,
        nama: p.nama,
        nip: p.nip,
        golongan: p.golongan,
        prosentaseKehadiran,
        jumlahPoin,
        bobot
      };
    });
  }

  async calculateUnitPelayanan(periode: string) {
    const pendapatanUnit = await this.keuanganRepo.getPendapatanUnit(periode);
    const bobotList = await this.calculateBobotKapitasi(periode);
    const kinerjaPegawai = await this.keuanganRepo.getKinerjaPegawai(periode);
    const units = await this.keuanganRepo.getUnits();
    
    const resultByUnit = pendapatanUnit.map(pu => {
      const unitVal = units.find(u => u.id === pu.unitId);
      const unitNama = unitVal ? unitVal.nama : 'Unknown';

      const tidakLangsungNonKapitasi = pu.jumlahNonKapitasi * 0.6;
      const langsungNonKapitasi = pu.jumlahNonKapitasi * 0.4;
      
      const tidakLangsungPadRanap = pu.padRanap * 0.6;
      const langsungPadRanap = pu.padRanap * 0.4;

      // Map kinerja for this specific unit
      const kinerjaDiUnit = kinerjaPegawai.filter(k => k.unitId === pu.unitId).map(k => {
        const bobotPegawai = bobotList.find(b => b.id === k.pegawaiId)?.bobot || 0;
        const adjustedIndividu = bobotPegawai * k.jumlahTindakan;
        return {
          ...k,
          bobotPegawai,
          adjustedIndividu
        };
      });

      // Calculate totals per percent peran in unit
      // This part group by persentaseBobotPeran basically to find "Total Adjusted Profesi di Unit tsb"
      const totalAdjustedPerPeran: Record<string, number> = {};
      kinerjaDiUnit.forEach(k => {
        totalAdjustedPerPeran[k.persentaseBobotPeran.toString()] = (totalAdjustedPerPeran[k.persentaseBobotPeran.toString()] || 0) + k.adjustedIndividu;
      });

      const perhitunganPegawai = kinerjaDiUnit.map(k => {
        // Alokasi Profesi for Non Kapitasi
        const danaAlokasiProfesiNonKap = langsungNonKapitasi * k.persentaseBobotPeran;
        const totalAdjusted = totalAdjustedPerPeran[k.persentaseBobotPeran.toString()] || 1; 
        const jaspelProfesiNonKap = (k.adjustedIndividu / totalAdjusted) * danaAlokasiProfesiNonKap;

        // Alokasi Profesi for PAD Murni/Ranap
        const danaAlokasiProfesiPad = langsungPadRanap * k.persentaseBobotPeran;
        const jaspelProfesiPad = (k.adjustedIndividu / totalAdjusted) * danaAlokasiProfesiPad;

        return {
          pegawaiId: k.pegawaiId,
          jaspelProfesiNonKap,
          jaspelProfesiPad
        };
      });

      return {
        unitId: pu.unitId,
        unitNama,
        jumlahNonKapitasi: pu.jumlahNonKapitasi,
        padRanap: pu.padRanap,
        tidakLangsungNonKapitasi,
        langsungNonKapitasi,
        tidakLangsungPadRanap,
        langsungPadRanap,
        perhitunganPegawai
      };
    });

    return resultByUnit;
  }

  async calculatePrint60TidakLangsung(periode: string) {
      const bobotList = await this.calculateBobotKapitasi(periode);
      const dataKeuangan = await this.calculateKeuanganGlobal(periode);
      const unitPelayanan = await this.calculateUnitPelayanan(periode);

      let totalJaspelNonKapitasi60 = 0;
      let totalJaspelPadMurni60 = 0;
      unitPelayanan.forEach(u => {
          totalJaspelNonKapitasi60 += u.tidakLangsungNonKapitasi;
          totalJaspelPadMurni60 += u.tidakLangsungPadRanap;
      });

      const totalBobotSeluruh = bobotList.reduce((acc, curr) => acc + curr.bobot, 0);

      return bobotList.map(b => {
          // Calculate for both Non Kapitasi and PAD Murni
          const jaspelNonKap = (b.bobot / (totalBobotSeluruh || 1)) * totalJaspelNonKapitasi60;
          const jaspelPadMurni = (b.bobot / (totalBobotSeluruh || 1)) * totalJaspelPadMurni60;
          
          const getPph = (gol: string) => gol === 'IV' ? 0.15 : gol === 'III' ? 0.05 : 0;
          const pphPercent = getPph(b.golongan);

          const pphNonKap = jaspelNonKap * pphPercent;
          const pphPadMurni = jaspelPadMurni * pphPercent;

          return {
             id: b.id,
             nama: b.nama,
             golongan: b.golongan,
             bobot: b.bobot,
             jaspelNonKap,
             pphNonKap,
             bersihNonKap: jaspelNonKap - pphNonKap,
             jaspelPadMurni,
             pphPadMurni,
             bersihPadMurni: jaspelPadMurni - pphPadMurni,
          }
      });
  }

  async calculateRekapan(periode: string) {
      // Aggregates both 60% and 40% into the final Rekap pages.
      const print60 = await this.calculatePrint60TidakLangsung(periode);
      const units = await this.calculateUnitPelayanan(periode);

      const mappingTotalJaspel40: Record<string, {nonKap: number, padMurni: number}> = {};
      units.forEach(u => {
          u.perhitunganPegawai.forEach(p => {
              if(!mappingTotalJaspel40[p.pegawaiId]) mappingTotalJaspel40[p.pegawaiId] = {nonKap: 0, padMurni: 0};
              mappingTotalJaspel40[p.pegawaiId].nonKap += p.jaspelProfesiNonKap;
              mappingTotalJaspel40[p.pegawaiId].padMurni += p.jaspelProfesiPad;
          })
      });

      return print60.map(p60 => {
          const p40 = mappingTotalJaspel40[p60.id] || {nonKap: 0, padMurni: 0};
          
          const jumlahTL = p60.jaspelNonKap + p60.jaspelPadMurni;
          const jumlahLangsung = p40.nonKap + p40.padMurni;
          const totalJaspel = jumlahTL + jumlahLangsung;

          const pphPercent = p60.golongan === 'IV' ? 0.15 : p60.golongan === 'III' ? 0.05 : 0;
          const pph = totalJaspel * pphPercent;
          const jumlahBersih = totalJaspel - pph;

          return {
              pegawaiId: p60.id,
              nama: p60.nama,
              golongan: p60.golongan,
              tlNonKap: p60.jaspelNonKap,
              tlPad: p60.jaspelPadMurni,
              jumlahTL,
              lgsgNonKap: p40.nonKap,
              lgsgPad: p40.padMurni,
              jumlahLangsung,
              totalJaspel,
              pphPercent,
              pph,
              jumlahBersih
          }
      });
  }
}

