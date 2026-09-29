import { Avatar, Chip } from 'nextjs-cloudrun-template';

export const PlayerList = () => (
  <ul className="flex flex-wrap gap-3">
    {['sandy', 'momo', 'captain_k', 'bubbles', 'rajma chawal'].map((name) => (
      <Chip key={name} as="li" leading={<Avatar name={name} size="sm" />}>
        {name}
      </Chip>
    ))}
  </ul>
);

export const TextOnly = () => (
  <div className="flex flex-wrap gap-3">
    <Chip>Bingo</Chip>
    <Chip>Trivia</Chip>
    <Chip>Draw it</Chip>
  </div>
);
