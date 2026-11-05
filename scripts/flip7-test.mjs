import { newLobby, reduce, buildDeck, roundScore, MAX_PLAYERS } from '../src/flip7/engine.js';
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m); };
const ids = Array.from({ length: 18 }, (_, i) => 'p' + i);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const total = (s) => s.draw.length + s.discard.length + s.players.reduce((a, p) => a + p.row.length + p.mods.length + p.acts.length, 0)
  + (s.choose ? 1 : 0) + (s.stack || []).reduce((a, f) => a + f.deferred.length, 0); // cards in flight (waiting for a target / deferred by Flip Three)

// ---- deck ----
const deck = buildDeck();
must(deck.length === 94, '94 cards');
must(deck.filter((c) => c === 12).length === 12 && deck.filter((c) => c === 1).length === 1 && deck.filter((c) => c === 0).length === 1, 'n copies of n, one zero');
must(['freeze', 'flip3', 'second'].every((a) => deck.filter((c) => c === a).length === 3), '3 of each action');
must(deck.filter((c) => typeof c === 'string' && (c[0] === 'p' || c === 'x2')).length === 6, '6 modifiers');

// ---- random simulation, 2..18 players ----
let games = 0, rounds = 0, busts = 0, flip7s = 0, ties = 0;
for (let g = 0; g < 400; g++) {
  const n = 2 + (g % 17);
  let s = newLobby('p0', 'P0');
  for (let i = 1; i < n; i++) s = reduce(s, { type: 'join', player: ids[i], name: ids[i] });
  s = reduce(s, { type: 'start', player: 'p0' });
  let steps = 0;
  while (s.phase !== 'ended' && steps++ < 30000) {
    must(total(s) === 94, 'card conservation (round ' + s.round + ')');
    const act = (a) => { const r = reduce(s, a); if (r) s = r; return r; };
    if (s.phase === 'roundEnd') { rounds++; busts += s.summary.rows.filter((r) => r.status === 'busted').length; if (s.summary.flip7By) flip7s++; act({ type: 'next', player: 'p0' }); continue; }
    if (s.choose) { act({ type: 'target', player: s.choose.by, target: pick(s.choose.eligible) }); continue; }
    if (Math.random() < 0.002) { const v = s.players.filter((p) => !p.left && p.id !== 'p0'); if (v.length > 2) { act({ type: 'leave', player: pick(v).id }); continue; } }
    const p = s.players[s.turnIdx];
    must(p.status === 'active', 'waiting on an active player');
    const sum = roundScore(p);
    const stayAt = 8 + Math.floor(Math.random() * 25);
    if (sum >= stayAt && p.row.length + p.mods.length > 0) act({ type: 'stay', player: p.id }); else act({ type: 'hit', player: p.id });
  }
  must(s.phase === 'ended' && s.winner, 'game finished n=' + n);
  must(Math.max(...s.players.filter((p) => !p.left).map((p) => s.scores[p.id] || 0)) >= 200 || s.players.filter((p) => !p.left).length < 2, 'winner reached 200');
  games++;
}
console.log('flip7 sim ok:', games, 'games;', rounds, 'rounds;', busts, 'busts;', flip7s, 'Flip 7s');

// ---- targeted rule checks ----
function mk(n = 3) {
  let s = newLobby('p0', 'P0'); for (let i = 1; i < n; i++) s = reduce(s, { type: 'join', player: ids[i], name: ids[i] });
  s = reduce(s, { type: 'start', player: 'p0' });
  // wipe to a clean, scriptable position: everyone empty, p0's turn
  s.players.forEach((p) => { s.discard.push(...p.row, ...p.mods, ...p.acts); p.row = []; p.mods = []; p.acts = []; p.status = 'active'; });
  s.stack = []; s.choose = null; s.passFrom = null; s.stage = 'turns'; s.dealQueue = []; s.turnIdx = 0; s.phase = 'play'; s.dealerId = ids[n - 1];
  return s;
}
const rig = (s, ...cards) => { s.draw = s.draw.filter((c) => !cards.includes(c) || false); s.draw = [...cards, ...s.draw]; return s; }; // top of the deck first (duplicates fine for tests)

