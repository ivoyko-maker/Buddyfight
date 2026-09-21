export const PHASES = Object.freeze(['Inicio', 'Roba', 'Carga y roba', 'Principal', 'Ataque', 'Final']);

export const CARD_LIBRARY = Object.freeze([
  { name: 'Dragonic Fighter, Ragna', type: 'monster', world: 'Dragon World', size: 1, power: 4000, crit: 2, text: 'Monstruo de tamaño 1.' },
  { name: 'Thunder Empire, Zas', type: 'monster', world: 'Dragon World', size: 2, power: 6000, crit: 2, text: 'Monstruo de tamaño 2.' },
  { name: 'Gargantua Dragon', type: 'monster', world: 'Dragon World', size: 3, power: 7000, crit: 3, text: 'Monstruo de tamaño 3.' },
  { name: 'Dragoblade, Ryu', type: 'item', world: 'Dragon World', size: 0, power: 3000, crit: 2, text: 'Ítem equipado.' },
  { name: 'Blue Dragon Shield', type: 'spell', world: 'Dragon World', size: 0, power: 0, crit: 0, text: 'Hechizo de prueba. Va al drop al usarlo.' },
  { name: 'Dragon Force: Burst', type: 'spell', world: 'Dragon World', size: 0, power: 0, crit: 0, text: 'Hechizo de prueba. Va al drop al usarlo.' }
]);

const DECK_ORDER = [0, 1, 3, 4, 0, 2, 5, 1, 4, 0, 3, 1, 5, 0, 4, 1, 2, 3, 0, 1];
const monsterZones = ['left', 'center', 'right'];

function cloneCard(template, serial) { return { ...template, id: `${serial}-${template.name}`, rest: false }; }
function createDeck(prefix) { return DECK_ORDER.map((index, serial) => cloneCard(CARD_LIBRARY[index], `${prefix}-${serial}`)); }
function createFighter(name, prefix) { return { name, life: 10, deck: createDeck(prefix), hand: [], gauge: [], drop: [], field: { left: null, center: null, right: null, item: null } }; }

export function createMatch() {
  const match = { player: createFighter('Kai', 'p'), opponent: createFighter('Nova', 'o'), phase: -1, round: 1, finished: false, log: [] };
  for (let index = 0; index < 5; index += 1) { draw(match, 'player'); draw(match, 'opponent'); }
  log(match, 'La lucha comienza. Kai tiene el primer turno.');
  return match;
}

export function log(match, message) { match.log.unshift(message); }
export function draw(match, owner) {
  const fighter = match[owner];
  if (fighter.deck.length) { fighter.hand.push(fighter.deck.shift()); return true; }
  damage(match, owner, 1, 'No quedan cartas en el mazo');
  return false;
}
export function damage(match, owner, amount, reason) {
  const fighter = match[owner];
  fighter.life = Math.max(0, fighter.life - amount);
  log(match, `${fighter.name} recibe ${amount} de daño. ${reason}.`);
  if (!fighter.life) { match.finished = true; log(match, `¡${fighter.name} pierde la lucha!`); }
}
export function monsterSize(fighter) { return monsterZones.reduce((total, zone) => total + (fighter.field[zone]?.size ?? 0), 0); }
export function availableMonsterZone(fighter) { return monsterZones.find(zone => !fighter.field[zone]); }
export function readyField(fighter) { Object.values(fighter.field).filter(Boolean).forEach(card => { card.rest = false; }); }

export function advancePlayerPhase(match) {
  if (match.finished || match.phase >= PHASES.length - 1) return { ok: false, reason: 'No hay más fases para avanzar.' };
  match.phase += 1;
  const phase = PHASES[match.phase];
  if (phase === 'Inicio') { readyField(match.player); log(match, 'Inicio: preparas tus cartas.'); }
  if (phase === 'Roba') { draw(match, 'player'); log(match, 'Roba: añades una carta a tu mano.'); }
  if (phase === 'Carga y roba') log(match, 'Carga y roba: puedes cargar una carta de tu mano.');
  if (phase === 'Principal') log(match, 'Principal: llama monstruos, equipa ítems o usa hechizos.');
  if (phase === 'Ataque') log(match, 'Ataque: selecciona un atacante preparado.');
  return { ok: true, phase };
}

