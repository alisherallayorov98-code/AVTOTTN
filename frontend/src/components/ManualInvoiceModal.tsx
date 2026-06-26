import { useState } from 'react'
import { X, FileText, Plus, Trash2, Search, Loader2 } from 'lucide-react'
import { toast } from './Toast'

const emptyItem = () => ({ productName: '', productMxik: '', unitName: 'tonna', quantity: 0, price: 0, vatRate: 12 })

export function ManualInvoiceModal({ invoice, onClose, onSaved }: any) {
  const [form, setForm] = useState<any>(() => invoice ? { ...invoice } : {
    invoiceNumber: '', invoiceDate: new Date().toISOString().slice(0, 10),
    buyerTin: '', buyerName: '', contractNumber: '', contractDate: '',
    items: [emptyItem()],
  })
  const [saving, setSaving] = useState(false)
  const [searching, setSearching] = useState(false)
  const isEdit = !!invoice?.id

  const update = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }))
  const updateItem = (idx: number, k: string, v: any) =>
    setForm((p: any) => ({ ...p, items: p.items.map((it: any, i: number) => i === idx ? { ...it, [k]: v } : it) }))
  const addItem = () => setForm((p: any) => ({ ...p, items: [...p.items, emptyItem()] }))
  const removeItem = (idx: number) => setForm((p: any) => ({ ...p, items: p.items.filter((_: any, i: number) => i !== idx) }))

  const handleSearchTin = async (silent = false) => {
    const tin = String(form.buyerTin || '').trim().replace(/\D/g, '')
    if (!tin || !/^\d{9,14}$/.test(tin)) {
      if (!silent) toast("STIR/PINFL 9 yoki 14 ta raqam bo'lishi kerak", 'error')
      return
    }
    if (form.buyerName?.trim() && silent) return // blur'da: nom allaqachon bor bo'lsa skip
    setSearching(true)
    try {
      const comp = await window.api.searchCompany(tin)
      if (comp?.name) {
        update('buyerName', comp.name)
        if (!silent) toast(`Topildi: ${comp.name}`, 'success')
      } else if (!silent) {
        toast("Kompaniya topilmadi", 'info')
      }
    } catch (e: any) {
      if (!silent) toast("Qidirishda xatolik: " + e.message, 'error')
    } finally {
      setSearching(false)
    }
  }

  const totalQty = (form.items || []).reduce((s: number, it: any) => s + (parseFloat(it.quantity) || 0), 0)

  const handleSave = async () => {
    if (!form.invoiceNumber?.trim()) return toast("Faktura raqamini kiriting!", 'error')
    if (!form.buyerName?.trim()) return toast("Xaridor nomini kiriting!", 'error')
    if (totalQty <= 0) return toast("Kamida bitta tovar miqdorini kiriting!", 'error')

    // Tovar qatorlarini raqamga aylantirib summalarni hisoblaymiz
    const items = form.items.map((it: any) => {
      const quantity = parseFloat(it.quantity) || 0
      const price = parseFloat(it.price) || 0
      const vatRate = parseFloat(it.vatRate) || 0
      const sum = quantity * price
      const vatSum = parseFloat((sum * vatRate / 100).toFixed(2))
      return {
        ...it, quantity, price, vatRate, vatSum,
        totalSum: parseFloat((sum + vatSum).toFixed(2)),
      }
    })
    const quantity = parseFloat(totalQty.toFixed(3))
    const totalSum = parseFloat(items.reduce((s: number, it: any) => s + it.totalSum, 0).toFixed(2))
    const unitName = items[0]?.unitName || 'tonna'
    const productName = items.length > 1
      ? `${items[0].productName} va boshqalar (${items.length} xil)`
      : (items[0]?.productName || '')

    setSaving(true)
    try {
      await window.api.saveManualInvoice({ ...form, items, quantity, totalSum, unitName, productName })
      toast(isEdit ? "Faktura yangilandi ✓" : "Faktura qo'shildi ✓", 'success')
      onSaved()
    } catch (e: any) {
      toast("Xatolik: " + e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = "w-full px-3 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-sm"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-background w-full max-w-3xl max-h-[90vh] rounded-xl shadow-2xl flex flex-col border overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between bg-secondary/30">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <FileText className="text-primary" /> {isEdit ? 'Fakturani tahrirlash' : 'Qo\'lda faktura kiritish'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-muted-foreground">Faktura № *</label>
              <input type="text" value={form.invoiceNumber} onChange={e => update('invoiceNumber', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 text-muted-foreground">Sana</label>
              <input type="date" value={form.invoiceDate} onChange={e => update('invoiceDate', e.target.value)} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-muted-foreground">Xaridor STIR</label>
              <div className="flex gap-2">
                <input type="text" value={form.buyerTin} onChange={e => update('buyerTin', e.target.value)} onBlur={() => handleSearchTin(true)} className={inputCls + ' font-mono'} placeholder="9 yoki 14 raqam" />
                <button onClick={() => handleSearchTin(false)} disabled={searching} className="px-3 bg-secondary rounded-md hover:bg-secondary/70 transition-colors shrink-0" title="STIR bo'yicha qidirish">
                  {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 text-muted-foreground">Xaridor nomi *</label>
              <input type="text" value={form.buyerName} onChange={e => update('buyerName', e.target.value)} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-muted-foreground">Shartnoma №</label>
              <input type="text" value={form.contractNumber} onChange={e => update('contractNumber', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 text-muted-foreground">Shartnoma sanasi</label>
              <input type="date" value={form.contractDate} onChange={e => update('contractDate', e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Tovarlar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm text-primary uppercase tracking-wide">Tovarlar</h3>
              <button onClick={addItem} className="text-xs text-primary flex items-center gap-1 hover:underline"><Plus size={12} /> Tovar qo'shish</button>
            </div>
            <div className="space-y-2">
              {form.items.map((it: any, idx: number) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-secondary/20 p-2 rounded-lg border">
                  <input className={inputCls + ' col-span-4'} placeholder="Tovar nomi" value={it.productName} onChange={e => updateItem(idx, 'productName', e.target.value)} />
                  <input className={inputCls + ' col-span-3 font-mono'} placeholder="MXIK (IKPU)" value={it.productMxik} onChange={e => updateItem(idx, 'productMxik', e.target.value)} />
                  <input className={inputCls + ' col-span-1'} placeholder="Birlik" value={it.unitName} onChange={e => updateItem(idx, 'unitName', e.target.value)} />
                  <input type="number" className={inputCls + ' col-span-1 text-right'} placeholder="Soni" value={it.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} />
                  <input type="number" className={inputCls + ' col-span-2 text-right'} placeholder="Narx" value={it.price} onChange={e => updateItem(idx, 'price', e.target.value)} />
                  <button onClick={() => removeItem(idx)} disabled={form.items.length === 1} className="col-span-1 text-muted-foreground hover:text-destructive disabled:opacity-30 flex justify-center">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            <div className="text-right text-sm mt-2 font-medium text-muted-foreground">Jami yuk: <span className="text-foreground">{totalQty.toFixed(3)} t</span></div>
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
