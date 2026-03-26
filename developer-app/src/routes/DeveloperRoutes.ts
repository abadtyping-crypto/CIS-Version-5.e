import { TenantManagementPage } from '../pages/TenantManagementPage';
import { ApplicationLibraryPage } from '../pages/ApplicationLibraryPage';
import { HeaderControlCenterPage as HeaderControlCenterPageImpl } from '../pages/HeaderControlCenterPageImpl';

export const DeveloperRoutes = [
    {
        path: '/t/:tenantId/dashboard',
        component: TenantManagementPage,
        name: 'Tenant Management'
    },
    {
        path: '/t/:tenantId/apps',
        component: ApplicationLibraryPage,
        name: 'Application Library'
    },
    {
        path: '/t/:tenantId/settings',
        component: HeaderControlCenterPageImpl,
        name: 'System Settings'
    }
];
