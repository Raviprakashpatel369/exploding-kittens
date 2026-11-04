// Registry of games. Each one provides a pure rules engine; the shared Room handles lobby, presence and
// disconnects for every game. To add a game: write an engine (reduce/newLobby/blockerId), a Board component,
// then register both here and in Room.jsx's BOARDS map.
import * as ek from './engine.js';
import * as uno from './uno/engine.js';

export const GAMES = {
  ek: {
    id: 'ek', title: 'Exploding Kittens', emoji: '💣', max: ek.MAX_PLAYERS,
    newLobby: ek.newLobby, reduce: ek.reduce, blockerId: ek.blockerId,
    lobbyNote: (n) => `${n}/${ek.MAX_PLAYERS} players · ${ek.decksFor(n) === 1 ? 'one deck (6 or more players combine two decks)' : 'two decks combined'}`,
    options: [{
      label: 'Faster game (removes a third of the deck, recommended for 2–3 players)',
      get: (s) => s.fast, set: (v) => ({ type: 'setFast', value: v }),
    }],
  },
  uno: {
    id: 'uno', title: 'Uno', emoji: '🎴', max: uno.MAX_PLAYERS,
    newLobby: uno.newLobby, reduce: uno.reduce, blockerId: uno.blockerId,
    lobbyNote: (n) => `${n}/${uno.MAX_PLAYERS} players · first to ${uno.TARGET} points wins the match`,
    options: [],
  },
};

export const gameOf = (state) => GAMES[state?.game || 'ek'];
