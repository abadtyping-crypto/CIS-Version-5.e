import { useTheme } from '../../context/useTheme';
import { Monitor, MoonStar, SunMedium } from 'lucide-react';

const ThemeToggle = () => {
  const { theme, resolvedTheme, toggleTheme } = useTheme();
  const appliedTheme = theme === 'system' ? resolvedTheme : theme;
  const ThemeIcon = theme === 'system' ? Monitor : appliedTheme === 'dark' ? MoonStar : SunMedium;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--c-ring)] bg-[color:color-mix(in_srgb,var(--c-surface)_90%,transparent)] px-4 text-sm font-semibold text-[var(--c-text)] transition hover:bg-[var(--c-panel)]"
      aria-label="Toggle dark mode"
    >
      <ThemeIcon className="h-4 w-4 text-[var(--c-accent)]" />
      Theme: {theme === 'system' ? `System (${resolvedTheme})` : theme === 'dark' ? 'Dark' : 'Light'}
    </button>
  );
};

export default ThemeToggle;
