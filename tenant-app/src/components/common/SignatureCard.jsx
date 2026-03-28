import { Link, useParams } from 'react-router-dom';
import { resolveTenantRoute } from '../../lib/tenantRoutes';

/**
 * SignatureCard
 * Versatile, premium signature block for attribution, categories, or selection tiles.
 *
 * Design cues:
 * - Left slot: 56px square (w-14), edge-to-edge, with a clean right border.
 * - Body: rounded-2xl, soft border, neutral panel background.
 * - Interaction: Supports Link, button, or div.
 * - State: Optional 'isActive' state for selection scenarios.
 */
const SignatureCard = ({
  uid = '',
  displayName = '',
  title = '', // Alias for displayName
  avatarUrl = '',
  image = '', // Alias for avatarUrl
  icon: Icon, // Lucide icon component
  subtitle = '',
  badge = '',
  href,
  to,
  onClick,
  isActive = false,
  as,
  className = '',
  contentClassName = '',
  children,
}) => {
  const { tenantId } = useParams();
  
  const resolvedTitle = title || displayName || 'User';
  const resolvedImage = image || avatarUrl || '/avatar.png';
  
  const targetHref =
    to ||
    href ||
    (uid
      ? resolveTenantRoute(tenantId, `profile/edit?uid=${encodeURIComponent(uid)}`)
      : null);

  const Component = as || (targetHref ? Link : onClick ? 'button' : 'div');
  
  // Base interaction classes
  const isInteractive = Component === Link || Component === 'button' || !!onClick;
  
  const activeClasses = isActive
    ? 'border-[var(--c-accent)] bg-[color:color-mix(in_srgb,var(--c-accent)_10%,var(--c-panel))] ring-4 ring-[var(--c-accent)]/5'
    : 'border-[var(--c-border)] bg-[var(--c-panel)]';

  const hoverClasses = isInteractive && !isActive
    ? 'hover:border-[var(--c-ring)] hover:bg-[color:color-mix(in_srgb,var(--c-panel)_94%,white_6%)] hover:shadow-md'
    : '';

  return (
    <Component
      {...(Component === Link ? { to: targetHref } : {})}
      {...(Component === 'button' ? { type: 'button', onClick } : onClick ? { onClick } : {})}
      className={`group flex items-stretch overflow-hidden rounded-2xl border transition-all duration-200 text-left outline-none ${activeClasses} ${hoverClasses} ${className}`}
    >
      {/* 56px Lead Slot */}
      <div className={`relative h-14 w-14 shrink-0 overflow-hidden border-r transition-colors duration-200 ${
        isActive ? 'border-[var(--c-accent)]/30 bg-[color:color-mix(in_srgb,var(--c-accent)_15%,var(--c-panel))]' : 'border-[var(--c-border)] bg-[var(--c-surface)]'
      }`}>
        {Icon ? (
          <div className="flex h-full w-full items-center justify-center transition-transform group-hover:scale-110">
            <Icon className={`h-6 w-6 ${isActive ? 'text-[var(--c-accent)]' : 'text-[var(--c-muted)]'}`} strokeWidth={1.5} />
          </div>
        ) : (
          <img
            src={resolvedImage}
            alt={resolvedTitle}
            className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.05]"
            loading="lazy"
          />
        )}
      </div>

      <div className={`flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-3 py-2 ${contentClassName}`}>
        <p className={`truncate text-sm font-bold leading-tight transition-colors ${
          isActive ? 'text-[var(--c-text)]' : 'text-[var(--c-text)]'
        }`}>
          {resolvedTitle}
        </p>
        
        {subtitle ? (
          <div className="truncate text-[10px] font-bold uppercase tracking-wider text-[var(--c-muted)]">
            {subtitle}
          </div>
        ) : null}
        
        {badge ? (
          <div className="mt-0.5">
            <span className={`inline-flex items-center rounded-lg border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-tighter ${
              isActive 
                ? 'border-[var(--c-accent)]/20 bg-[var(--c-accent)]/10 text-[var(--c-accent)]' 
                : 'border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-muted)]'
            }`}>
              {badge}
            </span>
          </div>
        ) : null}
      </div>

      {isActive && (
        <div className="flex items-center pr-3">
          <div className="h-2 w-2 rounded-full bg-[var(--c-accent)] shadow-[0_0_8px_var(--c-accent)]" />
        </div>
      )}

      {children}
    </Component>
  );
};

export default SignatureCard;
