import { useState, useEffect, useRef } from 'react'
import { FileText, Truck, Settings, Package, Search, Plus, Phone, User, Trash2, Pencil, FileUp, Layers, ChevronDown, CheckCircle2, XCircle, Loader2, Building2, ShieldCheck, RotateCcw, HardDrive } from 'lucide-react'
import { useInvoices, useVehicles, useSettings, useCustomers } from './hooks/useIpc'
import { SplitterModal } from './components/SplitterModal'
import { VehicleModal } from './components/VehicleModal'
import { PdfImportModal } from './components/PdfImportModal'
import { BulkDispatchModal } from './components/BulkDispatchModal'
import { Toaster, toast } from './components/Toast'
import { RegionDistrictPicker } from './components/RegionDistrictPicker'

// Assuming we expose ipcRenderer directly via contextBridge for updates
declare global {
  interface Window {
    electronAPI?: {
      onUpdateAvailable: (callback: (info: any) => void) => void;
      onUpdateProgress: (callback: (percent: number) => void) => void;
      onUpdateDownloaded: (callback: (info: any) => void) => void;
      restartApp: () => void;
      checkForUpdate: () => Promise<void>;
      getAppVersion: () => Promise<string>;
      openDownloadsFolder: () => Promise<void>;
    };
  }
}

