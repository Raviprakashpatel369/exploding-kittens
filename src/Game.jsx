import { useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from './useGame.js';
import { CARDS, CARD_ORDER, SINGLE_PLAY } from './cards.js';
import { NOPE_MS, blockerId } from './engine.js';

const GAME_WAIT = 60000;   // offline player we're waiting on is removed after 60s
const SHORT_WAIT = 15000;  // ...or 15s if they were already gone for a while
const LOBBY_WAIT = 30000;  // lobby: offline players are dropped after 30s

function Card({ type, selected, onClick, mini, disabled }) {
  const c = CARDS[type];
  return (
    <button type="button" className={`card${selected ? ' sel' : ''}${mini ? ' mini' : ''}`}
      style={{ '--bg': c.color, '--fg': c.fg }} onClick={onClick} disabled={disabled}
      title={`${c.name}: ${c.text}`} aria-pressed={onClick ? !!selected : undefined}>
      <span className="emoji" aria-hidden>{c.emoji}</span>
      <span className="cname">{c.name}</span>
    </button>
  );
}

export default function Game({ code, me, onLeave }) {
  const { state: s, notFound, error, dispatch, online, synced } = useGame(code, me.id);
  const [sel, setSel] = useState([]);
  const [target, setTarget] = useState('');
  const [named, setNamed] = useState('attack');
  const [pos, setPos] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [winStart, setWinStart] = useState(Date.now());
  const [copied, setCopied] = useState(false);
  const [offlineSince, setOfflineSince] = useState({});
  const [kick, setKick] = useState(null);
  const [tick, setTick] = useState(0);
  const blockRef = useRef({ key: '', t: 0 });
  const kickedAt = useRef({});
  const leaving = useRef(false);

  const mine = s?.players.find((p) => p.id === me.id);
  const hand = useMemo(
    () => [...(mine?.hand || [])].sort((a, b) => CARD_ORDER.indexOf(a) - CARD_ORDER.indexOf(b)),
    [mine?.hand],
  );
  const handKey = hand.join(',');

  // join automatically when opening a lobby link
  useEffect(() => {
    if (s && s.phase === 'lobby' && !mine && !leaving.current) dispatch({ type: 'join', player: me.id, name: me.name.trim() });
  }, [s?.phase, !!mine]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setSel([]); }, [handKey, s?.phase, s?.turnIdx]);

  // Nope window: the player who acted resolves it first; everyone else is a fallback.
  // Nope window. Every client times it from when *it* received the card, so clock differences between
  // players' devices can't shorten it. The player who acted resolves it first; others are a fallback.
  const pend = s?.pending;
  useEffect(() => {
    if (!pend) return undefined;
    setWinStart(Date.now());
    const delay = NOPE_MS + (pend.by === me.id ? 400 : 5000);
    const t = setTimeout(() => dispatch({ type: 'resolve', seq: pend.seq }), delay);
    return () => clearTimeout(t);
  }, [pend?.id, pend?.seq]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!pend) return undefined;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [pend?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Who is offline, and since when (only trusted after the first presence sync).
  useEffect(() => {
    if (!s || !synced) return;
    const t = Date.now();
    setOfflineSince((prev) => {
      const next = {};
      for (const p of s.players) if (p.id !== me.id && !online.has(p.id)) next[p.id] = prev[p.id] || t;
      return next;
    });
  }, [online, synced, s?.players.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Remove the offline player the game is waiting on. Every online player runs this with a small
  // stagger; the engine ignores duplicates, so exactly one removal happens.
  useEffect(() => {
    if (!s || !synced || s.phase === 'ended' || !s.players.some((p) => p.id === me.id)) { setKick(null); return; }
    const t = Date.now();
    let target = null, wait = 0, since = 0;
    if (s.phase === 'lobby') {
      target = s.players.find((p) => offlineSince[p.id]);
      if (target) { since = offlineSince[target.id]; wait = LOBBY_WAIT; }
    } else {
      const b = blockerId(s);
      const o = b && offlineSince[b];
      if (o) {
        const key = `${b}|${s.phase}|${s.log.length}`;
        if (blockRef.current.key !== key) blockRef.current = { key, t };
        wait = t - o >= GAME_WAIT ? SHORT_WAIT : GAME_WAIT;
        since = Math.max(o, blockRef.current.t);
        target = s.players.find((p) => p.id === b);
      }
    }
    if (!target) { setKick(null); return; }
    const left = wait - (t - since);
    setKick({ id: target.id, name: target.name, secs: Math.max(0, Math.ceil(left / 1000)) });
    const rank = s.players.filter((p) => p.id !== target.id && (p.id === me.id || online.has(p.id))).findIndex((p) => p.id === me.id);
    if (left + rank * 3000 <= 0 && (kickedAt.current[target.id] || 0) < t - 5000) {
      kickedAt.current[target.id] = t;
      dispatch({ type: 'kick', player: me.id, target: target.id });
    }
  }, [tick, s, offlineSince, online, synced]); // eslint-disable-line react-hooks/exhaustive-deps

  if (notFound) {
    return (
      <main className="home">
        <h1>Game not found</h1>
        <p className="hint">Check the 4-letter code and try again.</p>
        <button className="btn primary" onClick={onLeave}>Back</button>
      </main>
    );
  }
  if (!s) return <main className="home"><p className="hint">Connecting…</p></main>;

  const act = (a) => dispatch({ ...a, player: me.id });
  const link = `${location.origin}${location.pathname}#${code}`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };

  const leave = async () => {
    const inGame = mine && s.phase !== 'lobby' && s.phase !== 'ended' && mine.alive;
    if (inGame && !window.confirm('Leave the game? You will be out of this round.')) return;
    leaving.current = true;
    if (mine && (s.phase === 'lobby' || inGame)) await act({ type: 'leave' });
    onLeave();
  };
  const isOffline = (id) => Boolean(offlineSince[id]);

  const header = (
    <header className="bar">
      <h2>Exploding Kittens</h2>
      <button className="code" onClick={copy} title="Copy invite link">
        {copied ? 'Link copied' : `Game ${code}`}
      </button>
      <button className="btn ghost" onClick={leave}>Leave</button>
    </header>
  );
  const toast = error && <div className="toast" role="alert">{error}</div>;

  // ---------------------------------------------------------------- lobby
  if (s.phase === 'lobby') {
    const isHost = s.hostId === me.id;
    return (
      <div className="table">
        {header}
        <main className="lobby card-panel">
          <h1>Waiting for players</h1>
          <p className="hint">Send this link to your friends, or give them the code <strong>{code}</strong>.</p>
          <button className="btn" onClick={copy}>{copied ? 'Link copied' : 'Copy invite link'}</button>
          <ul className="roster">
            {s.players.map((p) => (
              <li key={p.id}>
                <span>{p.name}{p.id === s.hostId ? ' (host)' : ''}{p.id === me.id ? ' (you)' : ''}{isOffline(p.id) ? ' · offline' : ''}</span>
                {isHost && p.id !== me.id && (
                  <button className="btn ghost small" onClick={() => act({ type: 'kick', target: p.id })}>Remove</button>
                )}
              </li>
            ))}
          </ul>
          {isHost ? (
            <>
              <label className="check">
                <input type="checkbox" checked={s.fast} onChange={(e) => act({ type: 'setFast', value: e.target.checked })} />
                Faster game (removes a third of the deck, recommended for 2–3 players)
              </label>
              <button className="btn primary" disabled={s.players.length < 2} onClick={() => act({ type: 'start' })}>
                {s.players.length < 2 ? 'Need 2+ players' : `Start with ${s.players.length} players`}
              </button>
            </>
          ) : <p className="hint">The host will start the game.</p>}
        </main>
        {toast}
      </div>
    );
  }

  // ---------------------------------------------------------------- game
  const cur = s.players[s.turnIdx];
  const myTurn = s.phase === 'turn' && !s.pending && cur.id === me.id && mine?.alive;
  const targets = s.players.filter((p) => p.alive && p.id !== me.id && p.hand.length > 0);
  const tgt = targets.find((t) => t.id === target)?.id || targets[0]?.id;
  const selTypes = sel.map((i) => hand[i]);
  const same = selTypes.length > 0 && selTypes.every((t) => t === selTypes[0]);
  const nameOf = (id) => s.players.find((p) => p.id === id)?.name;
  const canNope = pend && mine?.alive && hand.includes('nope');
  const pct = pend ? Math.max(0, Math.min(100, ((winStart + NOPE_MS - now) / NOPE_MS) * 100)) : 0;
  const nopeCount = hand.filter((c) => c === 'nope').length;

  const onCard = (i) => {
    if (pend) { if (hand[i] === 'nope' && mine?.alive) act({ type: 'nope' }); return; }
    if (s.phase === 'favor') return setSel([i]);
    if (!myTurn) return;
    setSel((cur2) => {
      if (cur2.includes(i)) return cur2.filter((x) => x !== i);
      if (cur2.length && hand[cur2[0]] !== hand[i]) return [i];
      return cur2.length >= 3 ? cur2 : [...cur2, i];
    });
  };

  let play = null;
  if (myTurn && same) {
    const t = selTypes[0];
    if (sel.length === 1 && SINGLE_PLAY.includes(t)) {
      play = {
        label: `Play ${CARDS[t].name}`, needsTarget: t === 'favor',
        run: () => act({ type: 'play', card: t, target: t === 'favor' ? tgt : undefined }),
      };
    } else if ((sel.length === 2 || sel.length === 3) && t !== 'exploding') {
      play = {
        label: sel.length === 2 ? `Play pair of ${CARDS[t].name}s` : `Play three of a kind`,
        needsTarget: true, needsName: sel.length === 3,
        run: () => act({ type: 'combo', card: t, count: sel.length, target: tgt, named }),
      };
    }
  }

  let status = '';
  if (s.phase === 'ended') status = `${nameOf(s.winner)} wins!`;
  else if (s.pending) status = `${nameOf(s.pending.by)} is playing ${CARDS[s.pending.card].name}…`;
  else if (s.phase === 'favor') status = `${nameOf(s.favor.from)} is choosing a card to give ${nameOf(s.favor.to)}`;
  else if (s.phase === 'defuse') status = `${cur.name} drew an Exploding Kitten!`;
  else if (s.phase === 'reinsert') status = `${cur.name} is hiding the kitten`;
  else status = myTurn ? 'Your turn' : `${cur.name}'s turn${s.turnsLeft > 1 ? ` (${s.turnsLeft} turns left)` : ''}`;

  const discardTop = s.discard[s.discard.length - 1];
  const myPeek = s.peek && s.peek.playerId === me.id ? s.peek.cards : null;

  return (
    <div className="table">
      {header}

      <section className="seats" aria-label="Players">
        {s.players.map((p) => (
          <div key={p.id} className={`seat${p.alive ? '' : ' dead'}${s.phase !== 'ended' && cur.id === p.id ? ' turn' : ''}`}>
            <strong>{p.alive ? p.name : `💀 ${p.name}`}{p.id === me.id ? ' (you)' : ''}</strong>
            <span>{p.alive ? `${p.hand.length} cards` : p.left ? 'left the game' : 'exploded'}{p.alive && isOffline(p.id) ? ' · offline' : ''}</span>
            {s.hostId === me.id && p.alive && p.id !== me.id && isOffline(p.id) && s.phase !== 'ended' && (
              <button className="btn ghost small" onClick={() => act({ type: 'kick', target: p.id })}>Remove</button>
            )}
            {p.alive && s.phase !== 'ended' && cur.id === p.id && s.turnsLeft > 1 && <span className="badge">{s.turnsLeft} turns</span>}
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
          <button className="card back" disabled={!myTurn} onClick={() => act({ type: 'draw' })}
            aria-label="Draw a card and end your turn">
            <span className="count">{s.draw.length}</span>
            <span className="cname">Draw pile</span>
          </button>
          <span className="cap">{myTurn ? 'Click to draw' : 'Draw pile'}</span>
        </div>
        <div className="statusbox">
          <p className="status" aria-live="polite">{status}</p>

          {pend && (
            <div className="nope-box">
              <div className="meter"><div style={{ width: `${pct}%` }} /></div>
              <p>
                {pend.kind === 'combo' ? `${pend.count} × ${CARDS[pend.card].name}` : CARDS[pend.card].name}
                {pend.target ? ` → ${nameOf(pend.target)}` : ''}
                {' · '}{pend.nopes % 2 ? 'currently cancelled' : 'going through'}
              </p>
              {canNope && <button className="btn nope" onClick={() => act({ type: 'nope' })}>NOPE! ({nopeCount})</button>}
              {!canNope && mine?.alive && <p className="hint">You have no Nope card.</p>}
              <p className="hint">Anyone holding a Nope can play it now, even out of turn.</p>
            </div>
          )}

          {s.phase === 'defuse' && cur.id === me.id && (
            <div className="alert">
              <p>You drew an Exploding Kitten. You have a Defuse.</p>
              <button className="btn primary" onClick={() => act({ type: 'defuse' })}>Play Defuse</button>
            </div>
          )}
          {s.phase === 'reinsert' && cur.id === me.id && (
            <div className="alert">
              <label htmlFor="pos">Where should the kitten go? ({s.draw.length} cards in the pile)</label>
              <input id="pos" type="range" min={0} max={s.draw.length} value={Math.min(pos, s.draw.length)}
                onChange={(e) => setPos(+e.target.value)} />
              <p className="hint">{pos === 0 ? 'On top: the next player draws it' : pos >= s.draw.length ? 'At the very bottom' : `${pos} cards down`}</p>
              <button className="btn primary" onClick={() => act({ type: 'reinsert', pos: Math.min(pos, s.draw.length) })}>Hide the kitten</button>
            </div>
          )}
          {s.phase === 'favor' && s.favor.from === me.id && (
            <div className="alert">
              <p>Pick a card to give {nameOf(s.favor.to)}.</p>
              <button className="btn primary" disabled={sel.length !== 1}
                onClick={() => act({ type: 'favorGive', card: hand[sel[0]] })}>Give selected card</button>
            </div>
          )}
          {s.phase === 'ended' && (
            <div className="alert">
              {s.hostId === me.id
                ? <button className="btn primary" onClick={() => act({ type: 'rematch' })}>Play again</button>
                : <p className="hint">The host can start a rematch.</p>}
            </div>
          )}
        </div>
        <div className="pile">
          {discardTop ? <Card type={discardTop} mini={false} disabled /> : <div className="card empty">Discard</div>}
          <span className="cap">Discard</span>
        </div>
      </main>

      {myPeek && (
        <section className="peek" aria-label="Top of the draw pile">
          <span>Top of the pile, next card first:</span>
          {myPeek.map((t, i) => <Card key={i} type={t} mini disabled />)}
        </section>
      )}

      {mine ? (
        <section className="hand-area" aria-label="Your hand">
          <div className="hand">
            {hand.map((t, i) => (
              <Card key={`${t}-${i}`} type={t} selected={sel.includes(i)}
                disabled={!(myTurn || (s.phase === 'favor' && s.favor.from === me.id) || (pend && t === 'nope' && mine.alive))}
                onClick={() => onCard(i)} />
            ))}
            {!hand.length && <p className="hint">{mine.alive ? 'No cards in hand.' : 'You exploded. Stay to watch the finish.'}</p>}
          </div>

          {myTurn && (
            <div className="actions">
              {play && (
                <>
                  {play.needsTarget && (
                    <label>Target
                      <select value={tgt || ''} onChange={(e) => setTarget(e.target.value)}>
                        {targets.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.hand.length})</option>)}
                      </select>
                    </label>
                  )}
                  {play.needsName && (
                    <label>Ask for
                      <select value={named} onChange={(e) => setNamed(e.target.value)}>
                        {CARD_ORDER.map((t) => <option key={t} value={t}>{CARDS[t].name}</option>)}
                      </select>
                    </label>
                  )}
                  <button className="btn primary" disabled={play.needsTarget && !tgt} onClick={play.run}>{play.label}</button>
                </>
              )}
              {!play && sel.length > 0 && <span className="hint">Select 2 or 3 matching cards for a combo.</span>}
              <button className="btn" onClick={() => act({ type: 'draw' })}>Draw and end turn</button>
            </div>
          )}
        </section>
      ) : <p className="hint spectate">You're watching this game.</p>}
      {mine?.left && <p className="offline-banner">You were removed from this round because you went offline.</p>}

      <details className="log">
        <summary>Game log</summary>
        <ol>{[...s.log].reverse().slice(0, 25).map((l, i) => <li key={i}>{l}</li>)}</ol>
      </details>
      {toast}
    </div>
  );
}
