import { ipcMain, dialog, shell, app } from 'electron';
import path from 'path';
import fs from 'fs';
import log from 'electron-log';
import dbMethods from './db';
import * as db1Uz from './1uz-db';
import * as soliq from './soliq-api';
import * as splitter from './splitter';
import * as excelGen from './excel-generator';
import * as pdfParser from './pdf-parser';

// Fayl nomi uchun xavfsiz qism: yo'lni buzadigan/maxsus belgilarni olib tashlaydi
function safeFileSegment(value: any): string {
  return String(value ?? '').replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 60) || 'NA';
}

function saveCustomerAddress(tin: any, name: any, addrObj: any) {
  if (!tin || !addrObj?.addressText) return;
  try {
    const customers = dbMethods.getCustomers();
    const addrEntry = {
      addressText: String(addrObj.addressText),
      oblastCode: String(addrObj.oblastCode || '1726'),
      rayonCode: String(addrObj.rayonCode || '1')
    };
    const existing = customers.find((c: any) => String(c.tin) === String(tin));
    if (existing) {
      if (!existing.addresses) existing.addresses = [];
      const alreadySaved = existing.addresses.some(
        (a: any) => a.addressText === addrEntry.addressText
      );
      if (!alreadySaved) {
        existing.addresses.unshift(addrEntry); // yangi manzilni birinchiga qo'yish
        dbMethods.saveCustomer(existing);
      }
    } else {
      dbMethods.saveCustomer({
        tin: String(tin),
        name: String(name || ''),
        addresses: [addrEntry]
      });
    }
  } catch (e) {
    log.warn('Mijoz manzilini saqlashda xatolik:', e);
  }
}

