// Pure helpers of the parcel-locker map frame (no DOM): shared by frame.js and by the node tests.

export const HOSTS = {
  production: 'https://geowidget.inpost.pl',
  sandbox: 'https://sandbox-easy-geowidget-sdk.easypack24.net',
}

/** Geowidget draws its own header (location, flags, second search) in a cross-origin frame: it is hidden by cropping the top. */
export function cropHeight(width) {
  return width > 450 ? 182 : width > 322 ? 213 : 237
}

/** How close the map zooms for a kind of place. */
export function zoomFor(kind) {
  return kind === 'village' || kind === 'hamlet' || kind === 'suburb' ? 14 : 13
}

/** Bidigo's /api/search/cities answer → suggestions for the search box (max 8, no empty names). */
export function parsePlaces(data) {
  const out = []
  const seen = new Set()
  for (const p of (data && data.places) || []) {
    if (!p || !p.name || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue
    const label = String(p.name)
    const detail = p.displayName && p.displayName !== p.name ? String(p.displayName).slice(label.length).replace(/^,\s*/, '') : ''
    const key = label + '|' + detail
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ label, detail, lat: p.lat, lng: p.lng, zoom: zoomFor(p.kind) })
    if (out.length === 8) break
  }
  return out
}

/** Only parcel lockers may be chosen: a PaczkoPunkt (type without parcel_locker) is refused. */
export function pointKind(p) {
  if (!p || !/^[A-Z]{3}[0-9]{2,3}[A-Z]{0,4}$/.test(String(p.name || ''))) return 'invalid'
  if (Array.isArray(p.type) && p.type.length && !p.type.includes('parcel_locker')) return 'not_locker'
  return 'locker'
}
