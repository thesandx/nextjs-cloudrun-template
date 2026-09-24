'use client';

import { useId, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

export interface TabItem {
  /** Stable key. Also the value `onChange` reports. */
  id: string;
  label: string;
  content: React.ReactNode;
}

export interface TabsProps {
  /** Names the set of tabs for screen readers: "Game views". */
  label: string;
  items: readonly TabItem[];
  /** The tab open on first render. Default: the first item. */
  defaultTab?: string;
  onChange?: (id: string) => void;
  className?: string;
}

/**
 * Two to five views of the same thing. Follows the WAI-ARIA tabs pattern:
 * one tab stop, arrow keys move between tabs, Home and End jump to the ends.
 * The selected tab lifts onto a base, so the state never rests on colour alone.
 *
 * A client component because selection is state. Pass server-rendered
 * content through `items`; only the tab strip ships as JavaScript.
 */
export function Tabs({ label, items, defaultTab, onChange, className }: TabsProps) {
  const baseId = useId();
  const [selected, setSelected] = useState(defaultTab ?? items[0]?.id);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function select(index: number) {
    const item = items[index];
    if (!item) return;
    setSelected(item.id);
    onChange?.(item.id);
    tabRefs.current[index]?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent, index: number) {
    const last = items.length - 1;
    const next: Record<string, number> = {
      ArrowRight: index === last ? 0 : index + 1,
      ArrowLeft: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    };
    const target = next[event.key];
    if (target === undefined) return;
    event.preventDefault();
    select(target);
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div
        role="tablist"
        aria-label={label}
        className="bg-sunken border-line rounded-pill flex max-w-full gap-1 overflow-x-auto border-2 p-1"
      >
        {items.map((item, index) => {
          const isSelected = item.id === selected;
          return (
            <button
              key={item.id}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${item.id}`}
              aria-selected={isSelected}
              aria-controls={`${baseId}-panel-${item.id}`}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => select(index)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(
                'rounded-pill min-h-11 flex-1 border-2 px-4 font-medium whitespace-nowrap',
                'ease-squish transition-[transform,box-shadow] duration-150',
                isSelected
                  ? 'bg-surface border-line shadow-mochi-sm text-ink -translate-y-px'
                  : 'text-ink-soft hover:text-ink border-transparent',
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {items.map((item) => (
        <div
          key={item.id}
          role="tabpanel"
          id={`${baseId}-panel-${item.id}`}
          aria-labelledby={`${baseId}-tab-${item.id}`}
          hidden={item.id !== selected}
          tabIndex={0}
        >
          {item.content}
        </div>
      ))}
    </div>
  );
}
