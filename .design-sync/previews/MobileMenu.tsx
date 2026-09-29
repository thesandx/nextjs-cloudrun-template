import { MobileMenu } from 'nextjs-cloudrun-template';

export const Closed = () => (
  <div className="relative flex justify-end">
    <MobileMenu
      links={[
        { href: '/', label: 'Home' },
        { href: '/design', label: 'Design' },
        { href: '/pricing', label: 'Pricing' },
      ]}
      currentPath="/design"
    />
  </div>
);
