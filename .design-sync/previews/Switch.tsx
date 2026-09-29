import { Switch } from 'nextjs-cloudrun-template';

export const States = () => (
  <div className="flex max-w-md flex-col gap-2">
    <Switch label="Sound effects" hint="Plays when someone wins." defaultChecked />
    <Switch label="Reduce animations" />
    <Switch label="Voice chat" hint="Coming later." disabled />
  </div>
);