export function registerIpcHandlers() {
  ipcMain.handle('get-app-version', () => app.getVersion());

  // ─── Profil boshqaruvi ───────────────────────────────────────────────────────
  ipcMain.handle('get-profiles', () => dbMethods.getProfiles());
  ipcMain.handle('create-profile', (_, name) => dbMethods.createProfile(name));
  ipcMain.handle('switch-profile', (_, id) => dbMethods.switchProfile(id));
  ipcMain.handle('rename-profile', (_, id, name) => dbMethods.renameProfile(id, name));
  ipcMain.handle('delete-profile', (_, id) => dbMethods.deleteProfile(id));

  // ─── 1Uz Firebird ulanishini tekshirish ─────────────────────────────────────
  ipcMain.handle('test-firebird-connection', async () => {
    const settings = dbMethods.getSettings();
    if (!settings.firebirdDatabase) return { ok: false, message: "Fayl yo'li kiritilmagan" };
    return new Promise((resolve) => {
      const firebird = require('node-firebird');
      const options = {
        host: settings.firebirdHost || '127.0.0.1',
        port: parseInt(settings.firebirdPort) || 3050,
        database: settings.firebirdDatabase,
        user: settings.firebirdUser || 'SYSDBA',
        password: settings.firebirdPassword || 'masterkey',
        lowercase_keys: true,
        role: null,
        pageSize: 4096
      };
      firebird.attach(options, (err: any, db: any) => {
        if (err) {
          resolve({ ok: false, message: err.message });
        } else {
          db.detach();
          resolve({ ok: true, message: "Ulanish muvaffaqiyatli!" });
        }
      });
    });
  });

  ipcMain.handle('open-downloads-folder', () => {
    const dir = path.join(app.getPath('downloads'), 'AvtoETTN');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    shell.openPath(dir);
  });

  ipcMain.handle('get-invoices', async () => {
    const data = await db1Uz.getInvoices();
    const manualInvoices = dbMethods.getManualInvoices();
    const allInvoices = [...manualInvoices, ...data.invoices];
    
    const writtenInvoiceIds = dbMethods.getWrittenInvoiceIds();
    const invoicesWithStatus = allInvoices.map(inv => ({
      ...inv,
      isWritten: writtenInvoiceIds.includes(inv.id)
    }));

    return { invoices: invoicesWithStatus, isMock: data.isMock };
  });

  ipcMain.handle('toggle-invoice-written', async (_, invoiceId, isWritten) => {
    if (isWritten) {
      dbMethods.markInvoiceAsWritten(invoiceId);
    } else {
      dbMethods.unmarkInvoiceAsWritten(invoiceId);
    }
    return { success: true, isWritten };
  });

  ipcMain.handle('get-vehicles', () => {
    return dbMethods.getVehicles();
  });

  ipcMain.handle('save-vehicle', (_, vehicle) => {
    return dbMethods.saveVehicle(vehicle);
  });

  ipcMain.handle('delete-vehicle', (_, id) => {
    return dbMethods.deleteVehicle(id);
  });

  ipcMain.handle('get-customers', () => {
    return dbMethods.getCustomers();
  });

  ipcMain.handle('search-company', async (_, tin) => {
    return await soliq.searchCompanyByTin(tin);
  });

  ipcMain.handle('get-settings', () => {
    return dbMethods.getSettings();
  });

  ipcMain.handle('save-settings', (_, settings) => {
    return dbMethods.saveSettings(settings);
  });

  ipcMain.handle('split-cargo', (_, totalQuantity, vehicleIds) => {
    const allVehicles = dbMethods.getVehicles();
    const selectedVehicles = allVehicles.filter((v: any) => vehicleIds.includes(v.id));
    return splitter.autoSplit(totalQuantity, selectedVehicles);
  });

  ipcMain.handle('bulk-split', async (_, invoiceIds) => {
    const { invoices } = await db1Uz.getInvoices();
    const manualInvoices = dbMethods.getManualInvoices();
    const allInvoices = [...manualInvoices, ...invoices];
    const selectedInvoices = allInvoices.filter(inv => invoiceIds.includes(inv.id));
    const fleet = dbMethods.getVehicles();
    
    return splitter.bulkAutoDispatch(selectedInvoices, fleet);
  });

  ipcMain.handle('generate-excel', async (_, invoiceId, allocations, unloadingAddress) => {
    log.info(`Generating Excel for Invoice: ${invoiceId}`);
    try {
      const { invoices } = await db1Uz.getInvoices();
      const manualInvoices = dbMethods.getManualInvoices();
      const allInvoices = [...manualInvoices, ...invoices];
      const invoice = allInvoices.find(inv => inv.id === invoiceId);

      if (!invoice) throw new Error("Hisob-faktura topilmadi.");

      const allVehicles = dbMethods.getVehicles();
      const settings = dbMethods.getSettings();

      const fullAllocations = allocations.map((a: any) => {
        const v = allVehicles.find((veh: any) => veh.id === a.vehicleId);
        return {
          vehicle: v || { driverName: "Noma'lum", plateNumber: a.vehicleId },
          quantityAllocated: parseFloat(a.quantity)
        };
      });

      let unloadingAddressObj = { addressText: '', oblastCode: '1726', rayonCode: '1' };
      if (unloadingAddress) {
        if (typeof unloadingAddress === 'object') {
          unloadingAddressObj = unloadingAddress;
        } else if (typeof unloadingAddress === 'string') {
          try {
            unloadingAddressObj = JSON.parse(unloadingAddress);
          } catch (e) {
            unloadingAddressObj.addressText = unloadingAddress;
          }
        }
      }

      const excelBuffer = excelGen.generateEttnExcel(invoice, fullAllocations, unloadingAddressObj, settings);
      const filename = `ETTN_${safeFileSegment(invoice.invoiceNumber)}_${Date.now()}.xlsx`;

      const outputDir = path.join(app.getPath('downloads'), 'AvtoETTN');
      if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
      
      const outputPath = path.join(outputDir, filename);
      fs.writeFileSync(outputPath, excelBuffer);
      
      dbMethods.markInvoiceAsWritten(invoiceId);

      // Mijoz manzilini keyingi safar uchun saqlash
      saveCustomerAddress(invoice.buyerTin, invoice.buyerName, unloadingAddressObj);

      shell.showItemInFolder(outputPath);
      
      log.info(`Excel generated successfully: ${outputPath}`);
      return { success: true, path: outputPath, filename };
    } catch (err: any) {
      log.error('Excel avlodida xatolik:', err);
      throw new Error(err.message);
    }
  });

  ipcMain.handle('bulk-generate-excel', async (_, allocations, unloadingAddresses) => {
    try {
      const { invoices } = await db1Uz.getInvoices();
      const manualInvoices = dbMethods.getManualInvoices();
      const allInvoices = [...manualInvoices, ...invoices];
      const allVehicles = dbMethods.getVehicles();
      const settings = dbMethods.getSettings();

      const bulkAllocations: any[] = [];

      // tripIndex bo'yicha saralash — TTN raqamlari to'g'ri ketma-ketlikda chiqsin
      const sortedAllocations = [...allocations].sort((a: any, b: any) => {
        if (a.invoiceId < b.invoiceId) return -1;
        if (a.invoiceId > b.invoiceId) return 1;
        return (a.tripIndex || 1) - (b.tripIndex || 1);
      });

      sortedAllocations.forEach((a: any) => {
        const invoice = allInvoices.find((inv: any) => inv.id === a.invoiceId);
        const vehicle = allVehicles.find((v: any) => v.id === a.vehicleId);
        const unloadingAddr = unloadingAddresses[a.invoiceId];

        if (invoice && vehicle) {
          bulkAllocations.push({
            invoice,
            vehicle,
            quantityAllocated: parseFloat(a.quantity),
            unloadingAddressObj: unloadingAddr,
            tripIndex: a.tripIndex || 1
          });
        }
      });

      if (bulkAllocations.length === 0) throw new Error("Faktura yoki mashina ma'lumotlari topilmadi.");

      const excelBuffer = excelGen.generateBulkEttnExcel(bulkAllocations, settings);
      const filename = `ETTN_Ommaviy_${Date.now()}.xlsx`;

      const outputDir = path.join(app.getPath('downloads'), 'AvtoETTN');
      if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

      const outputPath = path.join(outputDir, filename);
      fs.writeFileSync(outputPath, excelBuffer);

      const invoiceIdsToMark = [...new Set(allocations.map((a: any) => a.invoiceId))];
      invoiceIdsToMark.forEach((id: any) => dbMethods.markInvoiceAsWritten(id));

      for (const alloc of bulkAllocations) {
        if (alloc.invoice?.buyerTin && alloc.unloadingAddressObj) {
          saveCustomerAddress(alloc.invoice.buyerTin, alloc.invoice.buyerName, alloc.unloadingAddressObj);
        }
      }

      shell.showItemInFolder(outputPath);
      return { success: true, path: outputPath, filename };
    } catch (err: any) {
      log.error('Ommaviy Excel avlodida xatolik:', err);
      throw new Error(err.message);
    }
  });

  ipcMain.handle('save-manual-invoice', (_, invoice) => {
    return dbMethods.saveManualInvoice(invoice);
  });

  ipcMain.handle('delete-manual-invoice', (_, id) => {
    return dbMethods.deleteManualInvoice(id);
  });

  ipcMain.handle('extract-pdfs', async (_, buffer) => {
    // This requires AdmZip
    const AdmZip = require('adm-zip');

    // PDF'lar yoziladigan papka — har doim Desktop (paketlangan .exe ichidagi papka read-only)
    const outputDir = path.join(require('os').homedir(), 'Desktop', 'Yuklangan_PDFlar');
    if (fs.existsSync(outputDir)) {
      const files = fs.readdirSync(outputDir);
      for (const file of files) {
        const filePath = path.join(outputDir, file);
        if (fs.statSync(filePath).isFile()) {
          fs.unlinkSync(filePath);
        }
      }
    } else {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const mainZip = new AdmZip(Buffer.from(buffer));
    const mainEntries = mainZip.getEntries();
    
    const extractedNames = new Set();
    let pdfCount = 0;
    
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const folderName = `Fakturalar_${dateStr}_PDFlar`;
    
    const flatZip = new AdmZip();
    
    for (const entry of mainEntries) {
      if (entry.isDirectory) continue;
      const entryNameLower = entry.entryName.toLowerCase();
      
      if (entryNameLower.endsWith('.zip')) {
        try {
          const nestedZipBuffer = entry.getData();
          const nestedZip = new AdmZip(nestedZipBuffer);
          const nestedEntries = nestedZip.getEntries();
          const zipBaseName = path.basename(entry.entryName, '.zip');
          
          for (const nestedEntry of nestedEntries) {
            if (nestedEntry.isDirectory) continue;
            if (nestedEntry.entryName.toLowerCase().endsWith('.pdf')) {
              const pdfBuffer = nestedEntry.getData();
              const pdfBase = path.basename(nestedEntry.entryName);
              
              let targetPdfName = `${zipBaseName}.pdf`;
              if (pdfBase.toLowerCase() !== 'document.pdf' && pdfBase.toLowerCase() !== 'factura.pdf') {
                targetPdfName = `${zipBaseName}_${pdfBase}`;
              }
              
              let finalName = targetPdfName;
              let counter = 1;
              while (extractedNames.has(finalName.toLowerCase())) {
                const ext = path.extname(targetPdfName);
                const base = path.basename(targetPdfName, ext);
                finalName = `${base}_${counter}${ext}`;
                counter++;
              }
              extractedNames.add(finalName.toLowerCase());
              
              const targetPath = path.join(outputDir, finalName);
              fs.writeFileSync(targetPath, pdfBuffer);
              
              flatZip.addFile(`${folderName}/${finalName}`, pdfBuffer);
              pdfCount++;
            }
          }
        } catch (nestedErr) {
          console.error(`Nested zip extract error:`, nestedErr);
        }
      } else if (entryNameLower.endsWith('.pdf')) {
        try {
          const pdfBuffer = entry.getData();
          const pdfBase = path.basename(entry.entryName);
          
          let finalName = pdfBase;
          let counter = 1;
          while (extractedNames.has(finalName.toLowerCase())) {
            const ext = path.extname(pdfBase);
            const base = path.basename(pdfBase, ext);
            finalName = `${base}_${counter}${ext}`;
            counter++;
          }
          extractedNames.add(finalName.toLowerCase());
          
          const targetPath = path.join(outputDir, finalName);
          fs.writeFileSync(targetPath, pdfBuffer);
          
          flatZip.addFile(`${folderName}/${finalName}`, pdfBuffer);
          pdfCount++;
        } catch (pdfErr) {
          console.error(`Direct pdf extract error:`, pdfErr);
        }
      }
    }
    
    if (pdfCount > 0) {
      shell.openPath(outputDir);
    }
    
    return {
      pdfCount,
      folderName,
      zipBuffer: flatZip.toBuffer()
    };
  });

  ipcMain.handle('parse-pdf', async (_, buffer) => {
    return await pdfParser.parseInvoicePdf(Buffer.from(buffer));
  });

  // ZIP ajratilgan PDFlar papkasidagi barcha fayllarni parse qilish
  ipcMain.handle('parse-pdfs-from-folder', async () => {
    const outputDir = path.join(require('os').homedir(), 'Desktop', 'Yuklangan_PDFlar');
    if (!fs.existsSync(outputDir)) return [];
    const files = fs.readdirSync(outputDir).filter(f => f.toLowerCase().endsWith('.pdf'));
    const results = [];
    for (const fileName of files) {
      try {
        const buffer = fs.readFileSync(path.join(outputDir, fileName));
        const inv = await pdfParser.parseInvoicePdf(buffer);
        results.push({ fileName, inv });
      } catch (e) {
        results.push({ fileName, inv: null });
      }
    }
    return results;
  });
}
