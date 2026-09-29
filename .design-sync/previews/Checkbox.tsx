import { Checkbox } from 'nextjs-cloudrun-template';

export const States = () => (
  <div className="flex flex-col gap-1">
    <Checkbox label="Allow late joiners" hint="They start with zero points." defaultChecked />
    <Checkbox label="Show the leaderboard" />
    <Checkbox label="Voice chat" hint="Coming later." disabled />
  </div>
);

export const Single = () => <Checkbox label="I agree to the house rules" />;
