import test from 'node:test'
import assert from 'node:assert/strict'
import {
  EMPTY_FORM, ageOn, amountWaitingForSeller, buildKycPayload, documentFileError, fieldErrorFromApi, formatIban, formatZip, ibanChecksumOk,
  isValidNip, isValidPesel, isIdDocument, expireDateError, isValidPlIban, isValidZip, normalizePlIban, sellerKycMessage, stepForState, validateKycForm, BUYER_SELLER_VERIFYING, MAX_DOCUMENT_BYTES,
} from './sellerKyc.ts'

const GOOD_IBAN = 'PL61109010140000071219812874'
const TODAY = new Date(2026, 10, 20)
const good = { ...EMPTY_FORM, firstName: 'Anna', lastName: 'Nowak', birthDate: '1990-05-17', street: 'Długa 5/2', zipcode: '00-950', city: 'Warszawa', phone: '600 100 200', email: 'anna@example.pl', iban: GOOD_IBAN }

test('IBAN: PL z 26 cyframi i suma kontrolna, spacje i brak prefiksu są wybaczane', () => {
  assert.equal(isValidPlIban(GOOD_IBAN), true)
  assert.equal(isValidPlIban('PL61 1090 1014 0000 0712 1981 2874'), true)
  assert.equal(isValidPlIban('61109010140000071219812874'), true)
  assert.equal(normalizePlIban('61 1090 1014 0000 0712 1981 2874'), GOOD_IBAN)
  assert.equal(isValidPlIban('PL61109010140000071219812875'), false) // zła suma kontrolna
  assert.equal(isValidPlIban('DE89370400440532013000'), false) // nie polski
  assert.equal(isValidPlIban('PL6110901014'), false)
  assert.equal(ibanChecksumOk('DE89370400440532013000'), true)
  assert.equal(formatIban('pl61109010140000071219812874'), 'PL61 1090 1014 0000 0712 1981 2874')
})

test('kod pocztowy: 00-000, myślnik dodawany w trakcie pisania', () => {
  assert.equal(isValidZip('00-950'), true)
  assert.equal(isValidZip('00950'), false)
  assert.equal(isValidZip('0-0950'), false)
  assert.equal(formatZip('00950'), '00-950')
  assert.equal(formatZip('00'), '00')
  assert.equal(formatZip('abc12-3456789'), '12-345')
})

test('NIP: 10 cyfr z poprawną cyfrą kontrolną, kreski i PL ignorowane', () => {
  assert.equal(isValidNip('5260250274'), true)
  assert.equal(isValidNip('526-025-02-74'), true)
  assert.equal(isValidNip('PL5260250274'), true)
  assert.equal(isValidNip('5260250275'), false)
  assert.equal(isValidNip('123'), false)
  assert.equal(isValidNip('1234567890'), false)
  assert.equal(isValidNip('0000000000'), true) // suma 0 == cyfra kontrolna 0: dopuszczona przez algorytm
})

test('wiek: pełnoletność liczona co do dnia, niemożliwe daty odrzucone', () => {
  assert.equal(ageOn('2008-11-20', TODAY), 18)
  assert.equal(ageOn('2008-11-21', TODAY), 17)
  assert.equal(ageOn('2001-02-30', TODAY), null)
  assert.equal(ageOn('', TODAY), null)
})

test('formularz: poprawne dane osoby prywatnej nie mają błędów, NIP nie jest wymagany', () => {
  assert.deepEqual(validateKycForm(good, 'PRIVATE_PERSON', TODAY), {})
})

test('formularz: komunikaty po polsku dla każdego pola', () => {
  const e = validateKycForm(EMPTY_FORM, 'PRIVATE_PERSON', TODAY)
  assert.deepEqual(Object.keys(e).sort(), ['birthDate', 'city', 'email', 'firstName', 'iban', 'lastName', 'phone', 'street', 'zipcode'])
  assert.match(e.zipcode!, /00-000/)
  const bad = validateKycForm({ ...good, birthDate: '2015-01-01', zipcode: '12345', phone: '12', email: 'x@', iban: 'PL12' }, 'PRIVATE_PERSON', TODAY)
  assert.match(bad.birthDate!, /pełnoletnia/)
  assert.match(bad.zipcode!, /00-000/)
  assert.match(bad.phone!, /telefon/)
  assert.match(bad.email!, /e-mail/)
  assert.match(bad.iban!, /polski/)
  assert.match(validateKycForm({ ...good, iban: 'PL61109010140000071219812875' }, 'PRIVATE_PERSON', TODAY).iban!, /niepoprawny/)
})

test('formularz: działalność wymaga NIP i nazwy', () => {
  const e = validateKycForm(good, 'SOLE_TRADER', TODAY)
  assert.match(e.nip!, /Podaj NIP/)
  assert.match(e.companyName!, /nazwę/)
  assert.match(validateKycForm({ ...good, nip: '5260250275', companyName: 'Anna Nowak Sklep' }, 'SOLE_TRADER', TODAY).nip!, /niepoprawny/)
  assert.deepEqual(validateKycForm({ ...good, nip: '526-025-02-74', companyName: 'Anna Nowak Sklep' }, 'SOLE_TRADER', TODAY), {})
})

