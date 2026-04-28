import { Link } from 'react-router-dom';
import { Building2, User, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import QuickInfoTooltip from './QuickInfoTooltip';
import { resolveTenantIdentity } from '../../lib/backendStore';

const joinClasses = (...classes) => classes.filter(Boolean).join(' ');

const normalizeText = (value) => String(value || '').trim();

const normalizeList = (value) => {
  if (!value) return [];
  const source = Array.isArray(value) ? value : [value];
  return source
    .map((item) => {
      if (typeof item === 'string' || typeof item === 'number') return String(item).trim();
      return String(item?.value || item?.number || item?.email || item?.label || '').trim();
    })
    .filter(Boolean);
};

const buildIdentityRoute = ({
  tenantId = '',
  clientId = '',
  dependentId = '',
  isDependent = false,
  useClientManagementRoute = true,
}) => {
  const tenant = encodeURIComponent(normalizeText(tenantId));
  const client = encodeURIComponent(normalizeText(clientId));
  const dependent = encodeURIComponent(normalizeText(dependentId));
  const base = useClientManagementRoute ? 'client-management' : 'clients';

  if (!tenant || !client) return '';
  if (isDependent && dependent) return `/t/${tenant}/${base}/${client}/dependents/${dependent}`;
  return `/t/${tenant}/${base}/${client}`;
};

const resolveIdentity = (entity, explicitIdentity) => {
  const type = normalizeText(entity?.type).toLowerCase();
  if (explicitIdentity) return normalizeText(explicitIdentity);
  if (type === 'company') return normalizeText(entity?.tradeLicenseNumber || entity?.displayClientId || entity?.id);
  return normalizeText(
    entity?.displayClientId
      || entity?.emiratesId
      || entity?.passportNumber
      || entity?.unifiedNumber
      || entity?.idNumber
      || entity?.id,
  );
};

const resolveName = (entity, explicitName) =>
  normalizeText(explicitName || entity?.tradeName || entity?.fullName || entity?.name || entity?.displayName || entity?.displayClientId || entity?.id);

const resolveImage = (entity, explicitImageUrl) =>
  normalizeText(
    explicitImageUrl
      || entity?.logoUrl
      || entity?.companyLogoUrl
      || entity?.profileImageUrl
      || entity?.photoUrl
      || entity?.photoURL
      || entity?.avatarUrl
      || entity?.imageUrl,
  );

const EntityFallbackIcon = ({ type, isDependent }) => {
  if (isDependent) return <Users strokeWidth={1.5} className="h-5 w-5" />;
  if (String(type || '').toLowerCase() === 'company') return <Building2 strokeWidth={1.5} className="h-5 w-5" />;
  return <User strokeWidth={1.5} className="h-5 w-5" />;
};

const IdentityContent = ({
  entity,
  name,
  identity,
  imageUrl,
  isDependent,
  parentClientName,
  parentClientId,
  size,
  imageOverride,
}) => {
  const compact = size === 'sm';
  const frameClass = compact ? 'h-10 w-10 rounded-xl' : 'h-14 w-14 rounded-2xl';

  return (
    <div className={joinClasses('flex min-w-0 items-center gap-3', compact ? 'p-2' : 'p-3')}>
      <div
        className={joinClasses(
          'aspect-square shrink-0 overflow-hidden border border-[var(--c-border)] bg-[var(--c-panel)] text-[var(--c-muted)]',
          frameClass,
        )}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className="h-full w-full object-cover"
            onError={(event) => {
              event.currentTarget.style.display = 'none';
            }}
          />
        ) : imageOverride || (
          <div className="flex h-full w-full items-center justify-center">
            <EntityFallbackIcon type={entity?.type} isDependent={isDependent} />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className={joinClasses('truncate font-black text-[var(--c-text)]', compact ? 'text-xs' : 'text-sm')}>
          {name || 'Client'}
        </p>
        {identity ? (
          <p className="truncate text-[10px] font-bold uppercase tracking-wide text-[var(--c-muted)]">{identity}</p>
        ) : null}
        {isDependent && (parentClientName || parentClientId) ? (
          <p className="truncate text-[10px] font-semibold text-[var(--c-accent)]">
            Under: {parentClientName || 'Parent Client'}{parentClientId ? ` (${parentClientId})` : ''}
          </p>
        ) : null}
      </div>
    </div>
  );
};

const IdentityCardSelector = ({
  entity = {},
  tenantId = '',
  clientId = '',
  dependentId = '',
  identityId = '',
  isDependent,
  parentClientName = '',
  parentClientId = '',
  name = '',
  identity = '',
  imageUrl = '',
  mobileNumbers,
  emailAddresses,
  to = '',
  mode = 'link',
  onSelect,
  className = '',
  contentClassName = '',
  size = 'md',
  imageOverride = null,
  tooltipClassName = '',
  resolveFromId = true,
}) => {
  const [resolvedPackage, setResolvedPackage] = useState(null);
  const [isResolving, setIsResolving] = useState(false);

  const hasEntityData = Boolean(
    entity
      && typeof entity === 'object'
      && (
        entity.id
        || entity.displayClientId
        || entity.tradeName
        || entity.fullName
        || entity.name
      ),
  );
  const lookupId = normalizeText(identityId || dependentId || clientId || entity?.id || entity?.displayClientId);

  useEffect(() => {
    let active = true;
    if (!resolveFromId || hasEntityData || !tenantId || !lookupId) {
      Promise.resolve().then(() => {
        if (!active) return;
        setResolvedPackage(null);
        setIsResolving(false);
      });
      return undefined;
    }

    Promise.resolve()
      .then(() => {
        if (!active) return null;
        setIsResolving(true);
        return resolveTenantIdentity(tenantId, {
          id: lookupId,
          clientId,
          dependentId,
        });
      })
      .then((result) => {
        if (!active || !result) return;
        setResolvedPackage(result?.ok ? result : null);
        setIsResolving(false);
      })
      .catch(() => {
        if (!active) return;
        setResolvedPackage(null);
        setIsResolving(false);
      });

    return () => {
      active = false;
    };
  }, [clientId, dependentId, hasEntityData, lookupId, resolveFromId, tenantId]);

  const effectiveEntity = resolvedPackage?.entity || entity || {};
  const effectiveParent = resolvedPackage?.parent || null;
  const resolvedIsDependent = Boolean(isDependent ?? resolvedPackage?.isDependent ?? String(effectiveEntity?.type || '').toLowerCase() === 'dependent');
  const resolvedClientId = normalizeText(clientId || resolvedPackage?.clientId || effectiveEntity?.parentId || effectiveEntity?.clientId || effectiveEntity?.id);
  const resolvedDependentId = normalizeText(dependentId || resolvedPackage?.dependentId || (resolvedIsDependent ? effectiveEntity?.id : ''));
  const resolvedName = resolveName(effectiveEntity, name) || (isResolving ? 'Loading identity...' : '');
  const resolvedIdentity = resolveIdentity(effectiveEntity, identity || lookupId);
  const resolvedImage = resolveImage(effectiveEntity, imageUrl);
  const resolvedParentName = parentClientName || effectiveEntity?.parentName || effectiveEntity?.parentClientName || effectiveParent?.tradeName || effectiveParent?.fullName || '';
  const resolvedParentId = parentClientId || effectiveEntity?.parentDisplayClientId || effectiveEntity?.parentClientId || effectiveParent?.displayClientId || effectiveParent?.id || effectiveEntity?.parentId || '';
  const route = to || resolvedPackage?.route || buildIdentityRoute({
    tenantId,
    clientId: resolvedIsDependent ? resolvedClientId : normalizeText(clientId || effectiveEntity?.id || resolvedClientId),
    dependentId: resolvedDependentId,
    isDependent: resolvedIsDependent,
  });
  const mobiles = normalizeList(mobileNumbers || effectiveEntity?.mobileContacts || [effectiveEntity?.primaryMobile, effectiveEntity?.secondaryMobile]);
  const emails = normalizeList(emailAddresses || effectiveEntity?.emailContacts || [effectiveEntity?.primaryEmail, effectiveEntity?.email]);

  const sharedClassName = joinClasses(
    'group/identity relative block min-w-0 rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)] text-left shadow-sm transition',
    'hover:border-[var(--c-accent)] hover:bg-[color:color-mix(in_srgb,var(--c-panel)_78%,var(--c-accent)_8%)] hover:shadow-md',
    className,
  );

  const content = (
    <IdentityContent
      entity={effectiveEntity}
      name={resolvedName}
      identity={resolvedIdentity}
      imageUrl={resolvedImage}
      isDependent={resolvedIsDependent}
      parentClientName={resolvedParentName}
      parentClientId={resolvedParentId}
      size={size}
      imageOverride={imageOverride}
    />
  );

  const tooltip = (
    <QuickInfoTooltip
      fullName={resolvedName}
      identity={resolvedIdentity}
      mobiles={mobiles}
      emails={emails}
      parentClientName={resolvedParentName}
      parentClientId={resolvedParentId}
      className={tooltipClassName}
    />
  );

  if (mode === 'button') {
    return (
      <div className={sharedClassName}>
        <button
          type="button"
          onClick={() => onSelect?.(effectiveEntity)}
          className={joinClasses('block w-full min-w-0 text-left', contentClassName)}
        >
          {content}
        </button>
        {tooltip}
      </div>
    );
  }

  if (!route) {
    return (
      <div className={sharedClassName}>
        <div className={joinClasses('block w-full min-w-0', contentClassName)}>{content}</div>
        {tooltip}
      </div>
    );
  }

  return (
    <div className={sharedClassName}>
      <Link to={route} className={joinClasses('block w-full min-w-0', contentClassName)}>
        {content}
      </Link>
      {tooltip}
    </div>
  );
};

export default IdentityCardSelector;
