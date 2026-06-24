import { ipcMain, dialog, shell } from 'electron';
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

export function registerIpcHandlers() {
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

      let unloadingAddressObj = { addressText: '', oblastCode: '33', rayonCode: '5' };
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
      const filename = `Didox_ETTN_Inv_${safeFileSegment(invoice.invoiceNumber)}_Split_${Date.now()}.xlsx`;
      
      // Save to Desktop/Yuklangan_Fakturalar folder for easy access
      const desktopPath = require('os').homedir() + '/Desktop';
      const outputDir = path.join(desktopPath, 'Yaratilgan_ETTN_Excel');
      if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
      
      const outputPath = path.join(outputDir, filename);
      fs.writeFileSync(outputPath, excelBuffer);
      
      dbMethods.markInvoiceAsWritten(invoiceId);
      
      // Optionally open the folder
      shell.showItemInFolder(outputPath);
      
      log.info(`Excel generated successfully: ${outputPath}`);
      return { success: true, path: outputPath, filename };
    } catch (err: any) {
      log.error('Excel avlodida xatolik:', err);
      throw new Error(err.message);
    }
  });

  ipcMain.handle('bulk-generate-excel', async (_, allocations, unloadingAddresses) => {
    const { invoices } = await db1Uz.getInvoices();
    const manualInvoices = dbMethods.getManualInvoices();
    const allInvoices = [...manualInvoices, ...invoices];
    const allVehicles = dbMethods.getVehicles();
    const settings = dbMethods.getSettings();
    
    const bulkAllocations: any[] = [];
    
    allocations.forEach((a: any) => {
      const invoice = allInvoices.find(inv => inv.id === a.invoiceId);
      const vehicle = allVehicles.find((v: any) => v.id === a.vehicleId);
      const unloadingAddr = unloadingAddresses[a.invoiceId];
      
      if (invoice && vehicle) {
        bulkAllocations.push({
          invoice,
          vehicle,
          quantityAllocated: parseFloat(a.quantity),
          unloadingAddressObj: unloadingAddr
        });
      }
    });
    
    if (bulkAllocations.length === 0) throw new Error("Faktura yoki mashina ma'lumotlari topilmadi.");
    
    const excelBuffer = excelGen.generateBulkEttnExcel(bulkAllocations, settings);
    const filename = `Didox_ETTN_Ommaviy_Split_${Date.now()}.xlsx`;
    
    const desktopPath = require('os').homedir() + '/Desktop';
    const outputDir = path.join(desktopPath, 'Yaratilgan_ETTN_Excel');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    
    const outputPath = path.join(outputDir, filename);
    fs.writeFileSync(outputPath, excelBuffer);
    
    const invoiceIdsToMark = [...new Set(allocations.map((a: any) => a.invoiceId))];
    invoiceIdsToMark.forEach((id: any) => dbMethods.markInvoiceAsWritten(id));
    
    shell.showItemInFolder(outputPath);

    return { success: true, path: outputPath, filename };
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
    const desktopPath = require('os').homedir() + '/Desktop';
    const outputDir = path.join(desktopPath, 'Yuklangan_PDFlar');
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
}
