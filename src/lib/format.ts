export function formatPln(value: number | string | null | undefined) {
  const n = typeof value === 'string' ? Number(value) : value ?? 0
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    maximumFractionDigits: 2,
  }).format(n)
}

/** Polish plural for auction bids / "podbicia". */
export function bidLabel(count: number | null | undefined) {
  const n = Number(count ?? 0)
  if (n <= 0) return 'Brak podbić'
  if (n === 1) return '1 podbicie'
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} podbicia`
  return `${n} podbić`
}

export function formatRemaining(endsAt: string, now = Date.now()) {
  const ms = new Date(endsAt).getTime() - now
  if (ms <= 0) return 'Zakończona'
  const totalSec = Math.floor(ms / 1000)
  const d = Math.floor(totalSec / 86400)
  const h = Math.floor((totalSec % 86400) / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (d > 0) return `${d} ${d === 1 ? 'dzień' : 'dni'} ${h} godz.`
  return [h, m, s].map((x) => String(x).padStart(2, '0')).join(':')
}

/** Home-card countdown: "3 dni 8 godz." while a day or more is left, then HH:MM:SS */
export function formatCountdown(endsAt: string, now = Date.now()) {
  const ms = new Date(endsAt).getTime() - now
  if (ms <= 0) return '00:00:00'
  const totalSec = Math.floor(ms / 1000)
  const d = Math.floor(totalSec / 86400)
  const h = Math.floor((totalSec % 86400) / 3600)
  if (d > 0) return `${d} ${d === 1 ? 'dzień' : 'dni'} ${h} godz.`
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  return [h, m, s].map((x) => String(x).padStart(2, '0')).join(':')
}

/** End moment in Polish time: "24.10, 23:59" (year only when it differs from now) */
export function formatEndsAt(endsAt: string, now = Date.now()) {
  const end = new Date(endsAt)
  const sameYear = end.getFullYear() === new Date(now).getFullYear()
  return end
    .toLocaleString('pl-PL', {
      timeZone: 'Europe/Warsaw',
      day: '2-digit',
      month: '2-digit',
      ...(sameYear ? {} : { year: 'numeric' }),
      hour: '2-digit',
      minute: '2-digit',
    })
}

export function ofertLabel(count: number | null | undefined) {
  const n = Number(count ?? 0)
  if (n === 1) return '1 oferta'
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} oferty`
  return `${n} ofert`
}

export function minNextBid(currentPrice: number, startingPrice: number, bidIncrement: number, bidCount: number) {
  if (bidCount === 0) return Number(startingPrice)
  return Number(currentPrice) + Number(bidIncrement)
}

/** Success fee: % of sale, at least minFee, at most maxFee (null: no cap) — the rate of the category (V51) */
export function calcSuccessFee(salePrice: number, feePercent: number, minFee = 2, maxFee: number | null = 150) {
  const fee = Math.max(minFee, Math.round(salePrice * feePercent) / 100)
  return maxFee === null ? fee : Math.min(maxFee, fee)
}
