import ExcelJS from "exceljs";
import { JaspelService } from "./jaspel.service";

export class ExportService {
  constructor(private jaspelService: JaspelService) {}

  async exportRekapToExcel(periode: string): Promise<any> {
    const data = await this.jaspelService.calculateRekapan(periode);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(`Rekap Jaspel ${periode}`);

    sheet.columns = [
      { header: "No", key: "no", width: 5 },
      { header: "NAMA", key: "nama", width: 30 },
      { header: "GOLONGAN", key: "golongan", width: 15 },
      { header: "60% (NON KAP + PAD MURNI)", key: "jumlahTL", width: 30 },
      { header: "40% (NON KAP + PAD MURNI)", key: "jumlahLangsung", width: 30 },
      { header: "TOTAL JASPEL", key: "totalJaspel", width: 25 },
      { header: "PPH (%)", key: "pphPercent", width: 15 },
      { header: "POTONGAN PPH", key: "pph", width: 20 },
      { header: "JUMLAH BERSIH DITERIMA", key: "jumlahBersih", width: 30 },
    ];

    data.forEach((row: any, index: number) => {
      sheet.addRow({
        no: index + 1,
        nama: row.nama,
        golongan: row.golongan,
        jumlahTL: row.jumlahTL,
        jumlahLangsung: row.jumlahLangsung,
        totalJaspel: row.totalJaspel,
        pphPercent: `${(row.pphPercent * 100).toFixed(0)}%`,
        pph: row.pph,
        jumlahBersih: row.jumlahBersih
      });
    });

    // Style headers
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).alignment = { horizontal: 'center' };

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  }
}

