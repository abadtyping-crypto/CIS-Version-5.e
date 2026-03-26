import { useNavigate, useParams } from 'react-router-dom';

const MobileHeader = ({ tenant, user }) => {
  const { tenantId } = useParams();
  const navigate = useNavigate();

  const goTo = (path) => navigate(`/t/${tenantId}/${path}`);

  return (
    <header className="sticky top-0 z-40 px-3 pt-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => goTo('dashboard')}
          className="mobile-glass-panel mobile-header-3d inline-flex min-w-0 max-w-[calc(100%-4.75rem)] items-center gap-2.5 rounded-2xl border border-[var(--c-border)] px-3 py-2 text-left no-underline outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-ring)]"
          style={{ textDecoration: 'none' }}
        >
          <img
            src="/logo.png"
            alt="ACIS Ajman"
            className="h-9 w-9 rounded-xl object-cover"
          />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-extrabold text-[var(--c-text)]">{tenant.name}</p>
            <p className="truncate text-xs font-medium text-[var(--c-muted)]">Workspace</p>
          </div>
        </button>

        <div className="mobile-glass-panel mobile-header-3d flex items-center gap-2 rounded-2xl border border-[var(--c-border)] px-2 py-1.5">
          <button
            type="button"
            onClick={() => goTo('profile')}
            className="mobile-nav-3d-btn inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] overflow-hidden"
            aria-label="Open profile"
            title="Profile"
          >
            <img
              src={user.photoURL || '/avatar.png'}
              alt={user.displayName}
              className="h-full w-full rounded-xl object-cover"
            />
          </button>
        </div>
      </div>
    </header>
  );
};

export default MobileHeader;
