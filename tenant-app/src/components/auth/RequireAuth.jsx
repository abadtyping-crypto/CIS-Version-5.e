import { Navigate, Outlet, useParams } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';

const RequireAuth = () => {
  const { tenantId } = useParams();
  const { isAuthenticated, tenantId: sessionTenantId } = useAuth();

  if (!isAuthenticated) return <Navigate to={`/t/${tenantId}/login`} replace />;
  if (sessionTenantId !== tenantId) return <Navigate to={`/t/${tenantId}/login`} replace />;

  return <Outlet />;
};

export default RequireAuth;

