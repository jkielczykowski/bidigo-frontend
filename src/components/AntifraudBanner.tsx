import { Link } from 'react-router-dom'
import { afNotice, awaitingExplanation, type AfStatus } from '../lib/antifraud'
import './AntifraudBanner.css'

type Props = {
  status: AfStatus | null
  /** Only the block (next to the bid form, the listing form) — no 1/3 and 2/3 warnings */
  blockOnly?: boolean
}

/**
 * Warning 1/3, 2/3 and the block from the anti-fraud system (my_antifraud_status), plus a nudge when the user has a case
 * waiting for their explanation. Everything leads to /my/security, where the explanation and appeal forms are.
 */
export function AntifraudBanner({ status, blockOnly }: Props) {
  const notice = afNotice(status)
  const waiting = awaitingExplanation(status)

  if (blockOnly && notice?.kind !== 'blocked') return null

  return (
    <>
      {notice && (
        <div
          className={`af-banner af-banner-${notice.kind}`}
          role={notice.kind === 'blocked' ? 'alert' : 'status'}
          data-testid="antifraud-banner"
        >
          <div>
            <p className="af-banner-title">{notice.title}</p>
            <p className="af-banner-body">{notice.body}</p>
          </div>
          <Link to="/my/security" className="btn btn-primary">
            Szczegóły i odwołanie
          </Link>
        </div>
      )}
      {!blockOnly && waiting.length > 0 && (
        <div className="af-banner" role="status" data-testid="antifraud-explain-banner">
          <div>
            <p className="af-banner-title">
              {waiting.length === 1 ? 'Jedno zgłoszenie czeka' : `Zgłoszenia czekają (${waiting.length})`} na Twoje wyjaśnienia
            </p>
            <p className="af-banner-body">Nic nie zostało jeszcze naliczone. Opisz swoją wersję w ciągu {status?.explanation_days} dni.</p>
          </div>
          <Link to="/my/security" className="btn btn-primary">
            Wyjaśnij
          </Link>
        </div>
      )}
    </>
  )
}
