import { useMemo } from 'react';
import { ACTION_NAME, TARGET, cardName, isMod, isNum, roundScore } from './engine.js';

const ACT_ICON = { freeze: '❄️', flip3: '🌀', second: '💛' };

function F7Card({ c, small, dim }) {
  let cls = 'f7c', style, label = cardName(c);
  if (isNum(c)) style = { '--h': c * 27 };
  else if (isMod(c)) cls += ' mod';
  else cls += ` act act-${c}`;
  if (small) cls += ' small';
  if (dim) cls += ' dim';
  return (
    <span className={cls} style={style} title={isNum(c) || isMod(c) ? label : `${label}`}>
      {!isNum(c) && !isMod(c) ? <span className="ic">{ACT_ICON[c]}</span> : null}
      <span className="v">{isNum(c) || isMod(c) ? label : ''}</span>
    </span>
  );
}

const STATUS = { active: '', stayed: '✋ stayed', busted: '💥 busted', frozen: '❄️ frozen' };

export default function Flip7Board({ s, me, mine, act, isOffline, kick }) {
  const cur = s.players[s.turnIdx];
  const live = s.players.filter((p) => !p.left);
  const nameOf = (id) => s.players.find((p) => p.id === id)?.name;
  const inPlay = s.phase === 'play';
  const myTurn = inPlay && !s.choose && s.stage === 'turns' && cur?.id === me.id && mine?.status === 'active';
  const choosing = s.choose && s.choose.by === me.id;

  // Public information: every card not yet drawn is in the draw pile, so these counts are what a careful player would track.
  const remaining = useMemo(() => {
    const c = Array(13).fill(0);
    for (const x of s.draw) if (isNum(x)) c[x] += 1;
    return c;
  }, [s.draw]);
  const bustOdds = useMemo(() => {
    if (!mine || !s.draw.length) return null;
    const bad = mine.row.reduce((a, n) => a + remaining[n], 0);
    return { bad, total: s.draw.length, pct: Math.round((bad / s.draw.length) * 100) };
  }, [mine, remaining, s.draw.length]);

  let status;
  if (s.phase === 'ended') status = `${nameOf(s.winner)} wins the game!`;
  else if (s.phase === 'roundEnd') status = s.summary?.flip7By ? `🎉 ${nameOf(s.summary.flip7By)} flipped 7!` : 'Round over';
  else if (s.choose) status = `${nameOf(s.choose.by)} chooses who gets ${ACTION_NAME[s.choose.card]}…`;
  else if (myTurn) status = 'Your turn: Hit or Stay?';
  else status = `${cur?.name}'s turn`;

  const sorted = [...live].sort((a, b) => (s.scores[b.id] || 0) - (s.scores[a.id] || 0));

  return (
    <>
      <p className="status center-text" aria-live="polite">Round {s.round} · first to {s.target || TARGET} · {status}</p>

      {kick && (
        <p className="offline-banner" role="status">
          ⏳ {kick.name} seems to be offline. {kick.secs > 0 ? `Removing them in ${kick.secs}s unless they come back.` : 'Removing them now…'}
        </p>
      )}

      <section className="f7-grid" aria-label="Players">
        {s.players.map((p) => {
          const turn = inPlay && !s.choose && s.stage === 'turns' && cur?.id === p.id;
          const pts = roundScore(p);
          return (
            <div key={p.id} className={`f7-seat${turn ? ' turn' : ''}${p.status !== 'active' ? ` st-${p.status}` : ''}${p.left ? ' dead' : ''}`}>
              <div className="f7-head">
                <strong>{p.id === s.dealerId ? '🃏 ' : ''}{p.name}{p.id === me.id ? ' (you)' : ''}</strong>
                <span className="pts">{s.scores[p.id] || 0}</span>
              </div>
              <div className="f7-sub">
                {p.left ? 'left the game' : STATUS[p.status] || (turn ? 'to play…' : 'in the round')}
                {isOffline(p.id) && !p.left ? ' · offline' : ''}
                {s.phase !== 'lobby' && !p.left && (p.row.length || p.mods.length) ? ` · +${pts}` : ''}
              </div>
              {(p.mods.length > 0 || p.acts.length > 0) && (
                <div className="f7-line">{p.mods.map((m, i) => <F7Card key={`m${i}`} c={m} small />)}{p.acts.map((a, i) => <F7Card key={`a${i}`} c={a} small />)}</div>
              )}
              <div className="f7-line">{p.row.map((n, i) => <F7Card key={i} c={n} small dim={p.status === 'busted'} />)}{!p.row.length && <span className="hint">no numbers yet</span>}</div>
              {s.hostId === me.id && !p.left && p.id !== me.id && isOffline(p.id) && s.phase !== 'ended' && (
                <button className="btn ghost small" onClick={() => act({ type: 'kick', target: p.id })}>Remove</button>
              )}
            </div>
          );
        })}
      </section>

      {inPlay && (
        <section className="alert wide">
          {choosing ? (
            <>
              <p>You {s.choose.card === 'second' ? 'already have a Second Chance. Give this one to' : 'drew'} <strong>{ACTION_NAME[s.choose.card]}</strong>{s.choose.card === 'second' ? '' : '. Who gets it?'}</p>
              <div className="color-row">
                {s.choose.eligible.map((id) => (
                  <button key={id} className="btn primary" onClick={() => act({ type: 'target', target: id })}>{id === me.id ? 'Myself' : nameOf(id)}</button>
                ))}
              </div>
              <p className="hint">{{ freeze: 'Freeze: they bank their points and are out of the round.', flip3: 'Flip Three: they must take three more cards.', second: 'Second Chance: protects against one duplicate number.' }[s.choose.card]}</p>
            </>
          ) : myTurn ? (
            <>
              {bustOdds && mine.row.length > 0 && (
                <p>Next card: <strong>{bustOdds.pct}%</strong> chance to bust ({bustOdds.bad} of {bustOdds.total} cards){mine.acts.includes('second') ? ', but your Second Chance protects you once' : ''}.</p>
              )}
              <p className="hint">You would bank <strong>{roundScore(mine)}</strong> points if you stay.</p>
              <div className="color-row">
                <button className="btn primary" onClick={() => act({ type: 'hit' })}>Hit (flip a card)</button>
                <button className="btn" disabled={mine.row.length + mine.mods.length + mine.acts.length === 0} onClick={() => act({ type: 'stay' })}>Stay and bank {roundScore(mine)}</button>
              </div>
            </>
          ) : (
            <p className="hint">{s.choose ? `Waiting for ${nameOf(s.choose.by)}…` : mine && mine.status !== 'active' ? 'You are out of this round. Wait for the others.' : `Waiting for ${cur?.name}…`}</p>
          )}
          <p className="hint">Deck: {s.draw.length} cards · discard: {s.discard.length}</p>
        </section>
      )}

      {(s.phase === 'roundEnd' || s.phase === 'ended') && s.summary && (
        <section className="alert wide">
          <div className="table-scroll">
            <table className="sum">
              <thead><tr><th>Player</th><th>Cards</th><th>Round</th><th>Total</th></tr></thead>
              <tbody>
                {s.summary.rows.map((r) => (
                  <tr key={r.id} className={s.winner === r.id ? 'win' : ''}>
                    <td>{nameOf(r.id)}{r.flip7 ? ' 🎉' : ''}</td>
                    <td>{r.status === 'busted' ? '💥 bust' : [...r.row, ...r.mods.map(cardName)].join(' ') || '-'}</td>
                    <td>{r.total}</td><td><strong>{s.scores[r.id] || 0}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {s.phase === 'roundEnd' && <button className="btn primary" onClick={() => act({ type: 'next' })}>Next round</button>}
          {s.phase === 'ended' && (
            <>
              <p className="status">🏆 {nameOf(s.winner)} wins with {s.scores[s.winner] || 0} points!</p>
              {s.hostId === me.id ? <button className="btn primary" onClick={() => act({ type: 'rematch' })}>Play again</button> : <p className="hint">The host can start a rematch.</p>}
            </>
          )}
        </section>
      )}

      <details className="log">
        <summary>Scores and card counter</summary>
        <ol className="scores">{sorted.map((p) => <li key={p.id}>{p.name}: {s.scores[p.id] || 0}</li>)}</ol>
        <p className="hint">Number cards still in the deck (unseen, order unknown):</p>
        <div className="counter">{remaining.map((n, v) => <span key={v}><b>{v}</b>×{n}</span>)}</div>
      </details>
      <details className="log">
        <summary>Quick rules</summary>
        <ul className="rules">
          <li>Hit to flip a card, or Stay to bank your points. A duplicate number busts you (0 points).</li>
          <li>7 different numbers = Flip 7: round ends for everyone and you score +15.</li>
          <li>Freeze banks a player's points and takes them out. Flip Three forces three flips. Second Chance cancels one duplicate (not a Freeze).</li>
          <li>Score = numbers (doubled by ×2), then +N modifiers, then the 15 bonus. First to {TARGET} wins; ties above {TARGET} play on.</li>
        </ul>
      </details>
      <details className="log">
        <summary>Game log</summary>
        <ol>{[...s.log].reverse().slice(0, 30).map((l, i) => <li key={i}>{l}</li>)}</ol>
      </details>
    </>
  );
}
