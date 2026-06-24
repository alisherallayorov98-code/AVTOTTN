import { useState } from 'react'
import { FileText, Truck, Settings, Package, Search, Plus, Phone, User, Trash2, Pencil, FileUp, Layers } from 'lucide-react'
import { useInvoices, useVehicles, useSettings, useCustomers } from './hooks/useIpc'
import { SplitterModal } from './components/SplitterModal'
import { VehicleModal } from './components/VehicleModal'
import { PdfImportModal } from './components/PdfImportModal'
import { BulkDispatchModal } from './components/BulkDispatchModal'
import { Toaster, toast } from './components/Toast'
import { RegionDistrictPicker } from './components/RegionDistrictPicker'
import { useEffect } from 'react'

// Assuming we expose ipcRenderer directly via contextBridge for updates
declare global {
  interface Window {
    electronAPI?: {
      onUpdateAvailable: (callback: (info: any) => void) => void;
      onUpdateDownloaded: (callback: (info: any) => void) => void;
      restartApp: () => void;
    };
  }
}

function App() {
  const [activeTab, setActiveTab] = useState<'invoices' | 'vehicles' | 'settings'>('invoices')
  const [updateState, setUpdateState] = useState<'idle' | 'available' | 'downloading' | 'ready'>('idle')
  const [updateProgress, setUpdateProgress] = useState(0)
  const [appVersion, setAppVersion] = useState('...')

  useEffect(() => {
    if (!window.electronAPI) return
    window.electronAPI.onUpdateAvailable(() => setUpdateState('available'))
    window.electronAPI.onUpdateProgress((p: number) => { setUpdateState('downloading'); setUpdateProgress(p) })
    window.electronAPI.onUpdateDownloaded(() => setUpdateState('ready'))
    window.electronAPI.getAppVersion?.().then((v: string) => setAppVersion(v))
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Toaster />
      {/* Sidebar */}
      <aside className="w-64 bg-secondary/30 border-r flex flex-col transition-all duration-300">
        <div className="p-6 flex items-center gap-3">
          <div className="bg-primary/10 text-primary p-2 rounded-lg">
            <Package size={24} />
          </div>
          <h1 className="font-bold text-xl tracking-tight">AvtoETTN</h1>
        </div>

        <nav className="flex-1 px-4 py-2 space-y-2">
          <NavItem 
            icon={<FileText size={20} />} 
            label="Fakturalar" 
            active={activeTab === 'invoices'} 
            onClick={() => setActiveTab('invoices')} 
          />
          <NavItem 
            icon={<Truck size={20} />} 
            label="Mashinalar" 
            active={activeTab === 'vehicles'} 
            onClick={() => setActiveTab('vehicles')} 
          />
          <NavItem 
            icon={<Settings size={20} />} 
            label="Sozlamalar" 
            active={activeTab === 'settings'} 
            onClick={() => setActiveTab('settings')} 
          />
        </nav>

        <div className="p-4 m-4 bg-primary/10 rounded-xl">
          <p className="text-xs text-primary/80 font-medium text-center">AvtoETTN</p>
          <p className="text-[10px] text-muted-foreground text-center mt-1">v{appVersion}</p>
          {updateState === 'available' && (
            <p className="text-[10px] text-amber-500 text-center mt-1 animate-pulse">Yangilanish yuklanmoqda...</p>
          )}
          {updateState === 'downloading' && (
            <div className="mt-2">
              <div className="w-full bg-primary/20 rounded-full h-1.5">
                <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${updateProgress}%` }} />
              </div>
              <p className="text-[10px] text-primary text-center mt-1">{updateProgress}% yuklandi</p>
            </div>
          )}
          {updateState === 'ready' && (
            <button
              onClick={() => window.electronAPI?.restartApp()}
              className="mt-2 w-full text-[11px] bg-emerald-500 text-white rounded-lg py-1.5 font-medium hover:bg-emerald-600 transition-colors animate-pulse"
            >
              Yangilash — O'rnatish
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-background">
        <header className="h-16 border-b flex items-center justify-between px-8 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10 sticky top-0">
          <h2 className="text-2xl font-semibold tracking-tight capitalize">
            {activeTab === 'invoices' ? 'Fakturalar Ro\'yxati' : activeTab === 'vehicles' ? 'Mashinalar Parki' : 'Tizim Sozlamalari'}
          </h2>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveTab('settings')}
              title="Sozlamalar"
              className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-colors"
            >
              <Settings size={16} />
            </button>
            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-white font-medium shadow-md">
              A
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {activeTab === 'invoices' && <InvoicesView />}
          {activeTab === 'vehicles' && <VehiclesView />}
          {activeTab === 'settings' && <SettingsView />}
        </div>
      </main>

    </div>
  )
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
        active 
          ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-[1.02]' 
          : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

function InvoicesView() {
  const { invoices, isMock, loading, refetch } = useInvoices()
  const { vehicles } = useVehicles()
  const { customers, refetch: refetchCustomers } = useCustomers()
  const [search, setSearch] = useState('')
  const [statusTab, setStatusTab] = useState<'pending' | 'written'>('pending')
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [showPdfImport, setShowPdfImport] = useState(false)
  const [showBulk, setShowBulk] = useState(false)

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
  }

  const pendingInvoices = invoices.filter(i => !i.isWritten)
  const writtenInvoices = invoices.filter(i => i.isWritten)

  const filtered = (statusTab === 'pending' ? pendingInvoices : writtenInvoices).filter(i =>
    (i.invoiceNumber || '').toLowerCase().includes(search.toLowerCase()) ||
    (i.buyerName || '').toLowerCase().includes(search.toLowerCase())
  )

  const toggleSelect = (id: string) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const isImported = (inv: any) => typeof inv.id === 'string' && inv.id.startsWith('manual_')

  const deleteImported = async (inv: any) => {
    if (!confirm(`№ ${inv.invoiceNumber} fakturasini o'chirasizmi?`)) return
    try {
      await window.api.deleteManualInvoice(inv.id)
      toast("Faktura o'chirildi", 'info')
      refetch()
    } catch (e: any) {
      toast("Xatolik: " + e.message, 'error')
    }
  }

  const toggleWritten = async (inv: any) => {
    try {
      await window.api.toggleInvoiceWritten(inv.id, !inv.isWritten)
      refetch()
    } catch (e: any) {
      toast("Xatolik: " + e.message, 'error')
    }
  }

  const selectedInvoices = invoices.filter(i => selectedIds.includes(i.id))

  const tabBtn = (tab: 'pending' | 'written', label: string, count: number) => (
    <button
      onClick={() => { setStatusTab(tab); setSelectedIds([]) }}
      className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
        statusTab === tab
          ? 'bg-primary text-primary-foreground shadow'
          : 'text-muted-foreground hover:bg-secondary'
      }`}
    >
      {label} <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${statusTab === tab ? 'bg-white/20' : 'bg-secondary'}`}>{count}</span>
    </button>
  )

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {isMock && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 text-sm">
          <span className="text-lg">⚠️</span>
          <span>
            <b>Demo rejim:</b> 1Uz bazasiga ulanmagan.
            Haqiqiy ma'lumot uchun <b>Sozlamalar → 1Uz Ma'lumotlar Bazasi</b> bo'limida <b>.fdb</b> fayl yo'lini ko'rsating.
          </span>
        </div>
      )}

      {/* Tab va amallar qatori */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 bg-secondary/30 p-1 rounded-xl">
          {tabBtn('pending', 'Kutilmoqda', pendingInvoices.length)}
          {tabBtn('written', 'Yozilgan', writtenInvoices.length)}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {selectedIds.length > 0 && (
            <button onClick={() => setShowBulk(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg shadow hover:opacity-90 transition-opacity font-medium text-sm">
              <Layers size={16} /> Ommaviy taqsimlash ({selectedIds.length})
            </button>
          )}
          <button onClick={() => setShowPdfImport(true)} className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors font-medium text-sm">
            <FileUp size={16} /> PDF / ZIP yuklash
          </button>
          <button onClick={() => window.electronAPI?.openDownloadsFolder?.()} className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors font-medium text-sm" title="Tayyor Excel fayllar papkasini ochish">
            Tayyor fayllar
          </button>
          <button onClick={refetch} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg shadow hover:opacity-90 transition-opacity font-medium text-sm">
            Yangilash
          </button>
        </div>
      </div>

      {/* Qidiruv */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
        <input
          type="text"
          placeholder="Faktura raqami yoki xaridor nomi..."
          className="w-full pl-10 pr-4 py-2 bg-secondary/50 border-transparent rounded-lg focus:bg-background focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-card rounded-xl border shadow-sm overflow-hidden bg-background">
        <table className="w-full text-sm text-left">
          <thead className="bg-secondary/40 text-muted-foreground">
            <tr>
              {statusTab === 'pending' && <th className="pl-4 pr-2 py-4 w-10"></th>}
              <th className="px-6 py-4 font-medium">Faktura №</th>
              <th className="px-6 py-4 font-medium">Sana</th>
              <th className="px-6 py-4 font-medium">Xaridor</th>
              <th className="px-6 py-4 font-medium">Yuk (tonna)</th>
              <th className="px-6 py-4 font-medium text-right">Summa</th>
              <th className="px-6 py-4 font-medium text-right">Amallar</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={statusTab === 'pending' ? 7 : 6} className="px-6 py-12 text-center text-muted-foreground">
                  {statusTab === 'pending' ? 'Kutilayotgan fakturalar yo\'q.' : 'Yozilgan fakturalar yo\'q.'}
                </td>
              </tr>
            ) : filtered.map(inv => (
              <tr key={inv.id} className="hover:bg-secondary/20 transition-colors group">
                {statusTab === 'pending' && (
                  <td className="pl-4 pr-2 py-4">
                    <input type="checkbox" checked={selectedIds.includes(inv.id)} onChange={() => toggleSelect(inv.id)} className="w-4 h-4 rounded text-primary focus:ring-primary" />
                  </td>
                )}
                <td className="px-6 py-4 font-medium">{inv.invoiceNumber}</td>
                <td className="px-6 py-4 text-muted-foreground">{(inv.invoiceDate || '').substring(0, 10)}</td>
                <td className="px-6 py-4">
                  <div className="font-medium text-foreground truncate max-w-[250px]">{inv.buyerName}</div>
                  <div className="text-xs text-muted-foreground">STIR: {inv.buyerTin}</div>
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center px-2 py-1 rounded-md bg-accent/50 text-accent-foreground text-xs font-semibold">
                    {inv.quantity} {inv.unitName || 't'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right font-medium">{Number(inv.totalSum).toLocaleString('ru-RU')} UZS</td>
                <td className="px-6 py-4 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isImported(inv) && (
                      <button onClick={() => deleteImported(inv)} className="p-1.5 text-muted-foreground hover:text-destructive rounded-md" title="O'chirish">
                        <Trash2 size={14} />
                      </button>
                    )}
                    {statusTab === 'written' && (
                      <button onClick={() => toggleWritten(inv)} className="px-3 py-1.5 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 rounded-md text-xs font-medium transition-colors">
                        Qaytarish
                      </button>
                    )}
                    {statusTab === 'pending' && (
                      <button onClick={() => setSelectedInvoice(inv)} className="px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground rounded-md text-xs font-medium transition-colors">
                        TTN yozish
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedInvoice && (
        <SplitterModal
          invoice={selectedInvoice}
          vehicles={vehicles}
          customers={customers}
          onClose={() => setSelectedInvoice(null)}
          onComplete={() => { setSelectedInvoice(null); refetch(); refetchCustomers(); }}
        />
      )}

      {showPdfImport && (
        <PdfImportModal
          onClose={() => setShowPdfImport(false)}
          onImported={() => { setShowPdfImport(false); refetch(); }}
        />
      )}

      {showBulk && (
        <BulkDispatchModal
          invoices={selectedInvoices}
          vehicles={vehicles}
          customers={customers}
          onClose={() => setShowBulk(false)}
          onComplete={() => { setShowBulk(false); setSelectedIds([]); refetch(); }}
        />
      )}
    </div>
  )
}

function VehiclesView() {
  const { vehicles, loading, refetch } = useVehicles()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<any>(null)
  const [showModal, setShowModal] = useState(false)

  if (loading) return <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>

  const filtered = vehicles.filter(v => v.plateNumber.toLowerCase().includes(search.toLowerCase()) || v.driverName.toLowerCase().includes(search.toLowerCase()))

  const openAdd = () => { setEditing(null); setShowModal(true) }
  const openEdit = (v: any) => { setEditing(v); setShowModal(true) }

  const handleDelete = async (v: any) => {
    if (!confirm(`"${v.plateNumber}" mashinasini o'chirasizmi?`)) return
    try {
      await window.api.deleteVehicle(v.id)
      toast("Mashina o'chirildi", 'info')
      refetch()
    } catch (e: any) {
      toast("Xatolik: " + e.message, 'error')
    }
  }

  const toggleActive = async (v: any) => {
    try {
      await window.api.saveVehicle({ ...v, isActive: !v.isActive })
      refetch()
    } catch (e: any) {
      toast("Xatolik: " + e.message, 'error')
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <input
            type="text"
            placeholder="Mashina raqami yoki haydovchi..."
            className="w-full pl-10 pr-4 py-2 bg-secondary/50 border-transparent rounded-lg focus:bg-background focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg shadow hover:opacity-90 transition-opacity font-medium text-sm">
          <Plus size={16} /> Mashina qo'shish
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Truck size={48} className="mx-auto mb-4 opacity-30" />
          <p>Mashinalar yo'q. "Mashina qo'shish" tugmasini bosing.</p>
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filtered.map(v => (
          <div key={v.id} className="group relative bg-card border rounded-xl p-5 hover:shadow-lg hover:border-primary/50 transition-all duration-300 flex flex-col h-full bg-background">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2.5 rounded-lg text-primary">
                  <Truck size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-lg leading-tight">{v.plateNumber}</h3>
                  <p className="text-xs text-muted-foreground">{v.vehicleModel || 'Model kiritilmagan'}</p>
                </div>
              </div>
              <button
                onClick={() => toggleActive(v)}
                title={v.isActive !== false ? 'Nofaol qilish' : 'Faol qilish'}
                className={`w-3 h-3 rounded-full transition-colors hover:ring-2 hover:ring-offset-1 ${v.isActive !== false ? 'bg-emerald-500 hover:ring-emerald-400' : 'bg-destructive hover:ring-destructive/50'}`}
              />
            </div>

            <div className="space-y-3 flex-1">
              <div className="flex items-center gap-2 text-sm">
                <User size={14} className="text-muted-foreground" />
                <span className="font-medium">{v.driverName}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone size={14} />
                <span>{v.driverPhone || 'Noma\'lum'}</span>
              </div>

              <div className="pt-3 mt-3 border-t grid grid-cols-2 gap-2 text-center">
                <div className="bg-secondary/50 rounded-lg py-2">
                  <div className="text-xs text-muted-foreground mb-0.5">Sig'im</div>
                  <div className="font-bold text-primary">{v.maxCapacity} <span className="text-xs font-normal">t</span></div>
                </div>
                <div className="bg-secondary/50 rounded-lg py-2">
                  <div className="text-xs text-muted-foreground mb-0.5">Maks. Reys</div>
                  <div className="font-bold text-foreground">{v.maxDailyTrips || 2} <span className="text-xs font-normal">marta</span></div>
                </div>
              </div>
            </div>

            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
              <button onClick={() => openEdit(v)} className="bg-background/80 backdrop-blur border p-1.5 rounded-md text-muted-foreground hover:text-primary shadow-sm" title="Tahrirlash">
                <Pencil size={14} />
              </button>
              <button onClick={() => handleDelete(v)} className="bg-background/80 backdrop-blur border p-1.5 rounded-md text-muted-foreground hover:text-destructive shadow-sm" title="O'chirish">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
      )}

      {showModal && (
        <VehicleModal
          vehicle={editing}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); refetch() }}
        />
      )}
    </div>
  )
}

function SettingsView() {
  const { settings, loading, refetch } = useSettings()
  const [form, setForm] = useState<any>({})
  const [units, setUnits] = useState<{ name: string; code: string }[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!loading) {
      setForm(settings || {})
      const uc = settings?.unitCodes || { tonna: 1629438 }
      setUnits(Object.entries(uc).map(([name, code]) => ({ name, code: String(code) })))
    }
  }, [loading, settings])

  if (loading) return null

  const update = (key: string, value: any) => setForm((prev: any) => ({ ...prev, [key]: value }))

  // Birlik kodlari jadvalini tahrirlash (nomi -> Didox kodi)
  const commitUnits = (next: { name: string; code: string }[]) => {
    setUnits(next)
    const obj: any = {}
    next.forEach(u => { if (u.name.trim()) obj[u.name.trim().toLowerCase()] = u.code })
    setForm((prev: any) => ({ ...prev, unitCodes: obj }))
  }
  const updateUnit = (idx: number, key: 'name' | 'code', value: string) =>
    commitUnits(units.map((u, i) => i === idx ? { ...u, [key]: value } : u))
  const addUnit = () => commitUnits([...units, { name: '', code: '' }])
  const removeUnit = (idx: number) => commitUnits(units.filter((_, i) => i !== idx))

  const handleSave = async () => {
    setSaving(true)
    try {
      await window.api.saveSettings(form)
      await refetch()
      toast("Sozlamalar saqlandi ✓", 'success')
    } catch (e: any) {
      toast("Saqlashda xatolik: " + e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = "w-full px-3 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-sm"

  return (
    <div className="max-w-5xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

        {/* Jo'natuvchi Ma'lumotlari */}
        <section className="bg-card border rounded-xl overflow-hidden bg-background">
          <div className="px-6 py-4 border-b bg-secondary/30">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Package size={18} className="text-primary" />
              Jo'natuvchi Ma'lumotlari
            </h3>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-muted-foreground">Kompaniya Nomi</label>
              <input type="text" value={form.senderName || ''} onChange={e => update('senderName', e.target.value)} className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5 text-muted-foreground">STIR (INN)</label>
                <input type="text" value={form.senderTin || ''} onChange={e => update('senderTin', e.target.value)} className={inputCls + ' font-mono'} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 text-muted-foreground">Mas'ul JShShIR (PINFL)</label>
                <input type="text" value={form.senderResponsiblePinfl || ''} onChange={e => update('senderResponsiblePinfl', e.target.value)} className={inputCls + ' font-mono'} />
              </div>
            </div>
          </div>
        </section>

        {/* Yuklash (Ortish) Manzili */}
        <section className="bg-card border rounded-xl overflow-hidden bg-background">
          <div className="px-6 py-4 border-b bg-secondary/30">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Package size={18} className="text-primary" />
              Yuklash (Ortish) Manzili
            </h3>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-muted-foreground">Manzil (Ko'cha, uy)</label>
              <input type="text" value={form.loadingAddress || ''} onChange={e => update('loadingAddress', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 text-muted-foreground">Viloyat / Tuman</label>
              <RegionDistrictPicker
                oblastCode={form.loadingOblast}
                rayonCode={form.loadingRayon}
                onChange={(o, r) => setForm((prev: any) => ({ ...prev, loadingOblast: o, loadingRayon: r }))}
              />
            </div>
          </div>
        </section>

        {/* 1Uz Firebird Bazasi */}
        <section className="bg-card border rounded-xl overflow-hidden bg-background">
          <div className="px-6 py-4 border-b bg-secondary/30">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Settings size={18} className="text-primary" />
              1Uz Ma'lumotlar Bazasi (Firebird)
            </h3>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1.5 text-muted-foreground">Host</label>
                <input type="text" value={form.firebirdHost || ''} onChange={e => update('firebirdHost', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 text-muted-foreground">Port</label>
                <input type="number" value={form.firebirdPort || ''} onChange={e => update('firebirdPort', e.target.value)} className={inputCls} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 text-muted-foreground">Fayl yo'li (.fdb Database Path)</label>
              <input type="text" value={form.firebirdDatabase || ''} onChange={e => update('firebirdDatabase', e.target.value)} placeholder="Bo'sh qoldirsangiz demo rejimda ishlaydi" className={inputCls + ' font-mono'} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5 text-muted-foreground">Foydalanuvchi</label>
                <input type="text" value={form.firebirdUser || ''} onChange={e => update('firebirdUser', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 text-muted-foreground">Parol</label>
                <input type="password" value={form.firebirdPassword || ''} onChange={e => update('firebirdPassword', e.target.value)} className={inputCls} />
              </div>
            </div>
          </div>
        </section>

        {/* Soliq API */}
        <section className="bg-card border rounded-xl overflow-hidden bg-background">
          <div className="px-6 py-4 border-b bg-secondary/30">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Search size={18} className="text-primary" />
              Soliq API (STIR qidirish)
            </h3>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-muted-foreground">API URL <span className="text-xs">(STIR uchun %s)</span></label>
              <input type="text" value={form.soliqApiUrl || ''} onChange={e => update('soliqApiUrl', e.target.value)} className={inputCls + ' font-mono'} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 text-muted-foreground">API Kalit (Token)</label>
              <input type="text" value={form.soliqApiKey || ''} onChange={e => update('soliqApiKey', e.target.value)} className={inputCls + ' font-mono'} />
            </div>
          </div>
        </section>

        {/* ETTN qiymatlari (Yetkazib berish, ekspeditor, birlik kodlari) */}
        <section className="bg-card border rounded-xl overflow-hidden bg-background md:col-span-2">
          <div className="px-6 py-4 border-b bg-secondary/30">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <FileText size={18} className="text-primary" />
              ETTN qiymatlari (Yetkazib berish va birliklar)
            </h3>
          </div>
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5 text-muted-foreground">Umumiy masofa (km)</label>
                <input type="number" value={form.deliveryDistance ?? ''} onChange={e => update('deliveryDistance', e.target.value)} placeholder="1" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 text-muted-foreground">1 km narxi (so'm)</label>
                <input type="number" value={form.deliveryCostPerKm ?? ''} onChange={e => update('deliveryCostPerKm', e.target.value)} placeholder="1" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 text-muted-foreground">Yetkazish narxi (jami)</label>
                <input
                  type="text"
                  disabled
                  value={((parseFloat(form.deliveryDistance) || 1) * (parseFloat(form.deliveryCostPerKm) || 1)).toLocaleString('ru-RU')}
                  className={inputCls + ' bg-secondary/40 cursor-not-allowed'}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5 text-muted-foreground">Ekspeditor STIR/PINFL <span className="text-xs">(bo'sh qoldirsangiz — jo'natuvchi STIR ishlatiladi)</span></label>
              <input type="text" value={form.expeditorTin || ''} onChange={e => update('expeditorTin', e.target.value)} placeholder={form.senderTin || 'Jo\'natuvchi STIR'} className={inputCls + ' font-mono max-w-sm'} />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-muted-foreground">O'lchov birliklari kodi <span className="text-xs">(Didox kodlari)</span></label>
                <button onClick={addUnit} className="text-xs text-primary flex items-center gap-1 hover:underline"><Plus size={12} /> Birlik qo'shish</button>
              </div>
              <div className="space-y-2 max-w-xl">
                {units.map((u, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input className={inputCls} placeholder="Birlik nomi (masalan: tonna)" value={u.name} onChange={e => updateUnit(idx, 'name', e.target.value)} />
                    <input className={inputCls + ' font-mono w-40'} placeholder="Kod (masalan: 1629438)" value={u.code} onChange={e => updateUnit(idx, 'code', e.target.value)} />
                    <button onClick={() => removeUnit(idx)} className="text-muted-foreground hover:text-destructive shrink-0"><Trash2 size={16} /></button>
                  </div>
                ))}
                {units.length === 0 && <p className="text-xs text-muted-foreground">Birlik qo'shilmagan — barcha tovarlar standart "tonna" (1629438) kodi bilan ketadi.</p>}
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">Tovar birligi shu jadvalda bo'lmasa, standart <b>tonna (1629438)</b> kodi ishlatiladi.</p>
            </div>
          </div>
        </section>
      </div>

      {/* Yagona Saqlash tugmasi */}
      <div className="flex justify-end sticky bottom-0 py-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-8 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:opacity-90 transition-opacity shadow-lg shadow-primary/20 disabled:opacity-50"
        >
          {saving ? 'Saqlanmoqda...' : 'Barcha sozlamalarni saqlash'}
        </button>
      </div>
    </div>
  )
}

export default App
