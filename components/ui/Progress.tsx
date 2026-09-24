import { useId } from 'react';

import { cn } from '@/lib/utils';

export interface ProgressProps {
  /** What is progressing: "Round 3 of 5", "Upload". Always visible. */
  label: string;
  value: number;
  /** Default 100. */
  max?: number;
  /** The value in words beside the label, such as "3 of 5". Default: a percentage. */
  valueText?: string;
  className?: string;
}

/**
 * How far through something the user is. Shows the value in words as well as
 * the bar, so it never rests on the fill alone.
 */
export function Progress({ label, value, max = 100, valueText, className }: ProgressProps) {
  const id = useId();
  const safeMax = max > 0 ? max : 100;
  const clamped = Math.min(Math.max(value, 0), safeMax);
  const percent = Math.round((clamped / safeMax) * 100);
  const text = valueText ?? `${percent}%`;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="text-small flex items-baseline justify-between gap-3">
        <span id={id} className="font-medium">
          {label}
        </span>
        <span className="text-ink-soft">{text}</span>
      </div>
      <div
        role="progressbar"
        aria-labelledby={id}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuenow={clamped}
        aria-valuetext={text}
        className="bg-sunken border-line rounded-pill h-4 overflow-hidden border-2"
      >
        <div
          className="bg-brand ease-settle h-full transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
