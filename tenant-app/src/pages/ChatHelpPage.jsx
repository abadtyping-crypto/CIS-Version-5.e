import PageShell from '../components/layout/PageShell';

const ChatHelpPage = () => {
  return (
    <PageShell
      title="Chat Agent"
      subtitle="AI support workspace for guided actions."
      iconKey="notifications"
    >
      <div className="rounded-2xl border border-[var(--c-border)] bg-[color:color-mix(in_srgb,var(--c-surface)_86%,transparent)] p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)]">
            <img src="/boticon.png" alt="Chat Agent" className="h-11 w-11 rounded-full object-cover [transform:scale(1.16)]" />
          </div>
          <div>
            <p className="text-sm font-bold text-[var(--c-text)]">Chat Agent is ready</p>
            <p className="text-xs text-[var(--c-muted)]">
              This area is prepared for your full agent implementation.
            </p>
          </div>
        </div>
      </div>
    </PageShell>
  );
};

export default ChatHelpPage;
