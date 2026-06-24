import soatoData from '../data/soato.json'

interface District { name: string; code: string }
interface Region { name: string; code: string; districts: District[] }

const soato = soatoData as Region[]

interface Props {
  oblastCode?: string | number
  rayonCode?: string | number
  onChange: (oblastCode: string, rayonCode: string) => void
  className?: string
}

/**
 * Viloyat va tuman uchun SOATO kodlarini tanlash (qo'lda kod yozish o'rniga).
 * Viloyat o'zgarganda tuman avtomatik shu viloyatning birinchi tumaniga o'rnatiladi.
 */
export function RegionDistrictPicker({ oblastCode, rayonCode, onChange, className = '' }: Props) {
  const obl = oblastCode != null ? String(oblastCode) : ''
  const ray = rayonCode != null ? String(rayonCode) : ''
  const region = soato.find(r => r.code === obl)
  const districts = region?.districts || []

  const selectCls = "w-full px-3 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-sm"

  return (
    <div className={`grid grid-cols-2 gap-2 ${className}`}>
      <select
        className={selectCls}
        value={obl}
        onChange={e => {
          const r = soato.find(x => x.code === e.target.value)
          onChange(e.target.value, r?.districts?.[0]?.code || '')
        }}
      >
        <option value="">Viloyat tanlang...</option>
        {soato.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}
      </select>

      <select
        className={selectCls}
        value={ray}
        disabled={!region}
        onChange={e => onChange(obl, e.target.value)}
      >
        <option value="">Tuman tanlang...</option>
        {districts.map(d => <option key={d.code} value={d.code}>{d.name}</option>)}
      </select>
    </div>
  )
}
