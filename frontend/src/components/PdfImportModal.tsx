import { useState } from 'react'
import { X, FileUp, FileText, Loader2, CheckCircle, Archive } from 'lucide-react'
import { toast } from './Toast'

export function PdfImportModal({ onClose, onImported }: any) {
  const [tab, setTab] = useState<'pdf' | 'zip'>('pdf')
  const [parsing, setParsing] = useState(false)
  const [parsed, setParsed] = useState<any[]>([])
  const [zipResult, setZipResult] = useState<any>(null)

  // --- PDF fakturalarni o'qish ---
  const handlePdfSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setParsing(true)
    const results: any[] = []
    for (const file of files) {
      try {
        const buffer = await file.arrayBuffer()
        const inv = await window.api.parsePdf(buffer)
        if (inv && (inv.invoiceNumber || inv.buyerName)) {
          // Jadval uchun zaruriy summary maydonlarni to'ldiramiz
          const unitName = inv.items?.[0]?.unitName || 'tonna'
          const productName = inv.items?.length > 1
            ? `${inv.items[0].productName} va boshqalar (${inv.items.length} xil)`
            : (inv.items?.[0]?.productName || '')
          results.push({ ...inv, unitName, productName, _fileName: file.name, _selected: true })
        } else {
          toast(`"${file.name}" — ma'lumot o'qib bo'lmadi`, 'error')
        }
      } catch (err: any) {
        toast(`"${file.name}" xatolik: ${err.message}`, 'error')
      }
    }
    setParsed(prev => [...prev, ...results])
    setParsing(false)
    e.target.value = ''
  }

  const toggleSelect = (idx: number) =>
    setParsed(prev => prev.map((p, i) => i === idx ? { ...p, _selected: !p._selected } : p))

  const handleImport = async () => {
    const toImport = parsed.filter(p => p._selected)
    if (toImport.length === 0) return toast("Hech qaysi faktura tanlanmagan", 'error')
    let ok = 0
    for (const inv of toImport) {
      try {
        const { _fileName, _selected, ...clean } = inv
        await window.api.saveManualInvoice(clean)
        ok++
      } catch (err: any) {
        toast(`Saqlashda xatolik: ${err.message}`, 'error')
      }
    }
    toast(`${ok} ta faktura import qilindi ✓`, 'success')
    onImported()
  }

  // --- ZIP'dan PDF ajratish ---
  const handleZipSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setParsing(true)
    try {
      const buffer = await file.arrayBuffer()
      const result = await window.api.extractPdfs(buffer)
      setZipResult(result)
      toast(`${result.pdfCount} ta PDF ajratildi ✓`, 'success')
    } catch (err: any) {
      toast("ZIP ajratishda xatolik: " + err.message, 'error')
    } finally {
      setParsing(false)
      e.target.value = ''
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-background w-full max-w-3xl max-h-[90vh] rounded-xl shadow-2xl flex flex-col border overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between bg-secondary/30">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <FileUp className="text-primary" /> PDF / ZIP Import
          </h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Tablar */}
        <div className="flex border-b">
          <button onClick={() => setTab('pdf')} className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${tab === 'pdf' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-muted-foreground hover:bg-secondary/30'}`}>
            <FileText size={16} /> PDF Fakturalar
          </button>
          <button onClick={() => setTab('zip')} className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${tab === 'zip' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-muted-foreground hover:bg-secondary/30'}`}>
            <Archive size={16} /> ZIP'dan ajratish
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {tab === 'pdf' ? (
            <div className="space-y-4">
              <label className="block border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
                <input type="file" accept=".pdf" multiple onChange={handlePdfSelect} className="hidden" />
                {parsing ? (
                  <div className="flex flex-col items-center gap-2 text-primary"><Loader2 className="animate-spin" /> O'qilmoqda...</div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <FileText size={32} className="opacity-50" />
                    <span className="text-sm">PDF fakturalarni tanlang (bir nechtasini ham mumkin)</span>
                  </div>
                )}
              </label>

              {parsed.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">{parsed.length} ta faktura o'qildi:</p>
                  {parsed.map((p, idx) => (
                    <label key={idx} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${p._selected ? 'bg-primary/10 border-primary' : 'hover:bg-secondary/50'}`}>
                      <input type="checkbox" checked={p._selected} onChange={() => toggleSelect(idx)} className="w-4 h-4 rounded text-primary focus:ring-primary" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">№ {p.invoiceNumber || '—'} · {p.buyerName || 'Noma\'lum xaridor'}</div>
                        <div className="text-xs text-muted-foreground">STIR: {p.buyerTin || '—'} · {p.quantity} t · {Number(p.totalSum).toLocaleString('ru-RU')} so'm</div>
                      </div>
                      <CheckCircle size={16} className={p._selected ? 'text-primary' : 'text-transparent'} />
                    </label>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <label className="block border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
                <input type="file" accept=".zip" onChange={handleZipSelect} className="hidden" />
                {parsing ? (
                  <div className="flex flex-col items-center gap-2 text-primary"><Loader2 className="animate-spin" /> Ajratilmoqda...</div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Archive size={32} className="opacity-50" />
                    <span className="text-sm">Didox'dan yuklangan ZIP faylni tanlang</span>
                    <span className="text-xs">(Ichidagi barcha PDF'lar bitta papkaga chiqariladi)</span>
                  </div>
                )}
              </label>

              {zipResult && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 text-center">
                  <CheckCircle className="mx-auto text-emerald-500 mb-2" />
                  <p className="font-medium">{zipResult.pdfCount} ta PDF muvaffaqiyatli ajratildi</p>
                  <p className="text-xs text-muted-foreground mt-1">Papka: {zipResult.folderName}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t flex items-center justify-end gap-3 bg-secondary/10">
          <button onClick={onClose} className="px-5 py-2 rounded-lg font-medium text-sm hover:bg-secondary transition-colors">Yopish</button>
          {tab === 'pdf' && parsed.length > 0 && (
            <button onClick={handleImport} className="px-6 py-2 rounded-lg font-medium text-sm bg-primary text-primary-foreground hover:opacity-90 transition-opacity shadow-lg shadow-primary/20">
              Tanlanganlarni import qilish ({parsed.filter(p => p._selected).length})
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
