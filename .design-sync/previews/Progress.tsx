import { Progress } from 'nextjs-cloudrun-template';

export const Rounds = () => (
  <div className="max-w-md">
    <Progress label="Round" value={3} max={5} valueText="3 of 5" />
  </div>
);

export const Steps = () => (
  <div className="flex max-w-md flex-col gap-6">
    <Progress label="Setting up" value={1} max={4} valueText="Step 1 of 4" />
    <Progress label="Upload" value={100} valueText="Done" />
  </div>
);
