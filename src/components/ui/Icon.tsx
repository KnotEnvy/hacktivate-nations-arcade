// ===== src/components/ui/Icon.tsx =====
// A single stroke-based icon set so the harness stops mixing emoji glyphs
// (which render differently on every platform) into navigation and controls.
// All paths are drawn on a 24x24 grid with a 1.75 stroke and round caps.

import { cn } from '@/lib/utils';

export type IconName =
  | 'games'
  | 'trophy'
  | 'target'
  | 'medal'
  | 'user'
  | 'search'
  | 'lock'
  | 'play'
  | 'pause'
  | 'replay'
  | 'coin'
  | 'check'
  | 'close'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-down'
  | 'arrow-left'
  | 'more'
  | 'help'
  | 'audio'
  | 'sparkle'
  | 'clock'
  | 'cloud'
  | 'alert'
  | 'sliders';

const PATHS: Record<IconName, React.ReactNode> = {
  games: (
    <>
      <path d="M7 12h4M9 10v4" />
      <circle cx="15.5" cy="11" r=".9" fill="currentColor" stroke="none" />
      <circle cx="17.8" cy="13.4" r=".9" fill="currentColor" stroke="none" />
      <path d="M6.6 7h10.8a3.6 3.6 0 0 1 3.5 2.8l1 4.6A2.9 2.9 0 0 1 19 18c-1 0-1.7-.5-2.3-1.2L15.5 15h-7l-1.2 1.8C6.7 17.5 6 18 5 18a2.9 2.9 0 0 1-2.9-3.6l1-4.6A3.6 3.6 0 0 1 6.6 7Z" />
    </>
  ),
  trophy: (
    <>
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M7 6H4.5v1a3.5 3.5 0 0 0 3 3.4M17 6h2.5v1a3.5 3.5 0 0 1-3 3.4" />
      <path d="M12 14v3M9 20h6M10 17h4l.6 3h-5.2l.6-3Z" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r=".9" fill="currentColor" stroke="none" />
    </>
  ),
  medal: (
    <>
      <circle cx="12" cy="15" r="5" />
      <path d="m8.5 10.5-2.7-5.1A1 1 0 0 1 6.7 4h2.1l2.3 4.3M15.5 10.5l2.7-5.1A1 1 0 0 0 17.3 4h-2.1l-2.3 4.3" />
      <path d="m12 13 .8 1.6 1.7.2-1.3 1.2.3 1.7-1.5-.8-1.5.8.3-1.7L9.5 15l1.7-.3.8-1.6Z" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </>
  ),
  lock: (
    <>
      <rect x="4.75" y="10.5" width="14.5" height="9.5" rx="2.2" />
      <path d="M8.2 10.5V7.8a3.8 3.8 0 0 1 7.6 0v2.7" />
    </>
  ),
  play: <path d="M8 5.6 19 12 8 18.4V5.6Z" fill="currentColor" stroke="none" />,
  pause: (
    <path
      d="M8.5 5.5h2.2v13H8.5v-13Zm4.8 0h2.2v13h-2.2v-13Z"
      fill="currentColor"
      stroke="none"
    />
  ),
  replay: (
    <>
      <path d="M20 12a8 8 0 1 1-2.6-5.9" />
      <path d="M20.5 4v4.5H16" />
    </>
  ),
  coin: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M14.3 9.4a2.9 2.9 0 0 0-4.9 2.1 2.9 2.9 0 0 0 4.9 2.1" />
    </>
  ),
  check: <path d="m5 12.8 4.6 4.4L19 6.5" />,
  close: <path d="m6.4 6.4 11.2 11.2M17.6 6.4 6.4 17.6" />,
  'chevron-left': <path d="M14.5 5.5 8 12l6.5 6.5" />,
  'chevron-right': <path d="M9.5 5.5 16 12l-6.5 6.5" />,
  'chevron-down': <path d="M5.5 9.5 12 16l6.5-6.5" />,
  'arrow-left': <path d="M19 12H5.5m0 0L11 6.5M5.5 12 11 17.5" />,
  more: (
    <>
      <circle cx="12" cy="5.5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="18.5" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M9.7 9.6a2.4 2.4 0 1 1 3.2 2.3c-.6.2-.9.8-.9 1.4v.4" />
      <circle cx="12" cy="16.6" r=".9" fill="currentColor" stroke="none" />
    </>
  ),
  audio: (
    <>
      <path d="M11 5.5 6.8 9H4.2v6h2.6L11 18.5v-13Z" />
      <path d="M14.8 9.4a3.6 3.6 0 0 1 0 5.2M17.4 6.8a7.2 7.2 0 0 1 0 10.4" />
    </>
  ),
  sparkle: (
    <path d="m12 4 1.7 4.6L18.5 10l-4.8 1.4L12 16l-1.7-4.6L5.5 10l4.8-1.4L12 4Z" />
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 7.4V12l3 1.8" />
    </>
  ),
  cloud: (
    <>
      <path d="M7.2 18.5a4 4 0 0 1-.3-8 5.2 5.2 0 0 1 10 1 3.5 3.5 0 0 1-.4 7h-9.3Z" />
    </>
  ),
  alert: (
    <>
      <path d="M12 4.8 21 19.2H3L12 4.8Z" />
      <path d="M12 10.4v3.6" />
      <circle cx="12" cy="16.6" r=".9" fill="currentColor" stroke="none" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 8h9M17 8h3M4 16h3M11 16h9" />
      <circle cx="15" cy="8" r="2.1" />
      <circle cx="9" cy="16" r="2.1" />
    </>
  ),
};

interface IconProps {
  name: IconName;
  className?: string;
  /** Pixel size for both axes. Defaults to 18 — the harness's control size. */
  size?: number;
  title?: string;
}

export function Icon({ name, className, size = 18, title }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      className={cn('shrink-0', className)}
    >
      {title && <title>{title}</title>}
      {PATHS[name]}
    </svg>
  );
}
