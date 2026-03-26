import './App.css';
import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import RequireAuth from './components/auth/RequireAuth';
import AppLayout from './components/layout/AppLayout';
import TenantRouteSync from './components/layout/TenantRouteSync';
import { DEFAULT_TENANT_ID } from './config/tenants';
import { AuthProvider } from './context/AuthContext';
import { TenantProvider } from './context/TenantContext';
import { ThemeProvider } from './context/ThemeContext';
import { GlobalProgressProvider } from './context/GlobalProgressProvider';
import GlobalProgressController from './components/progress/GlobalProgressController';
import AdaptiveProfilePage from './pages/AdaptiveProfilePage';
import DashboardPage from './pages/DashboardPage';
import FavoritesPage from './pages/FavoritesPage';
import LoginPage from './pages/LoginPage';
import NotificationsPage from './pages/NotificationsPage';
import PortalManagementPage from './pages/PortalManagementPage';
import PortalDetailPage from './pages/PortalDetailPage';
import ProfilePage from './pages/ProfilePage';
import SearchPage from './pages/SearchPage';
import SettingsPage from './pages/SettingsPage';
import ClientsOnboardingPage from './pages/ClientsOnboardingPage';
import ClientDetailsPage from './pages/ClientDetailsPage';
import DependentDetailsPage from './pages/DependentDetailsPage';
import ModulePlaceholderPage from './pages/ModulePlaceholderPage';
import DailyTransactionPage from './pages/DailyTransactionPage';
import ChatHelpPage from './pages/ChatHelpPage';
import QuotationPage from './pages/QuotationPage';
import ProformaInvoicesPage from './pages/ProformaInvoicesPage';
import ReceivePaymentsPage from './pages/ReceivePaymentsPage';
import OperationExpensesPage from './pages/OperationExpensesPage';
import TasksTrackingPage from './pages/TasksTrackingPage';

import ProformaCreatePage from './pages/workflows/ProformaCreatePage';
import ProformaViewPage from './pages/workflows/ProformaViewPage';
import TaskManagementPage from './pages/workflows/TaskManagementPage';
import TrackingPage from './pages/workflows/TrackingPage';
import RefundLogPage from './pages/workflows/RefundLogPage';

import TitleBar from './components/layout/TitleBar';
import PageTransitionOverlay from './components/layout/PageTransitionOverlay';

const App = () => {
  useEffect(() => {
    const handleNumberInputWheel = (event) => {
      const activeElement = document.activeElement;
      if (!(activeElement instanceof HTMLInputElement) || activeElement.type !== 'number') return;

      const wheelTarget = event.target;
      if (!(wheelTarget instanceof Element)) return;

      if (wheelTarget.closest('input[type="number"]') !== activeElement) return;

      event.preventDefault();
      activeElement.blur();
    };

    document.addEventListener('wheel', handleNumberInputWheel, {
      passive: false,
      capture: true,
    });

    return () => {
      document.removeEventListener('wheel', handleNumberInputWheel, true);
    };
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <TenantProvider>
          <BrowserRouter>
            <GlobalProgressProvider>
              <TitleBar />
              <GlobalProgressController />
              <PageTransitionOverlay />
              <Routes>
                <Route path="/" element={<Navigate to={`/t/${DEFAULT_TENANT_ID}/login`} replace />} />
                <Route path="/t/:tenantId" element={<TenantRouteSync />}>
                  <Route path="login" element={<LoginPage />} />
                  <Route element={<RequireAuth />}>
                    <Route element={<AppLayout />}>
                      <Route index element={<Navigate to="dashboard" replace />} />
                      <Route path="dashboard" element={<DashboardPage />} />
                      <Route path="settings" element={<SettingsPage />} />
                      <Route path="daily-transactions" element={<DailyTransactionPage />} />
                      <Route
                        path="tasks-tracking"
                        element={<TasksTrackingPage />}
                      />
                      <Route
                        path="invoice-management"
                        element={<ModulePlaceholderPage title="Invoice Management" subtitle="Invoice Management module placeholder." iconKey="invoiceManagement" />}
                      />
                      <Route path="quotations" element={<QuotationPage />} />
                      <Route path="proforma-invoices" element={<ProformaInvoicesPage />} />
                      <Route path="receive-payments" element={<ReceivePaymentsPage />} />
                      <Route
                        path="proforma-quotation"
                        element={<Navigate to="../quotations" replace />}
                      />
                      <Route
                        path="operation-expenses"
                        element={<OperationExpensesPage />}
                      />
                      <Route path="notifications" element={<NotificationsPage />} />
                      <Route path="profile" element={<AdaptiveProfilePage />} />
                      <Route path="profile/edit" element={<ProfilePage />} />
                      <Route path="portal-management" element={<PortalManagementPage />} />
                      <Route path="portal-management/new" element={<PortalManagementPage />} />
                      <Route path="portal-management/edit/:portalId" element={<PortalManagementPage />} />
                      <Route path="portal-management/:portalId" element={<PortalDetailPage />} />
                      <Route
                        path="document-calendar"
                        element={<ModulePlaceholderPage title="Document Calendar" subtitle="Document calendar module placeholder." iconKey="documentCalendar" />}
                      />
                      <Route path="client-onboarding" element={<ClientsOnboardingPage />} />
                      <Route path="clients/:clientId/dependents/:dependentId" element={<DependentDetailsPage />} />
                      <Route path="clients/:clientId" element={<ClientDetailsPage />} />
                      <Route path="favorites" element={<FavoritesPage />} />
                      <Route path="search" element={<SearchPage />} />
                      <Route path="chat-help" element={<ChatHelpPage />} />

                      {/* Workflow System Modules */}
                      <Route path="workflows/proformas/new" element={<ProformaCreatePage />} />
                      <Route path="workflows/proformas/:proformaId" element={<ProformaViewPage />} />
                      <Route path="workflows/tasks" element={<TaskManagementPage />} />
                      <Route path="workflows/tracking" element={<TrackingPage />} />
                      <Route path="workflows/refund-log" element={<RefundLogPage />} />
                    </Route>
                  </Route>
                </Route>
                <Route path="*" element={<Navigate to={`/t/${DEFAULT_TENANT_ID}/login`} replace />} />
              </Routes>
            </GlobalProgressProvider>
          </BrowserRouter>
        </TenantProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
