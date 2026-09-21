import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { validateCatalog } from '../catalog.js';
import { importOfficialCards, parseCardPage, parseExpansionIds, writeCatalog } from '../scripts/import-official-cards.mjs';

const fixture = (name) => readFile(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const base = 'https://en.fc-buddyfight.com/cardlist/list/?id=3';

test('discovers expansion IDs from list select options', async () => {
  assert.deepEqual(parseExpansionIds(await fixture('official-list.html')), ['1', '2']);
});

test('imports paginated expansion pages and card details from saved HTML', async () => {
  const pages = new Map([
    [base, 'official-list.html'],
    ['https://en.fc-buddyfight.com/cardlist/list/?id=1', 'expansion-1-page-1.html'],
    ['https://en.fc-buddyfight.com/cardlist/list/?id=1&page=2', 'expansion-1-page-2.html'],
    ['https://en.fc-buddyfight.com/cardlist/list/?id=2', 'expansion-2-page-1.html'],
    ['https://en.fc-buddyfight.com/cardlist/card/?cardno=ABC-001', 'card-abc-001.html'],
    ['https://en.fc-buddyfight.com/cardlist/card/?cardno=ABC-002', 'card-abc-002.html'],
    ['https://en.fc-buddyfight.com/cardlist/card/?cardno=XYZ-001', 'card-xyz-001.html']
  ]);
  const fetchImpl = async (url) => ({ ok: pages.has(String(url)), status: 404, text: () => fixture(pages.get(String(url))) });
  const cards = await importOfficialCards({ fetchImpl, listUrl: base });
  assert.equal(cards.length, 3);
  assert.deepEqual(cards[0], {
    id: 'ABC-001', name: 'Brave & Bold', expansion: '1',
    sourceUrl: 'https://en.fc-buddyfight.com/cardlist/card/?cardno=ABC-001',
    world: 'Dragon World', type: 'Monster', size: '2', power: '5000', crit: '2',
    text: '[Call Cost] Pay 1 gauge.', imageUrl: 'https://en.fc-buddyfight.com/images/ABC-001.png'
  });
  assert.doesNotThrow(() => validateCatalog(cards));
});

test('parses definition-list metadata and an ordinary official card image', async () => {
  const card = (await fixture('card-abc-001.html'))
    .replace('<table>', '<dl>')
    .replaceAll('<tr><th>', '<dt>')
    .replaceAll('</th><td>', '</dt><dd>')
    .replaceAll('</td></tr>', '</dd>')
    .replace('</table>', '</dl>')
    .replace('class="card-image" ', '');
  const parsed = parseCardPage(card, {
    expansion: '1', sourceUrl: 'https://en.fc-buddyfight.com/cardlist/card/?id=ABC-001'
  });
  assert.equal(parsed.id, 'ABC-001');
  assert.equal(parsed.text, '[Call Cost] Pay 1 gauge.');
  assert.equal(parsed.imageUrl, 'https://en.fc-buddyfight.com/images/ABC-001.png');
});


test('writes only a catalog accepted by validateCatalog', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'buddyfight-catalog-'));
  const output = join(directory, 'cards.json');
  const cards = [{
    id: 'TEST-001', name: 'Test', expansion: '1', sourceUrl: 'https://example.test/card/1',
    world: 'Test World', type: 'Monster', size: '1', power: '1000', crit: '1', text: 'Test text'
  }];
  try {
    await writeCatalog(cards, output);
    assert.deepEqual(JSON.parse(await readFile(output, 'utf8')), cards);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
