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
    cell.numFmt = '"Rp" #,##0';
    cell.alignment = { vertical: 'middle', horizontal: 'right' };
  }

  private parsePeriodeToString(periode: string) {
    const [tahun, bulanStr] = periode.split('-');
    const bulanNames = ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];
    const bulan = bulanStr ? bulanNames[parseInt(bulanStr) - 1] : '';
    return { bulan, tahun };
  }

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

  // --- EXPORT ALL ORCHESTRATOR ---
  async exportAllToExcel(dbPeriode: string, displayPeriode: string): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    
    // 1. Fetch all data needed
    const pegawaiRepo = (this.jaspelService as any).pegawaiRepo as PegawaiRepository;
    const db = (pegawaiRepo as any).db;
    
    const pegawaiData = await pegawaiRepo.findAll();
    const bobotStaffMaster = await db.select().from(bobotStaff).all().catch(() => []);
    const keuanganData = await this.jaspelService.calculateKeuanganGlobal(dbPeriode);
    const strukturData = await (this.jaspelService as any).pegawaiRepo.getStruktur();
    const bobotDistData = await this.jaspelService.calculateBobotKapitasi(dbPeriode);
    const rekapData = await this.jaspelService.calculateRekapan(dbPeriode);
    const unitPelayananData = await this.jaspelService.calculateUnitPelayanan(dbPeriode);
    const print60Data = await this.jaspelService.calculatePrint60TidakLangsung(dbPeriode);
    const print40Data = await this.jaspelService.calculatePrint40Langsung(dbPeriode);
    const printLainData = await this.jaspelService.calculatePrintLainLain(dbPeriode);


    // 2. Build Sheets
    this.addDataDasarSheet(workbook, pegawaiData);
    this.addBobotStaffMasterSheet(workbook, pegawaiData, bobotStaffMaster);
    this.addStrukturSheet(workbook, strukturData, pegawaiData);
    this.addKeuanganSheet(workbook, keuanganData, displayPeriode);
    this.addBobotSheet(workbook, bobotDistData, displayPeriode);
    this.addRekapSheet(workbook, rekapData, displayPeriode);
    
    // Print 60
    this.addPrint60Sheet(workbook, print60Data, 'Non Kapitasi', displayPeriode, keuanganData);
    this.addPrint60Sheet(workbook, print60Data, 'PAD Murni', displayPeriode, keuanganData);
    
    // Print 40
    this.addPrint40Sheet(workbook, print40Data, 'Non Kapitasi', displayPeriode, keuanganData);
    this.addPrint40Sheet(workbook, print40Data, 'PAD Murni', displayPeriode, keuanganData);
    
    // Print Lain-lain
    this.addPrintLainSheet(workbook, printLainData, displayPeriode, keuanganData);
    
    const allowedUnits = [
        'ugd', 'one day care', 'poned', 'konseling', 'haji', 
        'kia', 'usg', 'kb', 'lab', 'poli umum', 'gigi', 'ambulans',
        'poli gigi', 'gula darah'
    ];
    for (const unit of unitPelayananData) {
        if (allowedUnits.includes(unit.unitNama.toLowerCase().trim())) {
            this.addUnitSheet(workbook, unit, displayPeriode, bobotDistData);
        }
    }

    // TCM distribution at the end
    const tcmData = await this.jaspelService.calculateTcmDistribution(dbPeriode);
    this.addTCMSheet(workbook, tcmData, displayPeriode);

    const buffer = await workbook.xlsx.writeBuffer() as unknown as Buffer;
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
    sheet.getColumn(8).width = 35;
    sheet.getColumn(10).width = 35;
  }

  private addBobotStaffMasterSheet(workbook: ExcelJS.Workbook, pegawai: any[], bobot: any[]) {
    const sheet = workbook.addWorksheet('Master Bobot Staff');
    sheet.mergeCells('A1:G1');
    sheet.getCell('A1').value = 'MASTER BOBOT JABATAN & RISIKO STAFF UPTD PUSKESMAS MAJALENGKA';
    sheet.getCell('A1').font = { bold: true };
    sheet.getCell('A1').alignment = { horizontal: 'center' };

    const headers = ['No', 'Nama Petugas', 'Bobot', 'Jabatan Unit', 'Risiko', 'Unit Kerja', 'Status'];
    const row = sheet.getRow(3);
    headers.forEach((h, i) => {
        const cell = row.getCell(i + 1);
        cell.value = h;
        this.applyStandardStyle(cell, '#E2EFDA', true);
    });

    pegawai.forEach((p, idx) => {
        const b = bobot.find((x: any) => x.pegawaiId === p.id);
        const poinJabatan = this.getPoinJabatanUnit(b?.jabatanUnit);
        const poinRisiko = this.getPoinRisiko(b?.risiko);
        
        const r = sheet.getRow(idx + 4);
        r.getCell(1).value = idx + 1;
        r.getCell(2).value = p.nama;
        r.getCell(3).value = poinJabatan + poinRisiko;
        r.getCell(4).value = b?.jabatanUnit || '-';
        r.getCell(5).value = poinRisiko;
        r.getCell(6).value = b?.unitKerja || '-';
        r.getCell(7).value = b?.status || '-';
        for(let i=1; i<=7; i++) {
            this.applyStandardStyle(r.getCell(i), undefined, false, i === 2 ? 'left' : 'center');
            if (i >= 4 && i <= 7) {
                r.getCell(i).alignment = { ...r.getCell(i).alignment as any, wrapText: false };
            }
        }
    });
    sheet.getColumn(2).width = 35;
    sheet.getColumn(3).width = 12;
    sheet.getColumn(4).width = 40;
    sheet.getColumn(5).width = 15;
    sheet.getColumn(6).width = 30;
    sheet.getColumn(7).width = 20;
  }

  private addKeuanganSheet(workbook: ExcelJS.Workbook, data: any, periode: string) {
    const sheet = workbook.addWorksheet('Keuangan');
    
    sheet.mergeCells('A1:G1');
    const title = sheet.getCell('A1');
    title.value = `REALISASI PENDAPATAN JASPEL PERIODE ${periode}`;
    title.font = { bold: true, size: 12 };
    title.alignment = { horizontal: 'center' };

    const header = ['JENIS PENDAPATAN', 'LAYANAN', 'JUMLAH BLUD', 'JASPEL (60%)', 'OPERASIONAL (40%)', 'TIDAK LANGSUNG (60%)', 'LANGSUNG (40%)'];
    const row = sheet.getRow(3);
    header.forEach((h, i) => {
        const cell = row.getCell(i + 1);
        cell.value = h;
        this.applyStandardStyle(cell, '#7030A0', true);
        cell.font.color = { argb: 'FFFFFF' };
    });

    let currentRow = 4;

    const printItemRow = (item: any) => {
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
    };

    const printTotalRow = (label: string, blud: number, jaspel: number, op: number, tl: number, l: number, bgColor: string) => {
        const tr = sheet.getRow(currentRow);
        tr.getCell(1).value = label;
        sheet.mergeCells(`A${currentRow}:B${currentRow}`);
        tr.getCell(3).value = blud;
        tr.getCell(4).value = jaspel;
        tr.getCell(5).value = op;
        tr.getCell(6).value = tl;
        tr.getCell(7).value = l;
        
        for(let i=1; i<=7; i++) {
            this.applyStandardStyle(tr.getCell(i), bgColor, true, i <= 2 ? 'left' : 'right');
            if(i >= 3) this.formatCurrency(tr.getCell(i));
        }
        currentRow++;
    };

    const nonKapItems = data.items.filter((i: any) => i.jenisPendapatan === 'Non Kapitasi');
    const padItems = data.items.filter((i: any) => i.jenisPendapatan === 'PAD Murni');
    const lainLainItems = data.items.filter((i: any) => i.jenisPendapatan === 'Lain - lain');

    let tNKBlud = 0, tNKJaspel = 0, tNKOp = 0, tNKTL = 0, tNKL = 0;
    nonKapItems.forEach((item: any) => {
        tNKBlud += item.jumlahBlud; tNKJaspel += item.jaspel60; tNKOp += item.operasional40; tNKTL += item.tidakLangsung; tNKL += item.langsung;
        printItemRow(item);
    });
    if (nonKapItems.length > 0) {
        printTotalRow('Total N. Kapitasi', tNKBlud, tNKJaspel, tNKOp, tNKTL, tNKL, '#92D050');
    }

    let tPADBlud = 0, tPADJaspel = 0, tPADOp = 0, tPADTL = 0, tPADL = 0;
    padItems.forEach((item: any) => {
        tPADBlud += item.jumlahBlud; tPADJaspel += item.jaspel60; tPADOp += item.operasional40; tPADTL += item.tidakLangsung; tPADL += item.langsung;
        printItemRow(item);
    });
    if (padItems.length > 0) {
        printTotalRow('Total PAD Murni', tPADBlud, tPADJaspel, tPADOp, tPADTL, tPADL, '#92D050');
    }

    let tLainBlud = 0, tLainJaspel = 0, tLainOp = 0;
    lainLainItems.forEach((item: any) => {
        tLainBlud += item.jumlahBlud; tLainJaspel += item.jaspel60; tLainOp += item.operasional40;
        const r = sheet.getRow(currentRow++);
        r.getCell(1).value = item.jenisPendapatan;
        r.getCell(2).value = item.namaLayanan;
        r.getCell(3).value = item.jumlahBlud;
        r.getCell(4).value = item.jaspel60;
        r.getCell(5).value = item.operasional40;
        r.getCell(6).value = '-';
        r.getCell(7).value = '-';
        for(let i=1; i<=7; i++) {
            this.applyStandardStyle(r.getCell(i), undefined, false, i <= 2 ? 'left' : 'right');
            if(i >= 3 && i <= 5) this.formatCurrency(r.getCell(i));
        }
    });
    if (lainLainItems.length > 0) {
        printTotalRow('Total Lain-lain', tLainBlud, tLainJaspel, tLainOp, 0, 0, '#92D050');
        // Fix the row we just printed to show '-' for TL/L
        const lastRow = sheet.getRow(currentRow - 1);
        lastRow.getCell(6).value = '-';
        lastRow.getCell(7).value = '-';
    }

    printTotalRow('GRAND TOTAL', data.pendapatan, data.jaspel, data.operasional, data.tidakLangsung, data.langsung, '#FFFF00');


    sheet.getColumn(1).width = 20;
    sheet.getColumn(2).width = 30;
    sheet.getColumn(3).width = 22;
    sheet.getColumn(4).width = 22;
    sheet.getColumn(5).width = 22;
    sheet.getColumn(6).width = 35;
    sheet.getColumn(7).width = 35;
  }

  private addStrukturSheet(workbook: ExcelJS.Workbook, data: any[], allPegawai: any[]) {
    const sheet = workbook.addWorksheet('PJ dan Koordinator');

    // Title row 1
    sheet.mergeCells('A1:I1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'PENANGGUNG JAWAB DAN KOORDINATOR UPTD PUSKESMAS MAJALENGKA';
    titleCell.font = { bold: true, size: 12 };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FCE4D6' } };

    // Header row 2 — merged group
    sheet.mergeCells('C2:H2');
    const groupCell = sheet.getCell('C2');
    groupCell.value = 'Penanggung Jawab dan Koordinator';
    this.applyStandardStyle(groupCell, 'FCE4D6', true, 'center');

    sheet.mergeCells('A2:A3'); // No
    sheet.mergeCells('B2:B3'); // Nama
    sheet.mergeCells('I2:I3'); // Jumlah Poin

    // Style merged cells row 2
    this.applyStandardStyle(sheet.getCell('A2'), 'FCE4D6', true, 'center');
    this.applyStandardStyle(sheet.getCell('B2'), 'FCE4D6', true, 'center');
    this.applyStandardStyle(sheet.getCell('I2'), 'FCE4D6', true, 'center');

    sheet.getCell('A2').value = 'No';
    sheet.getCell('B2').value = 'Nama';
    sheet.getCell('I2').value = 'Jumlah\nPoin';

    // Header row 3 — sub-columns 1, Poin, 2, Poin, 3, Poin
    const subHeaders = ['1', 'Poin', '2', 'Poin', '3', 'Poin'];
    subHeaders.forEach((h, i) => {
      const cell = sheet.getRow(3).getCell(i + 3); // C3, D3, E3, F3, G3, H3
      cell.value = h;
      this.applyStandardStyle(cell, 'FCE4D6', true, 'center');
    });

    // Group jabatan per pegawai from data (which is already in legacy format)
    const jabatanByPegawai: Record<string, any[]> = {};
    for (const item of data) {
      const key = item.pegawaiId || `_fallback_${item.id}`;
      if (!jabatanByPegawai[key]) jabatanByPegawai[key] = [];
      jabatanByPegawai[key].push(item);
    }

    // Write rows per pegawai
    allPegawai.forEach((peg: any, idx: number) => {
      const jabatanList = jabatanByPegawai[peg.id] || [];
      const j1 = jabatanList[0]?.jabatan || '';
      const j2 = jabatanList[1]?.jabatan || '';
      const j3 = jabatanList[2]?.jabatan || '';
      const p1 = jabatanList[0]?.poin || 0;
      const p2 = jabatanList[1]?.poin || 0;
      const p3 = jabatanList[2]?.poin || 0;
      const total = p1 + p2 + p3;

      const r = sheet.getRow(idx + 4);
      r.getCell(1).value = idx + 1;       // No
      r.getCell(2).value = peg.nama;      // Nama
      r.getCell(3).value = j1;            // Jabatan 1
      r.getCell(4).value = p1 || '';       // Poin 1
      r.getCell(5).value = j2;            // Jabatan 2
      r.getCell(6).value = p2 || '';       // Poin 2
      r.getCell(7).value = j3;            // Jabatan 3
      r.getCell(8).value = p3 || '';       // Poin 3
      r.getCell(9).value = total || '';    // Jumlah Poin

      this.applyStandardStyle(r.getCell(1), undefined, false, 'center');
      this.applyStandardStyle(r.getCell(2), undefined, false, 'left');
      for (let i = 3; i <= 9; i++) {
        this.applyStandardStyle(r.getCell(i), undefined, false, i % 2 === 0 ? 'center' : 'left');
      }

      // Highlight total poin
      if (total > 0) {
        r.getCell(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DBEAFE' } };
        r.getCell(9).font = { bold: true };
      }
    });

    // Total row
    const totalRow = sheet.getRow(allPegawai.length + 4);
    sheet.mergeCells(allPegawai.length + 4, 1, allPegawai.length + 4, 8);
    totalRow.getCell(1).value = 'TOTAL POIN';
    const grandTotal = allPegawai.reduce((sum: number, peg: any) => {
      const jabatanList = jabatanByPegawai[peg.id] || [];
      const totalPoinPegawai = jabatanList.reduce((s, j) => s + (j.poin || 0), 0);
      return sum + totalPoinPegawai;
    }, 0);
    totalRow.getCell(9).value = grandTotal;
    for (let i = 1; i <= 9; i++) {
      this.applyStandardStyle(totalRow.getCell(i), 'FFF2CC', true, i === 9 ? 'center' : 'right');
    }

    // Column widths
    sheet.getColumn(1).width = 6;
    sheet.getColumn(2).width = 35;
    sheet.getColumn(3).width = 35;
    sheet.getColumn(4).width = 8;
    sheet.getColumn(5).width = 35;
    sheet.getColumn(6).width = 8;
    sheet.getColumn(7).width = 35;
    sheet.getColumn(8).width = 8;
    sheet.getColumn(9).width = 12;

    // Row heights for header
    sheet.getRow(1).height = 24;
    sheet.getRow(2).height = 22;
    sheet.getRow(3).height = 18;
  }

  private addBobotSheet(workbook: ExcelJS.Workbook, data: any[], periode: string) {
    const sheet = workbook.addWorksheet('Bobot Kapitasi & 60%');
    sheet.mergeCells('A1:M1');
    sheet.getCell('A1').value = `PERHITUNGAN POIN & BOBOT JASPEL PERIODE ${periode}`;
    sheet.getCell('A1').font = { bold: true };
    
    const headers = [
        'No', 'Nama Petugas', 'Tanggung Jawab Program', 'Jenis Ketenagaan', 'Rangkap Tugas ADM', 'Lama Masa Kerja', 'Masa Kerja', 'Jumlah Hari Masuk Kerja', 'Jumlah Hari Kerja', 'Prosentase Kehadiran', 'Jumlah Poin Kapitasi', 'Bobot Kapitasi', 'Jumlah Poin Non Kapitasi', 'Bobot Non Kapitasi'
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

    // Total Row
    const totalRow = sheet.getRow(data.length + 4);
    totalRow.getCell(2).value = 'JUMLAH / TOTAL';
    totalRow.getCell(11).value = data.reduce((a, b) => a + (b.jumlahPoinKapitasi || 0), 0);
    totalRow.getCell(12).value = data.reduce((a, b) => a + (b.bobotKapitasi || 0), 0);
    totalRow.getCell(13).value = data.reduce((a, b) => a + (b.jumlahPoinNonKapitasi || 0), 0);
    totalRow.getCell(14).value = data.reduce((a, b) => a + (b.bobotNonKapitasi || 0), 0);

    for(let i=1; i<=14; i++) {
        this.applyStandardStyle(totalRow.getCell(i), '#FFF2CC', true, i === 2 ? 'right' : 'center');
    }

    sheet.getColumn(2).width = 30;
  }

  private addRekapSheet(workbook: ExcelJS.Workbook, data: any[], periode: string) {
    const sheet = workbook.addWorksheet('Rekap Keseluruhan');
    const p = this.parsePeriodeToString(periode);
    sheet.mergeCells('A1:M1');
    sheet.getCell('A1').value = `JASA PELAYANAN UPTD PUSKESMAS MAJALENGKA BULAN ${p.bulan} ${p.tahun}`;
    sheet.getCell('A1').font = { bold: true, size: 14 };
    sheet.getCell('A1').alignment = { horizontal: 'center' };

    const headers = [
        'No', 'Nama Petugas', 'Non Kapitasi', 'PAD Murni', 'Jumlah Jaspel Tidak Langsung (60%)', 'Non Kapitasi', 'PAD Murni', 'Jumlah Jaspel Langsung (40%)', 'Lain-lain', 'Total Jaspel', 'PPH (%)', 'PPH', 'Jumlah Bersih', 'TTD'
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
        r.getCell(9).value = row.lainLain;
        r.getCell(10).value = row.totalJaspel;
        r.getCell(11).value = row.pphPercent;
        r.getCell(12).value = row.pphNominal;
        r.getCell(13).value = row.takeHomePay;
        r.getCell(14).value = ''; 

        for(let i=1; i<=14; i++) {
           this.applyStandardStyle(r.getCell(i), undefined, i === 13 || i === 14, i === 2 ? 'left' : (i === 11 ? 'center' : 'right'));
           if (i >= 3 && i !== 11 && i !== 14) this.formatCurrency(r.getCell(i));
        }

    });

    // Total Row
    const totalRow = sheet.getRow(data.length + 4);
    totalRow.getCell(2).value = 'JUMLAH TOTAL';
    totalRow.getCell(3).value = data.reduce((a,b) => a + (b.tlNonKap || 0), 0);
    totalRow.getCell(4).value = data.reduce((a,b) => a + (b.tlPad || 0), 0);
    totalRow.getCell(5).value = data.reduce((a,b) => a + (b.totalTL || 0), 0);
    totalRow.getCell(6).value = data.reduce((a,b) => a + (b.lgsgNonKap || 0), 0);
    totalRow.getCell(7).value = data.reduce((a,b) => a + (b.lgsgPad || 0), 0);
    totalRow.getCell(8).value = data.reduce((a,b) => a + (b.totalL || 0), 0);
    totalRow.getCell(9).value = data.reduce((a,b) => a + (b.lainLain || 0), 0);
    totalRow.getCell(10).value = data.reduce((a,b) => a + (b.totalJaspel || 0), 0);
    totalRow.getCell(12).value = data.reduce((a,b) => a + (b.pphNominal || 0), 0);
    totalRow.getCell(13).value = data.reduce((a,b) => a + (b.takeHomePay || 0), 0);
    totalRow.getCell(14).value = '';


    for(let i=1; i<=14; i++) {
        this.applyStandardStyle(totalRow.getCell(i), '#FFF2CC', true, i === 2 ? 'right' : 'right');
        if (i >= 3 && i !== 11 && i !== 14) this.formatCurrency(totalRow.getCell(i));
    }


    sheet.getColumn(2).width = 35;
    for(let i=3; i<=14; i++) {
        if(i !== 11) sheet.getColumn(i).width = 25;
    }
  }

  private addPrintLainSheet(workbook: ExcelJS.Workbook, data: any[], periode: string, keuanganData: any) {
    const sheet = workbook.addWorksheet('Lain-lain');
    const p = this.parsePeriodeToString(periode);
    
    sheet.mergeCells('A1:H1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = `DAFTAR PENERIMAAN JASA PELAYANAN LAIN-LAIN (TCM) BULAN ${p.bulan} ${p.tahun}`;
    titleCell.font = { bold: true };
    titleCell.alignment = { horizontal: 'center' };

    const tcmEntry = keuanganData.items.find((i: any) => i.jenisPendapatan === 'Lain - lain' && i.namaLayanan?.toLowerCase().includes('tcm'));
    const totalVal = tcmEntry ? tcmEntry.jaspel60 : 0;
    
    sheet.mergeCells('A4:B4');
    sheet.getCell('A4').value = 'Jumlah Jaspel TCM';
    this.applyStandardStyle(sheet.getCell('A4'), '#BDD7EE', true, 'left');
    
    sheet.getCell('C4').value = totalVal;
    this.applyStandardStyle(sheet.getCell('C4'), '#FFFF00', true, 'right');
    this.formatCurrency(sheet.getCell('C4'));

    const headers = ['No', 'Nama Pegawai', 'Gol', 'TCM', 'Jumlah', 'PPh (Rp)', 'Bersih'];
    const hr = sheet.getRow(6);
    headers.forEach((h, i) => {
        const cell = hr.getCell(i + 1);
        cell.value = h;
        this.applyStandardStyle(cell, '#BDD7EE', true);
    });

    data.forEach((row, idx) => {
        const r = sheet.getRow(idx + 7);
        r.getCell(1).value = idx + 1;
        r.getCell(2).value = row.nama;
        r.getCell(3).value = row.golongan;
        r.getCell(4).value = row.tcm;
        r.getCell(5).value = row.jumlah;
        r.getCell(6).value = row.pphNominal;
        r.getCell(7).value = row.bersih;

        for(let i=1; i<=7; i++) {
           this.applyStandardStyle(r.getCell(i), undefined, false, i === 2 ? 'left' : (i === 3 ? 'center' : 'right'));
           if (i >= 4) this.formatCurrency(r.getCell(i));
        }
    });

    const totalRow = sheet.getRow(data.length + 7);
    totalRow.getCell(2).value = 'JUMLAH / TOTAL';
    totalRow.getCell(4).value = data.reduce((a,b) => a + (b.tcm || 0), 0);
    totalRow.getCell(5).value = data.reduce((a,b) => a + (b.jumlah || 0), 0);
    totalRow.getCell(6).value = data.reduce((a,b) => a + (b.pphNominal || 0), 0);
    totalRow.getCell(7).value = data.reduce((a,b) => a + (b.bersih || 0), 0);

    for(let i=1; i<=7; i++) {
        this.applyStandardStyle(totalRow.getCell(i), '#FFF2CC', true, i<=2 ? 'right' : 'right');
        if (i >= 4) this.formatCurrency(totalRow.getCell(i));
    }

    sheet.getColumn(2).width = 35;
    sheet.getColumn(3).width = 20; // Increase width for Gol / TCM Nominal
    for(let i=4; i<=7; i++) sheet.getColumn(i).width = 20;
  }


  private addPrint60Sheet(workbook: ExcelJS.Workbook, data: any[], type: 'Non Kapitasi' | 'PAD Murni', periode: string, keuanganData: any) {
    const sheet = workbook.addWorksheet(`Print 60% ${type}`);
    const p = this.parsePeriodeToString(periode);
    
    sheet.mergeCells('A1:O1'); 
    let titleCell = sheet.getCell('A1');
    titleCell.value = `DAFTAR PENERIMAAN JASA PELAYANAN ${type.toUpperCase()} BULAN ${p.bulan} ${p.tahun}`;
    titleCell.font = { bold: true };
    titleCell.alignment = { horizontal: 'center' };

    const totalVal = keuanganData.items.filter((i: any) => i.jenisPendapatan === type).reduce((a: number, b: any) => a + b.tidakLangsung, 0);
    sheet.mergeCells('A4:B4');
    let totalLabelCell = sheet.getCell('A4');
    totalLabelCell.value = `Jumlah Jaspel ${type}`;
    this.applyStandardStyle(totalLabelCell, type === 'Non Kapitasi' ? '#A9D08E' : '#A9D08E', true, 'left');
    
    let totalValueCell = sheet.getCell('C4');
    totalValueCell.value = totalVal;
    this.applyStandardStyle(totalValueCell, '#FFFF00', true, 'right');
    this.formatCurrency(totalValueCell);

    const headers = [
        'No', 'Nama Pegawai', 'Golongan', 'Jenis Ketenagaan', 'Masa Kerja', 'Rangkap Tugas ADM', 
        'Jumlah Hari Masuk Kerja', 'Jumlah Hari Kerja', 'Prosentase Kehadiran', 'Jumlah Poin', 
        'Bobot', 'Jumlah Jaspel', 'PPH (%)', 'PPH', 'Jumlah Bersih'
    ];
    
    const hr = sheet.getRow(6);
    headers.forEach((h, i) => {
        const cell = hr.getCell(i + 1);
        cell.value = h;
        this.applyStandardStyle(cell, type === 'Non Kapitasi' ? '#E2EFDA' : '#DDEBF7', true);
    });

    data.forEach((row, idx) => {
        const r = sheet.getRow(idx + 7);
        r.getCell(1).value = idx + 1;
        r.getCell(2).value = row.nama;
        r.getCell(3).value = row.golongan;
        r.getCell(4).value = row.jenisKetenagaanPoin || 0; 
        r.getCell(5).value = row.masaKerja;
        r.getCell(6).value = row.rangkapTugasAdm;
        r.getCell(7).value = row.hariMasukKerja;
        r.getCell(8).value = row.hariKerja;
        r.getCell(9).value = row.prosentaseKehadiran;
        r.getCell(9).numFmt = '0.00'; 
        r.getCell(10).value = row.jumlahPoin; 
        r.getCell(11).value = row.bobot;
        
        const isNK = type === 'Non Kapitasi';
        r.getCell(12).value = isNK ? row.jaspelNonKap : row.jaspelPadMurni;
        r.getCell(13).value = isNK ? row.pphPercentNonKap : row.pphPercentPad;
        r.getCell(14).value = isNK ? row.pphNonKap : row.pphPadMurni;
        r.getCell(15).value = isNK ? row.bersihNonKap : row.bersihPadMurni;

        for(let i=1; i<=15; i++) {
           this.applyStandardStyle(r.getCell(i), undefined, false, i === 2 ? 'left' : 'center');
           if (i === 12 || i === 14 || i === 15) this.formatCurrency(r.getCell(i));
        }
    });

    // Total Row
    const totalRow = sheet.getRow(data.length + 7);
    totalRow.getCell(2).value = 'JUMLAH / TOTAL';
    const isNK = type === 'Non Kapitasi';
    totalRow.getCell(10).value = data.reduce((a,b) => a + (b.jumlahPoin || 0), 0);
    totalRow.getCell(11).value = data.reduce((a,b) => a + (b.bobot || 0), 0);
    totalRow.getCell(12).value = data.reduce((a,b) => a + (isNK ? b.jaspelNonKap : b.jaspelPadMurni), 0);
    totalRow.getCell(14).value = data.reduce((a,b) => a + (isNK ? b.pphNonKap : b.pphPadMurni), 0);
    totalRow.getCell(15).value = data.reduce((a,b) => a + (isNK ? b.bersihNonKap : b.bersihPadMurni), 0);

    for(let i=1; i<=15; i++) {
        this.applyStandardStyle(totalRow.getCell(i), '#FFF2CC', true, i<=2 ? 'right' : 'center');
        if (i === 12 || i === 14 || i === 15) this.formatCurrency(totalRow.getCell(i));
    }

    sheet.getColumn(2).width = 30;
    for(let i=3; i<=15; i++) {
        sheet.getColumn(i).width = 18;
    }
  }

  private addPrint40Sheet(workbook: ExcelJS.Workbook, data: any[], type: 'Non Kapitasi' | 'PAD Murni', periode: string, keuanganData: any) {
    const sheet = workbook.addWorksheet(`Print 40% ${type}`);
    
    const p = this.parsePeriodeToString(periode);
    const bulan = p.bulan;
    const tahun = p.tahun;

    const kItems = keuanganData.items.filter((i: any) => i.jenisPendapatan === type);
    const sumJaspel60 = kItems.reduce((a: number, b: any) => a + (b.jaspel60||0), 0);
    const sumTL = kItems.reduce((a: number, b: any) => a + (b.tidakLangsung||0), 0);
    const sumL = kItems.reduce((a: number, b: any) => a + (b.langsung||0), 0);

    sheet.getRow(1).getCell(2).value = 'Jaspel';
    sheet.getRow(1).getCell(3).value = type;
    sheet.getRow(1).getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC000' } }; 

    sheet.getRow(2).getCell(2).value = 'Nama';
    sheet.getRow(2).getCell(3).value = 'Seluruh Ruangan';
    sheet.getRow(2).getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC000' } };

    sheet.getRow(3).getCell(2).value = 'Bulan';
    sheet.getRow(3).getCell(3).value = bulan;
    sheet.getRow(3).getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC000' } };

    sheet.getRow(4).getCell(2).value = 'Tahun';
    sheet.getRow(4).getCell(3).value = tahun;
    sheet.getRow(4).getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC000' } };

    sheet.getRow(5).getCell(3).value = type.toUpperCase();
    sheet.getRow(5).getCell(3).font = { bold: true };
    sheet.getRow(5).getCell(3).alignment = { horizontal: 'center' };

    sheet.getRow(6).getCell(2).value = 'JUMLAH';
    sheet.getRow(6).getCell(3).value = sumJaspel60;
    
    sheet.getRow(7).getCell(2).value = 'TIDAK LANGSUNG';
    sheet.getRow(7).getCell(3).value = sumTL;

    sheet.getRow(8).getCell(2).value = 'LANGSUNG';
    sheet.getRow(8).getCell(3).value = sumL;
    
    for(let r=6; r<=8; r++) {
       const row = sheet.getRow(r);
       this.applyStandardStyle(row.getCell(2), undefined, false, 'left');
       this.applyStandardStyle(row.getCell(3), undefined, false, 'right');
       this.formatCurrency(row.getCell(3));
    }
    for(let r=1; r<=4; r++) {
       const row = sheet.getRow(r);
       this.applyStandardStyle(row.getCell(2), undefined, false, 'left');
       this.applyStandardStyle(row.getCell(3), undefined, false, 'left');
    }

    const unitList = ['UGD', 'One Day Care', 'PONED', 'Konseling', 'Haji', 'KIA', 'USG', 'KB', 'LAB', 'Poli Umum', 'Gigi', 'Ambulans', 'Gula Darah'];
    const headers = ['No', 'Nama', 'Gol', ...unitList, 'Jumlah', 'Pph', 'Jumlah Bersih'];
    const hr = sheet.getRow(10);
    headers.forEach((h, i) => {
        const cell = hr.getCell(i + 1);
        cell.value = h;
        this.applyStandardStyle(cell, '#C6E0B4', true);
    });

    const matchUnit = (uBreakdown: any, target: string, typeVal: string) => {
       const key = Object.keys(uBreakdown).find(k => k.toLowerCase() === target.toLowerCase());
       if (!key) return 0;
       return typeVal === 'Non Kapitasi' ? uBreakdown[key].nonKap : uBreakdown[key].pad;
    };

    let colTotals = new Array(headers.length).fill(0);

    data.forEach((row, idx) => {
        const r = sheet.getRow(idx + 11);
        const isNK = type === 'Non Kapitasi';
        r.getCell(1).value = idx + 1;
        r.getCell(2).value = row.nama;
        r.getCell(3).value = row.golongan;
        
        let cIdx = 4;
        unitList.forEach(u => {
           const uVal = matchUnit(row.unitBreakdown, u, type);
           r.getCell(cIdx).value = uVal;
           this.formatCurrency(r.getCell(cIdx));
           colTotals[cIdx-1] += uVal;
           cIdx++;
        });

        const dbJumlah = isNK ? row.jaspelNonKap : row.jaspelPadMurni;
        const pphNominal = isNK ? row.pphNonKap : row.pphPadMurni;
        const jumlahBersih = isNK ? row.bersihNonKap : row.bersihPadMurni;

        r.getCell(cIdx).value = dbJumlah; this.formatCurrency(r.getCell(cIdx)); colTotals[cIdx-1] += dbJumlah; cIdx++; 
        r.getCell(cIdx).value = pphNominal; this.formatCurrency(r.getCell(cIdx)); colTotals[cIdx-1] += pphNominal; cIdx++; 
        r.getCell(cIdx).value = jumlahBersih; this.formatCurrency(r.getCell(cIdx)); colTotals[cIdx-1] += jumlahBersih; 

        for(let i=1; i<=headers.length; i++) {
           this.applyStandardStyle(r.getCell(i), undefined, false, i === 2 ? 'left' : 'center');
        }
    });

    const totalRow = sheet.getRow(data.length + 11);
    totalRow.getCell(2).value = 'JUMLAH / TOTAL';
    
    for(let i=4; i<=headers.length; i++) {
        totalRow.getCell(i).value = colTotals[i-1];
        this.formatCurrency(totalRow.getCell(i));
    }
    for(let i=1; i<=headers.length; i++) {
        this.applyStandardStyle(totalRow.getCell(i), '#FFF2CC', true, i<=2 ? 'right' : 'right');
    }

    sheet.getColumn(2).width = 30;
    sheet.getColumn(3).width = 25;
    for(let i=4; i<=headers.length; i++) {
        sheet.getColumn(i).width = 18;
    }
  }

  private addUnitSheet(workbook: ExcelJS.Workbook, unit: any, periode: string, bobotData: any[]) {
      const safeName = unit.unitNama.substring(0, 31).replace(/[/*?:\[\]]/g, '');
      const sheet = workbook.addWorksheet(safeName);
      
      const p = this.parsePeriodeToString(periode);

      sheet.getRow(1).getCell(2).value = 'Jaspel';
      sheet.getRow(1).getCell(3).value = 'Non Kapitasi & PAD';
      sheet.getRow(1).getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC000' } };
      
      sheet.getRow(2).getCell(2).value = 'Nama Ruangan';
      sheet.getRow(2).getCell(3).value = unit.unitNama;
      sheet.getRow(2).getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC000' } };

      sheet.getRow(3).getCell(2).value = 'Bulan';
      sheet.getRow(3).getCell(3).value = p.bulan;
      sheet.getRow(3).getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC000' } };

      sheet.getRow(4).getCell(2).value = 'Tahun';
      sheet.getRow(4).getCell(3).value = p.tahun;
      sheet.getRow(4).getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC000' } };

      sheet.getRow(6).getCell(3).value = 'NON KAPITASI';
      sheet.getRow(6).getCell(4).value = 'PAD MURNI';
      sheet.getRow(6).getCell(3).font = { bold: true };
      sheet.getRow(6).getCell(4).font = { bold: true };
      sheet.getRow(6).getCell(3).alignment = { horizontal: 'center' };
      sheet.getRow(6).getCell(4).alignment = { horizontal: 'center' };

      sheet.getRow(7).getCell(2).value = 'JUMLAH NON KAPITASI / PAD RANAP';
      sheet.getRow(7).getCell(3).value = unit.jumlahNonKapitasi;
      sheet.getRow(7).getCell(4).value = unit.padRanap;

      sheet.getRow(8).getCell(2).value = 'TIDAK LANGSUNG';
      sheet.getRow(8).getCell(3).value = unit.jumlahNonKapitasi - unit.langsungNonKapitasi;
      sheet.getRow(8).getCell(4).value = unit.padRanap - unit.langsungPadRanap;

      sheet.getRow(9).getCell(2).value = 'LANGSUNG';
      sheet.getRow(9).getCell(3).value = unit.langsungNonKapitasi;
      sheet.getRow(9).getCell(4).value = unit.langsungPadRanap;

      for (let r=7; r<=9; r++) {
         const row = sheet.getRow(r);
         this.applyStandardStyle(row.getCell(2), undefined, false, 'left');
         this.applyStandardStyle(row.getCell(3), undefined, false, 'right');
         this.applyStandardStyle(row.getCell(4), undefined, false, 'right');
         this.formatCurrency(row.getCell(3));
         this.formatCurrency(row.getCell(4));
      }
      for (let r=1; r<=4; r++) {
         this.applyStandardStyle(sheet.getRow(r).getCell(2), undefined, false, 'left');
         this.applyStandardStyle(sheet.getRow(r).getCell(3), undefined, false, 'left');
      }
      
      const rolesToRender = unit.paguData || [];

      const formatPeranName = (key: string) => {
          const map: Record<string, string> = {
             'dokter': 'Dokter',
             'perawat': 'Perawat',
             'bidan_jaga': 'Bidan Jaga',
             'bidan_asal_bulin': 'Bidan Asal Bulin',
             'pendamping_rujukan': 'Pendamping Rujukan',
             'penolong_persalinan': 'Penolong Persalinan',
             'manajemen_poned': 'Manajemen Poned',
             'petugas': 'Petugas',
             'atlm': 'ATLM',
             'pengemudi': 'Pengemudi',
             'pengelola': 'Pejabat Pengelola BLUD'
          };
          return map[key] || (key || '').replace(/_/g, ' ');
      };

      rolesToRender.forEach((pagu: any, i: number) => {
          let paguColIdx = 6 + (i * 4);
          sheet.mergeCells(6, paguColIdx, 6, paguColIdx + 1);
          const title = sheet.getRow(6).getCell(paguColIdx);
          title.value = formatPeranName(pagu.peranKey).toUpperCase();
          this.applyStandardStyle(title, undefined, true, 'center');

          sheet.getRow(7).getCell(paguColIdx).value = 'NON KAPITASI';
          sheet.getRow(7).getCell(paguColIdx + 1).value = 'PAD MURNI';
          this.applyStandardStyle(sheet.getRow(7).getCell(paguColIdx), undefined, true, 'center');
          this.applyStandardStyle(sheet.getRow(7).getCell(paguColIdx+1), undefined, true, 'center');
          
          sheet.getRow(8).getCell(paguColIdx).value = pagu.paguNonKap / 100;
          sheet.getRow(8).getCell(paguColIdx + 1).value = pagu.paguPadMurni / 100;
          this.applyStandardStyle(sheet.getRow(8).getCell(paguColIdx), undefined, true, 'center');
          this.applyStandardStyle(sheet.getRow(8).getCell(paguColIdx+1), undefined, true, 'center');
          sheet.getRow(8).getCell(paguColIdx).numFmt = '0%';
          sheet.getRow(8).getCell(paguColIdx+1).numFmt = '0%';
          sheet.getRow(8).getCell(paguColIdx).font.color = { argb: 'FF0000' };
          sheet.getRow(8).getCell(paguColIdx+1).font.color = { argb: 'FF0000' };

          sheet.getRow(9).getCell(paguColIdx).value = unit.roleBuckets[pagu.peranKey]?.nk || 0;
          sheet.getRow(9).getCell(paguColIdx + 1).value = unit.roleBuckets[pagu.peranKey]?.pad || 0;
          this.applyStandardStyle(sheet.getRow(9).getCell(paguColIdx), undefined, true, 'right');
          this.applyStandardStyle(sheet.getRow(9).getCell(paguColIdx+1), undefined, true, 'right');
          this.formatCurrency(sheet.getRow(9).getCell(paguColIdx));
          this.formatCurrency(sheet.getRow(9).getCell(paguColIdx+1));
      });

      const colHeadersRow1 = sheet.getRow(11);
      const colHeadersRow2 = sheet.getRow(12);

      const standardHeaders = ['No', 'Nama', 'Bobot'];
      let cIdx = 1;

      standardHeaders.forEach((h, i) => {
         sheet.mergeCells(11, cIdx, 12, cIdx);
         const cell = colHeadersRow1.getCell(cIdx);
         cell.value = h;
         this.applyStandardStyle(cell, '#B4C6E7', true); 
         cIdx++;
      });
      colHeadersRow1.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DAE3F3' } };
      colHeadersRow1.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DAE3F3' } };
      colHeadersRow1.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DAE3F3' } };

      rolesToRender.forEach((pagu: any) => {
         const pName = formatPeranName(pagu.peranKey);
         
         sheet.mergeCells(11, cIdx, 12, cIdx);
         const cellT = colHeadersRow1.getCell(cIdx);
         cellT.value = 'Jumlah Tindakan';
         this.applyStandardStyle(cellT, '#FFD966', true); 
         cIdx++;

         sheet.mergeCells(11, cIdx, 12, cIdx);
         const cellA = colHeadersRow1.getCell(cIdx);
         cellA.value = 'Adjusted';
         this.applyStandardStyle(cellA, '#FCE4D6', true); 
         cIdx++;

         sheet.mergeCells(11, cIdx, 12, cIdx);
         const cellNK = colHeadersRow1.getCell(cIdx);
         cellNK.value = `Jaspel ${pName}`;
         this.applyStandardStyle(cellNK, '#FCE4D6', true);
         cellNK.font.color = { argb: 'FF0000' };
         cIdx++;

         sheet.mergeCells(11, cIdx, 12, cIdx);
         const cellPad = colHeadersRow1.getCell(cIdx);
         cellPad.value = `Jaspel ${pName}`;
         this.applyStandardStyle(cellPad, '#FCE4D6', true);
         cellPad.font.color = { argb: 'FF0000' };
         cIdx++;
      });

      sheet.mergeCells(11, cIdx, 12, cIdx);
      const tNk = colHeadersRow1.getCell(cIdx);
      tNk.value = 'TOTAL JASPEL NON KAPITASI';
      this.applyStandardStyle(tNk, '#B4A7D6', true); 
      cIdx++;

      sheet.mergeCells(11, cIdx, 12, cIdx);
      const tPad = colHeadersRow1.getCell(cIdx);
      tPad.value = 'TOTAL JASPEL PAD MURNI';
      this.applyStandardStyle(tPad, '#B4A7D6', true); 
      cIdx++;

      sheet.mergeCells(11, cIdx, 12, cIdx);
      const tTotal = colHeadersRow1.getCell(cIdx);
      tTotal.value = 'TOTAL JASPEL';
      this.applyStandardStyle(tTotal, '#B4A7D6', true); 
      cIdx++;

      const maxCols = cIdx - 1;

      let rIdx = 13;
      unit.perhitunganPegawai.forEach((p: any, idx: number) => {
          const r = sheet.getRow(rIdx);
          const peg = bobotData.find(b => b.id === p.pegawaiId);
          r.getCell(1).value = idx + 1;
          r.getCell(2).value = peg?.nama || p.pegawaiId;
          r.getCell(3).value = p.bobotPegawai || 0;

          let colIndex = 4;
          rolesToRender.forEach((pagu: any) => {
              const roleData = p.roles[pagu.peranKey];
              const tindakan = roleData?.tindakan || '';
              const adjusted = roleData?.adjusted || '';
              const jaspelNK = roleData?.jaspelNK || 0;
              const jaspelPad = roleData?.jaspelPad || 0;
              
              r.getCell(colIndex).value = tindakan; 
              r.getCell(colIndex+1).value = adjusted; 
              r.getCell(colIndex+2).value = jaspelNK; this.formatCurrency(r.getCell(colIndex+2));
              r.getCell(colIndex+3).value = jaspelPad; this.formatCurrency(r.getCell(colIndex+3));

              for(let i=0; i<4; i++) {
                 this.applyStandardStyle(r.getCell(colIndex+i), undefined, false, i < 2 ? 'center' : 'right');
              }
              colIndex += 4;
          });

          r.getCell(colIndex).value = p.jaspelProfesiNonKap || 0;
          r.getCell(colIndex+1).value = p.jaspelProfesiPad || 0;
          r.getCell(colIndex+2).value = (p.jaspelProfesiNonKap + p.jaspelProfesiPad) || 0;

          for (let i=0; i<3; i++) {
             this.applyStandardStyle(r.getCell(colIndex+i), undefined, false, 'right');
             this.formatCurrency(r.getCell(colIndex+i));
          }

          this.applyStandardStyle(r.getCell(1), undefined, false, 'center');
          this.applyStandardStyle(r.getCell(2), undefined, false, 'left');
          this.applyStandardStyle(r.getCell(3), undefined, false, 'center');
          
          rIdx++;
      });

      const tRow = sheet.getRow(rIdx + 1);
      tRow.getCell(2).value = 'JUMLAH / TOTAL';
      
      let sumColIndex = 4;
      rolesToRender.forEach((pagu: any) => {
          tRow.getCell(sumColIndex).value = unit.perhitunganPegawai.reduce((acc: number, p: any) => acc + (p.roles[pagu.peranKey]?.tindakan ? Number(p.roles[pagu.peranKey]?.tindakan) : 0), 0) || '';
          tRow.getCell(sumColIndex+1).value = unit.perhitunganPegawai.reduce((acc: number, p: any) => acc + (p.roles[pagu.peranKey]?.adjusted ? Number(p.roles[pagu.peranKey]?.adjusted) : 0), 0) || '';
          tRow.getCell(sumColIndex+2).value = unit.perhitunganPegawai.reduce((acc: number, p: any) => acc + (p.roles[pagu.peranKey]?.jaspelNK || 0), 0) || 0; 
          this.formatCurrency(tRow.getCell(sumColIndex+2));
          tRow.getCell(sumColIndex+3).value = unit.perhitunganPegawai.reduce((acc: number, p: any) => acc + (p.roles[pagu.peranKey]?.jaspelPad || 0), 0) || 0; 
          this.formatCurrency(tRow.getCell(sumColIndex+3));
          
          for(let i=0; i<4; i++) {
             this.applyStandardStyle(tRow.getCell(sumColIndex+i), '#FFF2CC', true, i < 2 ? 'center' : 'right');
          }
          sumColIndex += 4;
      });

      tRow.getCell(sumColIndex).value = unit.perhitunganPegawai.reduce((acc: number, p: any) => acc + (p.jaspelProfesiNonKap || 0), 0) || 0;
      tRow.getCell(sumColIndex+1).value = unit.perhitunganPegawai.reduce((acc: number, p: any) => acc + (p.jaspelProfesiPad || 0), 0) || 0;
      tRow.getCell(sumColIndex+2).value = unit.perhitunganPegawai.reduce((acc: number, p: any) => acc + ((p.jaspelProfesiNonKap || 0) + (p.jaspelProfesiPad || 0)), 0) || 0;

      for (let i=0; i<3; i++) {
         this.applyStandardStyle(tRow.getCell(sumColIndex+i), '#FFF2CC', true, 'right');
         this.formatCurrency(tRow.getCell(sumColIndex+i));
      }
      this.applyStandardStyle(tRow.getCell(1), '#FFF2CC', true, 'center');
      this.applyStandardStyle(tRow.getCell(2), '#FFF2CC', true, 'right');
      this.applyStandardStyle(tRow.getCell(3), '#FFF2CC', true, 'center');

      sheet.getColumn(2).width = 30;
      sheet.getColumn(3).width = 18;
      for (let i=4; i<=maxCols; i++) sheet.getColumn(i).width = 15;
  }

  async exportRekapToExcel(dbPeriode: string, displayPeriode: string): Promise<Buffer> {
    const data = await this.jaspelService.calculateRekapan(dbPeriode);
    const workbook = new ExcelJS.Workbook();
    this.addRekapSheet(workbook, data, displayPeriode);
    return await workbook.xlsx.writeBuffer() as unknown as Buffer;
  }

  private addTCMSheet(workbook: ExcelJS.Workbook, data: any[], periode: string) {
    const sheet = workbook.addWorksheet('TCM');
    const p = this.parsePeriodeToString(periode);

    sheet.mergeCells('A1:E1');
    const title = sheet.getCell('A1');
    title.value = `DISTRIBUSI JASPEL TCM PERIODE ${p.bulan} ${p.tahun}`;
    title.font = { bold: true, size: 12 };
    title.alignment = { horizontal: 'center' };

    const totalBudget = data.length > 0 ? (data[0].totalRp / (data[0].persentase / 100 || 1)) : 0;
    
    sheet.getRow(3).getCell(1).value = 'Total Dana Tersedia (Operasional 40%)';
    sheet.getRow(3).getCell(3).value = totalBudget;
    this.applyStandardStyle(sheet.getRow(3).getCell(1), '#E2EFDA', true, 'left');
    this.applyStandardStyle(sheet.getRow(3).getCell(3), '#FFFF00', true, 'right');
    this.formatCurrency(sheet.getRow(3).getCell(3));

    const headers = ['No', 'Nama Karyawan', 'Persentase Pembagian (%)', 'Total (Rp)', 'Keterangan'];
    const hr = sheet.getRow(5);
    headers.forEach((h, i) => {
        const cell = hr.getCell(i + 1);
        cell.value = h;
        this.applyStandardStyle(cell, '#4472C4', true);
        cell.font.color = { argb: 'FFFFFF' };
    });

    data.forEach((row, idx) => {
        const r = sheet.getRow(idx + 6);
        r.getCell(1).value = idx + 1;
        r.getCell(2).value = row.namaKaryawan;
        r.getCell(3).value = (row.persentase / 100);
        r.getCell(3).numFmt = '0%';
        r.getCell(4).value = row.totalRp;
        r.getCell(5).value = '';

        for(let i=1; i<=5; i++) {
            this.applyStandardStyle(r.getCell(i), undefined, false, i === 2 ? 'left' : 'center');
            if(i === 4) this.formatCurrency(r.getCell(i));
        }
    });

    const totalRow = sheet.getRow(data.length + 6);
    totalRow.getCell(2).value = 'TOTAL';
    const totalPersen = data.reduce((a, b) => a + (b.persentase || 0), 0) / 100;
    totalRow.getCell(3).value = totalPersen;
    totalRow.getCell(3).numFmt = '0%';
    const totalRp = data.reduce((a, b) => a + (b.totalRp || 0), 0);
    totalRow.getCell(4).value = totalRp;

    for(let i=1; i<=5; i++) {
        this.applyStandardStyle(totalRow.getCell(i), '#FFF2CC', true, i === 2 ? 'right' : 'center');
        if(i === 4) this.formatCurrency(totalRow.getCell(i));
    }

    sheet.getColumn(2).width = 40;
    sheet.getColumn(3).width = 25;
    sheet.getColumn(4).width = 25;
    sheet.getColumn(5).width = 20;
  }
}

