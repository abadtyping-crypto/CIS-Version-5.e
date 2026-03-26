import {
  DashboardIcon,
  ClientOnboardingIcon,
  DailyTransactionsIcon,
  TasksTrackingIcon,
  QuotationsIcon,
  ProformaInvoicesIcon,
  ReceivePaymentsIcon,
  InvoiceManagementIcon,
  OperationExpensesIcon,
  PortalManagementIcon,
  DocumentCalendarIcon,
  BellIcon,
} from '../components/icons/AppIcons';
import { DEFAULT_PORTAL_ICON } from './transactionMethodConfig';
import { resolvePageIconUrl } from './pageIconAssets';

const TOPIC_ICON_MAP = {
  settings: DashboardIcon, // Or a specific settings icon if we had one
  users: ClientOnboardingIcon,
  finance: ReceivePaymentsIcon,
  documents: InvoiceManagementIcon,
  default: BellIcon,
};

const PAGE_KEY_ICON_MAP = {
  dashboard: DashboardIcon,
  settings: DashboardIcon, // Placeholder for settings
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
};

export const resolveNotificationPrimaryVisual = (item = {}, systemAssets = {}) => {
  if (item.entityType === 'portal') {
    return {
      kind: 'image',
      src: item.entityMeta?.iconUrl || DEFAULT_PORTAL_ICON,
      fallbackSrc: DEFAULT_PORTAL_ICON,
      alt: item.entityMeta?.name || 'Portal',
    };
  }

  const pageKey = String(item.pageKey || '').trim();
  const pageIconUrl = resolvePageIconUrl(systemAssets, pageKey);
  if (pageIconUrl) {
    return {
      kind: 'image',
      src: pageIconUrl,
      fallbackSrc: DEFAULT_PORTAL_ICON,
      alt: pageKey || 'Notification',
    };
  }

  const Icon =
    PAGE_KEY_ICON_MAP[pageKey] ||
    TOPIC_ICON_MAP[String(item.topic || '').trim()] ||
    TOPIC_ICON_MAP.default;

  return {
    kind: 'icon',
    Icon,
  };
};
