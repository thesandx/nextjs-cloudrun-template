import { Button, Header } from 'nextjs-cloudrun-template';

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/design', label: 'Design' },
  { href: '/pricing', label: 'Pricing' },
];

export const Website = () => (
  <div className="bg-paper border-line rounded-card overflow-hidden border-2">
    <Header appName="Playroom" links={LINKS} currentPath="/design" />
  </div>
);

export const WithAction = () => (
  <div className="bg-paper border-line rounded-card overflow-hidden border-2">
    <Header
      appName="Playroom"
      links={LINKS}
      currentPath="/"
      phoneMenu={false}
      end={<Button size="md">Sign in</Button>}
    />
  </div>
);
