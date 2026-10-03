import { ICON_PATHS, type IconName } from './icon-paths';

export type { IconName };

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  /** Use the filled variant when one exists. */
  filled?: boolean;
  title?: string;
}

/** Material Symbols icon rendered as inline SVG. Inherits color from the text color. */
export function Icon({ name, size = 20, className, filled, title }: IconProps) {
  const fillName = `${name}-fill` as IconName;
  const d = filled && fillName in ICON_PATHS ? ICON_PATHS[fillName] : ICON_PATHS[name];
  return (
    <svg
      viewBox="0 -960 960 960"
      width={size}
      height={size}
      fill="currentColor"
      className={['shrink-0', className].filter(Boolean).join(' ')}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title && <title>{title}</title>}
      <path d={d} />
    </svg>
  );
}

export function isIconName(s: string | null | undefined): s is IconName {
  return !!s && s in ICON_PATHS;
}
