import { useEffect, useMemo, useState } from 'react';
import { COLORS, COLOR_NAME, TARGET, colorOf, isPlayable, isWild, valueOf } from './engine.js';

const COLOR_HEX = { R: '#e5383b', Y: '#ffd23f', G: '#3fb27f', B: '#3b82f6' };
const SYMBOL = { S: '⊘', V: '⇄', D: '+2', W: '★', F: '+4' };
const symbolOf = (c) => SYMBOL[valueOf(c)] || valueOf(c);

function UnoCard({ c, playable, selected, onClick, small, disabled }) {
  const wild = isWild(c);
  const label = wild ? (c === 'F' ? 'Wild Draw Four' : 'Wild')
    : `${COLOR_NAME[colorOf(c)]} ${({ S: 'Skip', V: 'Reverse', D: 'Draw Two' })[valueOf(c)] || valueOf(c)}`;
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled}
      className={`uno-card${wild ? ' wild' : ''}${playable ? ' playable' : ''}${selected ? ' sel' : ''}${small ? ' small' : ''}`}
      style={wild ? undefined : { '--c': COLOR_HEX[colorOf(c)], '--fg': colorOf(c) === 'Y' ? '#2b2200' : '#fff' }}
      onClick={onClick}>
      <span className="v">{symbolOf(c)}</span>
    </button>
  );
}

function ColorPicker({ onPick, onCancel, title }) {
  return (
    <div className="alert" role="group" aria-label={title}>
      <p>{title}</p>
      <div className="color-row">
        {COLORS.map((col) => (
          <button key={col} className="color-btn" style={{ background: COLOR_HEX[col], color: col === 'Y' ? '#2b2200' : '#fff' }}
            onClick={() => onPick(col)}>{COLOR_NAME[col]}</button>
        ))}
      </div>
      {onCancel && <button className="btn ghost small" onClick={onCancel}>Cancel</button>}
    </div>
  );
}

const ORDER = { R: 0, Y: 1, G: 2, B: 3 };
const sortKey = (c) => (isWild(c) ? 100 + (c === 'F' ? 1 : 0) : ORDER[colorOf(c)] * 20 + (/\d/.test(valueOf(c)) ? Number(valueOf(c)) : 10 + valueOf(c).charCodeAt(0) / 100));

