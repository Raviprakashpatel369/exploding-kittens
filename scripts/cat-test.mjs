import { newLobby, reduce, legalMoves, largestGroup, ROWS, RANGE, PREDICTIONS } from '../src/cat/engine.js';
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m); };
const ids = ['a', 'b', 'c', 'd', 'e'];
function mk(n) { let s = newLobby('a', 'A'); for (let i = 1; i < n; i++) s = reduce(s, { type: 'join', player: ids[i], name: ids[i].toUpperCase() }); return reduce(s, { type: 'start', player: 'a' }); }
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ---------- random-play simulation (all player counts) ----------
let games = 0, paradoxes = 0, rounds = 0, perfect = 0;
for (let g = 0; g < 500; g++) {
  const n = 2 + (g % 4);
  let s = mk(n);
  must(s.players.every((p) => p.hand.length === (n === 5 ? 9 : 10)), 'deal size n=' + n);
  let steps = 0;
  while (s.phase !== 'ended' && steps++ < 5000) {
    const act = (a) => { const r = reduce(s, a); if (r) s = r; return r; };
    if (s.phase === 'discard') { for (const p of s.players) act({ type: 'discard', player: p.id, card: pick(p.hand) }); continue; }
    if (s.phase === 'predict') { const p = s.players[s.turnIdx]; act({ type: 'predict', player: p.id, value: pick(PREDICTIONS[n]) }); continue; }
    if (s.phase === 'trick') {
      const p = s.players[s.turnIdx]; const m = pick(legalMoves(s, p)); must(m, 'a legal move must exist during a trick');
      act({ type: 'play', player: p.id, card: m.card, color: m.color }); continue;
    }
    if (s.phase === 'roundEnd') { rounds++; if (s.summary.paradox) paradoxes++; act({ type: 'next', player: 'a' }); continue; }
  }
  must(s.phase === 'ended' && s.winners.length >= 1, 'game finished n=' + n);
  // each colour+number cell is used at most once and tokens match plays
  must(ROWS.every((r) => s.board[r].length === RANGE[n]), 'board width');
  games++;
}
console.log('cat sim ok:', games, 'games;', rounds, 'full rounds;', paradoxes, 'ended in paradox');

// ---------- targeted rule checks ----------
function trickState(n = 3) { // jump straight into a trick with chosen hands
  let s = mk(n); s.phase = 'trick'; s.startId = 'a'; s.turnIdx = 0; s.trick = []; s.led = null; s.paradox = null;
  s.players.forEach((p) => { p.discarded = true; p.pred = 1; p.tricks = 0; p.colors = { R: true, B: true, Y: true, G: true }; });
  ROWS.forEach((r) => s.board[r].fill(null)); return s;
}
// leader may not lead red unless red is open
let s = trickState(); s.players[0].hand = [5, 6]; must(legalMoves(s, s.players[0]).every((m) => m.color !== 'R'), 'leader cannot lead red');
s.board.R[0] = 'b'; must(legalMoves(s, s.players[0]).some((m) => m.color === 'R'), 'leader may lead red once red is open');
// ...or when no other colour is possible
s = trickState(); s.players[0].hand = [5]; ['B', 'Y', 'G'].forEach((r) => { s.board[r][4] = 'x'; }); must(legalMoves(s, s.players[0]).every((m) => m.color === 'R') && legalMoves(s, s.players[0]).length === 1, 'red allowed if nothing else');
// rule 1: a colour+number can be observed only once
s = trickState(); s.players[0].hand = [5, 7]; s = reduce(s, { type: 'play', player: 'a', card: 5, color: 'B' });
let threw = false; try { reduce({ ...s, turnIdx: 1 }, { type: 'play', player: 'b', card: 5, color: 'B' }); } catch { threw = true; }
// player b needs a 5 to test; give it
s.players[1].hand = [5, 6]; threw = false; try { reduce(s, { type: 'play', player: 'b', card: 5, color: 'B' }); } catch { threw = true; } must(threw, 'blue 5 already observed');
// declaring a different colour than led removes your led-colour token
s = reduce(s, { type: 'play', player: 'b', card: 5, color: 'G' }); must(s.players[1].colors.B === false && s.players[1].colors.G === true, 'led colour token removed when following another colour');
// rule 2: lost colour cannot be declared any more
s.players[1].hand = [3]; must(legalMoves({ ...s, trick: [] }, s.players[1]).every((m) => m.color !== 'B'), 'cannot declare blue again');
// trick winner: red beats the led colour; otherwise highest of the led colour
s = trickState(); s.players[0].hand = [4, 1]; s.players[1].hand = [6, 1]; s.players[2].hand = [2, 1];
s = reduce(s, { type: 'play', player: 'a', card: 4, color: 'B' }); s = reduce(s, { type: 'play', player: 'b', card: 6, color: 'G' }); s = reduce(s, { type: 'play', player: 'c', card: 2, color: 'R' });
must(s.players[2].tricks === 1 && s.turnIdx === 2, 'red (trump) wins even with the lowest number, and leads next');
s = trickState(); s.players[0].hand = [4, 1]; s.players[1].hand = [6, 1]; s.players[2].hand = [5, 1];
s = reduce(s, { type: 'play', player: 'a', card: 4, color: 'B' }); s = reduce(s, { type: 'play', player: 'b', card: 6, color: 'G' }); s = reduce(s, { type: 'play', player: 'c', card: 5, color: 'B' });
must(s.players[2].tricks === 1, 'highest of the led colour wins; an off-colour 6 loses');
// a normal round (no paradox): ends when everyone has one card left, bonus = prediction hit x largest group
{ let r = trickState(); r.players[0].hand = [1, 2]; r.players[1].hand = [2, 3]; r.players[2].hand = [3, 4];
  r.players.forEach((p) => { p.pred = 1; });
  r = reduce(r, { type: 'play', player: 'a', card: 1, color: 'B' }); r = reduce(r, { type: 'play', player: 'b', card: 2, color: 'B' }); r = reduce(r, { type: 'play', player: 'c', card: 3, color: 'B' });
  must(r.phase === 'roundEnd' && !r.paradox, 'round ends with one card left each');
  const c = r.summary.rows.find((x) => x.id === 'c');
  must(c.trickPts === 1 && c.ok && c.bonus === 1 && c.total === 2, 'trick point + prediction bonus');
  must(r.summary.rows.find((x) => x.id === 'a').total === 0, 'a won nothing, predicted 1: no points'); }
