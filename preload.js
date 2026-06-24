const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (_event, info) => callback(info)),
  onUpdateProgress: (callback) => ipcRenderer.on('update-progress', (_event, percent) => callback(percent)),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', (_event, info) => callback(info)),
  restartApp: () => ipcRenderer.send('restart-app'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  openDownloadsFolder: () => ipcRenderer.invoke('open-downloads-folder')
});

contextBridge.exposeInMainWorld('api', {
  getInvoices: () => ipcRenderer.invoke('get-invoices'),
  toggleInvoiceWritten: (invoiceId, isWritten) => ipcRenderer.invoke('toggle-invoice-written', invoiceId, isWritten),
  getVehicles: () => ipcRenderer.invoke('get-vehicles'),
  saveVehicle: (vehicle) => ipcRenderer.invoke('save-vehicle', vehicle),
  deleteVehicle: (id) => ipcRenderer.invoke('delete-vehicle', id),
  getCustomers: () => ipcRenderer.invoke('get-customers'),
  searchCompany: (tin) => ipcRenderer.invoke('search-company', tin),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  splitCargo: (totalQuantity, vehicleIds) => ipcRenderer.invoke('split-cargo', totalQuantity, vehicleIds),
  bulkSplit: (invoiceIds) => ipcRenderer.invoke('bulk-split', invoiceIds),
  generateExcel: (invoiceId, allocations, unloadingAddress) => ipcRenderer.invoke('generate-excel', invoiceId, allocations, unloadingAddress),
  bulkGenerateExcel: (allocations, unloadingAddresses) => ipcRenderer.invoke('bulk-generate-excel', allocations, unloadingAddresses),
  saveManualInvoice: (invoice) => ipcRenderer.invoke('save-manual-invoice', invoice),
  deleteManualInvoice: (id) => ipcRenderer.invoke('delete-manual-invoice', id),
  extractPdfs: (buffer) => ipcRenderer.invoke('extract-pdfs', buffer),
  parsePdf: (buffer) => ipcRenderer.invoke('parse-pdf', buffer),
  parsePdfsFromFolder: () => ipcRenderer.invoke('parse-pdfs-from-folder')
});
