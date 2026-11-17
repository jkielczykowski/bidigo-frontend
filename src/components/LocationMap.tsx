/** Google Maps embed — same approach as FluffyTag (no Maps JS API key). */

type MapViewProps = {
  lat: number
  lng: number
  city?: string | null
  className?: string
  /** Soften pin for privacy (~city block) */
  approximate?: boolean
  zoom?: number
}

function soften(lat: number, lng: number) {
  return {
    lat: Math.round(lat * 200) / 200,
    lng: Math.round(lng * 200) / 200,
  }
}

function googleEmbedUrl(lat: number, lng: number, zoom: number) {
  return `https://www.google.com/maps?q=${lat},${lng}&hl=pl&z=${zoom}&output=embed`
}

export function LocationMapView({ lat, lng, city, className, approximate = true, zoom = 12 }: MapViewProps) {
  const point = approximate ? soften(lat, lng) : { lat, lng }
  const src = googleEmbedUrl(point.lat, point.lng, zoom)

  return (
    <div className={`location-map ${className || ''}`}>
      <iframe
        className="location-map-canvas"
        title={city ? `Mapa: ${city}` : 'Mapa lokalizacji'}
        src={src}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />
      {city && <p className="location-map-caption muted">{city} · lokalizacja orientacyjna</p>}
      <p className="location-map-caption">
        <a
          href={`https://www.google.com/maps?q=${point.lat},${point.lng}&hl=pl`}
          target="_blank"
          rel="noreferrer"
        >
          Otwórz w Google Maps
        </a>
      </p>
    </div>
  )
}

type MapPickerProps = {
  lat: number | null
  lng: number | null
  city?: string | null
  className?: string
}

/** Preview only — choose place via CitySuggest (FluffyTag-style text search). */
export function LocationMapPicker({ lat, lng, city, className }: MapPickerProps) {
  if (lat == null || lng == null) {
    return (
      <div className={`location-map location-map--picker ${className || ''}`}>
        <p className="location-map-hint muted">
          Wyszukaj miejscowość powyżej — na mapie Google pojawi się pinezka.
        </p>
        <div className="location-map-placeholder">Wybierz miejscowość, żeby zobaczyć mapę</div>
      </div>
    )
  }

  return (
    <div className={`location-map location-map--picker ${className || ''}`}>
      <p className="location-map-hint muted">Podgląd lokalizacji na Google Maps — kupujący zobaczy orientacyjną pinezkę.</p>
      <LocationMapView lat={lat} lng={lng} city={city} approximate={false} zoom={13} />
    </div>
  )
}
