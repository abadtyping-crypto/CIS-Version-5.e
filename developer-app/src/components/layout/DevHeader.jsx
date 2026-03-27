import React from 'react';
import { Menu, Moon, Sun } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export const DevHeader = ({ onOpenSidebar }) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <header className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-[color:color-mix(in_srgb,var(--c-border)_82%,transparent)] bg-[color:color-mix(in_srgb,var(--c-surface)_84%,transparent)] px-4 py-3 shadow-sm backdrop-blur-xl">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)] text-[var(--c-text)] transition hover:border-[var(--c-accent)] hover:text-[var(--c-accent)] lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[var(--c-muted)]">Developer App</p>
          <h2 className="truncate text-lg font-black tracking-tight text-[var(--c-text)]">Night Shield Control</h2>
        </div>
      </div>

      <button
        type="button"
        onClick={toggleTheme}
        className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[color:color-mix(in_srgb,var(--c-border)_82%,transparent)] bg-[color:color-mix(in_srgb,var(--c-surface)_80%,transparent)] text-[var(--c-text)] shadow-sm backdrop-blur-xl transition hover:border-[var(--c-accent)] hover:text-[var(--c-accent)]"
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        title={isDark ? 'Light Mode' : 'Dark Mode'}
      >
        {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>
    </header>
  );
};
