import { useState } from 'react'
import { X, FileUp, FileText, Loader2, CheckCircle, Archive, AlertCircle } from 'lucide-react'
import { toast } from './Toast'

export function PdfImportModal({ onClose, onImported }: any) {
  const [tab, setTab] = useState<'pdf' | 'zip'>('pdf')
  const [parsing, setParsing] = useState(false)
  const [parsed, setParsed] = useState<any[]>([])

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
          const unitName = inv.items?.[0]?.unitName || 'tonna'
          const productName = inv.items?.length > 1
            ? `${inv.items[0].productName} va boshqalar (${inv.items.length} xil)`
            : (inv.items?.[0]?.productName || '')
          results.push({ ...inv, unitName, productName, _fileName: file.name, _selected: true, _ok: true })
        } else {
          results.push({ _fileName: file.name, _selected: false, _ok: false })
          toast(`"${file.name}" — ma'lumot o'qib bo'lmadi`, 'error')
        }
      } catch (err: any) {
        results.push({ _fileName: file.name, _selected: false, _ok: false })
        toast(`"${file.name}" xatolik: ${err.message}`, 'error')
      }
    }
    setParsed(prev => [...prev, ...results])
    setParsing(false)
    e.target.value = ''
  }

  // ZIP → PDFlarni o'qib, faktura sifatida parse qilish (bittada)
  const handleZipSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setParsing(true)
    setParsed([])
    try {
      const buffer = await file.arrayBuffer()
      const result = await window.api.extractPdfs(buffer)

      if (!result.pdfCount) {
        toast("ZIP ichida PDF topilmadi", 'error')
        setParsing(false)
        return
      }
      toast(`${result.pdfCount} ta PDF ajratildi, o'qilmoqda...`, 'info')

      // Ajratilgan PDFlarni backenddan parse qilamiz
      const parseResult = await window.api.parsePdfsFromFolder()
      const results: any[] = []
      for (const item of (parseResult || [])) {
        if (item.inv && (item.inv.invoiceNumber || item.inv.buyerName)) {
          const unitName = item.inv.items?.[0]?.unitName || 'tonna'
          const productName = item.inv.items?.length > 1
            ? `${item.inv.items[0].productName} va boshqalar (${item.inv.items.length} xil)`
            : (item.inv.items?.[0]?.productName || '')
          results.push({ ...item.inv, unitName, productName, _fileName: item.fileName, _selected: true, _ok: true })
        } else {
          results.push({ _fileName: item.fileName, _selected: false, _ok: false })
        }
      }
      setParsed(results)
      const okCount = results.filter(r => r._ok).length
      toast(`${okCount} ta faktura o'qildi ✓`, 'success')
    } catch (err: any) {
      toast("Xatolik: " + err.message, 'error')
    } finally {
      setParsing(false)
      e.target.value = ''
    }
  }

  const toggleSelect = (idx: number) =>
    setParsed(prev => prev.map((p, i) => i === idx ? { ...p, _selected: !p._selected } : p))

  const handleImport = async () => {
    const toImport = parsed.filter(p => p._selected && p._ok)
    if (toImport.length === 0) return toast("Hech qaysi faktura tanlanmagan", 'error')
    let ok = 0
    for (const inv of toImport) {
      try {
        const { _fileName, _selected, _ok, ...clean } = inv
        await window.api.saveManualInvoice(clean)
        ok++
      } catch (err: any) {
        toast(`Saqlashda xatolik: ${err.message}`, 'error')
      }
    }
    toast(`${ok} ta faktura import qilindi ✓`, 'success')
    onImported()
  }

  const selectedCount = parsed.filter(p => p._selected && p._ok).length

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

        <div className="flex border-b">
          <button onClick={() => { setTab('pdf'); setParsed([]) }} className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${tab === 'pdf' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-muted-foreground hover:bg-secondary/30'}`}>
            <FileText size={16} /> PDF Fakturalar
          </button>
          <button onClick={() => { setTab('zip'); setParsed([]) }} className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${tab === 'zip' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-muted-foreground hover:bg-secondary/30'}`}>
            <Archive size={16} /> ZIP (Didox arxivi)
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-4">
          <label className="block border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
            <input
              type="file"
              accept={tab === 'pdf' ? '.pdf' : '.zip'}
              multiple={tab === 'pdf'}
              onChange={tab === 'pdf' ? handlePdfSelect : handleZipSelect}
              className="hidden"
            />
            {parsing ? (
              <div className="flex flex-col items-center gap-2 text-primary">
                <Loader2 className="animate-spin" size={32} />
                <span>{tab === 'zip' ? 'ZIP ajratilmoqda va o\'qilmoqda...' : 'O\'qilmoqda...'}</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                {tab === 'pdf' ? <FileText size={32} className="opacity-50" /> : <Archive size={32} className="opacity-50" />}
                <span className="text-sm font-medium">
                  {tab === 'pdf' ? 'PDF fakturalarni tanlang' : 'Didox\'dan yuklangan ZIP faylni tanlang'}
                </span>
                <span className="text-xs">
                  {tab === 'pdf' ? 'Bir nechtasini ham mumkin' : 'Barcha fakturalar avtomatik o\'qiladi'}
                </span>
              </div>
            )}
          </label>

          {parsed.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">{parsed.length} ta fayl o'qildi:</p>
                <button
                  onClick={() => setParsed(prev => prev.map(p => p._ok ? { ...p, _selected: true } : p))}
                  className="text-xs text-primary hover:underline"
                >
                  Barchasini tanlash
                </button>
              </div>
              {parsed.map((p, idx) => (
                <label key={idx} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${!p._ok ? 'opacity-50 cursor-not-allowed bg-destructive/5 border-destructive/20' : p._selected ? 'bg-primary/10 border-primary' : 'hover:bg-secondary/50'}`}>
                  <input
                    type="checkbox"
                    checked={p._selected && p._ok}
                    disabled={!p._ok}
                    onChange={() => p._ok && toggleSelect(idx)}
                    className="w-4 h-4 rounded text-primary focus:ring-primary"
                  />
                  <div className="flex-1 min-w-0">
                    {p._ok ? (
                      <>
                        <div className="font-medium text-sm truncate">№ {p.invoiceNumber || '—'} · {p.buyerName || 'Noma\'lum xaridor'}</div>
                        <div className="text-xs text-muted-foreground">STIR: {p.buyerTin || '—'} · {p.quantity} t · {Number(p.totalSum || 0).toLocaleString('ru-RU')} so'm</div>
                      </>
                    ) : (
                      <div className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle size={14} /> {p._fileName} — o'qib bo'lmadi
                      </div>
                    )}
                  </div>
                  {p._ok && <CheckCircle size={16} className={p._selected ? 'text-primary' : 'text-transparent'} />}
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t flex items-center justify-end gap-3 bg-secondary/10">
          <button onClick={onClose} className="px-5 py-2 rounded-lg font-medium text-sm hover:bg-secondary transition-colors">Yopish</button>
          {parsed.length > 0 && selectedCount > 0 && (
            <button onClick={handleImport} className="px-6 py-2 rounded-lg font-medium text-sm bg-primary text-primary-foreground hover:opacity-90 transition-opacity shadow-lg shadow-primary/20">
              Import qilish ({selectedCount})
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