export default function UnoBoard({ s, me, mine, act, isOffline, kick }) {
  const [pickFor, setPickFor] = useState(null); // a wild card waiting for a colour
  const [unoNext, setUnoNext] = useState(false); // "say UNO" with the next play

  const hand = useMemo(() => [...(mine?.hand || [])].sort((a, b) => sortKey(a) - sortKey(b)), [mine?.hand]);
  useEffect(() => { setPickFor(null); }, [s.turnIdx, s.phase]);
  useEffect(() => { if (hand.length > 2) setUnoNext(false); }, [hand.length]);

  const cur = s.players[s.turnIdx];
  const myTurn = s.phase === 'turn' && cur.id === me.id && mine?.alive;
  const nameOf = (id) => s.players.find((p) => p.id === id)?.name;
  const top = s.discard[s.discard.length - 1];
  const ch = s.challenge;

  let status;
  if (s.phase === 'ended') status = s.matchWinner ? `${nameOf(s.winner)} wins the match!` : `${nameOf(s.winner)} wins the round!`;
  else if (s.phase === 'challenge') status = `${nameOf(ch.by)} played Wild Draw Four. ${nameOf(ch.victim)} decides…`;
  else if (s.phase === 'startColor') status = `${cur.name} picks the starting colour`;
  else if (myTurn) status = s.drawn ? 'Play the card you drew, or keep it' : 'Your turn';
  else status = `${cur.name}'s turn`;

  const play = (c) => {
    if (!myTurn) return;
    if (isWild(c)) return setPickFor(c);
    act({ type: 'play', card: c, uno: unoNext });
    setUnoNext(false);
  };
  const playWild = (color) => { act({ type: 'play', card: pickFor, color, uno: unoNext }); setPickFor(null); setUnoNext(false); };

  const iAmCatchable = s.catchable === me.id;
  const sortedScores = s.players.filter((p) => s.scores[p.id]).sort((a, b) => (s.scores[b.id] || 0) - (s.scores[a.id] || 0));

  return (
    <>
      <section className="seats" aria-label="Players">
        {s.players.map((p) => (
          <div key={p.id} className={`seat${p.alive ? '' : ' dead'}${s.phase !== 'ended' && cur.id === p.id ? ' turn' : ''}`}>
            <strong>{p.alive ? p.name : `💀 ${p.name}`}{p.id === me.id ? ' (you)' : ''}</strong>
            <span>
              {p.alive ? `${p.hand.length} card${p.hand.length === 1 ? '' : 's'}` : p.left ? 'left the game' : 'out'}
              {p.alive && isOffline(p.id) ? ' · offline' : ''}
              {s.scores[p.id] ? ` · ${s.scores[p.id]} pts` : ''}
            </span>
            {p.alive && p.hand.length === 1 && <span className="badge">UNO</span>}
            {s.catchable === p.id && p.id !== me.id && (
              <button className="btn primary small" onClick={() => act({ type: 'catch', target: p.id })}>Catch! forgot UNO</button>
            )}
            {s.hostId === me.id && p.alive && p.id !== me.id && isOffline(p.id) && s.phase !== 'ended' && (
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

      <main className="center">
        <div className="pile">
          <button className="uno-card back" disabled={!myTurn || !!s.drawn} onClick={() => act({ type: 'draw' })}
            aria-label="Draw a card"><span className="v">UNO</span><span className="count-s">{s.draw.length}</span></button>
          <span className="cap">{myTurn && !s.drawn ? 'Click to draw' : 'Draw pile'}</span>
        </div>

        <div className="statusbox">
          <p className="status" aria-live="polite">{status}</p>
          <p className="hint">Direction {s.dir === 1 ? '↻ clockwise' : '↺ counter-clockwise'}</p>

          {s.phase === 'startColor' && cur.id === me.id && (
            <ColorPicker title="The first card is Wild. Pick the starting colour." onPick={(color) => act({ type: 'chooseColor', color })} />
          )}

          {s.phase === 'challenge' && ch.victim === me.id && (
            <div className="alert">
              <p>{nameOf(ch.by)} played a Wild Draw Four. Accept and draw 4, or challenge?</p>
              <p className="hint">Challenge: if they held a {COLOR_NAME[ch.prevColor]} card they draw 4 instead. If not, you draw 6.</p>
              <div className="row">
                <button className="btn" onClick={() => act({ type: 'accept' })}>Draw 4</button>
                <button className="btn primary" onClick={() => act({ type: 'challenge' })}>Challenge!</button>
              </div>
            </div>
          )}

          {pickFor && <ColorPicker title="Choose a colour" onPick={playWild} onCancel={() => setPickFor(null)} />}

          {s.phase === 'ended' && (
            <div className="alert">
              {sortedScores.length > 0 && (
                <ol className="scores">
                  {sortedScores.map((p) => <li key={p.id}>{p.name}: {s.scores[p.id]}</li>)}
                </ol>
              )}
              <p className="hint">First to {TARGET} points wins the match.</p>
              {s.hostId === me.id
                ? <button className="btn primary" onClick={() => act({ type: 'rematch' })}>{s.matchWinner ? 'Start a new match' : 'Next round'}</button>
                : <p className="hint">The host starts the next round.</p>}
            </div>
          )}
        </div>

        <div className="pile">
          <div className="discard-wrap">
            {top && <UnoCard c={top} disabled />}
            {s.color && <span className="color-chip" style={{ background: COLOR_HEX[s.color] }} title={`Current colour: ${COLOR_NAME[s.color]}`} />}
          </div>
          <span className="cap">{s.color ? COLOR_NAME[s.color] : 'Discard'}</span>
        </div>
      </main>

      {mine ? (
        <section className="hand-area" aria-label="Your hand">
          <div className="hand">
            {hand.map((c, i) => {
              const ok = myTurn && isPlayable(s, c) && (!s.drawn || c === s.drawn);
              return <UnoCard key={`${c}-${i}`} c={c} playable={ok} disabled={!ok} onClick={() => play(c)} />;
            })}
            {!hand.length && <p className="hint">No cards in hand.</p>}
          </div>
          <div className="actions">
            {iAmCatchable && <button className="btn primary" onClick={() => act({ type: 'uno' })}>UNO!</button>}
            {myTurn && hand.length === 2 && (
              <label className="check">
                <input type="checkbox" checked={unoNext} onChange={(e) => setUnoNext(e.target.checked)} />
                Say UNO with this play
              </label>
            )}
            {myTurn && s.drawn && <button className="btn" onClick={() => act({ type: 'pass' })}>Keep it and end turn</button>}
            {myTurn && !s.drawn && <button className="btn" onClick={() => act({ type: 'draw' })}>Draw a card</button>}
          </div>
        </section>
      ) : <p className="hint spectate">You're watching this game.</p>}

      <details className="log">
        <summary>Game log</summary>
        <ol>{[...s.log].reverse().slice(0, 25).map((l, i) => <li key={i}>{l}</li>)}</ol>
      </details>
    </>
  );
}
