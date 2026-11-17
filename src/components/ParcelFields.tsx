import { LOCKER_EXCLUDED_TEXT, type ParcelInput } from '../lib/ordersLogic'

type Props = {
  value: ParcelInput
  onChange: (next: ParcelInput) => void
  errors?: Partial<Record<keyof ParcelInput, string>>
  /** false = the chosen category cannot be shipped by parcel locker: no question, only the reason */
  categoryAllowed?: boolean
}

/** Seller's answer to „Czy można wysłać Paczkomatem InPost?” + the package data (the backend decides whether it qualifies). */
export function ParcelFields({ value, onChange, errors = {}, categoryAllowed = true }: Props) {
  const set = (patch: Partial<ParcelInput>) => onChange({ ...value, ...patch })
  const field = (key: keyof ParcelInput, label: string, unit: string, mode: 'decimal' | 'text' = 'decimal', required = true) => (
    <label className={errors[key] ? 'has-error' : ''}>
      <span className="label-text">
        {label}
        {required && <span className="req"> *</span>}
      </span>
      <input
        type="text"
        inputMode={mode}
        value={value[key]}
        onChange={(e) => set({ [key]: e.target.value } as Partial<ParcelInput>)}
        placeholder={unit}
        maxLength={mode === 'text' ? 60 : 8}
      />
      {errors[key] && <span className="field-error">{errors[key]}</span>}
    </label>
  )
  if (!categoryAllowed) {
    return (
      <div className="parcel-fields">
        <p className="label-text">Wysyłka Paczkomatem InPost</p>
        <p className="hint">{LOCKER_EXCLUDED_TEXT}</p>
      </div>
    )
  }
  return (
    <fieldset className="parcel-fields">
      <legend>
        <span className="label-text">Czy można wysłać Paczkomatem InPost?</span>
      </legend>
      <label className="checkbox">
        <input type="radio" name="locker" checked={value.locker === 'yes'} onChange={() => set({ locker: 'yes' })} /> Tak
      </label>
      <label className="checkbox">
        <input type="radio" name="locker" checked={value.locker === 'no'} onChange={() => set({ locker: 'no' })} /> Nie
      </label>
      <p className="hint">
        Dla przedmiotów wysyłanych Paczkomatem kupujący może wybrać płatną Ochronę Kupującego Bidigo. Nie pobieramy od Ciebie żadnej prowizji.
      </p>
      {value.locker === 'yes' && (
        <>
        <p className="hint">Wymiary, waga i koszt wysyłki są wymagane — bez nich kupujący nie zobaczy Ochrony.</p>
        <div className="parcel-grid">
          {field('length', 'Długość', 'cm')}
          {field('width', 'Szerokość', 'cm')}
          {field('height', 'Wysokość', 'cm')}
          {field('weight', 'Waga', 'kg')}
          {field('kind', 'Rodzaj przedmiotu', 'np. ubrania, książki', 'text', false)}
          {field('shippingPrice', 'Koszt wysyłki Paczkomatem (płaci kupujący)', 'zł')}
        </div>
        </>
      )}
    </fieldset>
  )
}
