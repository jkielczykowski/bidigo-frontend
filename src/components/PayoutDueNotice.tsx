import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { payoutBlocked, type KycStatus } from '../lib/sellerKyc'
import { fetchKyc } from '../lib/sellerKycApi'
import { formatPln } from '../lib/format'
import '../pages/shipping.css'
import '../pages/payout.css'

/** „Masz X zł do odebrania, podaj dane do wypłaty”: tylko gdy sprzedający ma pieniądze w drodze, a dane do wypłaty nie są zweryfikowane. */
export function PayoutDueNotice({ amount }: { amount: number }) {
  const [status, setStatus] = useState<KycStatus | null | undefined>(undefined)
  useEffect(() => {
    void fetchKyc().then((s) => setStatus(s.status)).catch(() => setStatus(null))
  }, [])
  if (amount <= 0 || !status || !payoutBlocked(status)) return null
  const waiting = status === 'pending'
  return (
    <div className="pay-banner payout-due" role="note" data-testid="payout-due">
      <strong>Masz {formatPln(amount)} do odebrania</strong>
      <p>
        {waiting
          ? 'Operator płatności weryfikuje Twoje dane. Gdy skończy, pieniądze będzie można wypłacić po potwierdzeniu odbioru przez kupującego.'
          : 'Żeby wypłata mogła do Ciebie trafić, podaj dane do wypłaty. To jednorazowe i zajmuje kilka minut.'}
      </p>
      <Link className="btn btn-primary btn-sm" to="/my/payout">{waiting ? 'Zobacz stan weryfikacji' : 'Podaj dane do wypłaty'}</Link>
    </div>
  )
}
