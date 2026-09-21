#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { validateCatalog } from '../catalog.js';

export const LIST_URL = 'https://en.fc-buddyfight.com/cardlist/list/?id=3';
const BASE_URL = 'https://en.fc-buddyfight.com';
const clean = (value = '') => decodeHtml(value.replace(/<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>|<[^>]*>/gi, ' ').replace(/\s+/g, ' ').trim());
const decodeHtml = (value) => value.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>');
const absolute = (value, base = BASE_URL) => new URL(decodeHtml(value), base).href;
const unique = (items) => [...new Set(items)];
const attributes = (tag) => Object.fromEntries([...tag.matchAll(/([\w:-]+)(?:\s*=\s*(?:(["'])(.*?)\2|([^\s"'=<>`]+)))?/gsi)].map((m) => [m[1].toLowerCase(), decodeHtml(m[3] ?? m[4] ?? '')]));

function optionValues(html) {
  return [...html.matchAll(/<option\b[^>]*\bvalue\s*=\s*(?:(["'])(.*?)\1|([^\s>]+))[^>]*>/gsi)]
    .map((match) => decodeHtml(match[2] ?? match[3]).trim())
    .filter((value) => /^\d+$/.test(value));
}

/** Find the values in the expansion selector on the official list page. */
export function parseExpansionIds(html) {
  const selects = [...html.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/gsi)];
  const named = selects.filter((match) => /(?:name|id|class)\s*=\s*(["'])[^"']*(?:expansion|product|series|cardlist|\bid\b)[^"']*\1/i.test(match[1]));
  // The initial URL uses id=3.  Its selector remains a reliable fallback when
  // the official site changes the selector's attribute names.
  const candidates = named.length ? named : selects.filter((match) => optionValues(match[2]).includes('3'));
  return unique((candidates.length ? candidates : selects).flatMap((match) => optionValues(match[2])));
}

/** Extract detail and pagination links, resolving relative links against the list page. */
export function parseListPage(html, pageUrl) {
  const cardUrls = [];
  const pageUrls = [];
  for (const match of html.matchAll(/<a\b[^>]*\bhref\s*=\s*(?:(["'])(.*?)\1|([^\s>]+))[^>]*>/gsi)) {
    const href = decodeHtml(match[2] ?? match[3]);
    let url;
    try { url = absolute(href, pageUrl); } catch { continue; }
    const parsed = new URL(url);
    if (/\/cardlist\/card\/?$/i.test(parsed.pathname) || /[?&](?:cardno|card_id|card)=/i.test(url)) cardUrls.push(url);
    if (/\/cardlist\/list\/?$/i.test(parsed.pathname) && [...parsed.searchParams.keys()].some((key) => /^(?:page|paged|paging|offset|p)$/i.test(key))) pageUrls.push(url);
  }
  return { cardUrls: unique(cardUrls), pageUrls: unique(pageUrls) };
}

function readLabel(html, labels) {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      new RegExp(`<(?:th|dt|[^>]*class=(["'])[^"']*(?:label|title|name)[^"']*\\1)[^>]*>\\s*${escaped}\\s*<\\/(?:th|dt|[^>]+)>\\s*<(?:td|dd|[^>]+)[^>]*>([\\s\\S]*?)<\\/(?:td|dd|[^>]+)>`, 'i'),
      new RegExp(`${escaped}\\s*<\\/[^>]+>\\s*<[^>]+>([\\s\\S]*?)<\\/[^>]+>`, 'i'),
      new RegExp(`${escaped}\\s*[:：]\\s*(?:<[^>]*>)?([\\s\\S]*?)(?:<\\/[^>]+>|\\n)`, 'i')
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) return clean(match[match.length - 1]);
    }
  }
  return '';
}

function readName(html) {
  const match = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>|<[^>]+class=(["'])[^"']*\bcard[_-]?(?:name|title)\b[^"']*\2[^>]*>([\s\S]*?)<\//i);
  return clean(match?.[1] || match?.[3] || '');
}

function readImage(html, pageUrl) {
  const images = [];
  for (const match of html.matchAll(/<img\b[^>]*>/gsi)) {
    const attrs = attributes(match[0]);
    const src = attrs.src || attrs['data-src'] || attrs['data-original'];
    if (!src || !/\.(?:png|jpe?g|webp)(?:[?#].*)?$/i.test(src)) continue;
    if (/logo|banner|icon|button|arrow|header|footer|nav/i.test(`${attrs.class} ${attrs.id} ${src}`)) continue;
    images.push(absolute(src, pageUrl));
  }
  return images[0];
}

/** Normalize one official card detail page into the catalog schema. */
export function parseCardPage(html, { expansion, sourceUrl }) {
  const url = new URL(sourceUrl);
  const card = {
    id: readLabel(html, ['Card No.', 'Card No', 'Card Number', 'No.']) || url.searchParams.get('cardno') || url.searchParams.get('card_id') || url.searchParams.get('id') || '',
    name: readName(html),
    expansion,
    sourceUrl,
    world: readLabel(html, ['World']),
    type: readLabel(html, ['Type']),
    size: readLabel(html, ['Size']),
    power: readLabel(html, ['Power']),
    crit: readLabel(html, ['Critical', 'Crit']),
    text: readLabel(html, ['Ability', 'Abilities', 'Text', 'Effect'])
  };
  const imageUrl = readImage(html, sourceUrl);
  if (imageUrl) card.imageUrl = imageUrl;
  return card;
}

async function get(url, fetchImpl) {
  const response = await fetchImpl(url, { headers: { accept: 'text/html,application/xhtml+xml' } });
  if (!response.ok) throw new Error(`Request failed (${response.status}): ${url}`);
  return response.text();
}

export async function importOfficialCards({ fetchImpl = fetch, listUrl = LIST_URL } = {}) {
  const expansionIds = parseExpansionIds(await get(listUrl, fetchImpl));
  if (!expansionIds.length) throw new Error(`No expansion IDs found at ${listUrl}`);
  const cardsById = new Map();
  for (const expansion of expansionIds) {
    const initialUrl = new URL(listUrl); initialUrl.searchParams.set('id', expansion);
    const pending = [initialUrl.href];
    const visitedPages = new Set();
    const cardUrls = new Set();
    while (pending.length) {
      const pageUrl = pending.shift();
      if (visitedPages.has(pageUrl)) continue;
      visitedPages.add(pageUrl);
      const page = parseListPage(await get(pageUrl, fetchImpl), pageUrl);
      page.cardUrls.forEach((url) => cardUrls.add(url));
      page.pageUrls.forEach((url) => { if (!visitedPages.has(url)) pending.push(url); });
    }
    for (const sourceUrl of cardUrls) {
      const card = parseCardPage(await get(sourceUrl, fetchImpl), { expansion, sourceUrl });
      if (cardsById.has(card.id)) throw new Error(`Duplicate card id from official list: ${card.id}`);
      cardsById.set(card.id, card);
    }
  }
  const cards = [...cardsById.values()].sort((left, right) => left.id.localeCompare(right.id));
  validateCatalog(cards);
  return cards;
}

export async function writeCatalog(cards, outputPath) {
  validateCatalog(cards);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(cards, null, 2)}\n`);
}

async function main() {
  const outputPath = process.argv[2]
    ? resolve(process.argv[2])
    : resolve(dirname(fileURLToPath(import.meta.url)), '../data/cards.json');
  await writeCatalog(await importOfficialCards(), outputPath);
  console.log(`Imported catalog to ${outputPath}`);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error); process.exitCode = 1; });
