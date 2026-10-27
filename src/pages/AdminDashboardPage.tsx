import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AdminShell } from '../components/AdminShell'
import { adminSummary, PERIODS, plural, type AdminSummary, type SummaryPeriod } from '../lib/adminApi'
import { formatPln } from '../lib/format'

function bucketLabel(bucket: string, grain: AdminSummary['grain']) {
  const [y, m, d] = bucket.split('-')
  return grain === 'month' ? `${m}.${y}` : `${d}.${m}`
}

/** Single-series bars, one per day (or month); hover/focus shows the value. */
function BarChart({
  title,
  series,
  grain,
  value,
  tip,
  variant,
}: {
  title: string
  series: AdminSummary['series']
  grain: AdminSummary['grain']
  value: (p: AdminSummary['series'][number]) => number
  tip: (p: AdminSummary['series'][number]) => string
  variant?: 'issued'
}) {
  const max = Math.max(...series.map(value), 0)
  return (
    <>
      <div className={`admin-chart ${variant === 'issued' ? 'is-issued' : ''}`} role="img" aria-label={title}>
        {series.map((p) => (
          <div key={p.bucket} className="admin-chart-bar" tabIndex={0}>
            <span style={{ height: max > 0 ? `${(value(p) / max) * 100}%` : '0' }} />
            <div className="admin-chart-tip">
              {bucketLabel(p.bucket, grain)}: {tip(p)}
            </div>
          </div>
        ))}
      </div>
      {series.length > 0 && (
        <div className="admin-chart-axis">
          <span>{bucketLabel(series[0].bucket, grain)}</span>
          {series.length > 1 && <span>{bucketLabel(series[series.length - 1].bucket, grain)}</span>}
        </div>
      )}
    </>
  )
}

export function AdminDashboardPage() {
  const [params, setParams] = useSearchParams()
  const period = (PERIODS.find((p) => p.id === params.get('okres'))?.id ?? '30d') as SummaryPeriod
  const [data, setData] = useState<AdminSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setError(null)
    adminSummary(period)
      .then((d) => alive && setData(d))
      .catch((e: Error) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [period])

  const periodLabel = PERIODS.find((p) => p.id === period)!.label.toLowerCase()

  return (
    <AdminShell
      title="Podsumowanie"
      subtitle="Opłaty prowizyjne i użytkownicy Bidigo"
      actions={
        <div className="admin-chips" role="group" aria-label="Okres">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              className="admin-chip"
              aria-pressed={p.id === period}
              onClick={() => setParams(p.id === '30d' ? {} : { okres: p.id }, { replace: true })}
            >
              {p.label}
            </button>
          ))}
        </div>
      }
    >
      {error && <p className="error">{error}</p>}
      {data && (
        <>
          <div className="admin-stats" data-testid="admin-summary">
            <div className="admin-stat" data-stat="payments">
              <div className="label">Wykonane płatności</div>
              <div className="value">{data.payments_count}</div>
              <div className="hint">
                {plural(data.paid_fee_count, 'prowizja', 'prowizje', 'prowizji')} · {periodLabel}
              </div>
            </div>
            <div className="admin-stat ok" data-stat="paid">
              <div className="label">Opłacono</div>
              <div className="value">{formatPln(data.paid_amount)}</div>
              <div className="hint">wpłaty przez Stripe · {periodLabel}</div>
            </div>
            <div className="admin-stat warn" data-stat="pending">
              <div className="label">Do zapłaty</div>
              <div className="value">{formatPln(data.pending_amount)}</div>
              <div className="hint">{plural(data.pending_count, 'prowizja', 'prowizje', 'prowizji')} w terminie · teraz</div>
            </div>
            <div className="admin-stat bad" data-stat="overdue">
              <div className="label">Zaległe</div>
              <div className="value">{formatPln(data.overdue_amount)}</div>
              <div className="hint">
                <Link to="/admin/users?blokada=1">{plural(data.blocked_users, 'zablokowane konto', 'zablokowane konta', 'zablokowanych kont')}</Link> · teraz
              </div>
            </div>
          </div>

          <div className="admin-grid-2">
            <section className="admin-card">
              <div className="admin-card-head">
                <h2>Opłacone prowizje</h2>
                <span className="admin-muted">{data.grain === 'month' ? 'miesięcznie' : 'dziennie'}, zł</span>
              </div>
              <BarChart
                title="Opłacone prowizje w czasie"
                series={data.series}
                grain={data.grain}
                value={(p) => p.paid_amount}
                tip={(p) => `${formatPln(p.paid_amount)} · ${p.payments} płatn.`}
              />
            </section>
            <section className="admin-card">
              <div className="admin-card-head">
                <h2>Naliczone prowizje</h2>
                <span className="admin-muted">
                  {data.issued_count} za {formatPln(data.issued_amount)}
                </span>
              </div>
              <BarChart
                title="Naliczone prowizje w czasie"
                series={data.series}
                grain={data.grain}
                value={(p) => p.issued_amount}
                tip={(p) => formatPln(p.issued_amount)}
                variant="issued"
              />
            </section>
          </div>

          <div className="admin-stats" style={{ marginTop: 20 }}>
            <div className="admin-stat">
              <div className="label">Użytkownicy</div>
              <div className="value">{data.users_total}</div>
              <div className="hint">
                +{data.users_new} nowych · {periodLabel}
              </div>
            </div>
            <div className="admin-stat">
              <div className="label">Wystawione rozliczenia</div>
              <div className="value">{data.settlements_issued}</div>
              <div className="hint">{periodLabel}</div>
            </div>
            <div className="admin-stat">
              <div className="label">Naliczone prowizje</div>
              <div className="value">{formatPln(data.issued_amount)}</div>
              <div className="hint">
                {data.issued_count} sprzedaży · {periodLabel}
              </div>
            </div>
          </div>
        </>
      )}
    </AdminShell>
  )
}
