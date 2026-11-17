import { PAY_MESSAGES, type PayState } from '../lib/payuReturn'

/** Stan płatności PayU po powrocie na stronę: oczekuje / udana / nieudana. Nic tu nie potwierdza płatności, tylko ją opisuje. */
export function PaymentStateBanner({ state, action }: { state: PayState; action?: React.ReactNode }) {
  const m = PAY_MESSAGES[state]
  return (
    <div className={`pay-banner pay-${state}`} role={state === 'failed' ? 'alert' : 'status'}>
      <strong>{m.title}</strong>
      <p>{m.body}</p>
      {action}
    </div>
  )
}
