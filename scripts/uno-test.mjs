import { newLobby, reduce, buildDeck, isPlayable, isWild, colorOf, valueOf, COLORS } from '../src/uno/engine.js';
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m); };
const total = (s) => s.draw.length + s.discard.length + s.players.reduce((a, p) => a + p.hand.length, 0);
must(buildDeck().length === 108, '108-card deck');

let games = 0, maxSteps = 0, challenges = 0, catches = 0;
for (let g = 0; g < 600; g++) {
  const n = 2 + (g % 9);
  let s = newLobby('p0', 'P0');
  for (let i = 1; i < n; i++) s = reduce(s, { type: 'join', player: 'p' + i, name: 'P' + i });
  s = reduce(s, { type: 'start', player: 'p0' });
  must(total(s) === 108, 'deck total at deal n=' + n);
  must(s.players.every((p) => p.hand.length >= 7 && p.hand.length <= 9), '7 cards each (9 if the opening card is a Draw Two)');
  let steps = 0;
  while (s.phase !== 'ended' && steps++ < 20000) {
    const act = (a) => { const r = reduce(s, a); if (r) s = r; return r; };
    must(total(s) === 108, 'conservation');
    if (Math.random() < 0.01) { const v = s.players.filter((p) => p.alive && p.id !== 'p0'); if (v.length > 1) { act({ type: 'leave', player: v[0].id }); if (s.phase === 'ended') break; } }
    if (s.catchable && Math.random() < 0.3) { const o = s.players.find((p) => p.alive && p.id !== s.catchable); if (o) { act({ type: 'catch', player: o.id, target: s.catchable }); catches++; continue; } }
    const cur = s.players[s.turnIdx];
    if (s.phase === 'startColor') { act({ type: 'chooseColor', player: cur.id, color: COLORS[0] }); continue; }
    if (s.phase === 'challenge') { const v = s.challenge.victim; challenges++; act({ type: Math.random() < 0.5 ? 'challenge' : 'accept', player: v }); continue; }
    const pl = cur.hand.filter((c) => isPlayable(s, c) && (!s.drawn || c === s.drawn));
    if (pl.length) {
      const c = pl[Math.floor(Math.random() * pl.length)];
      act({ type: 'play', player: cur.id, card: c, color: COLORS[Math.floor(Math.random() * 4)], uno: Math.random() < 0.5 });
    } else if (s.drawn) act({ type: 'pass', player: cur.id });
    else act({ type: 'draw', player: cur.id });
  }
  must(s.phase === 'ended' && s.winner, 'game finished n=' + n);
  must(total(s) === 108, 'conservation at end');
  maxSteps = Math.max(maxSteps, steps); games++;
}
console.log('uno sim ok:', games, 'games; max steps', maxSteps, '; challenges', challenges, '; catches', catches);