test('ładunek: telefon +48, IBAN bez spacji, NIP bez kresek; dla osoby prywatnej bez NIP', () => {
  const p = buildKycPayload({ ...good, iban: 'PL61 1090 1014 0000 0712 1981 2874', nip: '526-025-02-74', companyName: 'X' }, 'PRIVATE_PERSON')
  assert.equal(p.phone, '+48600100200')
  assert.equal(p.iban, GOOD_IBAN)
  assert.equal('nip' in p, false)
  const t = buildKycPayload({ ...good, nip: '526-025-02-74', companyName: ' Sklep ' }, 'SOLE_TRADER')
  assert.equal(t.nip, '5260250274')
  assert.equal(t.companyName, 'Sklep')
})

test('kroki kreatora wynikają ze stanu z API (dataSent, regulationsAccepted)', () => {
  const st = (status: string, dataSent: boolean | null, regs: boolean | null, docs = false) => stepForState({
    status: status as never, dataSent, regulationsAccepted: regs, documentsRequested: docs ? [{ code: 'ID_CARD', label: 'Dowód' }] : [],
  })
  assert.equal(st('not_started', null, null), 'kind')
  assert.equal(st('in_progress', false, false), 'data')
  assert.equal(st('in_progress', null, null), 'data')
  assert.equal(st('in_progress', true, false), 'regulations') // po przeładowaniu nie pokazujemy formularza od nowa
  assert.equal(st('in_progress', true, true), 'waiting')
  assert.equal(st('pending', true, true), 'waiting')
  assert.equal(st('pending', true, true, true), 'documents')
  assert.equal(st('verified', null, null), 'verified')
  assert.equal(st('rejected', null, null), 'rejected')
  assert.equal(st('reverification', true, false), 'regulations')
})

test('PESEL i data ważności dokumentu', () => {
  assert.equal(isValidPesel('44051401359'), true)
  assert.equal(isValidPesel('44051401358'), false)
  assert.equal(isValidPesel('123'), false)
  assert.match(validateKycForm({ ...good, nip: '5260250274', companyName: 'Sklep', pesel: '123' }, 'SOLE_TRADER', TODAY).pesel!, /PESEL/)
  assert.equal(buildKycPayload({ ...good, nip: '5260250274', companyName: 'Sklep', pesel: '44051401359' }, 'SOLE_TRADER').pesel, '44051401359')
  assert.equal('pesel' in buildKycPayload({ ...good, pesel: '44051401359' }, 'PRIVATE_PERSON'), false)
  assert.equal(isIdDocument('ID_CARD'), true)
  assert.equal(isIdDocument('INVOICE'), false)
  assert.equal(expireDateError('2027-01-01', TODAY), null)
  assert.match(expireDateError('2026-11-20', TODAY)!, /przeterminowany/)
  assert.match(expireDateError('', TODAY)!, /ważności/)
  assert.match(expireDateError('2027-02-30', TODAY)!, /ważności/)
})

test('dokumenty: limit 1 MB i formaty', () => {
  assert.equal(documentFileError({ size: 1000, type: 'application/pdf' }), null)
  assert.equal(documentFileError({ size: MAX_DOCUMENT_BYTES, type: 'image/png' }), null)
  assert.match(documentFileError({ size: MAX_DOCUMENT_BYTES + 1, type: 'image/png' })!, /1 MB/)
  assert.match(documentFileError({ size: 10, type: 'text/html' })!, /PDF/)
  assert.match(documentFileError({ size: 0, type: 'image/png' })!, /pusty/)
})

test('komunikaty dla sprzedającego: bez nazwy operatora, zweryfikowany = brak baneru', () => {
  assert.equal(sellerKycMessage('verified'), null)
  for (const s of [null, 'not_started', 'in_progress', 'pending', 'rejected', 'reverification'] as const) {
    const m = sellerKycMessage(s)!
    assert.doesNotMatch(m.title + m.body + m.cta, /PayU/i, String(s))
    assert.ok(m.cta.length > 0)
  }
  assert.doesNotMatch(BUYER_SELLER_VERIFYING, /PayU/i)
  assert.match(BUYER_SELLER_VERIFYING, /Sprzedający kończy weryfikację/)
})

test('kwota do odebrania: tylko opłacone zamówienia z Ochroną, w toku', () => {
  const o = (fulfillment: string, status: string, itemAmount: number) => ({ fulfillment, status, itemAmount })
  assert.equal(amountWaitingForSeller([o('protected', 'PAID', 100), o('protected', 'SHIPPED', 50.5), o('direct', 'PAID', 999), o('protected', 'COMPLETED', 70), o('protected', 'AWAITING_PAYMENT', 20), o('protected', 'CANCELLED', 5)]), 150.5)
  assert.equal(amountWaitingForSeller([]), 0)
})

test('błąd 422 z API: pole i komunikat', () => {
  assert.deepEqual(fieldErrorFromApi({ field: 'iban', message: 'Zły numer' }), { field: 'iban', message: 'Zły numer' })
  assert.deepEqual(fieldErrorFromApi({ field: 'nieznane', message: 'x' }), { field: null, message: 'x' })
  assert.equal(fieldErrorFromApi(null), null)
  assert.equal(fieldErrorFromApi({ field: 'iban' }), null)
})
