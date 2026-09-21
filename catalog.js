/** Validate the normalized card catalog written by the official importer. */
export function validateCatalog(cards) {
  if (!Array.isArray(cards)) throw new TypeError('Catalog must be an array.');
  const required = ['id', 'name', 'expansion', 'sourceUrl', 'world', 'type', 'size', 'power', 'crit', 'text'];
  const ids = new Set();
  cards.forEach((card, index) => {
    if (!card || typeof card !== 'object' || Array.isArray(card)) {
      throw new TypeError(`Card ${index} must be an object.`);
    }
    for (const field of required) {
      if (typeof card[field] !== 'string' || card[field].trim() === '') {
        throw new TypeError(`Card ${index} has no ${field}.`);
      }
    }
    if (!/^https?:\/\//.test(card.sourceUrl)) throw new TypeError(`Card ${index} has an invalid sourceUrl.`);
    if (card.imageUrl !== undefined && (typeof card.imageUrl !== 'string' || !/^https?:\/\//.test(card.imageUrl))) {
      throw new TypeError(`Card ${index} has an invalid imageUrl.`);
    }
    if (ids.has(card.id)) throw new TypeError(`Duplicate card id: ${card.id}.`);
    ids.add(card.id);
  });
  return cards;
}
