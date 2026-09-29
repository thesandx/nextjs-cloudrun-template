import { Input } from 'nextjs-cloudrun-template';

export const WithHint = () => (
  <div className="max-w-md">
    <Input label="Your nickname" hint="Friends see this on the board." />
  </div>
);

export const RoomKey = () => (
  <div className="max-w-md">
    <Input label="Room key" code maxLength={6} autoComplete="off" placeholder="······" />
  </div>
);

export const WithError = () => (
  <div className="max-w-md">
    <Input label="Room key" code defaultValue="PLZ4K" error="Keys are 6 letters or numbers." />
  </div>
);

export const Disabled = () => (
  <div className="max-w-md">
    <Input label="Email" type="email" defaultValue="sandy@playroom.test" disabled />
  </div>
);
