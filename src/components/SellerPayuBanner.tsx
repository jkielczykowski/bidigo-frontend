import { useEffect, useState } from 'react'
import { connectPayuSandbox, fetchMyPayuAccount, fetchPayuStatus, type PayuStatus } from '../lib/ordersApi'
import { sellerPayuMessage, type SellerPayuAccount } from '../lib/payuReturn'
import { errorMessage } from '../lib/errors'
import '../pages/shipping.css'

/** Stan konta PayU sprzedającego („konto PayU do połączenia”) z przyciskiem łączenia konta testowego w sandboxie; null, gdy wszystko w porządku. */
export function SellerPayuBanner() {
  const [account, setAccount] = useState<SellerPayuAccount | null>(null)
  const [payu, setPayu] = useState<PayuStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    void fetchMyPayuAccount().then(setAccount).catch(() => setAccount(null))
    void fetchPayuStatus().then(setPayu).catch(() => setPayu(null))
  }, [])
  const msg = account ? sellerPayuMessage(account) : null
  if (!msg) return null
  return (
    <div className="pay-banner" role="note" data-testid="seller-payu">
      <strong>{msg.title}</strong>
      <p>{msg.body}</p>
      {account?.status === 'not_connected' && payu?.testMode && payu.marketplaceEnabled && (
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => {
          setBusy(true)
          void connectPayuSandbox().then(() => fetchMyPayuAccount().then(setAccount)).catch((e) => setError(errorMessage(e, 'Nie udało się połączyć konta'))).finally(() => setBusy(false))
        }}>
          Połącz konto PayU (sandbox, konto testowe)
        </button>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  )
}
