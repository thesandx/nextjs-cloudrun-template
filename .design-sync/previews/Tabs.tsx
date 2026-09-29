import { Tabs } from 'nextjs-cloudrun-template';

const GAME_VIEWS = [
  { id: 'board', label: 'Board', content: <p className="text-ink-soft">Numbers called so far: 12, 7, 33, 41.</p> },
  { id: 'players', label: 'Players', content: <p className="text-ink-soft">Five players, two with one line left.</p> },
  { id: 'rules', label: 'Rules', content: <p className="text-ink-soft">A full line wins the round.</p> },
];

export const Default = () => (
  <div className="max-w-xl">
    <Tabs label="Game views" items={GAME_VIEWS} />
  </div>
);

export const SecondTab = () => (
  <div className="max-w-xl">
    <Tabs label="Game views" items={GAME_VIEWS} defaultTab="players" />
  </div>
);
