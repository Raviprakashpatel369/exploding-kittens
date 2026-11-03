# Exploding Kittens Online

A small realtime web version of the Exploding Kittens base game (2–10 players, rules from the official rulebook).
React + Vite front end, Supabase (Postgres + Realtime) for shared game state, Vercel for hosting.

## 1. Supabase
1. Create a project at https://supabase.com.
2. SQL Editor → paste `supabase/schema.sql` → Run.
3. Project Settings → API: copy the **Project URL** and the **anon public** key.

## 2. Run locally
```bash
npm install
cp .env.example .env     # paste the URL and anon key
npm run dev
```
Open the printed URL in two browser windows (use a private window for the second player, since your identity is stored in localStorage).

## 3. Deploy to Vercel
1. Push this folder to a GitHub repo.
2. Vercel → Add New Project → import the repo (Vite is auto-detected).
3. Add environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then Deploy.
4. Share the site link. One person clicks **Create a game** and sends the invite link (`https://your-app.vercel.app/#ABCD`) to friends.

## How it works
- `src/engine.js` is a pure rules engine (`reduce(state, action)`), tested by `npm test` (500 simulated games).
- The whole game lives in one `games` row (`state` JSON + `version`). Every move is a compare-and-swap update
  (`where version = old`), so two simultaneous moves (e.g. two people hitting Nope) never overwrite each other.
- Supabase Realtime pushes each change to all players; a 4s poll is a fallback.

## Disconnects
Supabase Realtime Presence shows who is online. If the player the game is waiting on goes offline, everyone sees a
countdown and that player is removed after 60s (15s if they were already gone for a while). Reconnecting in time cancels it.
Removed players' cards are discarded and play continues; if only one player remains they win. In the lobby, offline players
are dropped after 30s. The **Leave** button removes you immediately, and the host can remove any offline player with **Remove**.
Tune `GAME_WAIT`, `SHORT_WAIT`, `LOBBY_WAIT` at the top of `src/Game.jsx`.

## Bigger games
2–5 players use one deck. 6–10 players combine two decks (the rulebook allows combining decks): every card count doubles,
each player still gets 1 Defuse + 7 cards, 2 spare Defuses per deck go back into the pile, and there are always
(players − 1) Exploding Kittens. Change `MAX_PLAYERS` / `decksFor` in `src/engine.js` to tune this.

## Rules implemented
Exploding Kittens, Defuse (secret reinsert), Attack (with stacking), Skip, Favor, Shuffle, See the Future,
Nope (any living player, any time, even out of turn; chainable; 7s window that restarts on each Nope and is timed locally by each player so device clocks do not matter), 5 Cat card types, two-of-a-kind (random steal) and
three-of-a-kind (name a card), faster-game variant for small games, correct setup for 2–5 players.
Pairs/triples work with any matching card title, as in the "Special Combos" section.

## Known limitations (fine for friends)
- Hands are hidden in the UI but stored in the shared row, so a determined player could read them via browser dev tools.
  To make it cheat-proof, move `reduce` into a Supabase Edge Function / RPC and store hands in a separate table with RLS.
- Anyone with a game code can join while the lobby is open. Games are never deleted; clear old rows occasionally.
- If someone closes their tab mid-game, the others must wait for them to return (their seat is kept via localStorage).