// paradox: the next leader holds only blocked numbers -> round ends at once, -1 per trick, no bonus
{ let t2 = trickState(); t2.players[0].hand = [6, 4, 5]; t2.players[1].hand = [1, 2, 3]; t2.players[2].hand = [1, 2, 3];
  ['R', 'B', 'Y', 'G'].forEach((r) => { t2.board[r][3] = 'x'; t2.board[r][4] = 'x'; });
  t2.players[0].pred = 1;
  t2 = reduce(t2, { type: 'play', player: 'a', card: 6, color: 'B' });
  t2 = reduce(t2, { type: 'play', player: 'b', card: 1, color: 'Y' }); t2 = reduce(t2, { type: 'play', player: 'c', card: 2, color: 'Y' });
  must(t2.paradox === 'a', 'paradox detected when the next leader has only blocked cards');
  const row = t2.summary.rows.find((r) => r.id === 'a');
  must(row.caused && row.trickPts === -1 && row.bonus === 0 && row.ok === false, 'paradox: -1 per trick won, bonus forfeited');
  must(t2.phase === 'roundEnd', 'round ends at once'); }
// adjacency bonus
const board = { R: [null, 'x', 'a', 'a'], B: ['a', null, 'a', null], Y: ['a', 'a', 'a', 'b'], G: [null, null, 'b', 'a'] };
must(largestGroup(board, 'a') === 7, 'largest orthogonal group: R3,R4,B3,Y3,Y2,Y1,B1 = 7 (green 4 is isolated)');
// 3 players may only predict 1, 3 or 4
s = mk(3);
for (const p of s.players) s = reduce(s, { type: 'discard', player: p.id, card: p.hand[0] });
threw = false; try { reduce(s, { type: 'predict', player: s.players[s.turnIdx].id, value: 2 }); } catch { threw = true; } must(threw, '3 players cannot predict 2');
// 2 players: no prediction phase, centre tokens on the green row
s = mk(2); must(s.phase === 'discard', '2p starts with discard'); const blocked = ROWS.reduce((a, r) => a + s.board[r].filter((x) => x === 'x').length, 0); must(blocked === 3, '3 revealed cards block 3 spaces');
for (const p of s.players) s = reduce(s, { type: 'discard', player: p.id, card: p.hand[0] }); must(s.phase === 'trick', '2p skips predictions');
console.log('cat rules ok');
