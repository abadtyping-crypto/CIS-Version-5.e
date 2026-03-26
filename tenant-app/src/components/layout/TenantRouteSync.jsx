import { useEffect } from 'react';
import { Navigate, Outlet, useParams } from 'react-router-dom';
import { DEFAULT_TENANT_ID, findTenantById } from '../../config/tenants';
import { useTenant } from '../../context/useTenant';

const TenantRouteSync = () => {
  const { tenantId: routeTenantId } = useParams();
  const { setTenantId } = useTenant();

  const tenant = findTenantById(routeTenantId);

  useEffect(() => {
    if (tenant) setTenantId(tenant.id);
  }, [setTenantId, tenant]);

  if (!tenant) return <Navigate to={`/t/${DEFAULT_TENANT_ID}/login`} replace />;

  return <Outlet />;
};

export default TenantRouteSync;