// scoring (rulebook example: 11+5+12 with +4 = 32; x2 doubles numbers only)
must(roundScore({ status: 'stayed', row: [11, 5, 12], mods: ['p4'] }) === 32, 'rulebook example = 32');
must(roundScore({ status: 'stayed', row: [3, 4], mods: ['x2', 'p4'] }) === 18, 'x2 first, then +N');
must(roundScore({ status: 'stayed', row: [1, 2, 3, 4, 5, 6, 7], mods: ['x2'] }) === 28 * 2 + 15, 'flip 7 bonus is not doubled');
must(roundScore({ status: 'busted', row: [5, 5], mods: ['p10'] }) === 0, 'bust scores nothing');
// hit / bust
let s = mk(); s.players[0].row = [5]; s.draw = [5, ...s.draw]; s = reduce(s, { type: 'hit', player: 'p0' });
must(s.players[0].status === 'busted' && s.turnIdx === 1, 'duplicate busts and passes the turn');
// second chance saves; both cards discarded; turn passes (FAQ: no immediate redraw)
s = mk(); s.players[0].row = [5]; s.players[0].acts = ['second']; s.draw = [5, ...s.draw]; const dBefore = s.discard.length; s = reduce(s, { type: 'hit', player: 'p0' });
must(s.players[0].status === 'active' && s.players[0].row.length === 1 && s.players[0].acts.length === 0 && s.discard.length === dBefore + 2 && s.turnIdx === 1, 'second chance used: duplicate + second chance discarded, turn ends');
// second chance does NOT stop a freeze
s = mk(); s.players[0].acts = ['second']; s.draw = ['freeze', ...s.draw]; s = reduce(s, { type: 'hit', player: 'p0' });
must(s.choose && s.choose.card === 'freeze', 'drawing freeze asks for a target');
s = reduce(s, { type: 'target', player: 'p0', target: 'p1' }); must(s.players[1].status === 'frozen' && s.players[1].acts.includes('freeze'), 'freeze banks and removes the target');
s = mk(); s.players[1].acts = ['second']; s.draw = ['freeze', ...s.draw]; s = reduce(s, { type: 'hit', player: 'p0' }); s = reduce(s, { type: 'target', player: 'p0', target: 'p1' });
must(s.players[1].status === 'frozen' && s.players[1].acts.includes('second'), 'second chance does not protect from freeze');
// a second Second Chance must be given to another active player without one (or discarded)
s = mk(); s.players[0].acts = ['second']; s.draw = ['second', ...s.draw]; s = reduce(s, { type: 'hit', player: 'p0' });
must(s.choose && s.choose.card === 'second' && !s.choose.eligible.includes('p0'), 'second Second Chance goes to someone else');
s = reduce(s, { type: 'target', player: 'p0', target: 'p2' }); must(s.players[2].acts.includes('second') && s.players[0].acts.filter((x) => x === 'second').length === 1, 'given away');
s = mk(); s.players[0].acts = ['second']; s.players[1].acts = ['second']; s.players[2].acts = ['second']; s.draw = ['second', ...s.draw]; const dd = s.discard.length; s = reduce(s, { type: 'hit', player: 'p0' });
must(!s.choose && s.discard.length === dd + 1, 'nobody can take it: discarded');
// last active player must play an action on themself
s = mk(); s.players[1].status = 'stayed'; s.players[2].status = 'busted'; s.draw = ['freeze', ...s.draw]; s = reduce(s, { type: 'hit', player: 'p0' });
must(!s.choose && s.players[0].status === 'frozen', 'only active player freezes themself');
// flip three: three cards, stops on bust, actions deferred until after
s = mk(); s.draw = ['flip3', ...s.draw]; s = reduce(s, { type: 'hit', player: 'p0' }); s.draw = [1, 2, 3, ...s.draw.filter((c) => c !== 1 && c !== 2 && c !== 3)];
s = reduce(s, { type: 'target', player: 'p0', target: 'p1' }); must(s.players[1].row.join() === '1,2,3', 'flip three draws three cards');
s = mk(); s.draw = ['flip3', ...s.draw]; s = reduce(s, { type: 'hit', player: 'p0' }); s.players[1].row = [4]; s.draw = [4, 9, 9, ...s.draw];
s = reduce(s, { type: 'target', player: 'p0', target: 'p1' }); must(s.players[1].status === 'busted' && s.players[1].row.length === 2, 'flip three stops when the target busts');
s = mk(); s.draw = ['flip3', ...s.draw]; s = reduce(s, { type: 'hit', player: 'p0' }); s.draw = [6, 'freeze', 7, ...s.draw];
s = reduce(s, { type: 'target', player: 'p0', target: 'p0' }); must(s.choose && s.choose.card === 'freeze' && s.players[0].row.join() === '6,7', 'freeze drawn during flip three waits until all three cards are drawn');
s = reduce(s, { type: 'target', player: 'p0', target: 'p2' }); must(s.players[2].status === 'frozen', 'deferred freeze resolves afterwards');
// flip 7 ends the round for everyone: busted 0, others bank their cards
s = mk(); s.players[0].row = [1, 2, 3, 4, 5, 6]; s.players[1].row = [10]; s.players[2].row = [7, 7]; s.players[2].status = 'busted'; s.draw = [12, ...s.draw]; s = reduce(s, { type: 'hit', player: 'p0' });
must(s.phase === 'roundEnd' && s.scores.p0 === 21 + 12 + 15 && s.scores.p1 === 10 && (s.scores.p2 || 0) === 0, 'flip 7: +15, others bank, bust 0');
// stay needs a card in front
s = mk(); let threw = false; try { reduce(s, { type: 'stay', player: 'p0' }); } catch { threw = true; } must(threw, 'cannot stay with no cards');
// round ends when nobody is active; next round rotates the dealer; cards go to the discard pile
s = mk(); s.players[0].row = [8]; s.players[1].status = 'stayed'; s.players[2].status = 'stayed'; s = reduce(s, { type: 'stay', player: 'p0' });
must(s.phase === 'roundEnd' && s.scores.p0 === 8, 'round ends when all have stayed/busted');
const dealer1 = s.dealerId; s = reduce(s, { type: 'next', player: 'p1' }); must(s.dealerId !== dealer1 && s.round === 2 && s.players.every((p) => p.status !== 'busted'), 'dealer passes left and a new round starts');
// game end: unique >=200 wins; tie >=200 plays on
s = mk(); s.scores = { p0: 195, p1: 190, p2: 0 }; s.players[0].row = [10]; s.players[1].status = 'stayed'; s.players[2].status = 'stayed'; s = reduce(s, { type: 'stay', player: 'p0' });
must(s.phase === 'ended' && s.winner === 'p0', 'first to 200+ with the highest score wins');
s = mk(); s.scores = { p0: 190, p1: 200, p2: 0 }; s.players[0].row = [10]; s.players[1].status = 'stayed'; s.players[2].status = 'stayed'; s = reduce(s, { type: 'stay', player: 'p0' });
must(s.phase === 'roundEnd' && s.scores.p0 === 200 && s.scores.p1 === 200, 'tie above 200: play another round');
console.log('flip7 rules ok');
