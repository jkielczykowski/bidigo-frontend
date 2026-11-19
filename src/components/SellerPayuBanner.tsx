import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { connectPayuSandbox, fetchMyPayuAccount, fetchPayuStatus, type PayuStatus } from '../lib/ordersApi'
import { sellerPayuMessage, type SellerPayuAccount } from '../lib/payuReturn'
import { sellerKycMessage, type KycStatus } from '../lib/sellerKyc'
import { fetchKyc } from '../lib/sellerKycApi'
import { errorMessage } from '../lib/errors'
import '../pages/shipping.css'

/**
 * Stan danych do wypłaty sprzedającego z linkiem do ekranu /my/payout; null, gdy wszystko w porządku.
 * Przycisk konta testowego (sandbox) zostaje tylko w trybie testowym i dopóki sprzedający nie zaczął prawdziwej weryfikacji.
 */
export function SellerPayuBanner() {
  const [account, setAccount] = useState<SellerPayuAccount | null>(null)
  const [payu, setPayu] = useState<PayuStatus | null>(null)
  const [kyc, setKyc] = useState<KycStatus | null | undefined>(undefined) // undefined = jeszcze wczytujemy, null = API niedostępne
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    void fetchMyPayuAccount().then(setAccount).catch(() => setAccount(null))
    void fetchPayuStatus().then(setPayu).catch(() => setPayu(null))
    void fetchKyc().then((s) => setKyc(s.status)).catch(() => setKyc(null))
  }, [])
  if (!account || kyc === undefined) return null
  // bez umowy marketplace (albo gdy konto jest już zweryfikowane po staremu) zostaje dotychczasowy komunikat
  const legacy = !account.marketplaceReady || kyc === null ? sellerPayuMessage(account) : null
  const msg = legacy ? { ...legacy, cta: null as string | null } : kyc === 'verified' ? null : sellerKycMessage(kyc)
  if (!msg) return null
  const sandboxButton = payu?.testMode && payu.marketplaceEnabled && account.status === 'not_connected' && (kyc === null || kyc === 'not_started')
  return (
    <div className="pay-banner" role="note" data-testid="seller-payu">
      <strong>{msg.title}</strong>
      <p>{msg.body}</p>
      {msg.cta && <Link className="btn btn-primary btn-sm" to="/my/payout" data-testid="seller-payu-link">{msg.cta}</Link>}
      {sandboxButton && (
        <p>
          <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => {
            setBusy(true)
            void connectPayuSandbox().then(() => fetchMyPayuAccount().then(setAccount)).catch((e) => setError(errorMessage(e, 'Nie udało się połączyć konta'))).finally(() => setBusy(false))
          }}>
            Połącz konto testowe (tryb testowy)
          </button>
        </p>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  )
}
