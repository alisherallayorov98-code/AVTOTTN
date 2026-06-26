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
const backup = require('./backup');
const localServer = require('./local-server');
const { createRemoteDb } = require('./remote-db');
const netConfig = require('./network-config');

// ─── DB proxy: lokal yoki remote ────────────────────────────────────────────
function getDb() {
  const cfg = netConfig.get();
  if (cfg.networkMode === 'client' && cfg.serverIp) {
    return createRemoteDb(cfg.serverIp, cfg.serverPort || 3737);
  }
  return {
    getProfiles:            () => Promise.resolve(dbMethods.getProfiles()),
    createProfile:          (name: string) => Promise.resolve(dbMethods.createProfile(name)),
    switchProfile:          (id: string) => Promise.resolve(dbMethods.switchProfile(id)),
    renameProfile:          (id: string, name: string) => Promise.resolve(dbMethods.renameProfile(id, name)),
    deleteProfile:          (id: string) => Promise.resolve(dbMethods.deleteProfile(id)),
    getVehicles:            () => Promise.resolve(dbMethods.getVehicles()),
    saveVehicle:            (v: any) => Promise.resolve(dbMethods.saveVehicle(v)),
    deleteVehicle:          (id: string) => Promise.resolve(dbMethods.deleteVehicle(id)),
    getCustomers:           () => Promise.resolve(dbMethods.getCustomers()),
    saveCustomer:           (c: any) => Promise.resolve(dbMethods.saveCustomer(c)),
    getSettings:            () => Promise.resolve(dbMethods.getSettings()),
    saveSettings:           (s: any) => Promise.resolve(dbMethods.saveSettings(s)),
    getManualInvoices:      () => Promise.resolve(dbMethods.getManualInvoices()),
    saveManualInvoice:      (inv: any) => Promise.resolve(dbMethods.saveManualInvoice(inv)),
    deleteManualInvoice:    (id: string) => Promise.resolve(dbMethods.deleteManualInvoice(id)),
    getWrittenInvoiceIds:   () => Promise.resolve(dbMethods.getWrittenInvoiceIds()),
    markInvoiceAsWritten:   (id: string) => Promise.resolve(dbMethods.markInvoiceAsWritten(id)),
    unmarkInvoiceAsWritten: (id: string) => Promise.resolve(dbMethods.unmarkInvoiceAsWritten(id)),
  };
}

// Fayl nomi uchun xavfsiz qism
function safeFileSegment(value: any): string {
  return String(value ?? '').replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 60) || 'NA';
}

async function saveCustomerAddress(tin: any, name: any, addrObj: any) {
  if (!tin || !addrObj?.addressText) return;
  try {
    const db = getDb();
    const customers = await db.getCustomers();
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
        existing.addresses.unshift(addrEntry);
        await db.saveCustomer(existing);
      }
    } else {
      await db.saveCustomer({ tin: String(tin), name: String(name || ''), addresses: [addrEntry] });
    }
  } catch (e) {
    log.warn('Mijoz manzilini saqlashda xatolik:', e);
  }
}