function App() {
  const [activeTab, setActiveTab] = useState<'invoices' | 'vehicles' | 'settings'>('invoices')
  const [updateState, setUpdateState] = useState<'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error'>('idle')
  const [updateProgress, setUpdateProgress] = useState(0)
  const [appVersion, setAppVersion] = useState('...')
  const [profileKey, setProfileKey] = useState(0)
  const [profiles, setProfiles] = useState<{ id: string; name: string }[]>([])
  const [currentProfileId, setCurrentProfileId] = useState('')
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [creatingProfile, setCreatingProfile] = useState(false)
  const [newProfileName, setNewProfileName] = useState('')
  const profileMenuRef = useRef<HTMLDivElement>(null)

  const [restoreCandidate, setRestoreCandidate] = useState<any>(null)
  const [restoring, setRestoring] = useState(false)

  useEffect(() => {
    window.api.backupCheckRestore?.().then((candidate: any) => {
      if (candidate) setRestoreCandidate(candidate)
    }).catch(() => {})
  }, [])

  const handleRestore = async () => {
    if (!restoreCandidate) return
    setRestoring(true)
    try {
      const result = await window.api.backupRestore(restoreCandidate.path)
      if (result.ok) {
        setRestoreCandidate(null)
        toast('Ma\'lumotlar tiklandi! Ilova qayta yuklanmoqda...', 'success')
        setTimeout(() => window.location.reload(), 1500)
      } else {
        toast('Tiklashda xatolik: ' + result.message, 'error')
      }
    } catch (e: any) {
      toast('Xatolik: ' + e.message, 'error')
    } finally {
      setRestoring(false)
    }
  }

  const loadProfiles = async () => {
    try {
      const data = await window.api.getProfiles()
      setProfiles(data.list || [])
      setCurrentProfileId(data.currentId || '')
    } catch {}
  }

  useEffect(() => {
    if (!window.electronAPI) return
    window.electronAPI.onUpdateAvailable(() => setUpdateState('available'))
    window.electronAPI.onUpdateProgress((p: number) => { setUpdateState('downloading'); setUpdateProgress(p) })
    window.electronAPI.onUpdateDownloaded(() => setUpdateState('ready'))
    window.electronAPI.getAppVersion?.().then((v: string) => setAppVersion(v))
  }, [])

  useEffect(() => { loadProfiles() }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false)
        setCreatingProfile(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const switchProfile = async (id: string) => {
    if (id === currentProfileId) { setShowProfileMenu(false); return }
    try {
      await window.api.switchProfile(id)
      setCurrentProfileId(id)
      setProfileKey(k => k + 1)
      setShowProfileMenu(false)
    } catch (e: any) { toast("Profil almashtirilmadi: " + e.message, 'error') }
  }

  const handleCreateProfile = async () => {
    if (!newProfileName.trim()) return
    try {
      await window.api.createProfile(newProfileName.trim())
      await loadProfiles()
      setProfileKey(k => k + 1)
      setNewProfileName('')
      setCreatingProfile(false)
      setShowProfileMenu(false)
    } catch (e: any) { toast("Xatolik: " + e.message, 'error') }
  }

  const handleDeleteProfile = async (id: string, name: string) => {
    if (!confirm(`"${name}" profilini o'chirasizmi? Barcha ma'lumotlar yo'qoladi!`)) return
    try {
      await window.api.deleteProfile(id)
      await loadProfiles()
      setProfileKey(k => k + 1)
    } catch (e: any) { toast("Xatolik: " + e.message, 'error') }
  }

  const currentProfile = profiles.find(p => p.id === currentProfileId)

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Toaster />

      {/* Restore dialog — yangi o'rnatilganda backup topilsa */}
      {restoreCandidate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-background border rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-emerald-500/10 p-3 rounded-xl">
                <ShieldCheck size={28} className="text-emerald-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Backup topildi!</h2>
                <p className="text-sm text-muted-foreground">D:\1uz arxiv\AvtoETTN</p>
              </div>
            </div>
            <div className="bg-secondary/50 rounded-xl p-4 mb-6 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fayl</span>
                <span className="font-medium text-xs">{restoreCandidate.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sana</span>
                <span className="font-medium">{new Date(restoreCandidate.date).toLocaleString('ru-RU')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Kompaniyalar</span>
                <span className="font-medium">{restoreCandidate.profileCount} ta</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mashinalar</span>
                <span className="font-medium">{restoreCandidate.vehicleCount} ta</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Avvalgi ma'lumotlaringiz (mashinalar, sozlamalar, mijozlar) tiklanadi. Davom etasizmi?
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleRestore}
                disabled={restoring}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50"
              >
                {restoring ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                {restoring ? 'Tiklanmoqda...' : 'Ha, tiklash'}
              </button>
              <button
                onClick={() => setRestoreCandidate(null)}
                className="px-4 py-2.5 bg-secondary text-secondary-foreground rounded-xl font-medium hover:bg-secondary/80 transition-colors"
              >
                Yo'q, yangi boshlayman
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className="w-64 bg-secondary/30 border-r flex flex-col transition-all duration-300">
        <div className="p-5 flex items-center gap-3 border-b">
          <div className="bg-primary/10 text-primary p-2 rounded-lg">
            <Package size={22} />
          </div>
          <h1 className="font-bold text-lg tracking-tight">AvtoETTN</h1>
        </div>

        {/* Profil almashtirish */}
        <div className="px-3 pt-3 pb-1 relative" ref={profileMenuRef}>
          <button
            onClick={() => { setShowProfileMenu(v => !v); setCreatingProfile(false) }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-background border hover:border-primary/50 transition-colors text-sm"
          >
            <Building2 size={14} className="text-primary shrink-0" />
            <span className="flex-1 text-left font-medium truncate">{currentProfile?.name || '...'}</span>
            <ChevronDown size={14} className={`text-muted-foreground transition-transform ${showProfileMenu ? 'rotate-180' : ''}`} />
          </button>

          {showProfileMenu && (
            <div className="absolute left-3 right-3 top-full mt-1 z-50 bg-background border rounded-xl shadow-xl overflow-hidden">
              <div className="py-1">
                {profiles.map(p => (
                  <div key={p.id} className={`flex items-center group px-3 py-2 hover:bg-secondary/50 transition-colors ${p.id === currentProfileId ? 'bg-primary/5' : ''}`}>
                    <button onClick={() => switchProfile(p.id)} className="flex-1 text-left text-sm flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${p.id === currentProfileId ? 'bg-primary' : 'bg-transparent'}`} />
                      <span className={p.id === currentProfileId ? 'font-semibold text-primary' : ''}>{p.name}</span>
                    </button>
                    {profiles.length > 1 && (
                      <button onClick={() => handleDeleteProfile(p.id, p.name)} className="hidden group-hover:flex text-muted-foreground hover:text-destructive p-1 rounded" title="O'chirish">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="border-t px-3 py-2">
                {creatingProfile ? (
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      type="text"
                      placeholder="Kompaniya nomi..."
                      value={newProfileName}
                      onChange={e => setNewProfileName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleCreateProfile(); if (e.key === 'Escape') setCreatingProfile(false) }}
                      className="flex-1 text-xs px-2 py-1.5 border rounded-md outline-none focus:ring-1 focus:ring-primary"
                    />
                    <button onClick={handleCreateProfile} className="text-xs px-2 py-1.5 bg-primary text-white rounded-md">OK</button>
                  </div>
                ) : (
                  <button onClick={() => setCreatingProfile(true)} className="w-full flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground py-1">
                    <Plus size={12} /> Yangi kompaniya
                  </button>
                )}
              </div>
            </div>
          )}
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

          {(updateState === 'idle' || updateState === 'error') && (
            <button
              onClick={async () => {
                setUpdateState('checking')
                try {
                  await window.electronAPI?.checkForUpdate()
                } catch {
                  setUpdateState('error')
                }
              }}
              className="mt-2 w-full text-[11px] bg-primary/20 text-primary rounded-lg py-1.5 font-medium hover:bg-primary/30 transition-colors"
            >
              {updateState === 'error' ? 'Qayta tekshirish' : 'Yangilash tekshirish'}
            </button>
          )}
          {updateState === 'error' && (
            <p className="text-[10px] text-destructive text-center mt-1">Ulanishda xatolik</p>
          )}

          {updateState === 'checking' && (
            <p className="text-[10px] text-primary text-center mt-2 animate-pulse">Tekshirilmoqda...</p>
          )}

          {updateState === 'available' && (
            <p className="text-[10px] text-amber-500 text-center mt-1 animate-pulse">Yangi versiya yuklanmoqda...</p>
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
              O'rnatish va Qayta Yuklash
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
          {activeTab === 'invoices' && <InvoicesView key={profileKey} />}
          {activeTab === 'vehicles' && <VehiclesView key={profileKey} />}
          {activeTab === 'settings' && <SettingsView key={profileKey} onProfileRenamed={loadProfiles} />}
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
  const { customers, loading: customersLoading, refetch: refetchCustomers } = useCustomers()
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
          customersLoading={customersLoading}
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

  const filtered = vehicles.filter(v =>
    (v.plateNumber || '').toLowerCase().includes(search.toLowerCase()) ||
    (v.driverName || '').toLowerCase().includes(search.toLowerCase())
  )

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

function SettingsView({ onProfileRenamed }: { onProfileRenamed?: () => void }) {
  const { settings, loading, refetch } = useSettings()
  const [form, setForm] = useState<any>({})
  const [units, setUnits] = useState<{ name: string; code: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [testing, setTesting] = useState(false)
  const [renamingProfile, setRenamingProfile] = useState(false)
  const [profileName, setProfileName] = useState('')
  const [showSoliqApi, setShowSoliqApi] = useState(false)

  useEffect(() => {
    if (!loading) {
      setForm(settings || {})
      const uc = settings?.unitCodes || { tonna: 1629438 }
      setUnits(Object.entries(uc).map(([name, code]) => ({ name, code: String(code) })))
    }
  }, [loading, settings])

  const handleTestFirebird = async () => {
    setTesting(true); setTestResult(null)
    try {
      await window.api.saveSettings(form)
      const result = await window.api.testFirebirdConnection()
      setTestResult(result)
    } catch (e: any) { setTestResult({ ok: false, message: e.message }) }
    finally { setTesting(false) }
  }

  const handleRenameProfile = async () => {
    if (!profileName.trim()) return
    try {
      const data = await window.api.getProfiles()
      await window.api.renameProfile(data.currentId, profileName.trim())
      onProfileRenamed?.()
      setRenamingProfile(false)
      toast("Profil nomi o'zgartirildi ✓", 'success')
    } catch (e: any) { toast("Xatolik: " + e.message, 'error') }
  }

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
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1.5 text-muted-foreground">Kompaniya Nomi</label>
                {renamingProfile ? (
                  <div className="flex gap-2">
                    <input autoFocus type="text" value={profileName} onChange={e => setProfileName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleRenameProfile() }} className={inputCls} />
                    <button onClick={handleRenameProfile} className="px-3 py-2 bg-primary text-white text-xs rounded-md">OK</button>
                    <button onClick={() => setRenamingProfile(false)} className="px-3 py-2 bg-secondary text-xs rounded-md">✕</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input type="text" value={form.senderName || ''} onChange={e => update('senderName', e.target.value)} className={inputCls} />
                    <button onClick={() => { setProfileName(form.senderName || ''); setRenamingProfile(true) }} className="px-3 py-2 bg-secondary text-xs rounded-md shrink-0 text-muted-foreground hover:text-foreground" title="Profil nomini o'zgartirish"><Pencil size={13} /></button>
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5 text-muted-foreground">STIR (INN)</label>
                <input type="text" value={form.senderTin || ''} onChange={e => update('senderTin', e.target.value)} className={inputCls + ' font-mono'} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 text-muted-foreground">Jo'natuvchi mas'ul JShShIR (PINFL)</label>
                <input type="text" value={form.senderResponsiblePinfl || ''} onChange={e => update('senderResponsiblePinfl', e.target.value)} className={inputCls + ' font-mono'} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground bg-secondary/50 rounded-lg px-3 py-2">
              Transport egasi va qabul qiluvchi mas'ul — har bir mashina ma'lumotlarida alohida kiritiladi (Mashinalar bo'limi).
            </p>
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
            <div className="grid grid-cols-2 gap-4 items-end">
              <div>
                <label className="block text-sm font-medium mb-1.5 text-muted-foreground">Fakturalar boshlanish sanasi</label>
                <input type="date" value={form.invoiceDateFrom || `${new Date().getFullYear()}-01-01`} onChange={e => update('invoiceDateFrom', e.target.value)} className={inputCls} />
              </div>
              <div className="flex flex-col gap-2">
                <button onClick={handleTestFirebird} disabled={testing} className="flex items-center justify-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-md text-sm font-medium hover:bg-secondary/80 transition-colors disabled:opacity-50">
                  {testing ? <Loader2 size={14} className="animate-spin" /> : <Settings size={14} />}
                  Ulanishni tekshirish
                </button>
                {testResult && (
                  <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-md ${testResult.ok ? 'bg-emerald-500/10 text-emerald-600' : 'bg-destructive/10 text-destructive'}`}>
                    {testResult.ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                    {testResult.message}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Soliq API — yashirin, faqat texnik foydalanuvchilar uchun */}
        <section className="bg-card border rounded-xl overflow-hidden bg-background">
          <button
            type="button"
            onClick={() => setShowSoliqApi(v => !v)}
            className="w-full px-6 py-4 flex items-center justify-between bg-secondary/30 hover:bg-secondary/50 transition-colors"
          >
            <h3 className="font-semibold text-base flex items-center gap-2 text-muted-foreground">
              <Settings size={16} className="text-muted-foreground" />
              Kengaytirilgan sozlamalar (Soliq API)
            </h3>
            <ChevronDown size={16} className={`text-muted-foreground transition-transform ${showSoliqApi ? 'rotate-180' : ''}`} />
          </button>
          {showSoliqApi && (
            <div className="p-6 space-y-4">
              <p className="text-xs text-muted-foreground bg-secondary/50 rounded-lg px-3 py-2">
                Bu sozlamalar STIR orqali mijoz manzilini avtomatik topish uchun ishlatiladi. Odatda o'zgartirish shart emas.
              </p>
              <div>
                <label className="block text-sm font-medium mb-1.5 text-muted-foreground">API URL <span className="text-xs">(STIR uchun %s)</span></label>
                <input type="text" value={form.soliqApiUrl || ''} onChange={e => update('soliqApiUrl', e.target.value)} className={inputCls + ' font-mono'} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 text-muted-foreground">API Kalit (Token)</label>
                <input type="password" value={form.soliqApiKey || ''} onChange={e => update('soliqApiKey', e.target.value)} className={inputCls + ' font-mono'} />
              </div>
            </div>
          )}
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
            <div className="bg-secondary/30 rounded-lg px-4 py-3 text-sm text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Yetkazish masofasi va narxi</p>
              <p>Masofa — yuklash manzili viloyatidan tushirish manzili viloyatigacha avtomatik hisoblanadi.</p>
              <p>Narx: korxona yoki mijoz mashinasi = <b>0 so'm</b>, uchinchi tomon = quyidagi sozlamadan olinadi.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5 text-muted-foreground">
                  Uchinchi tomon yetkazish narxi (so'm/km)
                  <span className="text-xs ml-1 text-muted-foreground">(Boshqa birov mashinasi uchun)</span>
                </label>
                <input type="number" value={form.deliveryCostPerKm ?? ''} onChange={e => update('deliveryCostPerKm', e.target.value)} placeholder="1" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 text-muted-foreground">Ekspeditor STIR/PINFL <span className="text-xs">(bo'sh → jo'natuvchi STIR)</span></label>
                <input type="text" value={form.expeditorTin || ''} onChange={e => update('expeditorTin', e.target.value)} placeholder={form.senderTin || 'Jo\'natuvchi STIR'} className={inputCls + ' font-mono'} />
              </div>
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

      {/* Tarmoq bo'limi */}
      <NetworkSection />

      {/* Backup bo'limi */}
      <BackupSection />

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

function NetworkSection() {
  const [cfg, setCfg] = useState<any>({ networkMode: 'local', serverIp: '', serverPort: 3737 })
  const [ips, setIps] = useState<{ name: string; ip: string }[]>([])
  const [serverStatus, setServerStatus] = useState<any>({ running: false })
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message?: string; version?: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    try {
      const [config, ipList, status] = await Promise.all([
        window.api.networkGetConfig(),
        window.api.networkGetIps(),
        window.api.networkServerStatus(),
      ])
      setCfg(config)
      setIps(ipList || [])
      setServerStatus(status)
    } catch {}
  }

  useEffect(() => { load() }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await window.api.networkSaveConfig(cfg)
      toast('Tarmoq sozlamalari saqlandi ✓', 'success')
      await load()
    } catch (e: any) { toast('Xatolik: ' + e.message, 'error') }
    finally { setSaving(false) }
  }

  const handleServerToggle = async () => {
    try {
      if (serverStatus.running) {
        await window.api.networkServerStop()
        toast('Server to\'xtatildi', 'info')
      } else {
        const res = await window.api.networkServerStart(cfg.serverPort || 3737)
        if (res.ok) toast(`Server ishga tushdi — port ${cfg.serverPort || 3737}`, 'success')
        else toast('Server ishlamadi', 'error')
      }
      await load()
    } catch (e: any) { toast('Xatolik: ' + e.message, 'error') }
  }

  const handleTest = async () => {
    if (!cfg.serverIp) return
    setTesting(true); setTestResult(null)
    try {
      const res = await window.api.networkTestConnection(cfg.serverIp, cfg.serverPort || 3737)
      setTestResult(res)
    } catch (e: any) { setTestResult({ ok: false, message: e.message }) }
    finally { setTesting(false) }
  }

  const inputCls = "w-full px-3 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
  const modeBtn = (mode: string, label: string, desc: string) => (
    <button
      onClick={() => { setCfg((p: any) => ({ ...p, networkMode: mode })); setTestResult(null) }}
      className={`flex-1 p-3 rounded-xl border-2 text-left transition-all ${cfg.networkMode === mode ? 'border-primary bg-primary/5' : 'border-transparent bg-secondary/30 hover:bg-secondary/60'}`}
    >
      <div className={`text-sm font-semibold ${cfg.networkMode === mode ? 'text-primary' : ''}`}>{label}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
    </button>
  )

  return (
    <section className="bg-card border rounded-xl overflow-hidden bg-background md:col-span-2">
      <div className="px-6 py-4 border-b bg-secondary/30 flex items-center gap-2">
        <HardDrive size={18} className="text-primary" />
        <h3 className="font-semibold text-lg">Tarmoq rejimi (Ko'p kompyuter)</h3>
      </div>
      <div className="p-6 space-y-5">
        <p className="text-xs text-muted-foreground bg-secondary/50 rounded-lg px-3 py-2">
          Bir xonada bir nechta kompyuter bitta bazadan foydalanishi uchun. Bitta kompyuterni <b>Server</b>, qolganlarini <b>Mijoz</b> rejimiga qo'ying.
        </p>

        {/* Rejim tanlash */}
        <div className="flex gap-3">
          {modeBtn('local', '🖥 Lokal', 'Faqat shu kompyuter (standart)')}
          {modeBtn('server', '📡 Server', 'Baza shu yerda, boshqalar ulanadi')}
          {modeBtn('client', '🔗 Mijoz', 'Serverga ulanib ishlaydi')}
        </div>

        {/* Server rejimi */}
        {cfg.networkMode === 'server' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 items-end">
              <div>
                <label className="block text-sm font-medium mb-1.5 text-muted-foreground">Server port</label>
                <input type="number" value={cfg.serverPort || 3737}
                  onChange={e => setCfg((p: any) => ({ ...p, serverPort: parseInt(e.target.value) || 3737 }))}
                  className={inputCls} />
              </div>
              <button
                onClick={handleServerToggle}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${serverStatus.running ? 'bg-destructive/10 text-destructive hover:bg-destructive/20' : 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20'}`}
              >
                {serverStatus.running ? '⏹ Serverni to\'xtatish' : '▶ Serverni ishga tushirish'}
              </button>
            </div>

            {serverStatus.running && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
                <p className="text-sm font-semibold text-emerald-600 mb-2">✅ Server ishlayapti — boshqa kompyuterlar quyidagi IP ni kiriting:</p>
                <div className="space-y-1">
                  {ips.map(i => (
                    <div key={i.ip} className="flex items-center gap-3">
                      <code className="text-base font-bold text-primary bg-primary/10 px-3 py-1 rounded-lg">{i.ip}</code>
                      <span className="text-xs text-muted-foreground">({i.name})</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">Port: <b>{serverStatus.port}</b> · Windows Firewall port {serverStatus.port} ni ruxsat etishi kerak</p>
              </div>
            )}

            {!serverStatus.running && ips.length > 0 && (
              <div className="bg-secondary/50 rounded-xl p-3">
                <p className="text-xs text-muted-foreground mb-1">Sizning IP manzillaringiz:</p>
                {ips.map(i => <div key={i.ip} className="text-sm font-mono text-foreground">{i.ip} <span className="text-xs text-muted-foreground">({i.name})</span></div>)}
              </div>
            )}
          </div>
        )}

        {/* Mijoz rejimi */}
        {cfg.networkMode === 'client' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 items-end">
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1.5 text-muted-foreground">Server IP manzili</label>
                <input type="text" placeholder="192.168.1.100" value={cfg.serverIp || ''}
                  onChange={e => { setCfg((p: any) => ({ ...p, serverIp: e.target.value })); setTestResult(null) }}
                  className={inputCls + ' font-mono'} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 text-muted-foreground">Port</label>
                <input type="number" value={cfg.serverPort || 3737}
                  onChange={e => setCfg((p: any) => ({ ...p, serverPort: parseInt(e.target.value) || 3737 }))}
                  className={inputCls} />
              </div>
            </div>
            <button onClick={handleTest} disabled={testing || !cfg.serverIp}
              className="flex items-center gap-2 px-4 py-2 bg-secondary text-sm font-medium rounded-lg hover:bg-secondary/80 disabled:opacity-50">
              {testing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Ulanishni tekshirish
            </button>
            {testResult && (
              <div className={`flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl ${testResult.ok ? 'bg-emerald-500/10 text-emerald-600' : 'bg-destructive/10 text-destructive'}`}>
                {testResult.ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                {testResult.ok ? `✅ Ulandi! Server v${testResult.version}` : `❌ Ulanmadi: ${testResult.message}`}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end">
          <button onClick={handleSave} disabled={saving}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
            {saving ? 'Saqlanmoqda...' : 'Tarmoq sozlamalarini saqlash'}
          </button>
        </div>
      </div>
    </section>
  )
}

function BackupSection() {
  const [backups, setBackups] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [backing, setBacking] = useState(false)
  const [restoring, setRestoring] = useState<string | null>(null)

  const loadBackups = async () => {
    setLoading(true)
    try {
      const list = await window.api.backupList()
      setBackups(list || [])
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { loadBackups() }, [])

  const handleBackup = async () => {
    setBacking(true)
    try {
      const result = await window.api.backupCreate()
      if (result.ok) { toast('Backup saqlandi ✓', 'success'); loadBackups() }
      else toast(result.message, 'error')
    } catch (e: any) { toast('Xatolik: ' + e.message, 'error') }
    finally { setBacking(false) }
  }

  const handleRestore = async (b: any) => {
    if (!confirm(`"${b.name}" dan tiklash — hozirgi ma'lumotlar o'rnini bosadi. Davom etasizmi?`)) return
    setRestoring(b.path)
    try {
      const result = await window.api.backupRestore(b.path)
      if (result.ok) {
        toast('Tiklandi! Qayta yuklanmoqda...', 'success')
        setTimeout(() => window.location.reload(), 1500)
      } else toast('Xatolik: ' + result.message, 'error')
    } catch (e: any) { toast('Xatolik: ' + e.message, 'error') }
    finally { setRestoring(null) }
  }

  const formatSize = (bytes: number) => bytes < 1024 ? bytes + ' B' : (bytes / 1024).toFixed(1) + ' KB'

  return (
    <section className="bg-card border rounded-xl overflow-hidden bg-background md:col-span-2">
      <div className="px-6 py-4 border-b bg-secondary/30 flex items-center justify-between">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <HardDrive size={18} className="text-primary" />
          Avtomatik Backup (D:\1uz arxiv\AvtoETTN)
        </h3>
        <button
          onClick={handleBackup}
          disabled={backing}
          className="flex items-center gap-2 px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {backing ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
          {backing ? 'Saqlanmoqda...' : 'Hozir saqlash'}
        </button>
      </div>
      <div className="p-6">
        <p className="text-xs text-muted-foreground bg-secondary/50 rounded-lg px-3 py-2 mb-4">
          Ilova har kuni ishga tushganda va yopilganda avtomatik backup qiladi. So'nggi 30 ta backup saqlanadi.
          Ilova qayta o'rnatilsa — backup dan bir tugma bilan tiklanadi.
        </p>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>
        ) : backups.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Hali backup yo'q. "Hozir saqlash" ni bosing.</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
            {backups.map((b, i) => (
              <div key={b.path} className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${i === 0 ? 'border-emerald-500/40 bg-emerald-500/5' : 'bg-secondary/30 border-transparent'}`}>
                <div className="flex items-center gap-3">
                  {i === 0 && <span className="text-[10px] bg-emerald-500 text-white px-1.5 py-0.5 rounded font-medium">OXIRGI</span>}
                  <div>
                    <p className="text-sm font-medium">{new Date(b.date).toLocaleString('ru-RU')}</p>
                    <p className="text-xs text-muted-foreground">{b.profileCount} kompaniya · {b.vehicleCount} mashina · {formatSize(b.size)}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleRestore(b)}
                  disabled={restoring === b.path}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-secondary hover:bg-primary hover:text-primary-foreground rounded-lg transition-colors disabled:opacity-50"
                >
                  {restoring === b.path ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                  Tiklash
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

export default App
