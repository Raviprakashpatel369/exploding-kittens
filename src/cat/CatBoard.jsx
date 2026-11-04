import { useEffect, useMemo, useState } from 'react';
import { ROWS, COLOR_NAME, PREDICTIONS, legalMoves } from './engine.js';

const HEX = { R: '#e5383b', B: '#3b82f6', Y: '#ffd23f', G: '#3fb27f' };
const INK = { R: '#fff', B: '#fff', Y: '#2b2200', G: '#06301f' };
const TOKENS = ['🐱', '🐯', '🦁', '🐆', '🐈‍⬛']; // player tokens on the research board, by seat

const ColorDot = ({ c, off }) => (
  <span className={`cdot${off ? ' off' : ''}`} style={{ background: HEX[c] }} title={`${COLOR_NAME[c]}${off ? ' (no longer available this round)' : ''}`} />
);

export default function CatBoard({ s, me, mine, act, isOffline, kick }) {
  const [sel, setSel] = useState(null);
  useEffect(() => { setSel(null); }, [s.phase, s.turnIdx, s.round, mine?.hand.length]);

  const n = s.players.length;
  const seatOf = (id) => s.players.findIndex((p) => p.id === id);
  const tok = (id) => TOKENS[seatOf(id)] || '🐾';
  const nameOf = (id) => s.players.find((p) => p.id === id)?.name;
  const cur = s.players[s.turnIdx];
  const myTurn = s.phase === 'trick' && cur?.id === me.id && mine && !mine.left;
  const moves = useMemo(() => (mine && s.phase === 'trick' ? legalMoves(s, mine) : []), [s, mine]);
  const playable = new Set(myTurn ? moves.map((m) => m.card) : []);
  const redOpen = s.board.R.some((x) => x !== null);
  const M = s.board.R.length;
  const mySorted = [...(mine?.hand || [])].sort((a, b) => a - b);

  let status;
  if (s.phase === 'discard') status = mine?.discarded ? 'Waiting for everyone to set a card aside…' : 'Choose one card to set aside, face down';
  else if (s.phase === 'predict') status = cur.id === me.id ? 'How many tricks will you win?' : `${cur.name} is predicting…`;
  else if (s.phase === 'trick') status = myTurn ? (s.trick.length ? 'Your turn: pick a card and observe its colour' : 'You lead: pick a card and observe its colour') : `${cur.name} is playing…`;
  else if (s.phase === 'roundEnd') status = s.summary?.paradox ? `🌀 Paradox caused by ${nameOf(s.summary.paradox)}!` : 'Round complete';
  else status = s.summary?.paradox ? `🌀 Paradox caused by ${nameOf(s.summary.paradox)}. Game over` : 'Game over';

  const allowed = PREDICTIONS[n] || [];
  const colorsFor = (card) => moves.filter((m) => m.card === card).map((m) => m.color);
  const paradoxer = s.summary?.paradox && s.players.find((p) => p.id === s.summary.paradox);

  return (
    <>
      <section className="seats" aria-label="Players">
        {s.players.map((p) => (
          <div key={p.id} className={`seat${p.left ? ' dead' : ''}${['trick', 'predict'].includes(s.phase) && cur.id === p.id ? ' turn' : ''}`}>
            <strong>{tok(p.id)} {p.name}{p.id === me.id ? ' (you)' : ''}{p.id === s.startId ? ' ⭐' : ''}</strong>
            <span>
              {s.phase === 'discard' ? (p.discarded ? 'ready' : 'choosing…') : `${p.tricks} won${p.pred ? ` · predicted ${p.pred}` : ''}`}
              {isOffline(p.id) ? ' · offline' : ''}
            </span>
            <span className="cdots" aria-label="Colours still available this round">
              {ROWS.map((c) => <ColorDot key={c} c={c} off={p.colors && !p.colors[c]} />)}
              <em className="pts">{s.scores[p.id] || 0} pts</em>
            </span>
            {s.hostId === me.id && !p.left && p.id !== me.id && isOffline(p.id) && (
              <button className="btn ghost small" onClick={() => act({ type: 'kick', target: p.id })}>Remove</button>
            )}
          </div>
        ))}
      </section>

      {kick && (
        <p className="offline-banner" role="status">
          ⏳ {kick.name} seems to be offline. {kick.secs > 0 ? `Removing them in ${kick.secs}s unless they come back.` : 'Removing them now…'}
        </p>
      )}

      <p className="status center-text" aria-live="polite">Round {s.round} of {s.totalRounds} · {status}</p>

      <section className="rb-wrap" aria-label="Research board">
        <div className="rb" style={{ gridTemplateColumns: `78px repeat(${M}, minmax(30px, 1fr))` }}>
          {ROWS.map((r) => (
            <div className="rb-row" key={r} style={{ '--c': HEX[r], '--ink': INK[r] }}>
              <div className="rb-label">{COLOR_NAME[r]}{r === 'R' ? ' (trump)' : ''}</div>
              {s.board[r].map((v, i) => (
                <div key={i} className={`rb-cell${v ? ' used' : ''}`} title={v ? (v === 'x' ? 'Blocked' : `${nameOf(v)} observed ${COLOR_NAME[r]} ${i + 1}`) : `${COLOR_NAME[r]} ${i + 1}`}>
                  {v === 'x' ? '⬛' : v ? tok(v) : i + 1}
                </div>
              ))}
            </div>
          ))}
        </div>
        <p className="hint">{redOpen ? 'Red has been observed, so the leader may now lead trump.' : 'Nobody has observed red yet: the leader may not lead red.'}</p>
      </section>

      {s.phase === 'trick' && (
        <section className="trick-area" aria-label="Current trick">
          <strong>{s.trick.length ? `Led colour: ${COLOR_NAME[s.led]}` : s.lastTrick ? `${nameOf(s.lastTrick.winner)} won the last trick and leads` : 'New trick'}</strong>
          <div className="trick-cards">
            {s.trick.map((t) => (
              <div key={t.player} className="qcard played" style={{ '--c': HEX[t.color], '--ink': INK[t.color] }}>
                <span className="who">{tok(t.player)} {nameOf(t.player)}</span>
                <span className="num">{t.card}</span>
                <span className="col">{COLOR_NAME[t.color]}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {(s.phase === 'roundEnd' || s.phase === 'ended') && s.summary && (
        <section className="alert wide">
          {paradoxer && (
            <p>🌀 <strong>{paradoxer.name}</strong> had no legal card to play and revealed their hand: {paradoxer.hand.join(', ')}. The unfinished trick is void.</p>
          )}
          <div className="table-scroll">
            <table className="sum">
              <thead><tr><th>Player</th><th>Tricks</th><th>Predicted</th><th>Tricks pts</th><th>Bonus</th><th>Round</th><th>Total</th></tr></thead>
              <tbody>
                {s.summary.rows.map((r) => (
                  <tr key={r.id} className={s.winners?.includes(r.id) ? 'win' : ''}>
                    <td>{tok(r.id)} {nameOf(r.id)}</td>
                    <td>{r.tricks}</td><td>{r.pred ?? (n === 2 ? '≤4' : '-')}</td>
                    <td>{r.trickPts}</td><td>{r.caused ? 'lost' : r.ok ? `+${r.bonus}` : 0}</td>
                    <td>{r.total}</td><td><strong>{s.scores[r.id] || 0}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {s.phase === 'roundEnd' && <button className="btn primary" onClick={() => act({ type: 'next' })}>Next round</button>}
          {s.phase === 'ended' && (
            <>
              <p className="status">🏆 {s.winners.map(nameOf).join(' & ')} {s.winners.length > 1 ? 'share the win' : 'wins'}!</p>
              {s.hostId === me.id ? <button className="btn primary" onClick={() => act({ type: 'rematch' })}>Play again</button> : <p className="hint">The host can start a rematch.</p>}
            </>
          )}
        </section>
      )}

      {s.phase === 'predict' && cur.id === me.id && (
        <section className="alert wide">
          <p>Predict how many tricks you will win this round. A correct prediction scores a bonus for your largest connected group on the board.</p>
          <div className="color-row">
            {allowed.map((v) => <button key={v} className="btn primary" onClick={() => act({ type: 'predict', value: v })}>{v} trick{v === 1 ? '' : 's'}</button>)}
          </div>
        </section>
      )}

      {mine && !mine.left ? (
        <section className="hand-area" aria-label="Your hand">
          <div className="hand">
            {mySorted.map((c, i) => {
              const can = s.phase === 'discard' ? !mine.discarded : playable.has(c);
              return (
                <button key={`${c}-${i}`} type="button" disabled={!can} onClick={() => setSel(sel === c ? null : c)}
                  className={`qcard${sel === c ? ' sel' : ''}${can ? ' ok' : ''}`} aria-pressed={sel === c} title="Its colour is not decided until you play it">
                  <span className="num">{c}</span><span className="col">?</span>
                </button>
              );
            })}
          </div>
          <div className="actions">
            {s.phase === 'discard' && !mine.discarded && (
              <button className="btn primary" disabled={sel === null} onClick={() => act({ type: 'discard', card: sel })}>
                {sel === null ? 'Select a card to set aside' : `Set aside ${sel} (face down)`}
              </button>
            )}
            {myTurn && sel !== null && colorsFor(sel).map((col) => (
              <button key={col} className="color-btn" style={{ background: HEX[col], color: INK[col] }} onClick={() => act({ type: 'play', card: sel, color: col })}>
                Observe {sel} as {COLOR_NAME[col]}
              </button>
            ))}
            {myTurn && sel === null && <span className="hint">Select a card, then choose the colour you observe.</span>}
          </div>
        </section>
      ) : mine?.left ? <p className="hint spectate">You left this game.</p> : <p className="hint spectate">You're watching this game.</p>}

      <details className="log">
        <summary>Quick rules</summary>
        <ul className="rules">
          <li>Each number can be observed in each colour only once per round (the board). You declare a card's colour when you play it.</li>
          <li>The leader can't lead red (trump) until red has been observed, unless they have no other option.</li>
          <li>Declaring a colour other than the led colour means you can't declare the led colour again this round.</li>
          <li>Red beats everything; otherwise the highest card of the led colour wins. 1 point per trick won.</li>
          <li>If you have no legal card, it's a <strong>paradox</strong>: the round ends, you score −1 per trick and no bonus.</li>
          <li>Predicted correctly? Bonus = your largest group of connected tokens on the board.</li>
        </ul>
      </details>
      <details className="log">
        <summary>Game log</summary>
        <ol>{[...s.log].reverse().slice(0, 25).map((l, i) => <li key={i}>{l}</li>)}</ol>
      </details>
    </>
  );
}
