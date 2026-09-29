import { Select } from 'nextjs-cloudrun-template';

const GAMES = [
  { value: 'bingo', label: 'Bingo' },
  { value: 'trivia', label: 'Trivia' },
  { value: 'draw', label: 'Draw it', disabled: true },
];

export const Placeholder = () => (
  <div className="max-w-md">
    <Select label="Game" options={GAMES} placeholder="Pick a game" />
  </div>
);

export const Chosen = () => (
  <div className="max-w-md">
    <Select label="Game" options={GAMES} defaultValue="trivia" hint="You can change it between rounds." />
  </div>
);

export const WithError = () => (
  <div className="max-w-md">
    <Select label="Game" options={GAMES} placeholder="Pick a game" error="Pick a game to start." />
  </div>
);
