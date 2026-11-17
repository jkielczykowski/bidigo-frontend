import { ParcelFields } from '../components/ParcelFields'
import { parcelColumns, parcelInputFrom, type ParcelInput } from '../lib/ordersLogic'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { LocationMapView } from '../components/LocationMap'
import { useAuth } from '../lib/auth'
import type { Auction, SellerNote } from '../lib/database.types'
import { formatPln } from '../lib/format'
import { supabase } from '../lib/supabase'

type FieldErrors = {
  buyNowPrice?: string
  shipping?: string
  note?: string
}

export function EditAuctionPage() {
  const { id } = useParams()
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [auction, setAuction] = useState<Auction | null>(null)
  const [buyNowPrice, setBuyNowPrice] = useState('')
  const [shipping, setShipping] = useState<string[]>(['odbior'])
  const [parcel, setParcel] = useState<ParcelInput>(parcelInputFrom(null))
  const [parcelErrors, setParcelErrors] = useState<Partial<Record<keyof ParcelInput, string>>>({})
  const [note, setNote] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) navigate('/login')
  }, [authLoading, user, navigate])

  async function loadAuction() {
    if (!id || !user) return
    setLoading(true)
    const { data, error: err } = await supabase.from('auctions').select('*').eq('id', id).single()
    if (err || !data) {
      setError(err?.message || 'Nie znaleziono aukcji')
      setAuction(null)
      setLoading(false)
      return
    }
    const a = data as Auction
    if (a.seller_id !== user.id) {
      setError('Możesz edytować tylko własne oferty')
      setAuction(null)
      setLoading(false)
      return
    }
    if (a.status !== 'active') {
      setError('Zarządzanie tylko aktywnych aukcji')
      setAuction(null)
      setLoading(false)
      return
    }
    setAuction(a)
    setBuyNowPrice(a.buy_now_price != null ? String(a.buy_now_price) : '')
    setShipping(a.shipping_options?.length ? a.shipping_options : ['odbior'])
    setParcel(parcelInputFrom(a))
    setError(null)
    setLoading(false)
  }

  useEffect(() => {
    void loadAuction()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user])

  const minBuyNow = useMemo(() => {
    if (!auction) return 1
    return Math.max(Number(auction.current_price), Number(auction.starting_price)) + 0.01
  }, [auction])

  const notes = (auction?.seller_notes as SellerNote[] | null) || []

  function toggleShipping(opt: string) {
    setShipping((prev) => (prev.includes(opt) ? prev.filter((x) => x !== opt) : [...prev, opt]))
    setFieldErrors((e) => ({ ...e, shipping: undefined }))
  }

  async function onSaveSettings(e: FormEvent) {
    e.preventDefault()
    if (!user || !id || !auction) return
    const errs: FieldErrors = {}
    if (shipping.length < 1) errs.shipping = 'Wybierz co najmniej jedną opcję dostawy'
    if (buyNowPrice.trim()) {
      const b = Number(buyNowPrice)
      const floor = Math.max(Number(auction.current_price), Number(auction.starting_price))
      if (Number.isNaN(b) || b <= floor) {
        errs.buyNowPrice = `Kup teraz musi być wyższe od ${formatPln(floor)}`
      }
    }
    setFieldErrors(errs)
    if (Object.keys(errs).length) {
      setError(Object.values(errs)[0] || 'Uzupełnij pola')
      return
    }
    const pc = parcelColumns(parcel)
    setParcelErrors(pc.errors)
    if (Object.keys(pc.errors).length > 0) {
      setError('Uzupełnij dane paczki')
      return
    }
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const { data, error: updErr } = await supabase
        .from('auctions')
        .update({
          shipping_options: shipping,
          buy_now_price: buyNowPrice.trim() ? Number(buyNowPrice) : null,
          ...parcelColumns(parcel).columns,
        })
        .eq('id', id)
        .eq('seller_id', user.id)
        .select('id')
        .maybeSingle()
      if (updErr) throw updErr
      if (!data) throw new Error('Nie zapisano zmian')
      setNotice('Zapisano ustawienia (Kup teraz / dostawa).')
      await loadAuction()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zapisać')
    } finally {
      setBusy(false)
    }
  }

  async function onAddNote(e: FormEvent) {
    e.preventDefault()
    if (!user || !id) return
    const body = note.trim()
    if (body.length < 3) {
      setFieldErrors((er) => ({ ...er, note: 'Notatka min. 3 znaki' }))
      return
    }
    setBusy(true)
    setError(null)
    setNotice(null)
    setFieldErrors((er) => ({ ...er, note: undefined }))
    try {
      const { error: rpcErr } = await supabase.rpc('append_seller_note', {
        p_auction_id: id,
        p_body: body,
      })
      if (rpcErr) throw rpcErr
      setNote('')
      setNotice('Dodano notatkę — widać ją na stronie aukcji.')
      await loadAuction()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się dodać notatki')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="container narrow page">
        <p className="muted">Ładowanie…</p>
      </div>
    )
  }

  if (!auction) {
    return (
      <div className="container narrow page">
        <p className="error">{error || 'Brak aukcji'}</p>
        <Link to="/my/selling">Wróć do moich aukcji</Link>
      </div>
    )
  }

  return (
    <div className="container narrow page">
      <Link to={`/auction/${id}`} className="back">
        ← Wróć do aukcji
      </Link>
      <h1>Zarządzaj ofertą</h1>
      <p className="muted">
        Po uruchomieniu aukcji nie zmienia się tytułu, opisu ani zdjęć. Możesz dodać notatkę dla kupujących oraz ustawić
        „Kup teraz” i dostawę.
      </p>

      <div className="card-form edit-locked-block">
        <h3>Zablokowana treść</h3>
        <p className="edit-locked-title">{auction.title}</p>
        <p className="description">{auction.description || 'Brak opisu.'}</p>
        {auction.image_urls?.length > 0 && (
          <div className="photo-grid edit-locked-photos">
            {auction.image_urls.map((url, idx) => (
              <div key={url} className={`photo-thumb ${idx === 0 ? 'is-cover' : ''}`}>
                <img src={url} alt={`Zdjęcie ${idx + 1}`} />
                {idx === 0 && <span className="cover-badge">Główne</span>}
              </div>
            ))}
          </div>
        )}
        {auction.city && <p className="muted">Miasto: {auction.city}</p>}
        {auction.lat != null && auction.lng != null && (
          <LocationMapView lat={Number(auction.lat)} lng={Number(auction.lng)} city={auction.city} />
        )}
      </div>

      <form className="card-form" onSubmit={onAddNote} noValidate>
        <h3>Notatka sprzedawcy</h3>
        <p className="muted">Dopiski pojawiają się pod opisem na stronie aukcji (np. nowy termin odbioru).</p>
        {notes.length > 0 && (
          <ul className="seller-notes-list">
            {notes.map((n, i) => (
              <li key={`${n.created_at}-${i}`}>
                <p>{n.body}</p>
                <time className="muted">{n.created_at ? new Date(n.created_at).toLocaleString('pl-PL') : ''}</time>
              </li>
            ))}
          </ul>
        )}
        <label className={fieldErrors.note ? 'has-error' : ''}>
          Nowa notatka
          <textarea
            rows={3}
            maxLength={2000}
            value={note}
            onChange={(e) => {
              setNote(e.target.value)
              setFieldErrors((er) => ({ ...er, note: undefined }))
            }}
            placeholder="Np. Mogę wysłać też w sobotę…"
          />
          {fieldErrors.note && <span className="field-error">{fieldErrors.note}</span>}
        </label>
        <button className="btn btn-primary" disabled={busy} type="submit">
          {busy ? 'Zapisywanie…' : 'Dodaj notatkę'}
        </button>
      </form>

      <form className="card-form" onSubmit={onSaveSettings} noValidate>
        <div className="edit-buy-now-box">
          <h3>Kup teraz</h3>
          <p className="muted">
            Aktualna oferta: {formatPln(auction.current_price)}. Zostaw puste, żeby wyłączyć.
          </p>
          <label className={fieldErrors.buyNowPrice ? 'has-error' : ''}>
            Cena Kup teraz (zł)
            <input
              type="number"
              min={Math.ceil(minBuyNow)}
              step="1"
              value={buyNowPrice}
              onChange={(e) => {
                setBuyNowPrice(e.target.value)
                setFieldErrors((er) => ({ ...er, buyNowPrice: undefined }))
              }}
              placeholder={`np. ${Math.ceil(Number(auction.current_price) * 1.5)}`}
            />
            {fieldErrors.buyNowPrice && <span className="field-error">{fieldErrors.buyNowPrice}</span>}
          </label>
        </div>

        <fieldset className={`shipping ${fieldErrors.shipping ? 'has-error' : ''}`}>
          <legend>
            <span className="label-text">
              Odbiór / wysyłka<span className="req"> *</span>
            </span>
          </legend>
          {[
            ['odbior', 'Odbiór osobisty'],
            ['inpost', 'InPost'],
            ['kurier', 'Kurier'],
          ].map(([sid, label]) => (
            <label key={sid} className="checkbox">
              <input type="checkbox" checked={shipping.includes(sid)} onChange={() => toggleShipping(sid)} />
              {label}
            </label>
          ))}
          {fieldErrors.shipping && <span className="field-error">{fieldErrors.shipping}</span>}
        </fieldset>

        <ParcelFields value={parcel} onChange={setParcel} errors={parcelErrors} />

        {error && <p className="error">{error}</p>}
        {notice && <p className="success">{notice}</p>}
        <button className="btn btn-outline btn-lg" disabled={busy} type="submit">
          {busy ? 'Zapisywanie…' : 'Zapisz Kup teraz / dostawę'}
        </button>
      </form>
    </div>
  )
}
