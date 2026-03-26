import { Wrench } from 'lucide-react';
import PageShell from '../components/layout/PageShell';

const ModulePlaceholderPage = ({ title, subtitle, iconKey }) => {
  return (
    <PageShell
      title={title}
      subtitle={subtitle || 'This module is configured as a placeholder and will be implemented next.'}
      icon={Wrench}
      iconKey={iconKey}
    >
      <section className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-6 shadow-sm">
        <p className="text-sm font-medium text-[var(--c-muted)]">
          Placeholder active. Navigation and route are ready.
        </p>
      </section>
    </PageShell>
  );
};

export default ModulePlaceholderPage;
