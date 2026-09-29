import { AppBar, Button } from 'nextjs-cloudrun-template';

export const WithBack = () => <AppBar title="Room settings" back />;

export const WithAction = () => (
  <AppBar title="Edit profile" back={{ fallbackHref: '/profile' }} end={<Button size="md">Save</Button>} />
);

export const TopLevel = () => <AppBar title="Profile" />;
