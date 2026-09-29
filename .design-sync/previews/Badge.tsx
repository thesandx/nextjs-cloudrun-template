import { Badge } from 'nextjs-cloudrun-template';

export const Tones = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Badge tone="brand">Host</Badge>
    <Badge tone="success">Ready</Badge>
    <Badge>Spectating</Badge>
    <Badge tone="danger">Left the room</Badge>
  </div>
);
