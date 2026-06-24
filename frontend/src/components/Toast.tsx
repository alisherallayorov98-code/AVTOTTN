import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, Info, X } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'info'
export interface ToastItem {
  id: number
  message: string
  type: ToastType
}

type Listener = (t: ToastItem) => void
let listeners: Listener[] = []
let counter = 0

/** Ilovaning istalgan joyidan xabar (toast) chiqarish uchun yordamchi funksiya */
export function toast(message: string, type: ToastType = 'success') {
  const item: ToastItem = { id: ++counter, message, type }
  listeners.forEach(l => l(item))
}

function subscribe(l: Listener) {
  listeners.push(l)
  return () => { listeners = listeners.filter(x => x !== l) }
}

/** App ildizida bir marta render qilinadigan toast konteyneri */
export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([])

  useEffect(() => {
    return subscribe((item) => {
      setItems(prev => [...prev, item])
      setTimeout(() => {
        setItems(prev => prev.filter(x => x.id !== item.id))
      }, 4000)
    })
  }, [])

  const remove = (id: number) => setItems(prev => prev.filter(x => x.id !== id))

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 max-w-sm">
      {items.map(item => (
        <div
          key={item.id}
          className={`flex items-start gap-3 p-4 rounded-xl shadow-2xl border animate-in slide-in-from-right-8 fade-in bg-background ${
            item.type === 'success' ? 'border-emerald-500/30' :
            item.type === 'error' ? 'border-destructive/30' : 'border-primary/30'
          }`}
        >
          <div className={
            item.type === 'success' ? 'text-emerald-500' :
            item.type === 'error' ? 'text-destructive' : 'text-primary'
          }>
            {item.type === 'success' ? <CheckCircle size={20} /> :
             item.type === 'error' ? <XCircle size={20} /> : <Info size={20} />}
          </div>
          <p className="text-sm flex-1 leading-snug whitespace-pre-line">{item.message}</p>
          <button onClick={() => remove(item.id)} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  )
}
