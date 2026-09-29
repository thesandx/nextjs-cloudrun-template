import { useEffect, useRef } from 'react';
import { Face, MobileMenu } from 'nextjs-cloudrun-template';

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/design', label: 'Design' },
  { href: '/pricing', label: 'Pricing' },
];

// The menu sits in a phone header row, as Header renders it. The panel is
// positioned against that row, so the row is `relative`.
const PhoneHeader = ({ open }: { open: boolean }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // The open state lives inside the component, so press its button once.
    if (open) ref.current?.querySelector('button')?.click();
  }, [open]);
  return (
    <div ref={ref} className={open ? 'max-w-sm min-h-72' : 'max-w-sm'}>
      <div className="bg-paper border-line relative flex items-center justify-between border-b-2 px-5 py-3">
        <span className="font-display flex items-center gap-2">
          <span className="bg-brand-soft border-line inline-grid size-10 place-items-center rounded-full border-2">
            <Face size={30} label="" />
          </span>
          Playroom
        </span>
        <MobileMenu links={LINKS} currentPath="/design" />
      </div>
    </div>
  );
};

export const Closed = () => <PhoneHeader open={false} />;

export const Open = () => <PhoneHeader open />;