export function chargeAndDraw(match, handIndex) {
  if (match.phase !== 2) return { ok: false, reason: 'Solo puedes cargar durante Carga y roba.' };
  const card = match.player.hand[handIndex];
  if (!card) return { ok: false, reason: 'Selecciona una carta de tu mano.' };
  match.player.hand.splice(handIndex, 1);
  match.player.gauge.push(card);
  draw(match, 'player');
  log(match, `${card.name} se coloca en gauge; robas una carta.`);
  return { ok: true };
}

export function playCard(match, handIndex) {
  if (match.phase !== 3) return { ok: false, reason: 'Solo puedes jugar cartas durante la fase Principal.' };
  const fighter = match.player;
  const card = fighter.hand[handIndex];
  if (!card) return { ok: false, reason: 'Selecciona una carta de tu mano.' };
  if (card.type === 'spell') {
    fighter.hand.splice(handIndex, 1); fighter.drop.push(card);
    log(match, `${card.name} se usa y se coloca en el drop.`);
    return { ok: true };
  }
  const zone = card.type === 'item' ? 'item' : availableMonsterZone(fighter);
  if (!zone) return { ok: false, reason: 'No queda una zona libre para esa carta.' };
  if (card.type === 'monster' && monsterSize(fighter) + card.size > 3) return { ok: false, reason: 'El tamaño total de monstruos no puede superar 3.' };
  if (fighter.field[zone]) fighter.drop.push(fighter.field[zone]);
  fighter.field[zone] = fighter.hand.splice(handIndex, 1)[0];
  fighter.field[zone].rest = true;
  log(match, `${card.name} entra en reposo en ${zone === 'item' ? 'la zona de ítem' : `la zona ${zone}`}.`);
  return { ok: true, zone };
}

export function removeFromField(match, owner, card) {
  const zone = Object.keys(match[owner].field).find(key => match[owner].field[key] === card);
  if (zone) { match[owner].field[zone] = null; match[owner].drop.push(card); }
}
export function attack(match, attackerOwner, zone) {
  if (match.finished) return { ok: false, reason: 'La lucha ya terminó.' };
  const defenderOwner = attackerOwner === 'player' ? 'opponent' : 'player';
  const attacker = match[attackerOwner].field[zone];
  if (!attacker || attacker.type === 'item' || attacker.rest) return { ok: false, reason: 'Ese atacante no está disponible.' };
  attacker.rest = true;
  const defender = match[defenderOwner].field.center || match[defenderOwner].field.left || match[defenderOwner].field.right;
  if (!defender) { damage(match, defenderOwner, attacker.crit, `${attacker.name} ataca directamente`); return { ok: true, result: 'direct' }; }
  if (attacker.power > defender.power) { removeFromField(match, defenderOwner, defender); log(match, `${attacker.name} destruye a ${defender.name}.`); return { ok: true, result: 'defender-destroyed' }; }
  if (attacker.power < defender.power) { removeFromField(match, attackerOwner, attacker); log(match, `${attacker.name} es destruido por ${defender.name}.`); return { ok: true, result: 'attacker-destroyed' }; }
  removeFromField(match, attackerOwner, attacker); removeFromField(match, defenderOwner, defender);
  log(match, `${attacker.name} y ${defender.name} son destruidos en batalla.`);
  return { ok: true, result: 'both-destroyed' };
}

export function playOpponentTurn(match) {
  if (match.finished) return;
  const opponent = match.opponent;
  readyField(opponent); draw(match, 'opponent');
  const card = opponent.hand.find(candidate => candidate.type === 'monster' && candidate.size + monsterSize(opponent) <= 3);
  const zone = availableMonsterZone(opponent);
  if (card && zone) { opponent.hand.splice(opponent.hand.indexOf(card), 1); opponent.field[zone] = card; log(match, `Nova llama a ${card.name}.`); }
  const attackerZone = monsterZones.find(zoneName => opponent.field[zoneName] && !opponent.field[zoneName].rest);
  if (attackerZone) attack(match, 'opponent', attackerZone);
  match.phase = -1; match.round += 1;
  if (!match.finished) log(match, 'Comienza tu siguiente turno.');
}
