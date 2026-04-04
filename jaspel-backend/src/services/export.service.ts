import ExcelJS from "exceljs";
import { JaspelService } from "./jaspel.service";
import { bobotStaff } from "../db/schema";
import { KeuanganRepository } from "../repositories/keuangan.repository";
import { PegawaiRepository } from "../repositories/pegawai.repository";

export class ExportService {
  constructor(private jaspelService: JaspelService) {}

  // --- STYLING HELPERS ---
  private applyStandardStyle(cell: ExcelJS.Cell, bgColor?: string, isBold: boolean = false, align: string = 'center') {
    cell.font = { name: 'Calibri', size: 11, bold: isBold };
    cell.alignment = { vertical: 'middle', horizontal: align as any, wrapText: true };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
    if (bgColor) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: bgColor.replace('#', '') }
      };
    }
  }

  private formatCurrency(cell: ExcelJS.Cell) {
    cell.numFmt = '#,##0';
    cell.alignment = { vertical: 'middle', horizontal: 'right' };
  }

  // --- EXPORT ALL ORCHESTRATOR ---
  async exportAllToExcel(periode: string): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    
    // 1. Fetch all data needed
    const pegawaiRepo = (this.jaspelService as any).pegawaiRepo as PegawaiRepository;
    const db = (pegawaiRepo as any).db;
    
    const pegawaiData = await pegawaiRepo.findAll();
    const bobotStaffMaster = await db.select().from(bobotStaff).all().catch(() => []);
    const keuanganData = await this.jaspelService.calculateKeuanganGlobal(periode);
    const strukturData = await (this.jaspelService as any).pegawaiRepo.getStruktur();
    const bobotDistData = await this.jaspelService.calculateBobotKapitasi(periode);
    const rekapData = await this.jaspelService.calculateRekapan(periode);
    const unitPelayananData = await this.jaspelService.calculateUnitPelayanan(periode);
    const print60Data = await this.jaspelService.calculatePrint60TidakLangsung(periode);
    const print40Data = await this.jaspelService.calculatePrint40Langsung(periode);

    // 2. Build Sheets
    this.addDataDasarSheet(workbook, pegawaiData);
    this.addBobotStaffMasterSheet(workbook, pegawaiData, bobotStaffMaster);
    this.addStrukturSheet(workbook, strukturData, pegawaiData);
    this.addKeuanganSheet(workbook, keuanganData, periode);
    this.addBobotSheet(workbook, bobotDistData, periode);
    this.addRekapSheet(workbook, rekapData, periode);
    
    // Print 60
    this.addPrint60Sheet(workbook, print60Data, 'Non Kapitasi', periode);
    this.addPrint60Sheet(workbook, print60Data, 'PAD Murni', periode);
    
    // Print 40
    this.addPrint40Sheet(workbook, print40Data, 'Non Kapitasi', periode);
    this.addPrint40Sheet(workbook, print40Data, 'PAD Murni', periode);
    
    // 3. Unit Sheets
    for (const unit of unitPelayananData) {
        this.addUnitSheet(workbook, unit, periode, bobotDistData);
    }

    const buffer = await workbook.xlsx.writeBuffer() as Buffer;
    return buffer;
  }

  // --- SHEET BUILDERS ---

  private addDataDasarSheet(workbook: ExcelJS.Workbook, data: any[]) {
    const sheet = workbook.addWorksheet('Data Dasar');
    
    // Title
    sheet.mergeCells('A1:L1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'DATA KEPEGAWAIAN UPTD PUKESMAS MAJALENGKA';
    titleCell.font = { bold: true, size: 14 };
    titleCell.alignment = { horizontal: 'center' };

    // Headers
    const headers = [
      'No', 'Nama Petugas', 'Nomor Rekening', 'Nama Bank', 'NPWP', 'NIP',
      'Golongan', 'Jabatan', 'Jenis Ketenagaan', 'Penanggung Jawab'
    ];
    
    const headerRow = sheet.getRow(3);
    headers.forEach((h, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = h;
        this.applyStandardStyle(cell, '#FCE4D6', true);
    });

    data.forEach((row, idx) => {
      const r = sheet.getRow(idx + 4);
      r.getCell(1).value = idx + 1;
      r.getCell(2).value = row.nama;
      r.getCell(3).value = row.nomorRekening;
      r.getCell(4).value = row.namaBank;
      r.getCell(5).value = row.npwp;
      r.getCell(6).value = row.nip;
      r.getCell(7).value = row.golongan;
      r.getCell(8).value = row.jabatan;
      r.getCell(9).value = row.jenisKetenagaan;
      r.getCell(10).value = row.penanggungJawab;
      
      for(let i=1; i<=10; i++) this.applyStandardStyle(r.getCell(i), undefined, false, i === 2 ? 'left' : 'center');
    });

    sheet.getColumn(2).width = 35;
    sheet.getColumn(3).width = 20;
    sheet.getColumn(6).width = 25;
  }

  private addBobotStaffMasterSheet(workbook: ExcelJS.Workbook, pegawai: any[], bobot: any[]) {
    const sheet = workbook.addWorksheet('Master Bobot Staff');
    sheet.mergeCells('A1:F1');
    sheet.getCell('A1').value = 'MASTER BOBOT JABATAN & RISIKO STAFF';
    sheet.getCell('A1').font = { bold: true };

    const headers = ['No', 'Nama Petugas', 'Jabatan Unit', 'Risiko', 'Unit Kerja', 'Status'];
    const row = sheet.getRow(3);
    headers.forEach((h, i) => {
        const cell = row.getCell(i + 1);
        cell.value = h;
        this.applyStandardStyle(cell, '#E2EFDA', true);
    });

    pegawai.forEach((p, idx) => {
        const b = bobot.find((x: any) => x.pegawaiId === p.id);
        const r = sheet.getRow(idx + 4);
        r.getCell(1).value = idx + 1;
        r.getCell(2).value = p.nama;
        r.getCell(3).value = b?.jabatanUnit || '-';
        r.getCell(4).value = b?.risiko || '-';
        r.getCell(5).value = b?.unitKerja || '-';
        r.getCell(6).value = b?.status || '-';
        for(let i=1; i<=6; i++) this.applyStandardStyle(r.getCell(i), undefined, false, i === 2 ? 'left' : 'center');
    });
    sheet.getColumn(2).width = 35;
  }

  private addKeuanganSheet(workbook: ExcelJS.Workbook, data: any, periode: string) {
    const sheet = workbook.addWorksheet('Keuangan');
    
    sheet.mergeCells('A1:G1');
    const title = sheet.getCell('A1');
    title.value = `REALISASI PENDAPATAN JASPEL PERIODE ${periode}`;
    title.font = { bold: true, size: 12 };
    title.alignment = { horizontal: 'center' };

    const header = ['JENIS PENDAPATAN', 'LAYANAN', 'JUMLAH BLUD', 'JASPEL (60%)', 'OPERASIONAL (40%)', 'TIDAK LANGSUNG', 'LANGSUNG'];
    const row = sheet.getRow(3);
    header.forEach((h, i) => {
        const cell = row.getCell(i + 1);
        cell.value = h;
        this.applyStandardStyle(cell, '#7030A0', true);
        cell.font.color = { argb: 'FFFFFF' };
    });

    let currentRow = 4;
    data.items.forEach((item: any) => {
      const r = sheet.getRow(currentRow++);
      r.getCell(1).value = item.jenisPendapatan;
      r.getCell(2).value = item.namaLayanan;
      r.getCell(3).value = item.jumlahBlud;
      r.getCell(4).value = item.jaspel60;
      r.getCell(5).value = item.operasional40;
      r.getCell(6).value = item.tidakLangsung;
      r.getCell(7).value = item.langsung;

      for(let i=1; i<=7; i++) {
          this.applyStandardStyle(r.getCell(i), undefined, false, i <= 2 ? 'left' : 'right');
          if(i >= 3) this.formatCurrency(r.getCell(i));
      }
    });

    // Total Row
    const tr = sheet.getRow(currentRow);
    tr.getCell(1).value = 'TOTAL';
    sheet.mergeCells(`A${currentRow}:B${currentRow}`);
    tr.getCell(3).value = data.pendapatan;
    tr.getCell(4).value = data.jaspel;
    tr.getCell(5).value = data.operasional;
    tr.getCell(6).value = data.tidakLangsung;
    tr.getCell(7).value = data.langsung;
    
    for(let i=1; i<=7; i++) {
        this.applyStandardStyle(tr.getCell(i), '#92D050', true);
        if(i >= 3) this.formatCurrency(tr.getCell(i));
    }

    sheet.getColumn(1).width = 20;
    sheet.getColumn(2).width = 25;
    sheet.getColumn(3).width = 18;
    sheet.getColumn(4).width = 18;
    sheet.getColumn(5).width = 18;
  }

  private addStrukturSheet(workbook: ExcelJS.Workbook, data: any[], allPegawai: any[]) {
    const sheet = workbook.addWorksheet('Struktur');
    sheet.mergeCells('A1:C1');
    sheet.getCell('A1').value = 'STRUKTUR ORGANISASI PUKESMAS';
    sheet.getCell('A1').font = { bold: true };
    sheet.getCell('A1').alignment = { horizontal: 'center' };

    const header = ['Jabatan', ':', 'Nama Pejabat'];
    const hr = sheet.getRow(3);
    header.forEach((h, i) => {
        const cell = hr.getCell(i + 1);
        cell.value = h;
        this.applyStandardStyle(cell, '#E2EFDA', true);
    });

    data.forEach((item, idx) => {
       const r = sheet.getRow(idx + 4);
       const peg = item.pegawaiId ? allPegawai.find(p => p.id === item.pegawaiId) : null;
       r.getCell(1).value = item.jabatan;
       r.getCell(2).value = ':';
       r.getCell(3).value = peg ? peg.nama : (item.namaPejabat || '-');
       
       this.applyStandardStyle(r.getCell(1), undefined, false, 'left');
       this.applyStandardStyle(r.getCell(2), undefined, false, 'center');
       this.applyStandardStyle(r.getCell(3), undefined, false, 'left');
    });

    sheet.getColumn(1).width = 40;
    sheet.getColumn(3).width = 40;
  }

  private addBobotSheet(workbook: ExcelJS.Workbook, data: any[], periode: string) {
    const sheet = workbook.addWorksheet('Bobot Kapitasi & 60%');
    sheet.mergeCells('A1:M1');
    sheet.getCell('A1').value = `PERHITUNGAN POIN & BOBOT JASPEL PERIODE ${periode}`;
    sheet.getCell('A1').font = { bold: true };
    
    const headers = [
        'No', 'Nama Petugas', 'Tanggung Jawab', 'Ketenagaan', 'Rangkap Tugas', 'MK', 'Masa Kerja', 'Msk', 'Hkr', 'Hadir (%)', 'Poin Kap', 'Bobot Kap', 'Poin Non Kap', 'Bobot Non Kap'
    ];
    const hr = sheet.getRow(3);
    headers.forEach((h, i) => {
        const cell = hr.getCell(i + 1);
        cell.value = h;
        this.applyStandardStyle(cell, '#C6E0B4', true);
    });

    data.forEach((row, idx) => {
        const r = sheet.getRow(idx + 4);
        r.getCell(1).value = idx + 1;
        r.getCell(2).value = row.nama;
        r.getCell(3).value = row.poinTanggungJawab;
        r.getCell(4).value = row.poinKetenagaan;
        r.getCell(5).value = row.rangkapTugasAdm;
        r.getCell(6).value = row.poinMasaKerja;
        r.getCell(7).value = row.lamaMasaKerja;
        r.getCell(8).value = row.hariMasukKerja;
        r.getCell(9).value = row.hariKerja;
        r.getCell(10).value = row.prosentaseKehadiran;
        r.getCell(10).numFmt = '0%';
        r.getCell(11).value = row.jumlahPoinKapitasi;
        r.getCell(12).value = row.bobotKapitasi;
        r.getCell(13).value = row.jumlahPoinNonKapitasi;
        r.getCell(14).value = row.bobotNonKapitasi;

        for(let i=1; i<=14; i++) this.applyStandardStyle(r.getCell(i), undefined, false, i === 2 ? 'left' : 'center');
    });

    sheet.getColumn(2).width = 30;
  }

  private addRekapSheet(workbook: ExcelJS.Workbook, data: any[], periode: string) {
    const sheet = workbook.addWorksheet('Rekap Keseluruhan');
    sheet.mergeCells('A1:L1');
    sheet.getCell('A1').value = `REKAPITULASI PEMBAGIAN JASPEL PERIODE ${periode}`;
    sheet.getCell('A1').font = { bold: true, size: 14 };

    const headers = [
        'No', 'Nama Petugas', 'Non Kap TL', 'PAD TL', 'Total TL', 'Non Kap Lgsg', 'PAD Lgsg', 'Total Lgsg', 'Total Jaspel', 'PPh (%)', 'PPh (Rp)', 'Take Home Pay'
    ];
    const hr = sheet.getRow(3);
    headers.forEach((h, i) => {
        const cell = hr.getCell(i + 1);
        cell.value = h;
        this.applyStandardStyle(cell, '#BDD7EE', true);
    });

    data.forEach((row, idx) => {
        const r = sheet.getRow(idx + 4);
        r.getCell(1).value = idx + 1;
        r.getCell(2).value = row.nama;
        r.getCell(3).value = row.tlNonKap;
        r.getCell(4).value = row.tlPad;
        r.getCell(5).value = row.totalTL;
        r.getCell(6).value = row.lgsgNonKap;
        r.getCell(7).value = row.lgsgPad;
        r.getCell(8).value = row.totalL;
        r.getCell(9).value = row.totalJaspel;
        r.getCell(10).value = row.pphPercent;
        r.getCell(11).value = row.pphNominal;
        r.getCell(12).value = row.takeHomePay;

        for(let i=1; i<=12; i++) {
           this.applyStandardStyle(r.getCell(i), undefined, i === 12, i === 2 ? 'left' : (i === 10 ? 'center' : 'right'));
           if (i >= 3 && i !== 10) this.formatCurrency(r.getCell(i));
        }
    });

    sheet.getColumn(2).width = 35;
  }

  private addPrint60Sheet(workbook: ExcelJS.Workbook, data: any[], type: 'Non Kapitasi' | 'PAD Murni', periode: string) {
    const sheet = workbook.addWorksheet(`Print 60% ${type}`);
    sheet.mergeCells('A1:L1');
    sheet.getCell('A1').value = `DISTRIBUSI JASPEL 60% ${type.toUpperCase()} - ${periode}`;
    sheet.getCell('A1').font = { bold: true };

    const headers = ['No', 'Nama Pegawai', 'Gol', 'Masa Kerja', 'RT ADM', 'Msk', 'Hkr', 'Hadir (%)', 'Bobot', 'Jaspel Kotor', 'PPh (%)', 'PPh (Rp)', 'Jaspel Bersih'];
    const hr = sheet.getRow(3);
    headers.forEach((h, i) => {
        const cell = hr.getCell(i + 1);
        cell.value = h;
        this.applyStandardStyle(cell, type === 'Non Kapitasi' ? '#F4B084' : '#C5E0B3', true);
    });

    data.forEach((row, idx) => {
        const r = sheet.getRow(idx + 4);
        r.getCell(1).value = idx + 1;
        r.getCell(2).value = row.nama;
        r.getCell(3).value = row.golongan;
        r.getCell(4).value = row.masaKerja;
        r.getCell(5).value = row.rangkapTugasAdm;
        r.getCell(6).value = row.hariMasukKerja;
        r.getCell(7).value = row.hariKerja;
        r.getCell(8).value = row.prosentaseKehadiran;
        r.getCell(8).numFmt = '0%';
        r.getCell(9).value = row.bobot;
        
        const isNK = type === 'Non Kapitasi';
        r.getCell(10).value = isNK ? row.jaspelNonKap : row.jaspelPadMurni;
        r.getCell(11).value = isNK ? row.pphPercentNonKap : row.pphPercentPad;
        r.getCell(12).value = isNK ? row.pphNonKap : row.pphPadMurni;
        r.getCell(13).value = isNK ? row.bersihNonKap : row.bersihPadMurni;

        for(let i=1; i<=13; i++) {
           this.applyStandardStyle(r.getCell(i), undefined, false, i === 2 ? 'left' : 'center');
           if (i >= 10 && i !== 11) this.formatCurrency(r.getCell(i));
        }
    });

    sheet.getColumn(2).width = 30;
  }

  private addPrint40Sheet(workbook: ExcelJS.Workbook, data: any[], type: 'Non Kapitasi' | 'PAD Murni', periode: string) {
    const sheet = workbook.addWorksheet(`Print 40% ${type}`);
    sheet.mergeCells('A1:G1');
    sheet.getCell('A1').value = `DISTRIBUSI JASPEL 40% ${type.toUpperCase()} - ${periode}`;
    sheet.getCell('A1').font = { bold: true };
    const headers = ['No', 'Nama Pegawai', 'Gol', 'Jaspel Kotor', 'PPh (Rp)', 'Jaspel Bersih', 'Ket'];
    const hr = sheet.getRow(3);
    headers.forEach((h, i) => {
        const cell = hr.getCell(i + 1); cell.value = h;
        this.applyStandardStyle(cell, '#DDEBF7', true);
    });

    data.forEach((row, idx) => {
        const r = sheet.getRow(idx + 4);
        r.getCell(1).value = idx + 1; r.getCell(2).value = row.nama; r.getCell(3).value = row.golongan;
        const isNK = type === 'Non Kapitasi';
        r.getCell(4).value = isNK ? row.jaspelNonKap : row.jaspelPadMurni;
        r.getCell(5).value = isNK ? row.pphNonKap : row.pphPadMurni;
        r.getCell(6).value = isNK ? row.bersihNonKap : row.bersihPadMurni;
        r.getCell(7).value = isNK ? (row.isOverride ? 'Override' : '-') : '';
        for(let i=1; i<=7; i++) {
           this.applyStandardStyle(r.getCell(i), undefined, false, i === 2 ? 'left' : 'center');
           if (i >= 4 && i <= 6) this.formatCurrency(r.getCell(i));
        }
    });
    sheet.getColumn(2).width = 30;
  }

  private addUnitSheet(workbook: ExcelJS.Workbook, unit: any, periode: string, bobotData: any[]) {
      const safeName = unit.unitNama.substring(0, 31).replace(/[/*?:\[\]]/g, '');
      const sheet = workbook.addWorksheet(safeName);
      
      sheet.mergeCells('A1:F1');
      sheet.getCell('A1').value = `UNIT PELAYANAN: ${unit.unitNama} - ${periode}`;
      sheet.getCell('A1').font = { bold: true };

      const headers = ['No', 'Nama Pegawai', 'Bobot Staff', 'Jaspel Non Kap', 'Jaspel PAD', 'Total Langsung'];
      const hr = sheet.getRow(3);
      headers.forEach((h, i) => {
          const cell = hr.getCell(i + 1);
          cell.value = h;
          this.applyStandardStyle(cell, '#FFF2CC', true);
      });

      unit.perhitunganPegawai.forEach((p: any, idx: number) => {
          const r = sheet.getRow(idx + 4);
          const peg = bobotData.find(b => b.id === p.pegawaiId);
          r.getCell(1).value = idx + 1;
          r.getCell(2).value = peg?.nama || p.pegawaiId;
          r.getCell(3).value = peg?.bobotNonKapitasi || 0;
          r.getCell(4).value = p.jaspelProfesiNonKap;
          r.getCell(5).value = p.jaspelProfesiPad;
          r.getCell(6).value = p.jaspelProfesiNonKap + p.jaspelProfesiPad;

          for(let i=1; i<=6; i++){
              this.applyStandardStyle(r.getCell(i), undefined, false, i === 2 ? 'left' : (i <= 3 ? 'center' : 'right'));
              if(i >= 4) this.formatCurrency(r.getCell(i));
          }
      });

      sheet.getColumn(2).width = 35;
  }

  async exportRekapToExcel(periode: string): Promise<Buffer> {
    const data = await this.jaspelService.calculateRekapan(periode);
    const workbook = new ExcelJS.Workbook();
    this.addRekapSheet(workbook, data, periode);
    return await workbook.xlsx.writeBuffer() as Buffer;
  }
}
