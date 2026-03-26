import { useMemo } from 'react';
import { resolvePageIconUrl } from '../lib/pageIconAssets';
import { useSystemAssets } from '../lib/systemAssetsCache';
import * as LucideIcons from 'lucide-react';
import { ClientOnboardingIcon, DashboardIcon, DailyTransactionsIcon, TasksTrackingIcon, QuotationsIcon, ProformaInvoicesIcon, ReceivePaymentsIcon, InvoiceManagementIcon, OperationExpensesIcon, PortalManagementIcon, DocumentCalendarIcon, BellIcon, RecycleBinIcon, SettingsIcon } from '../components/icons/AppIcons';

const DEFAULT_ICON_MAP = {
  dashboard: DashboardIcon,
  clientOnboarding: ClientOnboardingIcon,
  dailyTransactions: DailyTransactionsIcon,
  tasksTracking: TasksTrackingIcon,
  quotations: QuotationsIcon,
  proformaInvoices: ProformaInvoicesIcon,
  receivePayments: ReceivePaymentsIcon,
  invoiceManagement: InvoiceManagementIcon,
  operationExpenses: OperationExpensesIcon,
  portalManagement: PortalManagementIcon,
  documentCalendar: DocumentCalendarIcon,
  bell: BellIcon,
  recycleBin: RecycleBinIcon,
  settings: SettingsIcon,
};

export const useAppIcon = (iconKey) => {
  const assets = useSystemAssets();
  // For now, we'll use a simplified version that checks systemAssets
  // In a full implementation, we'd also check the applicationIconLibraryStore
  
  return useMemo(() => {
    const FallbackIcon = DEFAULT_ICON_MAP[iconKey] || LucideIcons.HelpCircle;
    
    return {
      Icon: FallbackIcon,
      // We can also return a URL if a custom one is found
      customUrl: resolvePageIconUrl(assets, iconKey), 
    };
  }, [assets, iconKey]);
};
