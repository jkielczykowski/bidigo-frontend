import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { LocationMapView } from '../components/LocationMap'
import { FeeBlockBanner } from '../components/FeeBlockBanner'
import { Modal } from '../components/Modal'
import { PromoteAuction } from '../components/PromoteAuction'
import { ReportAuction } from '../components/ReportAuction'
import { useAuth } from '../lib/auth'
import { errorMessage } from '../lib/errors'
import { isFeeBlockError, useFeeBlock } from '../lib/feeBlock'
import type { Auction, AuctionComment, Bid, SellerNote, SellerRating } from '../lib/database.types'
import { bidLabel, formatEndsAt, formatPln, formatRemaining, minNextBid } from '../lib/format'
import { usePromotionsEnabled } from '../lib/features'
import { isPromoted } from '../lib/promotions'
import { PUBLIC_PROFILE_COLUMNS, supabase } from '../lib/supabase'

function formatSellerRating(avg?: number | null, count?: number | null) {
  const n = Number(count ?? 0)
  if (!n) return null
  return `${Number(avg ?? 0).toFixed(1)} ★ (${n})`
}

export function AuctionDetailPage() {
  const { id } = useParams()
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [auction, setAuction] = useState<Auction | null>(null)
  const [bids, setBids] = useState<Bid[]>([])
  const [amount, setAmount] = useState('')
  // Once the user types a bid, reloads (realtime, double effect) must not replace it with the minimum
  const amountTouched = useRef(false)
  const [maxAmount, setMaxAmount] = useState('')
  const [useProxy, setUseProxy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [buyNowOpen, setBuyNowOpen] = useState(false)
  const [buyNowError, setBuyNowError] = useState<string | null>(null)
  const [activeImage, setActiveImage] = useState(0)
  const [chatBusy, setChatBusy] = useState(false)
  const [endOpen, setEndOpen] = useState(false)
  const [endError, setEndError] = useState<string | null>(null)
  const [myRating, setMyRating] = useState<SellerRating | null>(null)
  const [rateScore, setRateScore] = useState(5)
  const [rateComment, setRateComment] = useState('')
  const [rateError, setRateError] = useState<string | null>(null)
  const [rateBusy, setRateBusy] = useState(false)
  const [comments, setComments] = useState<AuctionComment[]>([])
  const [commentBody, setCommentBody] = useState('')
  const [commentError, setCommentError] = useState<string | null>(null)
  const [commentBusy, setCommentBusy] = useState(false)
  const [replyToId, setReplyToId] = useState<string | null>(null)
  const [replyBody, setReplyBody] = useState('')

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  async function load() {
    if (!id) return
    const { data: a, error: aErr } = await supabase
      .from('auctions')
      .select(`*, category:categories(*), seller:profiles!auctions_seller_id_fkey(${PUBLIC_PROFILE_COLUMNS})`)
      .eq('id', id)
      .single()
    if (aErr) {
      setError(aErr.message)
      return
    }
    setAuction(a as Auction)
    setActiveImage(0)

    const { data: b } = await supabase
      .from('bids')
      .select(`id, auction_id, bidder_id, amount, created_at, bidder:profiles!bids_bidder_id_fkey(${PUBLIC_PROFILE_COLUMNS})`)
      .eq('auction_id', id)
      .order('amount', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(30)
    setBids((b as unknown as Bid[]) ?? [])

    const auctionRow = a as Auction
    const min = minNextBid(
      Number(auctionRow.current_price),
      Number(auctionRow.starting_price),
      Number(auctionRow.bid_increment),
      Number(auctionRow.bid_count),
    )
    if (!amountTouched.current) setAmount(String(min))

    const { data: ratingRow } = await supabase
      .from('seller_ratings')
      .select('*')
      .eq('auction_id', id)
      .maybeSingle()
    setMyRating((ratingRow as SellerRating | null) ?? null)

    const { data: commentRows } = await supabase
      .from('auction_comments')
      .select(`*, author:profiles!auction_comments_author_id_fkey(${PUBLIC_PROFILE_COLUMNS})`)
      .eq('auction_id', id)
      .order('created_at', { ascending: true })
    setComments((commentRows as AuctionComment[]) ?? [])
  }

  useEffect(() => {
    void load()
    if (!id) return
    // One broadcast per change on this auction (bid, question, status) from the database
    // (bidigo-backend V33). A burst of events (proxy auto-bids) triggers a single reload.
    let reloadTimer = 0
    const channel = supabase
      .channel(`auction:${id}`)
      .on('broadcast', { event: 'changed' }, () => {
        window.clearTimeout(reloadTimer)
        reloadTimer = window.setTimeout(() => void load(), 250)
      })
      .subscribe()
    return () => {
      window.clearTimeout(reloadTimer)
      void supabase.removeChannel(channel)
    }
  }, [id])

  const live = useMemo(
    () =>
      auction?.status === 'active' &&
      auction.moderation_status === 'approved' &&
      new Date(auction.ends_at).getTime() > now,
    [auction, now],
  )

  const isSeller = !!user && auction?.seller_id === user.id
  const promotionsOn = usePromotionsEnabled()
  const { block: feeBlock, reload: reloadFeeBlock } = useFeeBlock()
  const isAdmin = !!profile?.is_admin
  const isWinner = !!user && auction?.winner_id === user.id
  const canChat = auction?.status === 'sold' && (isSeller || isWinner)
  const canRateSeller = auction?.status === 'sold' && isWinner && !isSeller
  const pendingReview = auction?.moderation_status === 'pending_review'
  // Waiting for the automatic check (bidigo-backend V44); the decision arrives as a broadcast, polling is a fallback
  const pendingAuto = auction?.moderation_status === 'pending_auto'
  useEffect(() => {
    if (!pendingAuto) return
    const timer = window.setInterval(() => void load(), 3000)
    return () => window.clearInterval(timer)
  }, [pendingAuto, id])
  const rejected = auction?.moderation_status === 'rejected'
  const sellerRatingLabel = formatSellerRating(auction?.seller?.rating_avg, auction?.seller?.rating_count)

  async function submitComment(e: FormEvent, parentId?: string | null) {
    e.preventDefault()
    if (!user) {
      navigate(`/login?next=/auction/${id}`)
      return
    }
    if (!id) return
    const body = (parentId ? replyBody : commentBody).trim()
    if (body.length < 2) {
      setCommentError('Napisz co najmniej 2 znaki')
      return
    }
    if (parentId && !isSeller) {
      setCommentError('Tylko sprzedawca może odpowiadać w wątku')
      return
    }
    setCommentBusy(true)
    setCommentError(null)
    try {
      const { error: err } = await supabase.from('auction_comments').insert({
        auction_id: id,
        author_id: user.id,
        body,
        parent_id: parentId || null,
      })
      if (err) throw err
      if (parentId) {
        setReplyBody('')
        setReplyToId(null)
      } else {
        setCommentBody('')
      }
      await load()
    } catch (err) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : err instanceof Error
            ? err.message
            : 'Nie udało się dodać komentarza'
      setCommentError(msg || 'Nie udało się dodać komentarza')
    } finally {
      setCommentBusy(false)
    }
  }

  async function deleteComment(commentId: string) {
    if (!user) return
    setCommentBusy(true)
    setCommentError(null)
    try {
      const { error: err } = await supabase.from('auction_comments').delete().eq('id', commentId).eq('author_id', user.id)
      if (err) throw err
      await load()
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : 'Nie udało się usunąć komentarza')
    } finally {
      setCommentBusy(false)
    }
  }

  async function submitSellerRating(e: FormEvent) {
    e.preventDefault()
    if (!id || !canRateSeller) return
    setRateBusy(true)
    setRateError(null)
    try {
      const { data, error: err } = await supabase.rpc('rate_seller', {
        p_auction_id: id,
        p_score: rateScore,
        p_comment: rateComment.trim() || null,
      })
      if (err) throw err
      setMyRating(data as SellerRating)
      setRateComment('')
      await load()
    } catch (err) {
      setRateError(err instanceof Error ? err.message : 'Nie udało się zapisać oceny')
    } finally {
      setRateBusy(false)
    }
  }

  const minBid = useMemo(() => {
    if (!auction) return 0
    return minNextBid(
      Number(auction.current_price),
      Number(auction.starting_price),
      Number(auction.bid_increment),
      Number(auction.bid_count),
    )
  }, [auction])

  const buyNowPrice = auction?.buy_now_price != null ? Number(auction.buy_now_price) : null
  const bidCappedByBuyNow = buyNowPrice != null && minBid >= buyNowPrice
  const maxBidAllowed = buyNowPrice != null ? Math.max(buyNowPrice - 0.01, 0) : null

  async function confirmEndAuction() {
    if (!id) return
    setBusy(true)
    setEndError(null)
    try {
      const { error: err } = await supabase.rpc('end_auction', { p_auction_id: id })
      if (err) throw err
      setEndOpen(false)
      await load()
    } catch (err) {
      setEndError(err instanceof Error ? err.message : 'Nie udało się zakończyć aukcji')
    } finally {
      setBusy(false)
    }
  }

  async function openChat() {
    if (!id || !user) {
      navigate('/login')
      return
    }
    setChatBusy(true)
    setError(null)
    try {
      const { data, error: err } = await supabase.rpc('get_or_create_conversation', {
        p_auction_id: id,
      })
      if (err) throw err
      const conv = data as { id: string }
      navigate(`/messages/${conv.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się otworzyć czatu')
    } finally {
      setChatBusy(false)
    }
  }

  async function placeBid(e: FormEvent) {
    e.preventDefault()
    if (!user) {
      navigate('/login')
      return
    }
    if (!profile?.phone_verified_at) {
      navigate(`/verify-phone?next=/auction/${id}`)
      return
    }
    if (!id || !auction) return

    const offered = useProxy ? Number(maxAmount) : Number(amount)
    const buyNow = auction.buy_now_price != null ? Number(auction.buy_now_price) : null
    if (buyNow != null && offered >= buyNow) {
      setError(`Nie licytuj po „Kup teraz” ani wyżej (${formatPln(buyNow)}). Użyj przycisku „Kup teraz”.`)
      return
    }

    setBusy(true)
    setError(null)
    try {
      const { error: err } = await supabase.rpc('place_bid', {
        p_auction_id: id,
        p_amount: Number(amount),
        p_max_amount: useProxy && maxAmount ? Number(maxAmount) : null,
      })
      if (err) throw err
      amountTouched.current = false // bid placed — show the next minimum again
      await load()
    } catch (err) {
      setError(errorMessage(err, 'Nie udało się złożyć oferty'))
      if (isFeeBlockError(err)) void reloadFeeBlock()
    } finally {
      setBusy(false)
    }
  }

  function openBuyNow() {
    if (!user) {
      navigate('/login')
      return
    }
    if (!profile?.phone_verified_at) {
      navigate(`/verify-phone?next=/auction/${id}`)
      return
    }
    setBuyNowError(null)
    setBuyNowOpen(true)
  }

  async function confirmBuyNow() {
    if (!id || !auction?.buy_now_price) return
    setBusy(true)
    setBuyNowError(null)
    try {
      const { error: err } = await supabase.rpc('buy_now', { p_auction_id: id })
      if (err) throw err
      setBuyNowOpen(false)
      await load()
    } catch (err) {
      setBuyNowError(errorMessage(err, 'Nie udało się kupić'))
      if (isFeeBlockError(err)) void reloadFeeBlock()
    } finally {
      setBusy(false)
    }
  }

  if (!auction) {
    return (
      <div className="container page">
        <p className="muted">{error || 'Ładowanie…'}</p>
      </div>
    )
  }

  const images = auction.image_urls?.filter(Boolean) ?? []
  const img = images[Math.min(activeImage, Math.max(images.length - 1, 0))]

  return (
    <div className="container page detail">
      <Link to="/auctions" className="back">
        ← Wróć do aukcji
      </Link>
      <div className="detail-grid">
        <div className="detail-gallery">
          <div className="detail-media">
            {img ? (
              <img src={img} alt={`${auction.title} — zdjęcie ${activeImage + 1}`} />
            ) : (
              <div className="auction-card-placeholder">Brak zdjęcia</div>
            )}
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  className="detail-nav detail-nav-prev"
                  aria-label="Poprzednie zdjęcie"
                  onClick={() => setActiveImage((i) => (i - 1 + images.length) % images.length)}
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="detail-nav detail-nav-next"
                  aria-label="Następne zdjęcie"
                  onClick={() => setActiveImage((i) => (i + 1) % images.length)}
                >
                  ›
                </button>
                <span className="detail-photo-count">
                  {activeImage + 1} / {images.length}
                </span>
              </>
            )}
          </div>
          {images.length > 1 && (
            <div className="detail-thumbs" role="listbox" aria-label="Zdjęcia aukcji">
              {images.map((url, i) => (
                <button
                  key={`${url}-${i}`}
                  type="button"
                  role="option"
                  aria-selected={i === activeImage}
                  className={i === activeImage ? 'detail-thumb active' : 'detail-thumb'}
                  onClick={() => setActiveImage(i)}
                >
                  <img src={url} alt={`Zdjęcie ${i + 1}`} />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="detail-panel">
          <div className="detail-top">
            {live ? (
              <span className="live-pill">● Na żywo</span>
            ) : (
              <span className="ended-pill">
                {auction.status === 'sold' ? 'Sprzedane' : auction.status === 'ended' ? 'Zakończona' : auction.status}
              </span>
            )}
            {promotionsOn && live && isPromoted(auction, now) && <span className="promoted-badge">Promowane</span>}
            <span className="timer big">{formatRemaining(auction.ends_at, now)}</span>
            {live && <span className="timer-ends muted">Koniec: {formatEndsAt(auction.ends_at, now)}</span>}
          </div>
          <h1>{auction.title}</h1>
          {pendingAuto && (isSeller || isAdmin) && (
            <div className="mod-banner pending" role="status">
              <strong>Weryfikujemy ogłoszenie…</strong>
              <p>Sprawdzamy treść i zdjęcia — zwykle trwa to kilka sekund. Do tego czasu ogłoszenie nie jest widoczne dla innych.</p>
            </div>
          )}
          {pendingReview && (isSeller || isAdmin) && (
            <div className="mod-banner pending">
              <strong>W trakcie weryfikacji</strong>
              <p>
                Oznaczono tę aukcję do sprawdzenia
                {auction.moderation_reasons?.length
                  ? `: ${auction.moderation_reasons.join('; ')}`
                  : '.'}{' '}
                Nie jest widoczna publicznie.
              </p>
            </div>
          )}
          {rejected && (
            <div className="mod-banner rejected">
              <strong>Aukcja odrzucona</strong>
              <p>{auction.moderation_notes || 'Ogłoszenie nie przeszło weryfikacji.'}</p>
            </div>
          )}
          <p className="meta">
            {auction.city || 'Polska'}
            {auction.category?.name ? ` · ${auction.category.name}` : ''}
            {auction.seller?.display_name ? ` · sprzedaje ${auction.seller.display_name}` : ''}
            {sellerRatingLabel ? ` · ${sellerRatingLabel}` : ''}
          </p>
          {isSeller && live && (
            <div className="seller-actions">
              <Link to={`/auction/${auction.id}/edit`} className="btn btn-outline">
                Zarządzaj ofertą
              </Link>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy}
                onClick={() => {
                  setEndError(null)
                  setEndOpen(true)
                }}
              >
                Zakończ aukcję
              </button>
            </div>
          )}
          {promotionsOn && isSeller && live && (
            <div className="promote-block">
              <PromoteAuction auction={auction} feeBlock={feeBlock} onPaid={() => void load()} />
            </div>
          )}
          <div className="price-block">
            <span className="label">Aktualna oferta</span>
            <strong className="price huge">{formatPln(auction.current_price)}</strong>
            <span className="muted">
              Start {formatPln(auction.starting_price)} · krok {formatPln(auction.bid_increment)} ·{' '}
              {bidLabel(auction.bid_count)}
            </span>
            {auction.reserve_price != null && (
              <span className="muted">Minimum sprzedawcy: {formatPln(auction.reserve_price)}</span>
            )}
            {auction.buy_now_price != null && (
              <span className="muted">Kup teraz: {formatPln(auction.buy_now_price)}</span>
            )}
          </div>

          {live && isSeller && (
            <p className="hint">
              To Twoja aukcja — opis i zdjęcia są zablokowane. Możesz dodać notatkę lub zmienić „Kup teraz”.
            </p>
          )}

          {live && !isSeller && user && !profile?.phone_verified_at && (
            <p className="hint">
              Żeby licytować, <Link to={`/verify-phone?next=/auction/${id}`}>potwierdź numer telefonu SMS</Link>.
            </p>
          )}

          {live && !isSeller && feeBlock?.blocked && <FeeBlockBanner block={feeBlock} />}

          {live && !isSeller && (
            <div className="bid-form-wrap">
              {bidCappedByBuyNow ? (
                <div className="buy-now-only">
                  <p className="hint">
                    Kolejna oferta osiągnęłaby cenę „Kup teraz” — licytacja jest zamknięta. Możesz tylko kupić od razu.
                  </p>
                  {buyNowPrice != null && (
                    <button className="btn btn-primary btn-lg" type="button" disabled={busy} onClick={openBuyNow}>
                      Kup teraz · {formatPln(buyNowPrice)}
                    </button>
                  )}
                </div>
              ) : (
                <form className="bid-form" onSubmit={placeBid}>
                  <label>
                    Twoja oferta (zł)
                    <input
                      type="number"
                      min={minBid}
                      max={maxBidAllowed ?? undefined}
                      step="1"
                      required={!useProxy}
                      value={amount}
                      onChange={(e) => {
                        amountTouched.current = true
                        setAmount(e.target.value)
                      }}
                      disabled={useProxy}
                    />
                  </label>
                  <label className="checkbox">
                    <input type="checkbox" checked={useProxy} onChange={(e) => setUseProxy(e.target.checked)} />
                    Limit maksymalny (auto-bid do Twojego max)
                  </label>
                  {useProxy && (
                    <label>
                      Max, ile chcesz zapłacić
                      <input
                        type="number"
                        min={minBid}
                        max={maxBidAllowed ?? undefined}
                        step="1"
                        required
                        value={maxAmount}
                        onChange={(e) => setMaxAmount(e.target.value)}
                      />
                    </label>
                  )}
                  {buyNowPrice != null && (
                    <p className="hint">
                      Licytuj poniżej {formatPln(buyNowPrice)}. Od tej kwoty w górę tylko „Kup teraz”.
                    </p>
                  )}
                  {error && <p className="error">{error}</p>}
                  <button className="btn btn-primary btn-lg" disabled={busy} type="submit">
                    {busy ? 'Składanie…' : 'Licytuj'}
                  </button>
                  {buyNowPrice != null && (
                    <button className="btn btn-outline btn-lg" type="button" disabled={busy} onClick={openBuyNow}>
                      Kup teraz · {formatPln(buyNowPrice)}
                    </button>
                  )}
                  <p className="hint">Oferta w ostatnich 3 minutach przedłuża aukcję o 3 minuty.</p>
                </form>
              )}
            </div>
          )}

          {!live && auction.status === 'sold' && (
            <div className="sold-box">
              <p className="success">
                Sprzedane
                {isWinner ? ' — wygrałeś!' : isSeller ? ' — Twój przedmiot znalazł nabywcę.' : '.'}
              </p>
              {canChat && (
                <button type="button" className="btn btn-primary" disabled={chatBusy} onClick={() => void openChat()}>
                  {chatBusy ? 'Otwieranie…' : isSeller ? 'Napisz do kupującego' : 'Napisz do sprzedawcy'}
                </button>
              )}
              {!user && <p className="hint">Zaloguj się, żeby napisać po zakupie.</p>}

              {canRateSeller && (
                <div className="seller-rate-box">
                  {myRating ? (
                    <p className="muted">
                      Twoja ocena sprzedawcy: <strong>{myRating.score}/5</strong>
                      {myRating.comment ? ` — „${myRating.comment}”` : ''}
                    </p>
                  ) : (
                    <form className="seller-rate-form" onSubmit={(e) => void submitSellerRating(e)}>
                      <h3>Oceń sprzedawcę</h3>
                      <p className="muted">Tylko Ty jako kupujący możesz wystawić ocenę za tę transakcję.</p>
                      <div className="star-picker" role="group" aria-label="Ocena od 1 do 5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            className={`star-btn ${rateScore >= n ? 'is-on' : ''}`}
                            aria-label={`${n} na 5`}
                            onClick={() => setRateScore(n)}
                          >
                            ★
                          </button>
                        ))}
                      </div>
                      <label>
                        Komentarz (opcjonalnie)
                        <textarea
                          rows={2}
                          maxLength={500}
                          value={rateComment}
                          onChange={(e) => setRateComment(e.target.value)}
                          placeholder="Np. Szybka wysyłka, zgodne z opisem…"
                        />
                      </label>
                      {rateError && <p className="error">{rateError}</p>}
                      <button className="btn btn-outline" type="submit" disabled={rateBusy}>
                        {rateBusy ? 'Zapisywanie…' : `Wyślij ocenę ${rateScore}/5`}
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          )}

          {!live && auction.status === 'ended' && (
            <div className="sold-box">
              <p className="muted">Aukcja zakończona — nikt nie kupił.</p>
              {isSeller && (
                <Link to={`/sell?relist=${auction.id}`} className="btn btn-primary">
                  Wystaw ponownie
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      <section className="section-block">
        <h2>Opis</h2>
        <p className="description">{auction.description || 'Brak opisu.'}</p>
        <p className="muted">Dostawa: {auction.shipping_options?.join(', ') || 'do uzgodnienia'}</p>
        {!isSeller && auction.moderation_status === 'approved' && (
          <ReportAuction auctionId={auction.id} userId={user?.id ?? null} />
        )}
        {Array.isArray(auction.seller_notes) && auction.seller_notes.length > 0 && (
          <div className="seller-notes">
            <h3>Notatki sprzedawcy</h3>
            <ul>
              {(auction.seller_notes as SellerNote[]).map((n, i) => (
                <li key={`${n.created_at}-${i}`}>
                  <p>{n.body}</p>
                  <time className="muted">
                    {n.created_at ? new Date(n.created_at).toLocaleString('pl-PL') : ''}
                  </time>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="section-block">
        <h2>Historia ofert</h2>
        {bids.length === 0 ? (
          <p className="muted">Brak ofert — bądź pierwszy.</p>
        ) : (
          <ul className="bid-list">
            {bids.map((b) => (
              <li key={b.id}>
                <strong>{formatPln(b.amount)}</strong>
                <span>{b.bidder?.display_name || 'Użytkownik'}</span>
                <time>{new Date(b.created_at).toLocaleString('pl-PL')}</time>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="section-block auction-comments">
        <h2>
          Pytania i odpowiedzi{' '}
          {comments.filter((c) => !c.parent_id).length > 0
            ? `(${comments.filter((c) => !c.parent_id).length})`
            : ''}
        </h2>
        {comments.filter((c) => !c.parent_id).length === 0 ? (
          <p className="muted">Brak pytań — zadaj pytanie sprzedawcy.</p>
        ) : (
          <ul className="comment-list">
            {comments
              .filter((c) => !c.parent_id)
              .map((c) => {
                const replies = comments.filter((r) => r.parent_id === c.id)
                return (
                  <li key={c.id} className="comment-thread">
                    <div className="comment-head">
                      <strong>{c.author?.display_name || c.author?.username || 'Użytkownik'}</strong>
                      <time className="muted">{new Date(c.created_at).toLocaleString('pl-PL')}</time>
                    </div>
                    <p className="comment-body">{c.body}</p>
                    <div className="comment-actions">
                      {user && (c.author_id === user.id || isAdmin) && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          disabled={commentBusy}
                          onClick={() => void deleteComment(c.id)}
                        >
                          Usuń
                        </button>
                      )}
                      {isSeller && replyToId !== c.id && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={() => {
                            setReplyToId(c.id)
                            setReplyBody('')
                            setCommentError(null)
                          }}
                        >
                          Odpowiedz
                        </button>
                      )}
                    </div>

                    {replies.length > 0 && (
                      <ul className="comment-replies">
                        {replies.map((r) => (
                          <li key={r.id} className="comment-reply">
                            <div className="comment-head">
                              <strong>
                                {r.author?.display_name || r.author?.username || 'Sprzedawca'}
                                <span className="comment-seller-badge">Sprzedawca</span>
                              </strong>
                              <time className="muted">{new Date(r.created_at).toLocaleString('pl-PL')}</time>
                            </div>
                            <p className="comment-body">{r.body}</p>
                            {user && (r.author_id === user.id || isAdmin) && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-xs"
                                disabled={commentBusy}
                                onClick={() => void deleteComment(r.id)}
                              >
                                Usuń
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}

                    {isSeller && replyToId === c.id && (
                      <form className="comment-form comment-reply-form" onSubmit={(e) => void submitComment(e, c.id)}>
                        <label>
                          Twoja odpowiedź
                          <textarea
                            rows={2}
                            maxLength={1000}
                            value={replyBody}
                            autoFocus
                            onChange={(e) => {
                              setReplyBody(e.target.value)
                              setCommentError(null)
                            }}
                            placeholder="Odpowiedź dla kupującego…"
                          />
                        </label>
                        <div className="comment-actions">
                          <button className="btn btn-outline btn-sm" type="submit" disabled={commentBusy}>
                            {commentBusy ? 'Wysyłanie…' : 'Wyślij odpowiedź'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            disabled={commentBusy}
                            onClick={() => {
                              setReplyToId(null)
                              setReplyBody('')
                            }}
                          >
                            Anuluj
                          </button>
                        </div>
                      </form>
                    )}
                  </li>
                )
              })}
          </ul>
        )}

        {user && !isSeller ? (
          <form className="comment-form" onSubmit={(e) => void submitComment(e)}>
            <label>
              Zadaj pytanie
              <textarea
                rows={3}
                maxLength={1000}
                value={commentBody}
                onChange={(e) => {
                  setCommentBody(e.target.value)
                  setCommentError(null)
                }}
                placeholder="Pytanie o stan, wysyłkę, odbiór…"
              />
            </label>
            {commentError && <p className="error">{commentError}</p>}
            <button className="btn btn-outline" type="submit" disabled={commentBusy}>
              {commentBusy ? 'Wysyłanie…' : 'Dodaj pytanie'}
            </button>
          </form>
        ) : user && isSeller ? (
          <p className="muted">Jako sprzedawca odpowiadasz w wątku pod pytaniem kupującego.</p>
        ) : (
          <p className="muted">
            <Link to={`/login?next=/auction/${id}`}>Zaloguj się</Link>, żeby zadać pytanie.
          </p>
        )}
        {commentError && isSeller && <p className="error">{commentError}</p>}
      </section>

      {auction.lat != null && auction.lng != null && (
        <section className="section-block">
          <h2>Lokalizacja</h2>
          <LocationMapView lat={Number(auction.lat)} lng={Number(auction.lng)} city={auction.city} />
        </section>
      )}

      <Modal open={buyNowOpen} title="Kup teraz" onClose={() => !busy && setBuyNowOpen(false)}>
        <div className="buy-now-modal">
          {img && (
            <div className="buy-now-thumb">
              <img src={img} alt="" />
            </div>
          )}
          <div className="buy-now-info">
            <h3>{auction.title}</h3>
            <p className="muted">Aukcja zakończy się natychmiast. Kupujesz za stałą cenę.</p>
            <div className="buy-now-price">
              <span className="label">Do zapłaty</span>
              <strong>{formatPln(auction.buy_now_price)}</strong>
            </div>
            {buyNowError && <p className="error">{buyNowError}</p>}
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setBuyNowOpen(false)}>
                Anuluj
              </button>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void confirmBuyNow()}>
                {busy ? 'Kupowanie…' : `Potwierdź · ${formatPln(auction.buy_now_price)}`}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      <Modal open={endOpen} title="Zakończ aukcję" onClose={() => !busy && setEndOpen(false)}>
        <div className="buy-now-modal">
          <div className="buy-now-info">
            <h3>{auction.title}</h3>
            {Number(auction.bid_count) > 0 ? (
              <p className="muted">
                Są oferty — aukcja zakończy się sprzedażą dla najwyższej oferty (
                {formatPln(auction.current_price)}). Kupujący dostanie czat.
              </p>
            ) : (
              <p className="muted">Brak ofert — aukcja zostanie oznaczona jako zakończona bez sprzedaży.</p>
            )}
            {endError && <p className="error">{endError}</p>}
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setEndOpen(false)}>
                Anuluj
              </button>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void confirmEndAuction()}>
                {busy ? 'Kończenie…' : 'Potwierdź zakończenie'}
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