// ---- targeted rule checks ----
const mk = (n = 3) => { let s = newLobby('a', 'A'); ['b', 'c', 'd'].slice(0, n - 1).forEach((id) => { s = reduce(s, { type: 'join', player: id, name: id.toUpperCase() }); }); s = reduce(s, { type: 'start', player: 'a' }); s.phase = 'turn'; s.turnIdx = 0; s.dir = 1; s.drawn = null; s.catchable = null; s.challenge = null; s.color = 'R'; s.discard = ['R5']; s.players.forEach((p) => { p.hand = ['B1', 'B2', 'G3']; }); return s; };
let s = mk(); s.players[0].hand.push('RS'); s = reduce(s, { type: 'play', player: 'a', card: 'RS' }); must(s.turnIdx === 2, 'skip skips next');
s = mk(); s.players[0].hand.push('RV'); s = reduce(s, { type: 'play', player: 'a', card: 'RV' }); must(s.dir === -1 && s.turnIdx === 2, 'reverse flips direction (3p)');
s = mk(2); s.players[0].hand.push('RV'); s = reduce(s, { type: 'play', player: 'a', card: 'RV' }); must(s.turnIdx === 0, 'reverse = skip with 2 players');
s = mk(); s.players[0].hand.push('RD'); s = reduce(s, { type: 'play', player: 'a', card: 'RD' }); must(s.players[1].hand.length === 5 && s.turnIdx === 2, 'draw two: next draws 2 and is skipped');
s = mk(); let threw = false; try { reduce(s, { type: 'play', player: 'a', card: 'B1' }); } catch { threw = true; } must(threw, 'cannot play non-matching card');
s = mk(); s.players[0].hand.push('R9'); s = reduce(s, { type: 'play', player: 'a', card: 'R9' }); must(s.color === 'R' && s.turnIdx === 1, 'colour match plays');
s = mk(); s.players[0].hand.push('B5'); s = reduce(s, { type: 'play', player: 'a', card: 'B5' }); must(s.color === 'B', 'number match changes colour');
s = mk(); s.players[0].hand.push('W'); s = reduce(s, { type: 'play', player: 'a', card: 'W', color: 'G' }); must(s.color === 'G', 'wild sets colour');
// wild draw four: illegal play (had a red card) -> challenge succeeds
s = mk(); s.players[0].hand = ['F', 'R1', 'B2']; s = reduce(s, { type: 'play', player: 'a', card: 'F', color: 'B' });
must(s.phase === 'challenge' && s.challenge.illegal === true, 'WD4 with matching colour is illegal');
s = reduce(s, { type: 'challenge', player: 'b' }); must(s.players[0].hand.length === 2 + 4 && s.turnIdx === 1 && s.players[1].hand.length === 3, 'successful challenge: offender draws 4, victim plays');
// legal WD4, failed challenge -> victim draws 6 and is skipped
s = mk(); s.players[0].hand = ['F', 'B2', 'G3']; s = reduce(s, { type: 'play', player: 'a', card: 'F', color: 'B' });
must(s.challenge.illegal === false, 'WD4 with no matching colour is legal');
s = reduce(s, { type: 'challenge', player: 'b' }); must(s.players[1].hand.length === 9 && s.turnIdx === 2, 'failed challenge: victim draws 6');
// accept -> draws 4, skipped
s = mk(); s.players[0].hand = ['F', 'B2']; s = reduce(s, { type: 'play', player: 'a', card: 'F', color: 'G' }); s = reduce(s, { type: 'accept', player: 'b' });
must(s.players[1].hand.length === 7 && s.turnIdx === 2, 'accept: draw 4 and skip');
// UNO: forgetting lets others catch you; calling clears it
s = mk(); s.players[0].hand = ['R1', 'R2']; s = reduce(s, { type: 'play', player: 'a', card: 'R1' }); must(s.catchable === 'a', 'catchable when one card left and no UNO');
s = reduce(s, { type: 'catch', player: 'b', target: 'a' }); must(s.players[0].hand.length === 3 && !s.catchable, 'caught: draw 2');
s = mk(); s.players[0].hand = ['R1', 'R2']; s = reduce(s, { type: 'play', player: 'a', card: 'R1', uno: true }); must(!s.catchable, 'UNO called in time');
// draw: playable drawn card may be played, otherwise turn ends
s = mk(); s.draw = ['R7', ...s.draw]; s = reduce(s, { type: 'draw', player: 'a' }); must(s.drawn === 'R7' && s.turnIdx === 0, 'drawn playable card can be played');
s = reduce(s, { type: 'pass', player: 'a' }); must(s.turnIdx === 1, 'pass ends turn');
s = mk(); s.draw = ['G7', ...s.draw]; s = reduce(s, { type: 'draw', player: 'a' }); must(s.turnIdx === 1 && !s.drawn, 'unplayable draw ends turn');
// win + scoring
s = mk(); s.players[0].hand = ['R1']; s.players[1].hand = ['B9', 'RS', 'W']; s.players[2].hand = ['F']; s = reduce(s, { type: 'play', player: 'a', card: 'R1' });
must(s.phase === 'ended' && s.winner === 'a' && s.scores.a === 9 + 20 + 50 + 50, 'round scoring');
console.log('uno rules ok');