export function registerIpcHandlers() {
  ipcMain.handle('get-app-version', () => app.getVersion());

  // ─── Backup / Restore ────────────────────────────────────────────────────────
  ipcMain.handle('backup-create', () => backup.createBackup());
  ipcMain.handle('backup-list', () => backup.listBackups());
  ipcMain.handle('backup-restore', async (_: any, backupPath: string) => {
    const result = backup.restoreBackup(backupPath);
    if (result.ok) log.info('Backup tiklandi:', backupPath);
    return result;
  });
  ipcMain.handle('backup-check-restore', () => {
    if (!backup.isFreshInstall()) return null;
    return backup.getLatestBackup();
  });

  // ─── Tarmoq (Network) ────────────────────────────────────────────────────────
  ipcMain.handle('network-get-config', () => netConfig.get());
  ipcMain.handle('network-save-config', async (_: any, cfg: any) => {
    netConfig.save(cfg);
    return { ok: true };
  });
  ipcMain.handle('network-get-ips', () => localServer.getLocalIps());
  ipcMain.handle('network-server-start', async (_: any, port: number) => {
    return localServer.startServer(port || 3737);
  });
  ipcMain.handle('network-server-stop', async () => {
    return localServer.stopServer();
  });
  ipcMain.handle('network-server-status', () => ({
    running: localServer.isRunning(),
    ips: localServer.getLocalIps(),
    port: netConfig.get().serverPort || 3737
  }));
  ipcMain.handle('network-test-connection', async (_: any, serverIp: string, port: number) => {
    try {
      const remote = createRemoteDb(serverIp, port || 3737);
      const result = await remote.ping();
      return { ok: true, ...result };
    } catch (e: any) {
      return { ok: false, message: e.message };
    }
  });

  // ─── Profil boshqaruvi ───────────────────────────────────────────────────────
  ipcMain.handle('get-profiles', async () => getDb().getProfiles());
  ipcMain.handle('create-profile', async (_: any, name: string) => getDb().createProfile(name));
  ipcMain.handle('switch-profile', async (_: any, id: string) => getDb().switchProfile(id));
  ipcMain.handle('rename-profile', async (_: any, id: string, name: string) => getDb().renameProfile(id, name));
  ipcMain.handle('delete-profile', async (_: any, id: string) => getDb().deleteProfile(id));

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
        if (err) resolve({ ok: false, message: err.message });
        else { db.detach(); resolve({ ok: true, message: "Ulanish muvaffaqiyatli!" }); }
      });
    });
  });

  ipcMain.handle('open-downloads-folder', () => {
    const dir = path.join(app.getPath('downloads'), 'AvtoETTN');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    shell.openPath(dir);
  });

  ipcMain.handle('get-invoices', async () => {
    const db = getDb();
    const data = await db1Uz.getInvoices();
    const manualInvoices = await db.getManualInvoices();
    const allInvoices = [...manualInvoices, ...data.invoices];
    const writtenInvoiceIds = await db.getWrittenInvoiceIds();
    const invoicesWithStatus = allInvoices.map((inv: any) => ({
      ...inv,
      isWritten: writtenInvoiceIds.includes(inv.id)
    }));
    return { invoices: invoicesWithStatus, isMock: data.isMock };
  });

  ipcMain.handle('toggle-invoice-written', async (_: any, invoiceId: string, isWritten: boolean) => {
    const db = getDb();
    if (isWritten) await db.markInvoiceAsWritten(invoiceId);
    else await db.unmarkInvoiceAsWritten(invoiceId);
    return { success: true, isWritten };
  });

  ipcMain.handle('get-vehicles', async () => getDb().getVehicles());
  ipcMain.handle('save-vehicle', async (_: any, vehicle: any) => getDb().saveVehicle(vehicle));
  ipcMain.handle('delete-vehicle', async (_: any, id: string) => getDb().deleteVehicle(id));

  ipcMain.handle('get-customers', async () => getDb().getCustomers());

  ipcMain.handle('search-company', async (_: any, tin: string) => soliq.searchCompanyByTin(tin));

  ipcMain.handle('get-settings', async () => getDb().getSettings());
  ipcMain.handle('save-settings', async (_: any, settings: any) => getDb().saveSettings(settings));

  ipcMain.handle('split-cargo', async (_: any, totalQuantity: number, vehicleIds: string[]) => {
    const allVehicles = await getDb().getVehicles();
    const selectedVehicles = allVehicles.filter((v: any) => vehicleIds.includes(v.id));
    return splitter.autoSplit(totalQuantity, selectedVehicles);
  });

  ipcMain.handle('bulk-split', async (_: any, invoiceIds: string[]) => {
    const db = getDb();
    const { invoices } = await db1Uz.getInvoices();
    const manualInvoices = await db.getManualInvoices();
    const allInvoices = [...manualInvoices, ...invoices];
    const selectedInvoices = allInvoices.filter((inv: any) => invoiceIds.includes(inv.id));
    const fleet = await db.getVehicles();
    return splitter.bulkAutoDispatch(selectedInvoices, fleet);
  });

  ipcMain.handle('generate-excel', async (_: any, invoiceId: string, allocations: any[], unloadingAddress: any) => {
    log.info(`Generating Excel for Invoice: ${invoiceId}`);
    try {
      const db = getDb();
      const { invoices } = await db1Uz.getInvoices();
      const manualInvoices = await db.getManualInvoices();
      const allInvoices = [...manualInvoices, ...invoices];
      const invoice = allInvoices.find((inv: any) => inv.id === invoiceId);
      if (!invoice) throw new Error("Hisob-faktura topilmadi.");

      const allVehicles = await db.getVehicles();
      const settings = await db.getSettings();

      const fullAllocations = allocations.map((a: any) => {
        const v = allVehicles.find((veh: any) => veh.id === a.vehicleId);
        return {
          vehicle: v || { driverName: "Noma'lum", plateNumber: a.vehicleId },
          quantityAllocated: parseFloat(a.quantity)
        };
      });

      let unloadingAddressObj = { addressText: '', oblastCode: '1726', rayonCode: '1' };
      if (unloadingAddress) {
        if (typeof unloadingAddress === 'object') unloadingAddressObj = unloadingAddress;
        else if (typeof unloadingAddress === 'string') {
          try { unloadingAddressObj = JSON.parse(unloadingAddress); }
          catch (e) { unloadingAddressObj.addressText = unloadingAddress; }
        }
      }

      const excelBuffer = excelGen.generateEttnExcel(invoice, fullAllocations, unloadingAddressObj, settings);
      const filename = `ETTN_${safeFileSegment(invoice.invoiceNumber)}_${Date.now()}.xlsx`;
      const outputDir = path.join(app.getPath('downloads'), 'AvtoETTN');
      if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
      const outputPath = path.join(outputDir, filename);
      fs.writeFileSync(outputPath, excelBuffer);

      await db.markInvoiceAsWritten(invoiceId);
      await saveCustomerAddress(invoice.buyerTin, invoice.buyerName, unloadingAddressObj);

      shell.showItemInFolder(outputPath);
      log.info(`Excel generated: ${outputPath}`);
      return { success: true, path: outputPath, filename };
    } catch (err: any) {
      log.error('Excel avlodida xatolik:', err);
      throw new Error(err.message);
    }
  });

  ipcMain.handle('bulk-generate-excel', async (_: any, allocations: any[], unloadingAddresses: any) => {
    try {
      const db = getDb();
      const { invoices } = await db1Uz.getInvoices();
      const manualInvoices = await db.getManualInvoices();
      const allInvoices = [...manualInvoices, ...invoices];
      const allVehicles = await db.getVehicles();
      const settings = await db.getSettings();

      const bulkAllocations: any[] = [];
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
            invoice, vehicle,
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
      for (const id of invoiceIdsToMark) await db.markInvoiceAsWritten(id as string);

      for (const alloc of bulkAllocations) {
        if (alloc.invoice?.buyerTin && alloc.unloadingAddressObj) {
          await saveCustomerAddress(alloc.invoice.buyerTin, alloc.invoice.buyerName, alloc.unloadingAddressObj);
        }
      }

      shell.showItemInFolder(outputPath);
      return { success: true, path: outputPath, filename };
    } catch (err: any) {
      log.error('Ommaviy Excel avlodida xatolik:', err);
      throw new Error(err.message);
    }
  });

  ipcMain.handle('save-manual-invoice', async (_: any, invoice: any) => getDb().saveManualInvoice(invoice));
  ipcMain.handle('delete-manual-invoice', async (_: any, id: string) => getDb().deleteManualInvoice(id));

  ipcMain.handle('extract-pdfs', async (_: any, buffer: any) => {
    const AdmZip = require('adm-zip');
    const now = new Date();
    const stamp = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
    const outputDir = path.join(require('os').homedir(), 'Desktop', 'Yuklangan_PDFlar', stamp);
    fs.mkdirSync(outputDir, { recursive: true });

    const mainZip = new AdmZip(Buffer.from(buffer));
    const mainEntries = mainZip.getEntries();
    const extractedNames = new Set();
    let pdfCount = 0;
    const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const folderName = `Fakturalar_${dateStr}_PDFlar`;
    const flatZip = new AdmZip();

    for (const entry of mainEntries) {
      if (entry.isDirectory) continue;
      const entryNameLower = entry.entryName.toLowerCase();
      if (entryNameLower.endsWith('.zip')) {
        try {
          const nestedZip = new AdmZip(entry.getData());
          const zipBaseName = path.basename(entry.entryName, '.zip');
          for (const ne of nestedZip.getEntries()) {
            if (ne.isDirectory || !ne.entryName.toLowerCase().endsWith('.pdf')) continue;
            const pdfBuffer = ne.getData();
            const pdfBase = path.basename(ne.entryName);
            let targetName = `${zipBaseName}.pdf`;
            if (pdfBase.toLowerCase() !== 'document.pdf' && pdfBase.toLowerCase() !== 'factura.pdf') {
              targetName = `${zipBaseName}_${pdfBase}`;
            }
            let finalName = targetName;
            let cnt = 1;
            while (extractedNames.has(finalName.toLowerCase())) {
              const ext = path.extname(targetName);
              finalName = `${path.basename(targetName, ext)}_${cnt++}${ext}`;
            }
            extractedNames.add(finalName.toLowerCase());
            fs.writeFileSync(path.join(outputDir, finalName), pdfBuffer);
            flatZip.addFile(`${folderName}/${finalName}`, pdfBuffer);
            pdfCount++;
          }
        } catch (_) {}
      } else if (entryNameLower.endsWith('.pdf')) {
        try {
          const pdfBuffer = entry.getData();
          const pdfBase = path.basename(entry.entryName);
          let finalName = pdfBase;
          let cnt = 1;
          while (extractedNames.has(finalName.toLowerCase())) {
            const ext = path.extname(pdfBase);
            finalName = `${path.basename(pdfBase, ext)}_${cnt++}${ext}`;
          }
          extractedNames.add(finalName.toLowerCase());
          fs.writeFileSync(path.join(outputDir, finalName), pdfBuffer);
          flatZip.addFile(`${folderName}/${finalName}`, pdfBuffer);
          pdfCount++;
        } catch (_) {}
      }
    }
    if (pdfCount > 0) shell.openPath(outputDir);
    return { pdfCount, folderName, zipBuffer: flatZip.toBuffer() };
  });

  ipcMain.handle('parse-pdf', async (_: any, buffer: any) => {
    return await pdfParser.parseInvoicePdf(Buffer.from(buffer));
  });

  ipcMain.handle('parse-pdfs-from-folder', async () => {
    const baseDir = path.join(require('os').homedir(), 'Desktop', 'Yuklangan_PDFlar');
    if (!fs.existsSync(baseDir)) return [];
    const subfolders = fs.readdirSync(baseDir)
      .map((name: string) => ({ name, time: fs.statSync(path.join(baseDir, name)).mtimeMs }))
      .filter((e: any) => fs.statSync(path.join(baseDir, e.name)).isDirectory())
      .sort((a: any, b: any) => b.time - a.time);
    const outputDir = subfolders.length > 0 ? path.join(baseDir, subfolders[0].name) : baseDir;
    if (!fs.existsSync(outputDir)) return [];
    const files = fs.readdirSync(outputDir).filter((f: string) => f.toLowerCase().endsWith('.pdf'));
    const results = [];
    for (const fileName of files) {
      try {
        const buf = fs.readFileSync(path.join(outputDir, fileName));
        const inv = await pdfParser.parseInvoicePdf(buf);
        results.push({ fileName, inv });
      } catch (e) {
        results.push({ fileName, inv: null });
      }
    }
    return results;
  });
}
