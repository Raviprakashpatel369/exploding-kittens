// Card catalogue. Counts come from the official rulebook (56 cards total).
export const CARDS = {
  exploding: { name: 'Exploding Kitten', emoji: '💣', color: '#1c1c24', fg: '#ffb35c', count: 4,
    text: 'You die unless you can play a Defuse.' },
  defuse: { name: 'Defuse', emoji: '🧯', color: '#7ccf4a', fg: '#10250a', count: 6,
    text: 'Save yourself from an Exploding Kitten, then secretly reinsert it into the Draw Pile.' },
  attack: { name: 'Attack', emoji: '⚔️', color: '#ff8a1f', fg: '#2b1300', count: 4,
    text: 'End your turn without drawing. The next player takes 2 turns.' },
  skip: { name: 'Skip', emoji: '⏭️', color: '#3b9dff', fg: '#06203f', count: 4,
    text: 'End your turn without drawing a card.' },
  favor: { name: 'Favor', emoji: '🤝', color: '#ff6fae', fg: '#3d0a22', count: 4,
    text: 'Another player gives you 1 card of their choice.' },
  nope: { name: 'Nope', emoji: '🚫', color: '#e5383b', fg: '#fff', count: 5,
    text: 'Stop any action except an Exploding Kitten or a Defuse. Can be played at any time.' },
  shuffle: { name: 'Shuffle', emoji: '🔀', color: '#a679ff', fg: '#1d0b45', count: 4,
    text: 'Shuffle the Draw Pile.' },
  future: { name: 'See the Future', emoji: '🔮', color: '#e24bd6', fg: '#3a0636', count: 5,
    text: 'Privately look at the top 3 cards of the Draw Pile.' },
  cat_taco: { name: 'Taco Cat', emoji: '🌮', color: '#ffd23f', fg: '#3b2f00', count: 4, cat: true,
    text: 'Play 2 matching cards to steal a random card.' },
  cat_melon: { name: 'Melon Cat', emoji: '🍉', color: '#4fd1a5', fg: '#06301f', count: 4, cat: true,
    text: 'Play 2 matching cards to steal a random card.' },
  cat_potato: { name: 'Hairy Potato Cat', emoji: '🥔', color: '#c49a6c', fg: '#2f1d0a', count: 4, cat: true,
    text: 'Play 2 matching cards to steal a random card.' },
  cat_beard: { name: 'Beard Cat', emoji: '🧔', color: '#9aa7b8', fg: '#121a24', count: 4, cat: true,
    text: 'Play 2 matching cards to steal a random card.' },
  cat_rainbow: { name: 'Rainbow-Ralphing Cat', emoji: '🌈', color: '#f6f1ff', fg: '#2b1d4d', count: 4, cat: true,
    text: 'Play 2 matching cards to steal a random card.' },
};

export const CARD_ORDER = Object.keys(CARDS);
export const SINGLE_PLAY = ['attack', 'skip', 'shuffle', 'future', 'favor'];
