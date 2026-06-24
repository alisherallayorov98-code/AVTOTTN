import { useState, useEffect } from 'react'
import { X, Truck, MapPin, Plus, Package, Zap, Search, Loader2 } from 'lucide-react'
import { toast } from './Toast'
import { RegionDistrictPicker } from './RegionDistrictPicker'

export function SplitterModal({ invoice, vehicles, customers, onClose, onComplete }: any) {
  const [selectedVehicles, setSelectedVehicles] = useState<any[]>([])
  const [allocations, setAllocations] = useState<any[]>([])
  const [addressObj, setAddressObj] = useState<any>(null)
  const [generating, setGenerating] = useState(false)
  const [searching, setSearching] = useState(false)

  const [addresses, setAddresses] = useState<any[]>([])
  const [newAddressForm, setNewAddressForm] = useState(false)
  const [newAddrText, setNewAddrText] = useState('')
  const [newAddrOblast, setNewAddrOblast] = useState('1726')
  const [newAddrRayon, setNewAddrRayon] = useState('11')

  useEffect(() => {
    let customer = customers.find((c: any) => c.tin === invoice.buyerTin)
    if (customer && customer.addresses) {
      setAddresses(customer.addresses)
      if (customer.addresses.length > 0) {
        setAddressObj(customer.addresses[0])
      }
    } else {
      // Create a default address
      const defAddr = { addressText: "Yuk tushirish joyi (Asosiy)", oblastCode: "1726", rayonCode: "11" }
      setAddresses([defAddr])
      setAddressObj(defAddr)
    }
  }, [invoice, customers])

  const toggleVehicle = (v: any) => {
    if (selectedVehicles.find(sv => sv.id === v.id)) {
      setSelectedVehicles(prev => prev.filter(sv => sv.id !== v.id))
      setAllocations(prev => prev.filter(a => a.vehicleId !== v.id))
    } else {
      setSelectedVehicles(prev => [...prev, v])
      // Avtomatik taqsimlash
      setAllocations(prev => [...prev, { vehicleId: v.id, quantity: v.maxCapacity, tripIndex: 1 }])
    }
  }

  const handleWeightChange = (vehicleId: string, val: string) => {
    setAllocations(prev => prev.map(a => a.vehicleId === vehicleId ? { ...a, quantity: parseFloat(val) || 0 } : a))
  }

  const totalAllocated = allocations.reduce((acc, a) => acc + (parseFloat(a.quantity) || 0), 0)
  const isOverAllocated = parseFloat(totalAllocated.toFixed(3)) > parseFloat(invoice.quantity.toFixed(3))
  const remaining = parseFloat((invoice.quantity - totalAllocated).toFixed(3))

  // Avtomatik taqsimlash: backend algoritmi yukni tanlangan mashinalarga sig'imiga qarab bo'ladi
  const handleAutoSplit = async () => {
    if (selectedVehicles.length === 0) return toast('Avval kamida bitta mashina tanlang!', 'error')
    try {
      const result = await window.api.splitCargo(invoice.quantity, selectedVehicles.map(v => v.id))
      const newAllocs = result.allocations.map((a: any) => ({
        vehicleId: a.vehicle.id,
        quantity: a.quantityAllocated,
        tripIndex: 1,
      }))
      setAllocations(newAllocs)
      if (result.remaining > 0) {
        toast(`Avto-taqsimlandi. Sig'im yetmadi, qoldi: ${result.remaining} t`, 'info')
      } else {
        toast('Yuk avtomatik taqsimlandi ✓', 'success')
      }
    } catch (e: any) {
      toast("Xatolik: " + e.message, 'error')
    }
  }

  // STIR bo'yicha mijoz manzilini Soliq bazasidan yangilash
  const handleSearchAddress = async () => {
    setSearching(true)
    try {
      const comp = await window.api.searchCompany(invoice.buyerTin)
      if (comp?.address) {
        const newAddr = { addressText: comp.address, oblastCode: String(comp.oblastCode || '33'), rayonCode: String(comp.rayonCode || '5') }
        setAddresses(prev => {
          if (prev.some(a => a.addressText === newAddr.addressText)) return prev
          return [...prev, newAddr]
        })
        setAddressObj(newAddr)
        toast(`Manzil topildi: ${comp.name}`, 'success')
      } else {
        toast("Manzil topilmadi", 'info')
      }
    } catch (e: any) {
      toast("Qidirishda xatolik: " + e.message, 'error')
    } finally {
      setSearching(false)
    }
  }

  const generateExcel = async () => {
    if (allocations.length === 0) return toast('Kamida bitta mashina tanlang!', 'error')
    if (totalAllocated <= 0) return toast('Taqsimlangan miqdor 0 dan katta bo\'lishi kerak!', 'error')
    if (isOverAllocated) return toast(`Taqsimlangan yuk (${totalAllocated.toFixed(3)} t) faktura miqdoridan (${invoice.quantity} t) oshib ketdi!`, 'error')
    if (!addressObj) return toast('Tushirish manzilini tanlang!', 'error')

    setGenerating(true)
    try {
      const result = await window.api.generateExcel(invoice.id, allocations, addressObj)
      if (result.success) {
        toast(`Excel saqlandi ✓\n${result.filename}`, 'success')
        onComplete()
      }
    } catch (e: any) {
      toast("Xatolik: " + e.message, 'error')
    } finally {
      setGenerating(false)
    }
  }

  const handleAddNewAddress = () => {
    if (!newAddrText) return
    const newAddr = { addressText: newAddrText, oblastCode: newAddrOblast, rayonCode: newAddrRayon }
    setAddresses(prev => [...prev, newAddr])
    setAddressObj(newAddr)
    setNewAddressForm(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-background w-full max-w-4xl max-h-[90vh] rounded-xl shadow-2xl flex flex-col border overflow-hidden slide-in-from-bottom-8">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between bg-secondary/30">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Truck className="text-primary" />
              TTN Splitter
            </h2>
            <p className="text-sm text-muted-foreground mt-1">Faktura № {invoice.invoiceNumber} — Jami yuk: <span className="font-bold text-foreground">{invoice.quantity} t</span></p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-8 custom-scrollbar">
          
          {/* Chap tomon: Mashinalar ro'yxati */}
          <div>
            <h3 className="font-semibold mb-4 text-lg">Faol Mashinalar</h3>
            <div className="space-y-3">
              {vehicles.filter((v: any) => v.isActive !== false).map((v: any) => {
                const isSelected = selectedVehicles.find(sv => sv.id === v.id)
                return (
                  <label key={v.id} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${isSelected ? 'bg-primary/10 border-primary' : 'hover:bg-secondary/50'}`}>
                    <input 
                      type="checkbox" 
                      className="mt-1 w-4 h-4 text-primary rounded focus:ring-primary"
                      checked={!!isSelected}
                      onChange={() => toggleVehicle(v)}
                    />
                    <div className="flex-1">
                      <div className="font-medium text-foreground">{v.plateNumber}</div>
                      <div className="text-xs text-muted-foreground">{v.driverName}</div>
                    </div>
                    <div className="text-sm font-bold text-primary">{v.maxCapacity} t</div>
                  </label>
                )
              })}
            </div>
          </div>

          {/* O'ng tomon: Taqsimot va Manzil */}
          <div className="space-y-6">
            
            {/* Yuk taqsimoti */}
            <div className="bg-secondary/20 p-4 rounded-xl border">
              <h3 className="font-semibold mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2"><Package size={16} /> Yuk taqsimoti</div>
                <button onClick={handleAutoSplit} className="text-xs text-primary flex items-center gap-1 hover:underline" title="Tanlangan mashinalarga avtomatik taqsimlash">
                  <Zap size={12} /> Avto-taqsimla
                </button>
              </h3>
              {allocations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Mashina tanlanmagan</p>
              ) : (
                <div className="space-y-2">
                  {allocations.map(a => {
                    const vehicle = vehicles.find((v: any) => v.id === a.vehicleId)
                    return (
                      <div key={a.vehicleId} className="flex items-center justify-between gap-4 bg-background p-2 px-3 rounded-lg border">
                        <span className="font-medium text-sm">{vehicle?.plateNumber}</span>
                        <div className="flex items-center gap-2">
                          <input 
                            type="number" 
                            className="w-20 px-2 py-1 bg-secondary text-right rounded-md outline-none focus:ring-1 focus:ring-primary text-sm font-medium"
                            value={a.quantity}
                            onChange={(e) => handleWeightChange(a.vehicleId, e.target.value)}
                          />
                          <span className="text-xs text-muted-foreground">t</span>
                        </div>
                      </div>
                    )
                  })}
                  <div className="mt-3 pt-3 border-t space-y-1">
                    <div className="flex justify-between text-sm font-medium">
                      <span className="text-muted-foreground">Taqsimlangan jami:</span>
                      <span className={isOverAllocated ? 'text-destructive' : 'text-emerald-500'}>
                        {totalAllocated.toFixed(3)} / {invoice.quantity} t
                      </span>
                    </div>
                    {!isOverAllocated && remaining > 0 && (
                      <div className="flex justify-between text-xs text-amber-500">
                        <span>Qolgan (taqsimlanmagan):</span>
                        <span>{remaining} t</span>
                      </div>
                    )}
                    {isOverAllocated && (
                      <p className="text-xs text-destructive">⚠ Faktura miqdoridan oshib ketdi — kamaytiring.</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Manzil tanlash */}
            <div className="bg-secondary/20 p-4 rounded-xl border">
              <h3 className="font-semibold mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2"><MapPin size={16} /> Tushirish Manzili</div>
                <div className="flex items-center gap-3">
                  <button onClick={handleSearchAddress} disabled={searching} className="text-xs text-primary flex items-center gap-1 hover:underline" title="STIR bo'yicha Soliq bazasidan qidirish">
                    {searching ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />} STIR
                  </button>
                  <button onClick={() => setNewAddressForm(!newAddressForm)} className="text-xs text-primary flex items-center gap-1 hover:underline">
                    <Plus size={12} /> Yangi
                  </button>
                </div>
              </h3>
              
              {!newAddressForm ? (
                <select 
                  className="w-full bg-background border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={addressObj ? JSON.stringify(addressObj) : ''}
                  onChange={e => setAddressObj(JSON.parse(e.target.value))}
                >
                  {addresses.map((a, i) => (
                    <option key={i} value={JSON.stringify(a)}>{a.addressText}</option>
                  ))}
                </select>
              ) : (
                <div className="space-y-3 bg-background p-3 rounded-lg border animate-in slide-in-from-top-2">
                  <input type="text" placeholder="Manzil matni (ko'cha, uy)..." value={newAddrText} onChange={e => setNewAddrText(e.target.value)} className="w-full text-sm px-3 py-1.5 border rounded-md" />
                  <RegionDistrictPicker
                    oblastCode={newAddrOblast}
                    rayonCode={newAddrRayon}
                    onChange={(o, r) => { setNewAddrOblast(o); setNewAddrRayon(r) }}
                  />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setNewAddressForm(false)} className="px-3 py-1 text-xs text-muted-foreground hover:bg-secondary rounded-md">Bekor qilish</button>
                    <button onClick={handleAddNewAddress} className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded-md">Qo'shish</button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex items-center justify-end gap-3 bg-secondary/10">
          <button onClick={onClose} className="px-5 py-2 rounded-lg font-medium text-sm hover:bg-secondary transition-colors">
            Bekor qilish
          </button>
          <button onClick={generateExcel} disabled={generating || isOverAllocated || allocations.length === 0} className="px-5 py-2 rounded-lg font-medium text-sm bg-primary text-primary-foreground hover:opacity-90 transition-opacity shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed">
            {generating ? 'Yaratilmoqda...' : 'Excel Yaratish'}
          </button>
        </div>
      </div>
    </div>
  )
}
