import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CategoryPicker } from '../components/CategoryPicker'
import { CitySuggest } from '../components/CitySuggest'
import { LocationMapPicker } from '../components/LocationMap'
import { geocodeCity } from '../lib/cities'
import { FeeBlockBanner } from '../components/FeeBlockBanner'
import { ImageCropDialog } from '../components/ImageCropDialog'
import { useAuth } from '../lib/auth'
import { errorMessage } from '../lib/errors'
import { isFeeBlockError, useFeeBlock } from '../lib/feeBlock'
import type { Auction, Category } from '../lib/database.types'
import { calcSuccessFee, formatPln } from '../lib/format'
import { newId } from '../lib/id'
import { supabase } from '../lib/supabase'

const MAX_PHOTOS = 5

function isoDay(offset: number) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

type PhotoItem = {
  id: string
  file: File
  previewUrl: string
}

type FieldErrors = {
  title?: string
  description?: string
  categoryId?: string
  city?: string
  photos?: string
  startingPrice?: string
  bidIncrement?: string
  reservePrice?: string
  buyNowPrice?: string
  durationDays?: string
  shipping?: string
}

function isLeafCategory(categories: Category[], id: string) {
  return !!id && !categories.some((c) => c.parent_id === id)
}

export function CreateAuctionPage() {
  const { user, profile, loading } = useAuth()
  const { block: feeBlock, reload: reloadFeeBlock } = useFeeBlock()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const relistId = searchParams.get('relist')
  const [categories, setCategories] = useState<Category[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [city, setCity] = useState('')
  const [cityLat, setCityLat] = useState<number | null>(null)
  const [cityLng, setCityLng] = useState<number | null>(null)
  const [startingPrice, setStartingPrice] = useState('50')
  const [reservePrice, setReservePrice] = useState('')
  const [bidIncrement, setBidIncrement] = useState('10')
  const [buyNowPrice, setBuyNowPrice] = useState('')
  const [durationDays, setDurationDays] = useState<7 | 14>(7)
  const [autoRenew, setAutoRenew] = useState(false)
  const [shipping, setShipping] = useState<string[]>(['odbior'])
  const endsOn = useMemo(() => isoDay(durationDays), [durationDays])
  const [photos, setPhotos] = useState<PhotoItem[]>([])
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [cropOpen, setCropOpen] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void supabase
      .from('categories')
      .select('*')
      .order('sort_order')
      .then(({ data }) => {
        const cats = (data as Category[]) ?? []
        setCategories(cats)
      })
  }, [])

  useEffect(() => {
    if (!loading && !user) navigate('/login')
  }, [user, loading, navigate])

  useEffect(() => {
    if (!user || !relistId) return
    void (async () => {
      const { data } = await supabase.from('auctions').select('*').eq('id', relistId).maybeSingle()
      const a = data as Auction | null
      if (!a || a.seller_id !== user.id) return
      setTitle(a.title)
      setDescription(a.description || '')
      setCategoryId(a.category_id || '')
      setCity(a.city || '')
      setCityLat(a.lat ?? null)
      setCityLng(a.lng ?? null)
      setStartingPrice(String(a.starting_price))
      setReservePrice(a.reserve_price != null ? String(a.reserve_price) : '')
      setBidIncrement(String(a.bid_increment))
      setBuyNowPrice(a.buy_now_price != null ? String(a.buy_now_price) : '')
      setShipping(a.shipping_options?.length ? a.shipping_options : ['odbior'])
    })()
  }, [user, relistId])

  useEffect(() => {
    return () => {
      if (cropSrc) URL.revokeObjectURL(cropSrc)
    }
  }, [cropSrc])

  useEffect(() => {
    return () => {
      photos.forEach((p) => URL.revokeObjectURL(p.previewUrl))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revoke only on unmount
  }, [])

  function toggleShipping(opt: string) {
    setShipping((prev) => (prev.includes(opt) ? prev.filter((x) => x !== opt) : [...prev, opt]))
    setFieldErrors((e) => ({ ...e, shipping: undefined }))
  }

  function onPickFile(picked: File | null) {
    if (!picked) return
    if (photos.length >= MAX_PHOTOS) {
      setFieldErrors((e) => ({ ...e, photos: `Maksimum ${MAX_PHOTOS} zdjęć` }))
      return
    }
    if (cropSrc) URL.revokeObjectURL(cropSrc)
    const url = URL.createObjectURL(picked)
    setCropSrc(url)
    setCropOpen(true)
  }

  function onCropCancel() {
    setCropOpen(false)
    if (cropSrc) URL.revokeObjectURL(cropSrc)
    setCropSrc(null)
  }

  function onCropConfirm(cropped: File) {
    const previewUrl = URL.createObjectURL(cropped)
    setPhotos((prev) => {
      if (prev.length >= MAX_PHOTOS) {
        URL.revokeObjectURL(previewUrl)
        return prev
      }
      return [...prev, { id: newId(), file: cropped, previewUrl }]
    })
    setFieldErrors((e) => ({ ...e, photos: undefined }))
    setCropOpen(false)
    if (cropSrc) URL.revokeObjectURL(cropSrc)
    setCropSrc(null)
  }

  function removePhoto(id: string) {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === id)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((p) => p.id !== id)
    })
  }

  function movePhoto(id: string, dir: -1 | 1) {
    setPhotos((prev) => {
      const i = prev.findIndex((p) => p.id === id)
      if (i < 0) return prev
      const j = i + dir
      if (j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  const feePercent = useMemo(() => {
    const cat = categories.find((c) => c.id === categoryId)
    return Number(cat?.fee_percent ?? 5)
  }, [categories, categoryId])

  const feePreviewPrice = useMemo(() => {
    const buy = buyNowPrice ? Number(buyNowPrice) : NaN
    const start = Number(startingPrice)
    const reserve = reservePrice ? Number(reservePrice) : NaN
    if (!Number.isNaN(buy) && buy > 0) return buy
    if (!Number.isNaN(reserve) && reserve > 0) return reserve
    return start > 0 ? start : 0
  }, [buyNowPrice, startingPrice, reservePrice])

  const feeAmount = useMemo(
    () => (feePreviewPrice > 0 ? calcSuccessFee(feePreviewPrice, feePercent) : 0),
    [feePreviewPrice, feePercent],
  )

  function validate(): FieldErrors {
    const errs: FieldErrors = {}
    if (!title.trim() || title.trim().length < 5) {
      errs.title = 'Podaj tytuł (min. 5 znaków)'
    }
    if (!description.trim() || description.trim().length < 5) {
      errs.description = 'Opis jest wymagany (min. 5 znaków)'
    }
    if (!categoryId || !isLeafCategory(categories, categoryId)) {
      errs.categoryId = 'Wybierz szczegółową kategorię'
    }
    if (!city.trim() || city.trim().length < 2) {
      errs.city = 'Podaj miasto'
    } else if (cityLat == null || cityLng == null) {
      errs.city = 'Ustaw lokalizację na mapie (wybierz miasto lub kliknij mapę)'
    }
    if (photos.length < 1) {
      errs.photos = 'Zdjęcie jest wymagane — dodaj co najmniej 1'
    } else if (photos.length > MAX_PHOTOS) {
      errs.photos = `Maksimum ${MAX_PHOTOS} zdjęć`
    }
    const start = Number(startingPrice)
    if (!startingPrice || Number.isNaN(start) || start < 1) {
      errs.startingPrice = 'Cena startowa min. 1 zł'
    }
    const inc = Number(bidIncrement)
    if (!bidIncrement || Number.isNaN(inc) || inc < 1) {
      errs.bidIncrement = 'Krok oferty min. 1 zł'
    }
    if (reservePrice) {
      const r = Number(reservePrice)
      if (Number.isNaN(r) || r < start) {
        errs.reservePrice = 'Minimum musi być ≥ ceny startowej'
      }
    }
    if (buyNowPrice) {
      const b = Number(buyNowPrice)
      if (Number.isNaN(b) || b <= start) {
        errs.buyNowPrice = 'Kup teraz musi być wyższe od ceny startowej'
      }
    }
    if (shipping.length < 1) {
      errs.shipping = 'Wybierz co najmniej jedną opcję dostawy'
    }
    if (durationDays !== 7 && durationDays !== 14) {
      errs.durationDays = 'Wybierz 7 albo 14 dni'
    }
    return errs
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return

    let lat = cityLat
    let lng = cityLng
    if ((lat == null || lng == null) && city.trim().length >= 2) {
      const place = await geocodeCity(city.trim())
      if (place) {
        lat = place.lat
        lng = place.lng
        setCityLat(place.lat)
        setCityLng(place.lng)
      }
    }

    const errs = validate()
    if ((lat == null || lng == null) && city.trim().length >= 2) {
      errs.city = 'Ustaw lokalizację na mapie (wybierz miasto lub kliknij mapę)'
    } else if (lat != null && lng != null) {
      delete errs.city
    }
    setFieldErrors(errs)
    if (Object.keys(errs).length) {
      setError('Uzupełnij wymagane pola')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const imageUrls: string[] = []
      for (const photo of photos) {
        // WebP or JPEG, already resized by ImageCropDialog
        const ext = photo.file.type === 'image/webp' ? 'webp' : 'jpg'
        const path = `${user.id}/${newId()}.${ext}`
        const { error: upErr } = await supabase.storage.from('auction-images').upload(path, photo.file, {
          // Every upload gets a new name, so browsers and the CDN may keep it for a year
          cacheControl: '31536000',
          upsert: false,
          contentType: photo.file.type,
        })
        if (upErr) throw upErr
        const { data: pub } = supabase.storage.from('auction-images').getPublicUrl(path)
        imageUrls.push(pub.publicUrl)
      }

      const endsAt = new Date(`${endsOn}T23:59:00`).toISOString()
      const start = Number(startingPrice)

      const baseInsert = {
        seller_id: user.id,
        category_id: categoryId,
        title: title.trim(),
        description: description.trim(),
        image_urls: imageUrls,
        starting_price: start,
        current_price: start,
        reserve_price: reservePrice ? Number(reservePrice) : null,
        bid_increment: Number(bidIncrement),
        buy_now_price: buyNowPrice ? Number(buyNowPrice) : null,
        status: 'active' as const,
        starts_at: new Date().toISOString(),
        ends_at: endsAt,
        city: city.trim(),
        shipping_options: shipping,
        duration_days: durationDays,
        auto_renew: autoRenew,
      }

      let insertPayload: Record<string, unknown> = { ...baseInsert }
      if (lat != null && lng != null) {
        insertPayload = { ...insertPayload, lat, lng }
      }

      let { data, error: insErr } = await supabase
        .from('auctions')
        .insert(insertPayload)
        .select('*')
        .single()

      // Starsza baza bez lat/lng / auto_renew — spróbuj bez opcjonalnych kolumn
      if (insErr && /lat|lng|auto_renew|duration_days|column/i.test(insErr.message)) {
        const { duration_days: _d, auto_renew: _a, lat: _la, lng: _ln, ...legacy } = insertPayload
        ;({ data, error: insErr } = await supabase.from('auctions').insert(legacy).select('*').single())
      }

      if (insErr) throw insErr
      // The listing is checked on the server now (pending_auto); its page shows the progress
      const created = data as { id: string }
      navigate(`/auction/${created.id}`)
    } catch (err) {
      setError(errorMessage(err, 'Nie udało się wystawić aukcji'))
      if (isFeeBlockError(err)) void reloadFeeBlock()
    } finally {
      setBusy(false)
    }
  }

  if (loading || !user) {
    return (
      <div className="container narrow page">
        <p className="muted">Ładowanie…</p>
      </div>
    )
  }

  if (!profile?.phone_verified_at) {
    return (
      <div className="container narrow page">
        <h1>Potwierdź telefon</h1>
        <p className="muted">
          Żeby wystawić aukcję, potwierdź numer telefonu kodem SMS
          {profile?.phone ? ` (${profile.phone})` : ''}.
        </p>
        <Link className="btn btn-primary" to="/verify-phone?next=/sell">
          Potwierdź numer SMS
        </Link>
      </div>
    )
  }

  return (
    <div className="container narrow page">
      <h1>{relistId ? 'Wystaw ponownie' : 'Wystaw aukcję'}</h1>
      <p className="muted">
        {relistId
          ? 'Skopiowaliśmy dane z poprzedniej aukcji — dodaj zdjęcia i wystaw.'
          : 'Wymagane: tytuł, opis, kategoria, miasto, min. 1 zdjęcie (max 5), ceny i dostawa.'}
      </p>
      <FeeBlockBanner block={feeBlock} />
      <form className="card-form" onSubmit={onSubmit} noValidate>
        <label className={fieldErrors.title ? 'has-error' : ''}>
          <span className="label-text">
            Tytuł<span className="req"> *</span>
          </span>
          <input
            maxLength={120}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              setFieldErrors((er) => ({ ...er, title: undefined }))
            }}
            placeholder="Rower miejski — stan bdb"
          />
          {fieldErrors.title && <span className="field-error">{fieldErrors.title}</span>}
        </label>
        <label className={fieldErrors.description ? 'has-error' : ''}>
          <span className="label-text">
            Opis<span className="req"> *</span>
          </span>
          <textarea
            rows={5}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value)
              setFieldErrors((er) => ({ ...er, description: undefined }))
            }}
          />
          {fieldErrors.description && <span className="field-error">{fieldErrors.description}</span>}
        </label>

        <CategoryPicker
          categories={categories}
          value={categoryId}
          onChange={(id) => {
            setCategoryId(id)
            setFieldErrors((er) => ({ ...er, categoryId: undefined }))
          }}
          error={fieldErrors.categoryId}
        />

        <CitySuggest
          value={city}
          error={fieldErrors.city}
          label="Miejscowość"
          placeholder="Wpisz i wybierz z listy (np. Warszawa)…"
          onChange={(c) => {
            setCity(c)
            setFieldErrors((er) => ({ ...er, city: undefined }))
          }}
          onPlaceSelect={(place) => {
            setCityLat(place?.lat ?? null)
            setCityLng(place?.lng ?? null)
            if (place) setFieldErrors((er) => ({ ...er, city: undefined }))
          }}
        />
        <p className="muted city-search-hint">
          Wpisz min. 2 znaki i <strong>wybierz miejscowość z podpowiedzi</strong> — zapisujemy współrzędne, żeby
          wyszukiwanie po promieniu było szybkie.
        </p>
        {cityLat != null && cityLng != null && (
          <p className="muted city-search-hint" style={{ color: 'var(--accent-hover)' }}>
            Lokalizacja zapisana ({cityLat.toFixed(4)}, {cityLng.toFixed(4)})
          </p>
        )}

        <div className={`photo-field ${fieldErrors.photos ? 'has-error' : ''}`}>
          <span className="field-label">
            Zdjęcia oferty<span className="req"> *</span>
            <span className="muted"> ({photos.length}/{MAX_PHOTOS})</span>
          </span>
          {photos.length > 0 && (
            <div className="photo-grid">
              {photos.map((p, idx) => (
                <div key={p.id} className={`photo-thumb ${idx === 0 ? 'is-cover' : ''}`}>
                  <img src={p.previewUrl} alt={`Zdjęcie ${idx + 1}`} />
                  {idx === 0 && <span className="cover-badge">Główne</span>}
                  <div className="photo-thumb-actions">
                    <button type="button" className="btn btn-ghost btn-xs" disabled={idx === 0} onClick={() => movePhoto(p.id, -1)}>
                      ←
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      disabled={idx === photos.length - 1}
                      onClick={() => movePhoto(p.id, 1)}
                    >
                      →
                    </button>
                    <button type="button" className="btn btn-ghost btn-xs" onClick={() => removePhoto(p.id)}>
                      Usuń
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {photos.length < MAX_PHOTOS && (
            <label className="photo-drop compact">
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  onPickFile(e.target.files?.[0] ?? null)
                  e.target.value = ''
                }}
              />
              <strong>{photos.length === 0 ? 'Dodaj zdjęcie (wymagane)' : 'Dodaj kolejne'}</strong>
              <span>Bez zdjęcia nie wystawisz aukcji · JPG/PNG · max {MAX_PHOTOS}</span>
            </label>
          )}
          {fieldErrors.photos && <span className="field-error">{fieldErrors.photos}</span>}
        </div>

        <div className="form-row">
          <label className={fieldErrors.startingPrice ? 'has-error' : ''}>
            <span className="label-text">
              Cena startowa (zł)<span className="req"> *</span>
            </span>
            <input
              type="number"
              min={1}
              value={startingPrice}
              onChange={(e) => {
                setStartingPrice(e.target.value)
                setFieldErrors((er) => ({ ...er, startingPrice: undefined }))
              }}
            />
            {fieldErrors.startingPrice && <span className="field-error">{fieldErrors.startingPrice}</span>}
          </label>
          <label className={fieldErrors.bidIncrement ? 'has-error' : ''}>
            <span className="label-text">
              Krok oferty (zł)<span className="req"> *</span>
            </span>
            <input
              type="number"
              min={1}
              value={bidIncrement}
              onChange={(e) => {
                setBidIncrement(e.target.value)
                setFieldErrors((er) => ({ ...er, bidIncrement: undefined }))
              }}
            />
            {fieldErrors.bidIncrement && <span className="field-error">{fieldErrors.bidIncrement}</span>}
          </label>
        </div>
        <div className="form-row">
          <label className={fieldErrors.reservePrice ? 'has-error' : ''}>
            <span className="label-text">Minimum (opcjonalnie)</span>
            <input type="number" min={0} value={reservePrice} onChange={(e) => setReservePrice(e.target.value)} />
            {fieldErrors.reservePrice && <span className="field-error">{fieldErrors.reservePrice}</span>}
          </label>
          <label className={fieldErrors.buyNowPrice ? 'has-error' : ''}>
            <span className="label-text">Kup teraz (opcjonalnie)</span>
            <input type="number" min={0} value={buyNowPrice} onChange={(e) => setBuyNowPrice(e.target.value)} />
            {fieldErrors.buyNowPrice && <span className="field-error">{fieldErrors.buyNowPrice}</span>}
          </label>
        </div>
        <fieldset className={`duration-field ${fieldErrors.durationDays ? 'has-error' : ''}`}>
          <legend>
            <span className="label-text">
              Czas trwania<span className="req"> *</span>
            </span>
          </legend>
          <div className="duration-chips">
            {([7, 14] as const).map((d) => (
              <button
                key={d}
                type="button"
                className={`duration-chip ${durationDays === d ? 'is-active' : ''}`}
                onClick={() => {
                  setDurationDays(d)
                  setFieldErrors((er) => ({ ...er, durationDays: undefined }))
                }}
              >
                {d} dni
              </button>
            ))}
          </div>
          <p className="muted">
            Koniec: <strong>{endsOn}</strong> o 23:59
          </p>
          <label className="checkbox auto-renew-check">
            <input type="checkbox" checked={autoRenew} onChange={(e) => setAutoRenew(e.target.checked)} />
            <span>
              Wznawiaj automatycznie, jeśli nikt nie złoży oferty
              <span className="muted"> — wystawimy ponownie na kolejne {durationDays} dni</span>
            </span>
          </label>
          {fieldErrors.durationDays && <span className="field-error">{fieldErrors.durationDays}</span>}
        </fieldset>
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
          ].map(([id, label]) => (
            <label key={id} className="checkbox">
              <input type="checkbox" checked={shipping.includes(id)} onChange={() => toggleShipping(id)} />
              {label}
            </label>
          ))}
          {fieldErrors.shipping && <span className="field-error">{fieldErrors.shipping}</span>}
        </fieldset>

        <div className="location-block">
          <h3>Lokalizacja na mapie</h3>
          <LocationMapPicker lat={cityLat} lng={cityLng} city={city || null} />
        </div>

        <div className="fee-box">
          <h3>Prowizja od sprzedaży</h3>
          <p>
            Wystawianie jest <strong>darmowe</strong>. Opłata nalicza się dopiero gdy ktoś kupi.
          </p>
          <ul>
            <li>
              Stawka dla kategorii: <strong>{feePercent}%</strong>
            </li>
            <li>
              Min. {formatPln(2)} · max {formatPln(150)}
            </li>
            {feePreviewPrice > 0 && (
              <li>
                Przy cenie {formatPln(feePreviewPrice)} zapłacisz ok. <strong>{formatPln(feeAmount)}</strong>
              </li>
            )}
          </ul>
        </div>

        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary btn-lg" disabled={busy} type="submit">
          {busy ? 'Wystawianie…' : 'Wystaw aukcję'}
        </button>
      </form>

      {cropSrc && (
        <ImageCropDialog
          open={cropOpen}
          imageSrc={cropSrc}
          aspect={4 / 3}
          title="Przytnij zdjęcie oferty"
          hint="Przesuń i powiększ — kadr 4:3 jak na karcie aukcji."
          onCancel={onCropCancel}
          onConfirm={onCropConfirm}
        />
      )}
    </div>
  )
}
