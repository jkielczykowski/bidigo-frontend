// The map of parcel lockers, in its own page (iframe of the checkout): Bidigo's styles cannot break InPost's Geowidget v5
// and the other way round. Talks to the parent with postMessage only (same origin):
//   → {bidigoLocker: true, id, event: 'ready' | 'point' | 'error', point?}
// Query: token (InPost's PUBLIC map token), env (sandbox|production), id (message id), lang.
import { HOSTS, cropHeight, parsePlaces, pointKind } from './lib.js'

const q = new URLSearchParams(location.search)
const token = q.get('token') || ''
const host = HOSTS[q.get('env') === 'production' ? 'production' : 'sandbox']
const id = q.get('id') || 'locker'
const send = (event, extra) => parent.postMessage({ bidigoLocker: true, id, event, ...extra }, location.origin)

function loadAssets() {
  return new Promise((resolve, reject) => {
    const css = document.createElement('link')
    css.rel = 'stylesheet'
    css.href = host + '/inpost-geowidget.css'
    document.head.appendChild(css)
    const js = document.createElement('script')
    js.src = host + '/inpost-geowidget.js'
    js.onload = resolve
    js.onerror = () => reject(new Error('geowidget'))
    document.head.appendChild(js)
  })
}

function build() {
  let api = null
  const root = document.body
  root.style.cssText = 'display:flex;flex-direction:column;overflow:hidden;height:100%'
  const gw = document.createElement('inpost-geowidget') // created here: moving it would run its connectedCallback twice
  for (const [k, v] of Object.entries({ token, language: q.get('lang') || 'pl', config: 'parcelCollect', onpoint: id })) gw.setAttribute(k, v)
  gw.addEventListener('inpost.geowidget.init', (e) => {
    api = e.detail && e.detail.api
    if (api) api.changePointsType('PARCEL_LOCKER') // lockers only; PaczkoPunkty are filtered out of the map
    send('ready')
  })

  let last = 0
  const onPoint = (ev) => {
    const p = ev.detail || ev.details
    const now = Date.now()
    if (now - last < 300) return // the widget may announce a point twice (event and callback)
    last = now
    const kind = pointKind(p)
    if (kind === 'locker') send('point', { point: JSON.parse(JSON.stringify(p)) })
    else send('error', { reason: kind })
  }
  document.addEventListener(id, onPoint)
  window[id] = (p) => onPoint({ detail: p })

  const wrap = document.createElement('div')
  wrap.style.cssText = 'position:relative;flex:1;min-height:0;overflow:hidden'
  const fit = () => { gw.style.cssText = 'display:block;position:absolute;left:0;right:0;bottom:0;top:-' + cropHeight(wrap.clientWidth) + 'px' }
  window.addEventListener('resize', fit)
  wrap.appendChild(gw)

  // search box above the map: Geowidget only finds points, so places are centred by us (Bidigo's city proxy)
  const uid = 'sug'
  const form = document.createElement('form')
  form.setAttribute('role', 'search')
  form.style.cssText = 'position:relative;display:flex;gap:8px;padding:8px;background:#fff;border-bottom:1px solid #e6eaf0;box-sizing:border-box;z-index:1000'
  const input = document.createElement('input')
  input.type = 'search'
  input.placeholder = 'Wpisz miejscowość lub adres'
  input.autocomplete = 'off'
  input.setAttribute('aria-label', 'Wpisz miejscowość lub adres')
  input.setAttribute('role', 'combobox')
  input.setAttribute('aria-autocomplete', 'list')
  input.setAttribute('aria-expanded', 'false')
  input.setAttribute('aria-controls', uid)
  input.style.cssText = 'flex:1;min-width:0;padding:10px 12px;font:16px system-ui,sans-serif;border:1px solid #d9dee8;border-radius:10px;color:#1a2744' // 16px: iOS does not zoom on focus
  const btn = document.createElement('button')
  btn.type = 'submit'
  btn.textContent = 'Szukaj'
  btn.style.cssText = 'padding:10px 16px;font:600 14px system-ui,sans-serif;background:#1a2744;color:#fff;border:0;border-radius:10px;cursor:pointer'
  const list = document.createElement('ul')
  list.id = uid
  list.setAttribute('role', 'listbox')
  list.style.cssText = 'display:none;position:absolute;left:8px;right:8px;top:100%;margin:0;padding:0;list-style:none;background:#fff;border:1px solid #d9dee8;border-top:0;border-radius:0 0 10px 10px;box-shadow:0 8px 20px rgba(26,39,68,.18);max-height:260px;overflow:auto;font:14px system-ui,sans-serif'
  form.append(input, btn, list)

  let items = [], active = -1, timer = null, ctrl = null, lastQuery = ''
  const close = () => { list.style.display = 'none'; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); active = -1 }
  const highlight = (i) => {
    active = i
    ;[...list.children].forEach((li, j) => { li.style.background = j === i ? '#eef2f8' : ''; li.setAttribute('aria-selected', j === i ? 'true' : 'false') })
    if (i >= 0) { input.setAttribute('aria-activedescendant', list.children[i].id); list.children[i].scrollIntoView({ block: 'nearest' }) }
  }
  const choose = (it) => {
    input.value = it.label + (it.detail ? ' (' + it.detail + ')' : '')
    close()
    const go = () => api.changePosition({ longitude: it.lng, latitude: it.lat }, it.zoom)
    if (api) go(); else gw.addEventListener('inpost.geowidget.init', go, { once: true })
  }
  const render = (arr, empty) => {
    items = arr
    list.textContent = ''
    if (!arr.length && !empty) return close()
    arr.forEach((it, i) => {
      const li = document.createElement('li')
      li.id = uid + '-' + i
      li.setAttribute('role', 'option')
      li.style.cssText = 'padding:10px 12px;cursor:pointer;border-top:1px solid #eef2f8'
      const b = document.createElement('b'); b.textContent = it.label
      const sm = document.createElement('div'); sm.textContent = it.detail; sm.style.cssText = 'font-size:12px;color:#6b7280'
      li.append(b, sm)
      li.addEventListener('mousedown', (e) => { e.preventDefault(); choose(it) })
      li.addEventListener('touchend', (e) => { e.preventDefault(); choose(it) })
      list.appendChild(li)
    })
    if (!arr.length) { const li = document.createElement('li'); li.textContent = empty; li.style.cssText = 'padding:10px 12px;color:#6b7280'; list.appendChild(li) }
    list.style.display = 'block'
    input.setAttribute('aria-expanded', 'true')
    active = -1
  }
  const places = async (text) => {
    if (ctrl) ctrl.abort()
    ctrl = new AbortController()
    const r = await fetch('/api/search/cities?q=' + encodeURIComponent(text), { signal: ctrl.signal })
    if (!r.ok) throw new Error('cities ' + r.status)
    return parsePlaces(await r.json())
  }
  const suggest = async (text) => {
    lastQuery = text
    const arr = await places(text)
    if (text === lastQuery) render(arr, 'Brak miejscowości o takiej nazwie')
    return arr
  }
  input.addEventListener('input', () => {
    clearTimeout(timer)
    const t = input.value.trim()
    lastQuery = t
    if (t.length < 3) { if (ctrl) ctrl.abort(); return close() }
    timer = setTimeout(() => suggest(t).catch(() => {}), 350)
  })
  input.addEventListener('keydown', (e) => {
    const open = list.style.display === 'block' && items.length
    if (e.key === 'ArrowDown' && open) { e.preventDefault(); highlight((active + 1) % items.length) }
    else if (e.key === 'ArrowUp' && open) { e.preventDefault(); highlight(active <= 0 ? items.length - 1 : active - 1) }
    else if (e.key === 'Escape') close()
    else if (e.key === 'Enter' && open && active >= 0) { e.preventDefault(); choose(items[active]) }
  })
  input.addEventListener('blur', () => setTimeout(close, 200))
  form.addEventListener('submit', (ev) => {
    ev.preventDefault()
    clearTimeout(timer)
    const t = input.value.trim()
    if (t.length < 2) return
    suggest(t).then((arr) => { if (arr.length) choose(arr[0]) }).catch(() => { if (api) api.search(t) }) // no geocoder: fall back to the widget's own point search
  })

  root.append(form, wrap)
  fit()
}

if (!token) send('error', { reason: 'no_token' })
else loadAssets().then(build).catch(() => send('error', { reason: 'load' }))
