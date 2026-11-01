/**
 * controls.jsx
 * Accessible form primitives shared across the app:
 * - Switch       : role="switch" toggle row with label/description
 * - OptionGroup  : radio-chip group (native radios → arrow-key navigation for free)
 * - Segmented    : segmented control / tabs with an animated indicator
 */

import React, { useId } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

// ============================================
// Switch
// ============================================
export function Switch({ checked, onChange, label, description, icon: Icon, disabled, compact }) {
  const id = useId();
  return (
    <div
      className={clsx(
        'group flex items-center justify-between gap-4 rounded-xl transition-colors',
        compact ? 'py-3' : 'px-3.5 py-3 hover:bg-white/[0.025]'
      )}
    >
      <label htmlFor={id} className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
        {Icon && (
          <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] text-zinc-400 transition-colors group-hover:text-zinc-200">
            <Icon className="h-4 w-4" />
          </span>
        )}
        <span className="min-w-0">
          <span className="block text-sm font-medium text-zinc-200">{label}</span>
          {description && <span className="mt-0.5 block text-xs leading-relaxed text-zinc-500">{description}</span>}
        </span>
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={!!checked}
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
        className={clsx(
          'focus-ring relative inline-flex h-6 w-10 flex-shrink-0 items-center rounded-full border transition-colors duration-200 disabled:opacity-40',
          checked ? 'border-brand-400/40 bg-brand-500' : 'border-white/10 bg-white/[0.08] hover:bg-white/[0.12]'
        )}
      >
        <span className="sr-only">{label}</span>
        <span
          aria-hidden="true"
          className={clsx(
            'inline-block h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.4)] transition-transform duration-200 ease-out',
            checked ? 'translate-x-[19px]' : 'translate-x-[2px]'
          )}
        />
      </button>
    </div>
  );
}

// ============================================
// OptionGroup (radio chips)
// ============================================
/**
 * @param {{ label: string, value: string, options: {value:string,label:string,hint?:string,badge?:string}[], onChange: Function, columns?: number }} props
 */
export function OptionGroup({ label, value, options, onChange, columns = 4, name }) {
  const autoName = useId();
  const groupName = name || autoName;
  const labelId = `${groupName}-label`;
  const cols = { 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-2 sm:grid-cols-4', 5: 'grid-cols-3 sm:grid-cols-5', 6: 'grid-cols-3 sm:grid-cols-6' };

  return (
    <fieldset>
      <legend id={labelId} className="eyebrow mb-2.5">
        {label}
      </legend>
      <div role="radiogroup" aria-labelledby={labelId} className={clsx('grid gap-2', cols[columns] || cols[4])}>
        {options.map((opt) => {
          const selected = opt.value === value;
          return (
            <label
              key={opt.value}
              className={clsx(
                'relative flex cursor-pointer flex-col items-start rounded-xl border px-3 py-2.5 transition-[background-color,border-color,box-shadow] duration-150',
                'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-400/70 has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-ink-950',
                selected
                  ? 'border-brand-400/50 bg-brand-500/[0.10] shadow-[0_0_0_1px_rgba(167,139,250,0.25)_inset]'
                  : 'border-white/[0.07] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]'
              )}
            >
              <input
                type="radio"
                name={groupName}
                value={opt.value}
                checked={selected}
                onChange={() => onChange(opt.value)}
                className="sr-only"
              />
              <span className="flex w-full items-center justify-between gap-2">
                <span className={clsx('text-sm font-semibold tracking-tight', selected ? 'text-white' : 'text-zinc-300')}>
                  {opt.label}
                </span>
                {opt.badge && (
                  <span
                    className={clsx(
                      'rounded px-1 py-px text-[9px] font-semibold uppercase tracking-wider',
                      selected ? 'bg-brand-400/20 text-brand-200' : 'bg-white/[0.06] text-zinc-500'
                    )}
                  >
                    {opt.badge}
                  </span>
                )}
              </span>
              {opt.hint && <span className="mt-0.5 text-2xs text-zinc-500">{opt.hint}</span>}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

// ============================================
// Segmented control
// ============================================
/**
 * @param {{ items: {id:string,label:string,icon?:any,count?:number}[], value: string, onChange: Function, layoutId: string, ariaLabel: string, size?: 'sm'|'md', stretch?: boolean }} props
 */
export function Segmented({ items, value, onChange, layoutId, ariaLabel, size = 'md', stretch = false }) {
  const onKeyDown = (e) => {
    const idx = items.findIndex((i) => i.id === value);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const next = (idx + (e.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length;
      onChange(items[next].id);
      const btn = e.currentTarget.querySelectorAll('[role="tab"]')[next];
      btn?.focus();
    }
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={clsx(
        'relative inline-flex items-center gap-1 rounded-xl border border-white/[0.07] bg-white/[0.02] p-1',
        stretch && 'flex w-full'
      )}
    >
      {items.map((item) => {
        const active = item.id === value;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.id)}
            className={clsx(
              'focus-ring relative flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors',
              size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-3.5 py-2 text-sm',
              stretch && 'flex-1',
              active ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-lg border border-white/10 bg-white/[0.08] shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset]"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative flex items-center gap-2">
              {Icon && <Icon className="h-4 w-4" />}
              {item.label}
              {item.count > 0 && (
                <span
                  className={clsx(
                    'tabular rounded-md px-1.5 py-px font-mono text-[10px]',
                    active ? 'bg-brand-400/20 text-brand-200' : 'bg-white/[0.06] text-zinc-500'
                  )}
                >
                  {item.count}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
