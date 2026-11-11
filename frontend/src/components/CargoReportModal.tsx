import { useState, useEffect } from 'react'
import { X, BarChart3, Loader2 } from 'lucide-react'

const TYPE_LABEL: any = { bag: 'Qopli sement', bulk: 'Sochma sement (sementovoz)', any: 'Turi belgilanmagan' }
const today = () => new Date().toISOString().slice(0, 10)

export function CargoReportModal({ onClose }: any) {
  const [from, setFrom] = useState(today())
  const [to, setTo] = useState(today())
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<any>(null)

  useEffect(() => {
    setLoading(true)
    window.api.getTtnReport(from, to).then(setReport).finally(() => setLoading(false))
  }, [from, to])

  const inputCls = 'px-3 py-1.5 bg-background border rounded-md text-sm'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-background w-full max-w-2xl max-h-[90vh] rounded-xl shadow-2xl flex flex-col border overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between bg-secondary/30">
          <h2 className="text-xl font-bold flex items-center gap-2"><BarChart3 className="text-primary" /> Yuk hisoboti</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-secondary"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="flex items-center gap-2 text-sm">
            <input type="date" className={inputCls} value={from} onChange={e => setFrom(e.target.value)} />
            <span>—</span>
            <input type="date" className={inputCls} value={to} onChange={e => setTo(e.target.value)} />
          </div>
          {loading || !report ? (
            <div className="flex justify-center py-10 text-primary"><Loader2 className="animate-spin" /></div>
          ) : report.totalTrips === 0 ? (
            <p className="text-center text-muted-foreground py-8">Bu davrda TTN yaratilmagan.</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                {Object.entries(report.byType).map(([t, v]: any) => (
                  <div key={t} className="border rounded-xl p-3">
                    <div className="text-xs text-muted-foreground">{TYPE_LABEL[t] || t}</div>
                    <div className="text-xl font-bold text-primary">{v.tons} t</div>
                    <div className="text-xs text-muted-foreground">{v.trips} reys</div>
                  </div>
                ))}
              </div>
              <div className="text-sm font-medium">Jami: {report.totalTons} t · {report.totalTrips} reys</div>
              <div className="border rounded-xl divide-y">
                {report.byVehicle.map((v: any) => (
                  <div key={v.plateNumber} className="px-4 py-2 flex justify-between text-sm">
                    <span>{v.plateNumber}</span>
                    <span className="text-muted-foreground">{v.trips} reys · <b className="text-foreground">{v.tons} t</b></span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
