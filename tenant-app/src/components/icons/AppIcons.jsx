import {
  Banknote,
  Bell,
  CalendarDays,
  CircleDollarSign,
  CircleUserRound,
  CreditCard,
  FileSpreadsheet,
  FileText,
  House,
  Info,
  LayoutGrid,
  Library,
  ListChecks,
  ReceiptText,
  Search,
  Settings,
  Star,
  Trash2,
  UserPlus,
  WalletCards,
  HelpCircle,
  Menu,
  ChevronRight,
} from 'lucide-react';
import { resolvePageIconUrl } from '../../lib/pageIconAssets';
import { useSystemAssets } from '../../lib/systemAssetsCache';
import { useMemo } from 'react';

const withIcon = (Icon, defaultClassName) => {
  const WrappedIcon = ({ className = defaultClassName, ...props }) => (
    <Icon className={className} strokeWidth={1.9} aria-hidden="true" {...props} />
  );
  WrappedIcon.displayName = `${Icon.displayName || 'Icon'}Wrapper`;
  return WrappedIcon;
};

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
} from './nav/NavIcons';

export {
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
};

export const HomeIcon = DashboardIcon;
export const BellIcon = withIcon(Bell, 'h-6 w-6');
export const StarIcon = withIcon(Star, 'h-6 w-6');
export const UserIcon = withIcon(CircleUserRound, 'h-6 w-6');
export const SearchIcon = withIcon(Search, 'h-6 w-6');
export const InfoIcon = withIcon(Info, 'h-4 w-4');
export const SettingsIcon = withIcon(Settings, 'h-6 w-6');
export const LibraryIcon = withIcon(Library, 'h-6 w-6');
export const PortalIcon = PortalManagementIcon;
export const UserPlusIcon = ClientOnboardingIcon;
export const RecycleBinIcon = withIcon(Trash2, 'h-6 w-6');
export const ReceiptIcon = DailyTransactionsIcon;
export const TasksIcon = TasksTrackingIcon;
export const LauncherIcon = withIcon(LayoutGrid, 'h-6 w-6');
export const InvoiceIcon = InvoiceManagementIcon;
export const QuotationIcon = QuotationsIcon;
export const ExpenseIcon = OperationExpensesIcon;
export const CalendarIcon = DocumentCalendarIcon;
export const CreditCardIcon = ReceivePaymentsIcon;
export const CashByHandIcon = withIcon(CircleDollarSign, 'h-6 w-6');
export const BankTransferIcon = withIcon(FileSpreadsheet, 'h-6 w-6');
export const CdmDepositIcon = withIcon(ReceiptText, 'h-6 w-6');
export const CashWithdrawalsIcon = withIcon(Banknote, 'h-6 w-6');
export const OnlinePaymentIcon = withIcon(CreditCard, 'h-6 w-6');
export const ChequeDepositIcon = withIcon(FileText, 'h-6 w-6');
export const TabbyIcon = withIcon(WalletCards, 'h-6 w-6');
export const TamaraIcon = withIcon(WalletCards, 'h-6 w-6');

const DYNAMIC_MAPPING = {
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
  search: SearchIcon,
  user: UserIcon,
  sidebarHamburger: withIcon(Menu, 'h-6 w-6'),
  sidebarToggle: withIcon(ChevronRight, 'h-6 w-6'),
};

const HelpCircleIcon = withIcon(HelpCircle, 'h-6 w-6');

export const DynamicAppIcon = ({ iconKey, className = 'h-6 w-6', standalone = false, ...props }) => {
  const assets = useSystemAssets();
  const customUrl = useMemo(() => resolvePageIconUrl(assets, iconKey), [assets, iconKey]);
  const FallbackIcon = DYNAMIC_MAPPING[iconKey] || HelpCircleIcon;

  if (customUrl) {
    return (
      <div className={`relative shrink-0 overflow-hidden ${standalone ? '' : className.replace(/\bp-\d+\b|\bpx-\d+\b|\bpy-\d+\b/g, '').trim()}`}>
        <img
          src={customUrl}
          alt={iconKey}
          className="absolute inset-0 h-full w-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      </div>
    );
  }

  return <FallbackIcon className={className} {...props} />;
};

