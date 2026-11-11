import { useState, useEffect } from 'react'
import { X, Layers, Loader2, AlertTriangle, Truck, MapPin } from 'lucide-react'
import { toast } from './Toast'

export function BulkDispatchModal({ invoices, vehicles, customers, onClose, onComplete }: any) {
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [enriching, setEnriching] = useState(false)
  const [allocations, setAllocations] = useState<any[]>([])
  const [remaining, setRemaining] = useState<any[]>([])
  const [pkgOverrides, setPkgOverrides] = useState<{ [id: string]: string }>({})
  const [addrOverrides, setAddrOverrides] = useState<{ [id: string]: string }>({})
  const [fetchedAddrs, setFetchedAddrs] = useState<{ [tin: string]: string }>({})

  useEffect(() => {
    (async () => {
      try {
        const ids = invoices.map((i: any) => i.id)
        const result = await window.api.bulkSplit(ids)
        setAllocations(result.allocations || [])
        setRemaining(result.remainingInvoices || [])
      } catch (e: any) {
        toast("Taqsimlashda xatolik: " + e.message, 'error')
      } finally {
        setLoading(false)
      }
    })()
  }, [invoices])

  // Manzilsiz fakturalar uchun Soliq API dan avtomatik olish
  useEffect(() => {
    if (loading) return
    const missingTins = [...new Set(
      invoices
        .filter((inv: any) => {
          const c = customers.find((c: any) => c.tin === inv.buyerTin)
          return !c?.addresses?.length
        })
        .map((inv: any) => inv.buyerTin)
        .filter(Boolean)
    )] as string[]
    if (missingTins.length === 0) return

    setEnriching(true)
    window.api.enrichCustomers(missingTins)
      .then((results: any[]) => {
        const map: { [tin: string]: string } = {}
        for (const r of results) {
          if (r.address) map[r.tin] = r.address
        }
        if (Object.keys(map).length > 0) setFetchedAddrs(map)
      })
      .catch(() => {})
      .finally(() => setEnriching(false))
  }, [loading])

  // Faktura yuk turini qo'lda belgilash (qopli / sochma) va qayta taqsimlash
  const setPackaging = async (invId: string, value: string) => {
    const next = { ...pkgOverrides, [invId]: value === 'auto' ? '' : value }
    setPkgOverrides(next)
    try {
      const result = await window.api.bulkSplit(invoices.map((i: any) => i.id), next)
      setAllocations(result.allocations || [])
      setRemaining(result.remainingInvoices || [])
    } catch (e: any) { toast('Xatolik: ' + e.message, 'error') }
  }

  const invById = (id: string) => invoices.find((i: any) => i.id === id)
  const vehById = (id: string) => vehicles.find((v: any) => v.id === id)

  // Manzilsiz fakturalar (Soliq API dan avtomatik kelganlarni ham hisobga olamiz)
  const missingAddressInvoices = invoices.filter((inv: any) => {
    const customer = customers.find((c: any) => String(c.tin) === String(inv.buyerTin))
    return !customer?.addresses?.length && !fetchedAddrs[String(inv.buyerTin)]
  })

  // Har bir faktura uchun manzil: qo'lda → mijoz bazasi → Soliq API → standart
  const buildAddresses = () => {
    const map: any = {}
    for (const inv of invoices) {
      const buyerTinStr = String(inv.buyerTin)
      const customer = customers.find((c: any) => String(c.tin) === buyerTinStr)
      if (addrOverrides[inv.id]?.trim()) {
        map[inv.id] = { addressText: addrOverrides[inv.id].trim(), oblastCode: '1726', rayonCode: '1' }
      } else if (customer?.addresses?.[0]) {
        map[inv.id] = customer.addresses[0]
      } else if (fetchedAddrs[buyerTinStr]) {
        map[inv.id] = { addressText: fetchedAddrs[buyerTinStr], oblastCode: '1726', rayonCode: '1' }
      } else {
        map[inv.id] = { addressText: 'Manzil ko\'rsatilmagan', oblastCode: '1726', rayonCode: '1' }
      }
    }
    return map
  }

  // ---- Taqsimotni qo'lda tahrirlash ----
  const fits = (v: any, packaging: string) => {
    if (v.isActive === false) return false
    const t = v.cargoType || 'any'
    return packaging === 'bulk' ? t === 'bulk' : packaging === 'bag' ? t !== 'bulk' : true
  }
  const updateAlloc = (a: any, patch: any) => {
    setAllocations(prev => prev.map(x => (x === a ? { ...x, ...patch } : x)))
    setRemaining([])
  }
  const removeAlloc = (a: any) => {
    setAllocations(prev => prev.filter(x => x !== a))
    setRemaining([])
  }
  const addAlloc = (invId: string) => {
    const inv = invById(invId)
    const mine = allocations.filter(x => x.invoiceId === invId)
    const packaging = mine[mine.length - 1]?.packaging || remaining.find((r: any) => r.invoiceId === invId)?.packaging || 'any'
    const v = vehicles.find((x: any) => fits(x, packaging))
    if (!v) return toast("Mos mashina topilmadi", 'error')
    const left = Math.max(0, (parseFloat(inv?.quantity) || 0) - mine.reduce((s, x) => s + (parseFloat(x.quantity) || 0), 0))
    const qty = parseFloat(Math.min(left || (parseFloat(v.maxCapacity) || 0), parseFloat(v.maxCapacity) || left).toFixed(3))
    const trip = allocations.filter(x => x.vehicleId === v.id).length + 1
    setAllocations(prev => [...prev, { invoiceId: invId, vehicleId: v.id, packaging, tripIndex: trip, quantity: qty }])
    setRemaining([])
  }
  const allocatedOf = (invId: string) =>
    parseFloat(allocations.filter(x => x.invoiceId === invId).reduce((s, x) => s + (parseFloat(x.quantity) || 0), 0).toFixed(3))

  const handleGenerate = async () => {
    if (allocations.length === 0) return toast("Taqsimot bo'sh", 'error')
    const valid = allocations.filter(a => (parseFloat(a.quantity) || 0) > 0)
    if (valid.length === 0) return toast("Tonna 0 dan katta bo'lishi kerak", 'error')

    // Yuk fakturadan oshib ketsa — to'xtatamiz, kam bo'lsa — so'raymiz
    const ids = [...new Set(valid.map(a => a.invoiceId))] as string[]
    for (const id of ids) {
      const inv = invById(id)
      const total = parseFloat(inv?.quantity) || 0
      const done = allocatedOf(id)
      if (done > total + 0.001) return toast(`№ ${inv?.invoiceNumber}: taqsimot (${done} t) faktura miqdoridan (${total} t) oshib ketdi`, 'error')
    }
    const partial = ids.filter(id => allocatedOf(id) < (parseFloat(invById(id)?.quantity) || 0) - 0.001)
    if (partial.length > 0 && !confirm(`${partial.length} ta fakturada yuk to'liq taqsimlanmagan.\nShunday holda Excel yaratilsinmi?`)) return

    // Avval TTN yaratilgan fakturalar
    try {
      const exists = await window.api.checkTtnExists(ids)
      if (exists.length > 0 && !confirm(`Bu fakturalar uchun TTN avval yaratilgan: ${exists.map(e => '№' + e.invoiceNumber).join(', ')}.\nQayta yaratilsinmi? (hisobotda ikki marta sanalmaydi)`)) return
    } catch { /* tekshiruv ishlamasa davom etamiz */ }

    setGenerating(true)
    try {
      const result = await window.api.bulkGenerateExcel(valid, buildAddresses())
      if (result.success) {
        toast(`Excel yaratildi ✓\n${result.filename}`, 'success')
        onComplete()
      }
    } catch (e: any) {
      toast("Xatolik: " + e.message, 'error')
    } finally {
      setGenerating(false)
    }
  }

  // Taqsimotni faktura bo'yicha guruhlash
  const grouped: any = {}
  for (const a of allocations) {
    if (!grouped[a.invoiceId]) grouped[a.invoiceId] = []
    grouped[a.invoiceId].push(a)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-background w-full max-w-3xl max-h-[90vh] rounded-xl shadow-2xl flex flex-col border overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between bg-secondary/30">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2"><Layers className="text-primary" /> Ommaviy taqsimlash</h2>
            <p className="text-sm text-muted-foreground mt-1">{invoices.length} ta faktura avtomatik avtoparkga taqsimlanmoqda</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-primary gap-2">
              <Loader2 className="animate-spin" size={32} /> Aqlli taqsimlanmoqda...
            </div>
          ) : (
            <>
              {Object.keys(grouped).length === 0 && vehicles.filter((v: any) => v.isActive !== false).length === 0 ? (
                <p className="text-center text-muted-foreground py-10">Taqsimlash uchun faol mashina topilmadi. Mashinalar bo'limini tekshiring.</p>
              ) : Object.entries(grouped).map(([invId, allocs]: any) => {
                const inv = invById(invId)
                return (
                  <div key={invId} className="border rounded-xl overflow-hidden">
                    <div className="px-4 py-2.5 bg-secondary/30 flex justify-between items-center">
                      <span className="font-medium text-sm">№ {inv?.invoiceNumber} · {inv?.buyerName}</span>
                      <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        <select
                          className="text-xs border rounded px-1.5 py-0.5 bg-background"
                          value={pkgOverrides[invId] || 'auto'}
                          title="Yuk turi: avtomatik yoki qo'lda"
                          onChange={e => setPackaging(invId, e.target.value)}
                        >
                          <option value="auto">Tur: avtomatik</option>
                          <option value="bag">Qopli</option>
                          <option value="bulk">Sochma</option>
                        </select>
                        {inv?.quantity} t
                      </span>
                    </div>
                    <div className="divide-y">
                      {allocs.map((a: any, i: number) => {
                        const v = vehById(a.vehicleId)
                        const isBuyerVehicle = v?.customerTin && String(v.customerTin) === String(inv?.buyerTin)
                        return (
                          <div key={i} className="px-4 py-2 flex items-center justify-between text-sm">
                            <span className="flex items-center gap-2">
                              <Truck size={14} className="text-muted-foreground" />
                              <select
                                className="text-sm border rounded px-1.5 py-0.5 bg-background"
                                value={a.vehicleId}
                                onChange={e => updateAlloc(a, { vehicleId: e.target.value })}
                              >
                                {vehicles.filter((x: any) => fits(x, a.packaging) || x.id === a.vehicleId).map((x: any) => (
                                  <option key={x.id} value={x.id}>{x.plateNumber}{x.cargoType === 'bulk' ? ' · sementovoz' : ''}</option>
                                ))}
                              </select>
                              <span className="text-xs text-muted-foreground">({a.tripIndex}-reys)</span>
                              {a.packaging === 'bulk' && <span className="text-xs px-1.5 py-0.5 rounded bg-sky-100 text-sky-700">sochma</span>}
                              {a.packaging === 'bag' && <span className="text-xs px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">qopli</span>}
                              {isBuyerVehicle && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">xaridor</span>}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <input
                                type="number" step="0.1" min="0"
                                className="w-20 text-right text-sm border rounded px-2 py-0.5 bg-background font-medium text-primary"
                                value={a.quantity}
                                onChange={e => updateAlloc(a, { quantity: e.target.value })}
                              />
                              <span className="text-xs text-muted-foreground">t</span>
                              <button onClick={() => removeAlloc(a)} className="p-1 rounded text-muted-foreground hover:text-destructive" title="Reysni o'chirish">
                                <X size={14} />
                              </button>
                            </span>
                          </div>
                        )
                      })}
                    </div>
                    {(() => {
                      const done = allocatedOf(invId)
                      const total = parseFloat(inv?.quantity) || 0
                      const diff = parseFloat((total - done).toFixed(3))
                      return (
                        <div className="px-4 py-2 bg-secondary/20 flex items-center justify-between text-xs">
                          <span className={diff > 0.001 ? 'text-amber-600' : diff < -0.001 ? 'text-destructive font-medium' : 'text-emerald-600'}>
                            Taqsimlandi {done} / {total} t{diff > 0.001 ? ` · ${diff} t qoldi` : diff < -0.001 ? ` · ${-diff} t ortiqcha!` : ' ✓'}
                          </span>
                          <button onClick={() => addAlloc(invId)} className="text-primary hover:underline">+ Reys qo'shish</button>
                        </div>
                      )
                    })()}
                  </div>
                )
              })}

              {invoices.filter((i: any) => !grouped[i.id]).map((inv: any) => {
                const rem = remaining.find((r: any) => r.invoiceId === inv.id)
                return (
                  <div key={inv.id} className="border border-amber-500/40 rounded-xl overflow-hidden">
                    <div className="px-4 py-2.5 bg-amber-500/10 flex justify-between items-center">
                      <span className="font-medium text-sm">№ {inv.invoiceNumber} · {inv.buyerName}</span>
                      <span className="text-xs text-muted-foreground">{inv.quantity} t</span>
                    </div>
                    <div className="px-4 py-3 flex items-center justify-between text-sm">
                      <span className="text-amber-700">
                        Taqsimlanmadi{rem?.reason === 'no_vehicle' ? ' — mos mashina yo\'q (sementovoz kerak?)' : rem?.reason === 'trip_limit' ? ' — mashinalar reys limiti to\'ldi' : ''}
                      </span>
                      <button onClick={() => addAlloc(inv.id)} className="text-primary hover:underline">+ Reys qo'shish</button>
                    </div>
                  </div>
                )
              })}

              {missingAddressInvoices.length > 0 && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-blue-600">
                    <MapPin size={15} />
                    {enriching
                      ? <span className="animate-pulse">Soliq API dan manzillar qidirilmoqda...</span>
                      : `${missingAddressInvoices.length} ta mijoz manzili`}
                  </div>
                  {missingAddressInvoices.map((inv: any) => {
                    const autoAddr = fetchedAddrs[inv.buyerTin]
                    return (
                      <div key={inv.id} className="bg-background rounded-lg p-3 border space-y-1.5">
                        <div className="text-xs font-medium text-foreground">№ {inv.invoiceNumber} · {inv.buyerName} ({inv.buyerTin})</div>
                        {autoAddr && !addrOverrides[inv.id] && (
                          <div className="text-xs text-emerald-600 flex items-center gap-1">
                            ✓ {autoAddr}
                          </div>
                        )}
                        <input
                          type="text"
                          placeholder={autoAddr ? `Avtomatik: ${autoAddr}` : "Yetkazib berish manzilini kiriting..."}
                          className="w-full text-xs px-3 py-2 border rounded-md outline-none focus:ring-1 focus:ring-primary bg-background"
                          value={addrOverrides[inv.id] || ''}
                          onChange={e => setAddrOverrides(prev => ({ ...prev, [inv.id]: e.target.value }))}
                        />
                      </div>
                    )
                  })}
                </div>
              )}

              {remaining.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex gap-3">
                  <AlertTriangle className="text-amber-500 shrink-0" size={20} />
                  <div className="text-sm">
                    <p className="font-medium text-amber-600">Sig'im yetmadi — quyidagilar to'liq taqsimlanmadi:</p>
                    <ul className="mt-1 text-muted-foreground text-xs space-y-0.5">
                      {remaining.map((r: any, i: number) => (
                        <li key={i}>№ {invById(r.invoiceId)?.invoiceNumber} {r.packaging === 'bulk' ? '(sochma)' : r.packaging === 'bag' ? '(qopli)' : ''} — qoldi: {r.remainingQty} t{r.reason === 'no_vehicle' ? ' — mos mashina yo\'q (sementovoz kerak?)' : ''}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t flex items-center justify-end gap-3 bg-secondary/10">
          <button onClick={onClose} className="px-5 py-2 rounded-lg font-medium text-sm hover:bg-secondary transition-colors">Bekor qilish</button>
          <button onClick={handleGenerate} disabled={generating || loading || allocations.length === 0} className="px-6 py-2 rounded-lg font-medium text-sm bg-primary text-primary-foreground hover:opacity-90 transition-opacity shadow-lg shadow-primary/20 disabled:opacity-50">
            {generating ? 'Yaratilmoqda...' : 'Excel Yaratish'}
          </button>
        </div>
      </div>
    </div>
  )
}
