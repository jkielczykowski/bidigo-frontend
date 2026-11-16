import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { stems, suggestCategory, type CatLite } from './allegroCategory.ts'

const c = (id: string, name: string, parent_id: string | null = null): CatLite => ({ id, name, parent_id })
const CATS: CatLite[] = [
  c('moda', 'Odzież i akcesoria'),
  c('buty', 'Buty', 'moda'),
  c('buty-damskie', 'Buty damskie', 'buty'),
  c('buty-meskie', 'Buty męskie', 'buty'),
  c('buty-sport', 'Buty sportowe', 'buty'),
  c('plecaki', 'Plecaki', 'moda'),
  c('telefony', 'Telefony i tablety'),
  c('smartfony', 'Smartfony', 'telefony'),
  c('tablety', 'Tablety', 'telefony'),
  c('foto', 'Foto i optyka'),
  c('aparaty', 'Aparaty cyfrowe', 'foto'),
  c('analogowe', 'Aparaty analogowe', 'foto'),
  c('dom', 'Dom i mieszkanie'),
  c('lampy', 'Lampy i oświetlenie', 'dom'),
  c('inne', 'Inne'),
  c('moda-damska', 'Moda damska', 'moda'),
  c('dam-sukienki', 'Sukienki i spódnice', 'moda-damska'),
  c('dam-sport', 'Odzież sportowa damska', 'moda-damska'),
  c('ksiazki', 'Książki i komiksy'),
  c('beletrystyka', 'Beletrystyka', 'ksiazki'),
  c('komiksy', 'Komiksy i manga', 'ksiazki'),
]

describe('stems', () => {
  it('folds Polish inflection and diacritics', () => {
    assert.deepEqual(stems('Telefony i tablety'), ['telef', 'table'])
    assert.deepEqual(stems('Lampy i oświetlenie'), ['lampy', 'oswie'])
    assert.equal(stems('Łódź')[0], 'lodz')
  })
})

describe('suggestCategory', () => {
  it('matches the Allegro leaf to the Bidigo leaf', () => {
    assert.equal(suggestCategory(['Elektronika', 'Telefony i Akcesoria', 'Smartfony i telefony komórkowe'], 'iPhone 12 128GB', CATS), 'smartfony')
    assert.equal(suggestCategory(['Dom i Ogród', 'Oświetlenie', 'Lampy biurkowe'], 'Lampa biurkowa LED', CATS), 'lampy')
  })
  it('looks through a brand or model as the last level', () => {
    assert.equal(suggestCategory(['Elektronika', 'Telefony i Akcesoria', 'Smartfony i telefony komórkowe', 'Apple'], 'iPhone 12', CATS), 'smartfony')
  })
  it('prefers a specific leaf to "Inne"', () => {
    assert.notEqual(suggestCategory(['Elektronika', 'Telefony i Akcesoria', 'Tablety'], 'Tablet', CATS), 'inne')
  })
  it('uses the upper path to tell sibling leaves apart', () => {
    assert.equal(suggestCategory(['Moda', 'Odzież, Obuwie, Dodatki', 'Obuwie damskie', 'Sneakersy'], 'Nike Air', CATS), 'buty-damskie')
  })
  it('lets the most specific Allegro level beat a leaf that merely shares broad words', () => {
    assert.equal(suggestCategory(['Moda', 'Odzież, Obuwie, Dodatki', 'Odzież damska', 'Sukienki'], 'Sukienka letnia M', CATS), 'dam-sukienki')
  })
  it('knows that fiction is "beletrystyka" and is not drawn to the comics of the parent path', () => {
    assert.equal(suggestCategory(['Kultura i rozrywka', 'Książki i Komiksy', 'Książki', 'Fantastyka'], 'Wiedźmin', CATS), 'beletrystyka')
  })
  it('falls back on the title when Allegro sends no path', () => {
    assert.equal(suggestCategory([], 'Aparat analogowy Zenit 12', CATS), 'analogowe')
  })
  it('suggests only leaves, never a parent', () => {
    const id = suggestCategory(['Moda', 'Buty'], 'Buty', CATS)
    assert.ok(id === null || !['moda', 'buty'].includes(id))
  })
  it('returns null when nothing fits', () => {
    assert.equal(suggestCategory(['Instrumenty muzyczne', 'Fortepiany'], 'Fortepian', CATS), null)
    assert.equal(suggestCategory([], 'xyz', CATS), null)
  })
})
