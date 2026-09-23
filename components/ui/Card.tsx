import { cn } from '@/lib/utils';

export type CardTone = 'surface' | 'brand-soft' | 'butter' | 'soda' | 'grape' | 'peach';

const TONE_CLASS: Record<CardTone, string> = {
  surface: 'bg-surface',
  'brand-soft': 'bg-brand-soft',
  butter: 'bg-butter',
  soda: 'bg-soda',
  grape: 'bg-grape',
  peach: 'bg-peach',
};

export interface CardProps {
  children: React.ReactNode;
  /** Candy tones are identity (this game is butter), not decoration. Default: surface. */
  tone?: CardTone;
  /**
   * Something that peeks over the top edge — usually a <Face /> or <Avatar />.
   * The signature Mochi layout move. Maximum one peeking card per viewport.
   */
  peek?: React.ReactNode;
  /** Render as a different element, e.g. 'article' or 'li'. */
  as?: 'section' | 'article' | 'li' | 'div';
  className?: string;
}

export function Card({
  children,
  tone = 'surface',
  peek,
  as: Tag = 'section',
  className,
}: CardProps) {
  return (
    <Tag
      className={cn(
        'border-line shadow-mochi rounded-card relative border-2 p-5 sm:p-6',
        TONE_CLASS[tone],
        peek !== undefined && 'mt-8 pt-11 sm:pt-12',
        className,
      )}
    >
      {peek !== undefined && (
        <div className="absolute -top-7 left-5 sm:left-6" aria-hidden="true">
          {peek}
        </div>
      )}
      {children}
    </Tag>
  );
}
