import type { ReactNode } from 'react';
import { cx } from './cx';

/** Screen container: a centered column on phones and desktop; `wide` lets Weekly use 7 columns. */
export function Page({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className={cx('mx-auto w-full px-4 pt-3 pb-8', wide ? 'max-w-xl md:max-w-7xl' : 'max-w-xl')}>
      {children}
    </div>
  );
}
