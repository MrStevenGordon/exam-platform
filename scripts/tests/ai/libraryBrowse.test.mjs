import test from 'node:test'
import assert from 'node:assert/strict'
import { groupBooks, GENRES, GENRE_LABEL, NO_GENRE, NO_SUBJECT } from '../../../src/lib/libraryBrowsePure.ts'

const B = [
  { id: '1', title: 'Macbeth', subject: 'English', genre: 'drama' },
  { id: '2', title: 'A Midsummer Night\'s Dream', subject: 'English', genre: 'drama' },
  { id: '3', title: 'Selected poems', subject: 'English', genre: 'poetry' },
  { id: '4', title: 'Jamaica in the 1800s', subject: 'History', genre: 'non_fiction' },
  { id: '5', title: 'Anancy stories', subject: null, genre: 'folklore' },
  { id: '6', title: 'A mystery title', subject: 'Science', genre: null },
  { id: '7', title: 'Old book', subject: '  ', genre: 'not-a-genre' },
]
test('genres follow the library order, with unsorted titles last', () => {
  const g = groupBooks(B, 'genre')
  assert.deepEqual(g.map((x) => x.label), [GENRE_LABEL.poetry, GENRE_LABEL.drama, GENRE_LABEL.folklore, GENRE_LABEL.non_fiction, NO_GENRE])
  assert.deepEqual(g[1].books.map((b) => b.title), ['A Midsummer Night\'s Dream', 'Macbeth'])
  assert.deepEqual(g.at(-1).books.map((b) => b.id).sort(), ['6', '7'])    // no genre, and an unknown genre, both land in Not yet sorted
})
test('subjects run A to Z, with books that have no subject under General reading last', () => {
  const g = groupBooks(B, 'subject')
  assert.deepEqual(g.map((x) => x.label), ['English', 'History', 'Science', NO_SUBJECT])
  assert.deepEqual(g.at(-1).books.map((b) => b.id).sort(), ['5', '7'])
})
test('an empty library gives no groups, and books without the genre field at all still group', () => {
  assert.deepEqual(groupBooks([], 'genre'), [])
  const g = groupBooks([{ id: 'x', title: 'No genre field', subject: 'English' }], 'genre')
  assert.deepEqual(g.map((x) => x.label), [NO_GENRE])
})
test('every genre has a label', () => { for (const g of GENRES) assert.ok(GENRE_LABEL[g]) })
