import { useState, useEffect } from 'react'
import { X, Layers, Loader2, AlertTriangle, Truck } from 'lucide-react'
import { toast } from './Toast'

export function BulkDispatchModal({ invoices, vehicles, customers, onClose, onComplete }: any) {
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [allocations, setAllocations] = useState<any[]>([])
  const [remaining, setRemaining] = useState<any[]>([])

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

  const invById = (id: string) => invoices.find((i: any) => i.id === id)
  const vehById = (id: string) => vehicles.find((v: any) => v.id === id)

  // Har bir faktura uchun tushirish manzilini mijozlar bazasidan tanlaymiz
  const buildAddresses = () => {
    const map: any = {}
    for (const inv of invoices) {
      const customer = customers.find((c: any) => c.tin === inv.buyerTin)
      map[inv.id] = customer?.addresses?.[0] || { addressText: 'Mijoz manzili', oblastCode: '33', rayonCode: '5' }
    }
    return map
  }

  const handleGenerate = async () => {
    if (allocations.length === 0) return toast("Taqsimot bo'sh", 'error')
    setGenerating(true)
    try {
      const result = await window.api.bulkGenerateExcel(allocations, buildAddresses())
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
              {Object.keys(grouped).length === 0 ? (
                <p className="text-center text-muted-foreground py-10">Taqsimlash uchun faol mashina topilmadi. Mashinalar bo'limini tekshiring.</p>
              ) : Object.entries(grouped).map(([invId, allocs]: any) => {
                const inv = invById(invId)
                return (
                  <div key={invId} className="border rounded-xl overflow-hidden">
                    <div className="px-4 py-2.5 bg-secondary/30 flex justify-between items-center">
                      <span className="font-medium text-sm">№ {inv?.invoiceNumber} · {inv?.buyerName}</span>
                      <span className="text-xs text-muted-foreground">{inv?.quantity} t</span>
                    </div>
                    <div className="divide-y">
                      {allocs.map((a: any, i: number) => {
                        const v = vehById(a.vehicleId)
                        return (
                          <div key={i} className="px-4 py-2 flex items-center justify-between text-sm">
                            <span className="flex items-center gap-2"><Truck size={14} className="text-muted-foreground" /> {v?.plateNumber} <span className="text-xs text-muted-foreground">({a.tripIndex}-reys)</span></span>
                            <span className="font-medium text-primary">{a.quantity} t</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              {remaining.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex gap-3">
                  <AlertTriangle className="text-amber-500 shrink-0" size={20} />
                  <div className="text-sm">
                    <p className="font-medium text-amber-600">Sig'im yetmadi — quyidagilar to'liq taqsimlanmadi:</p>
                    <ul className="mt-1 text-muted-foreground text-xs space-y-0.5">
                      {remaining.map((r: any, i: number) => (
                        <li key={i}>№ {invById(r.invoiceId)?.invoiceNumber} — qoldi: {r.remainingQty} t</li>
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
