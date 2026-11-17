import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  afNotice,
  appealProblem,
  awaitingExplanation,
  daysLeft,
  explanationProblem,
  isAccountBlockedError,
  parseAfStatus,
  parsePrecheck,
  statusLabel,
  strikeLabel,
  type AfStatus,
} from './antifraud.ts'

const base = {
  enabled: true,
  threshold: 3,
  window_months: 12,
  explanation_days: 3,
  appeal_days: 14,
  strikes: 0,
  blocked: false,
  blocked_since: null,
  level: 'none',
  incidents: [],
  ratings: [],
}

test('precheck: tylko true/false ma znaczenie, reszta to „nie wiem”', () => {
  assert.equal(parsePrecheck({ allowed: true }), true)
  assert.equal(parsePrecheck({ allowed: false }), false)
  assert.equal(parsePrecheck([{ allowed: false }]), false)
  assert.equal(parsePrecheck(null), null)
  assert.equal(parsePrecheck({ allowed: 'nie' }), null)
  assert.equal(parsePrecheck({}), null)
})

test('blokadę z bazy rozpoznajemy po podpowiedzi, nie po treści', () => {
  assert.equal(isAccountBlockedError({ hint: 'account_blocked', message: 'cokolwiek' }), true)
  assert.equal(isAccountBlockedError({ hint: 'fees_overdue' }), false)
  assert.equal(isAccountBlockedError(new Error('Konto zablokowane')), false)
  assert.equal(isAccountBlockedError(null), false)
})

test('status: śmieci nie wybuchają, brakujące pola dostają wartości domyślne', () => {
  assert.equal(parseAfStatus(null), null)
  assert.equal(parseAfStatus({ threshold: 'x' }), null)
  const s = parseAfStatus({ threshold: 3, strikes: 1, blocked: false, level: 'dziwny' })
  assert.ok(s)
  assert.equal(s.level, 'none')
  assert.equal(s.window_months, 12)
  assert.deepEqual(s.incidents, [])
})

test('komunikat 1/3, 2/3 i blokada 3/3', () => {
  const w = afNotice({ ...base, strikes: 1, level: 'warning' } as AfStatus)
  assert.ok(w)
  assert.equal(w.kind, 'warning')
  assert.match(w.title, /Ostrzeżenie 1\/3/)
  assert.match(w.title, /negatywna ocena systemowa/)

  const r = afNotice({ ...base, strikes: 2, level: 'warning_block_risk' } as AfStatus)
  assert.ok(r)
  assert.equal(r.kind, 'risk')
  assert.match(r.title, /2\/3/)
  assert.match(r.title, /grozi blokada/)

  const b = afNotice({ ...base, strikes: 3, blocked: true, level: 'blocked' } as AfStatus)
  assert.ok(b)
  assert.equal(b.kind, 'blocked')
  assert.match(b.title, /zablokowane \(3\/3\)/)
})

test('próg konfigurowalny: komunikat pokazuje faktyczny próg', () => {
  const r = afNotice({ ...base, threshold: 5, strikes: 4, level: 'warning_block_risk' } as AfStatus)
  assert.ok(r)
  assert.match(r.title, /4\/5/)
  assert.equal(strikeLabel(7, 5), '5/5')
})

test('bez naruszeń i bez blokady nie ma banera', () => {
  assert.equal(afNotice(null), null)
  assert.equal(afNotice({ ...base } as AfStatus), null)
})

test('lista spraw czekających na wyjaśnienie', () => {
  const s = {
    ...base,
    incidents: [
      { id: 'a', can_explain: true },
      { id: 'b', can_explain: false },
    ],
  } as unknown as AfStatus
  assert.deepEqual(awaitingExplanation(s).map((i) => i.id), ['a'])
  assert.deepEqual(awaitingExplanation(null), [])
})

test('walidacja wyjaśnienia i odwołania', () => {
  assert.match(explanationProblem('krótko') ?? '', /min\. 10/)
  assert.equal(explanationProblem('Płatność zablokował bank'), null)
  assert.match(explanationProblem('x'.repeat(2001)) ?? '', /maks\./)
  assert.match(appealProblem('za krótkie') ?? '', /min\. 20/)
  assert.equal(appealProblem('Oferty składałem zgodnie z regulaminem.'), null)
})

test('dni do terminu', () => {
  const now = new Date('2026-11-17T12:00:00Z')
  assert.equal(daysLeft('2026-11-20T12:00:00Z', now), 3)
  assert.equal(daysLeft('2026-11-17T13:00:00Z', now), 1)
  assert.equal(daysLeft('2026-11-16T12:00:00Z', now), 0)
  assert.equal(daysLeft(null, now), 0)
})

test('nazwy statusów po polsku, nieznany zostaje jak jest', () => {
  assert.equal(statusLabel('AWAITING_EXPLANATION'), 'Czeka na Twoje wyjaśnienia')
  assert.equal(statusLabel('VIOLATION_DISMISSED'), 'Oddalone — bez naliczenia')
  assert.equal(statusLabel('COS_NOWEGO'), 'COS_NOWEGO')
})
