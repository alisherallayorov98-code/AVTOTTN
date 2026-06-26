import { useState, useEffect } from 'react';

// Define the shape of our global window.api
declare global {
  interface Window {
    api: {
      getProfiles: () => Promise<any>;
      createProfile: (name: string) => Promise<any>;
      switchProfile: (id: string) => Promise<any>;
      renameProfile: (id: string, name: string) => Promise<any>;
      deleteProfile: (id: string) => Promise<any>;
      testFirebirdConnection: () => Promise<{ ok: boolean; message: string }>;
      getInvoices: () => Promise<any>;
      toggleInvoiceWritten: (id: string, isWritten: boolean) => Promise<any>;
      getVehicles: () => Promise<any>;
      saveVehicle: (vehicle: any) => Promise<any>;
      deleteVehicle: (id: string) => Promise<any>;
      getCustomers: () => Promise<any>;
      searchCompany: (tin: string) => Promise<any>;
      getSettings: () => Promise<any>;
      saveSettings: (settings: any) => Promise<any>;
      splitCargo: (totalQty: number, vehicleIds: string[]) => Promise<any>;
      bulkSplit: (invoiceIds: string[]) => Promise<any>;
      generateExcel: (invoiceId: string, allocations: any[], address: any) => Promise<any>;
      bulkGenerateExcel: (allocations: any[], addresses: any) => Promise<any>;
      saveManualInvoice: (invoice: any) => Promise<any>;
      deleteManualInvoice: (id: string) => Promise<any>;
      extractPdfs: (buffer: ArrayBuffer) => Promise<any>;
      parsePdf: (buffer: ArrayBuffer) => Promise<any>;
      parsePdfsFromFolder: () => Promise<any>;
      backupCreate: () => Promise<any>;
      backupList: () => Promise<any[]>;
      backupRestore: (backupPath: string) => Promise<any>;
      backupCheckRestore: () => Promise<any>;
    };
  }
}

export function useVehicles() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchVehicles = async () => {
    setLoading(true);
    try {
      const data = await window.api.getVehicles();
      setVehicles(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, []);

  return { vehicles, loading, refetch: fetchVehicles };
}

export function useInvoices() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [isMock, setIsMock] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const data = await window.api.getInvoices();
      setInvoices(data.invoices || []);
      setIsMock(!!data.isMock);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  return { invoices, isMock, loading, refetch: fetchInvoices };
}

export function useCustomers() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const data = await window.api.getCustomers();
      setCustomers(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  return { customers, loading, refetch: fetchCustomers };
}

export function useSettings() {
  const [settings, setSettings] = useState<any>({});
  const [loading, setLoading] = useState(true);
  
  const fetchSettings = async () => {
    setLoading(true);
    try {
      const data = await window.api.getSettings();
      setSettings(data || {});
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return { settings, loading, refetch: fetchSettings };
}
