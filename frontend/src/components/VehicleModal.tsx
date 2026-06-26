import { useState } from 'react'
import { X, Truck } from 'lucide-react'
import { toast } from './Toast'

const empty = {
  plateNumber: '',
  vehicleModel: '',
  trailerPlate: '',
  trailerModel: '',
  driverName: '',
  driverPinfl: '',
  driverPhone: '',
  carrierName: '',
  carrierTin: '',
  transportOwnerTin: '',
  vehicleOwnerType: 'own',
  customerTin: '',
  maxCapacity: 40,
  maxDailyTrips: 2,
  isActive: true,
}

const inputCls = "w-full px-3 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-sm"

export function VehicleModal({ vehicle, onClose, onSaved, customers = [] }: any) {
  const [form, setForm] = useState<any>({ ...empty, ...(vehicle || {}) })
  const [saving, setSaving] = useState(false)
  const [tinLookup, setTinLookup] = useState<{ loading: boolean; name: string | null }>({ loading: false, name: null })
  const isEdit = !!vehicle?.id

  const handleCustomerTinBlur = async () => {
    const tin = String(form.customerTin || '').trim().replace(/\D/g, '')
    if (!tin || !/^\d{9,14}$/.test(tin)) return
    // Avval mavjud customers listidan qidirish
    const found = customers.find((c: any) => String(c.tin) === tin)
    if (found?.name) { setTinLookup({ loading: false, name: found.name }); return }
    setTinLookup({ loading: true, name: null })
    try {
      const comp = await window.api.searchCompany(tin)
      setTinLookup({ loading: false, name: comp?.name || '' }) // '' = topilmadi
    } catch {
      setTinLookup({ loading: false, name: '' })
    }
  }

  const update = (key: string, value: any) => setForm((prev: any) => ({ ...prev, [key]: value }))

  const handleSave = async () => {
    if (!form.plateNumber?.trim()) return toast("Davlat raqamini kiriting!", 'error')
    if (!form.driverName?.trim()) return toast("Haydovchi ismini kiriting!", 'error')
    if (!form.maxCapacity || Number(form.maxCapacity) <= 0) return toast("Sig'im 0 dan katta bo'lishi kerak!", 'error')

    setSaving(true)
    try {
      await window.api.saveVehicle({
        ...form,
        maxCapacity: parseFloat(form.maxCapacity),
        maxDailyTrips: parseInt(form.maxDailyTrips) || 2,
      })
      toast(isEdit ? "Mashina yangilandi ✓" : "Mashina qo'shildi ✓", 'success')
      onSaved()
    } catch (e: any) {
      toast("Xatolik: " + e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-background w-full max-w-2xl max-h-[90vh] rounded-xl shadow-2xl flex flex-col border overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between bg-secondary/30">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Truck className="text-primary" />
            {isEdit ? 'Mashinani tahrirlash' : 'Yangi mashina qo\'shish'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {/* Mashina */}
          <div>
            <h3 className="font-semibold mb-3 text-sm text-primary uppercase tracking-wide">Transport vositasi</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5 text-muted-foreground">Davlat raqami *</label>
                <input className={inputCls} placeholder="01 A 777 AA" value={form.plateNumber ?? ''} onChange={e => update('plateNumber', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 text-muted-foreground">Model *</label>
                <input className={inputCls} placeholder="SHACMAN X5000" value={form.vehicleModel ?? ''} onChange={e => update('vehicleModel', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 text-muted-foreground">Yarim tirkama raqami</label>
                <input className={inputCls} value={form.trailerPlate ?? ''} onChange={e => update('trailerPlate', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 text-muted-foreground">Yarim tirkama modeli</label>
                <input className={inputCls} value={form.trailerModel ?? ''} onChange={e => update('trailerModel', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Haydovchi */}
          <div>
            <h3 className="font-semibold mb-3 text-sm text-primary uppercase tracking-wide">Haydovchi</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5 text-muted-foreground">F.I.O *</label>
                <input className={inputCls} value={form.driverName ?? ''} onChange={e => update('driverName', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 text-muted-foreground">JShShIR (PINFL) *</label>
                <input className={inputCls + ' font-mono'} placeholder="14 raqam" value={form.driverPinfl ?? ''} onChange={e => update('driverPinfl', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 text-muted-foreground">Telefon</label>
                <input className={inputCls} placeholder="+998..." value={form.driverPhone ?? ''} onChange={e => update('driverPhone', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Mashina egaligi */}
          <div>
            <h3 className="font-semibold mb-3 text-sm text-primary uppercase tracking-wide">Mashina egaligi va transport egasi</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1.5 text-muted-foreground">Mashina turi</label>
                <select
                  className={inputCls}
                  value={form.vehicleOwnerType ?? 'own'}
                  onChange={e => {
                    update('vehicleOwnerType', e.target.value)
                    if (e.target.value !== 'client') update('customerTin', '')
                  }}
                >
                  <option value="own">Korxona o'z mashinasi (yetkazish narxi: 0 so'm)</option>
                  <option value="client">Mijoz mashinasi (yetkazish narxi: 0 so'm)</option>
                  <option value="third_party">Uchinchi tomon mashinasi (yetkazish narxi: sozlamadan)</option>
                </select>
              </div>
              {form.vehicleOwnerType === 'client' && (
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1.5 text-muted-foreground">
                    Qaysi mijozning mashinasi? (STIR)
                  </label>
                  {customers.length > 0 ? (
                    <select
                      className={inputCls}
                      value={form.customerTin ?? ''}
                      onChange={e => {
                        update('customerTin', e.target.value)
                        const found = customers.find((c: any) => c.tin === e.target.value)
                        setTinLookup({ loading: false, name: found?.name || null })
                      }}
                    >
                      <option value="">— Mijozni tanlang —</option>
                      {customers.map((c: any) => (
                        <option key={c.tin} value={c.tin}>{c.name} ({c.tin})</option>
                      ))}
                    </select>
                  ) : (
                    <div>
                      <input
                        className={inputCls + ' font-mono'}
                        placeholder="Mijoz STIR (9 yoki 14 raqam)"
                        value={form.customerTin ?? ''}
                        onChange={e => { update('customerTin', e.target.value); setTinLookup({ loading: false, name: null }) }}
                        onBlur={handleCustomerTinBlur}
                      />
                      {tinLookup.loading && <p className="text-xs text-muted-foreground mt-1 animate-pulse">Qidirilmoqda...</p>}
                      {!tinLookup.loading && tinLookup.name && <p className="text-xs text-emerald-600 mt-1 font-medium">✓ {tinLookup.name}</p>}
                      {!tinLookup.loading && tinLookup.name === '' && <p className="text-xs text-amber-500 mt-1">Kompaniya topilmadi</p>}
                      {!tinLookup.loading && tinLookup.name === null && !form.customerTin && (
                        <p className="text-xs text-muted-foreground mt-1">STIR kiritib, maydondan chiqqanda avtomatik qidiradi</p>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1.5 text-muted-foreground">
                  Transport egasi STIR/PINFL
                  <span className="text-xs ml-1 text-muted-foreground">(bo'sh → sozlamadagi STIR)</span>
                </label>
                <input className={inputCls + ' font-mono'} placeholder="Bo'sh qoldirsangiz kompaniya STIR ishlatiladi" value={form.transportOwnerTin ?? ''} onChange={e => update('transportOwnerTin', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 text-muted-foreground">Tashuvchi STIR/PINFL</label>
                <input className={inputCls + ' font-mono'} placeholder="Bo'sh qoldirsangiz kompaniya STIR ishlatiladi" value={form.carrierTin ?? ''} onChange={e => update('carrierTin', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium mb-1.5 text-muted-foreground">Tashkilot nomi</label>
                <input className={inputCls} value={form.carrierName ?? ''} onChange={e => update('carrierName', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Sig'im */}
          <div>
            <h3 className="font-semibold mb-3 text-sm text-primary uppercase tracking-wide">Sig'im va holat</h3>
            <div className="grid grid-cols-3 gap-4 items-end">
              <div>
                <label className="block text-sm font-medium mb-1.5 text-muted-foreground">Maks. sig'im (tonna) *</label>
                <input type="number" className={inputCls} value={form.maxCapacity ?? ''} onChange={e => update('maxCapacity', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 text-muted-foreground">Kunlik maks. reys</label>
                <input type="number" className={inputCls} value={form.maxDailyTrips ?? ''} onChange={e => update('maxDailyTrips', e.target.value)} />
              </div>
              <label className="flex items-center gap-2 pb-2 cursor-pointer">
                <input type="checkbox" checked={form.isActive !== false} onChange={e => update('isActive', e.target.checked)} className="w-4 h-4 rounded text-primary focus:ring-primary" />
                <span className="text-sm font-medium">Faol</span>
              </label>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t flex items-center justify-end gap-3 bg-secondary/10">
          <button onClick={onClose} className="px-5 py-2 rounded-lg font-medium text-sm hover:bg-secondary transition-colors">Bekor qilish</button>
          <button onClick={handleSave} disabled={saving} className="px-6 py-2 rounded-lg font-medium text-sm bg-primary text-primary-foreground hover:opacity-90 transition-opacity shadow-lg shadow-primary/20 disabled:opacity-50">
            {saving ? 'Saqlanmoqda...' : 'Saqlash'}
          </button>
        </div>
      </div>
    </div>
  )
}
