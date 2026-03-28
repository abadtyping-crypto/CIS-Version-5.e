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

export const WhatsAppColorIcon = ({ className = 'h-5 w-5' }) => (
  <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
    <path fill="#25D366" d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.149.929 3.182 0 5.767-2.587 5.768-5.766 0-3.18-2.586-5.771-5.768-5.771zm3.374 8.202c-.162.454-.844.851-1.221.914-.336.056-.77.082-1.242-.079-.47-.16-.837-.324-1.123-.414-1.975-.851-3.265-2.84-3.363-2.971-.098-.131-.803-1.066-.803-2.033 0-.967.509-1.442.689-1.639.18-.196.393-.245.525-.245l.377.007c.12.006.282.047.442.339.164.395.557 1.365.607 1.463.05.099.082.213.016.344-.065.131-.098.213-.196.327-.099.115-.207.258-.295.345-.098.113-.186.236-.086.4.115.196.507.835 1.087 1.352.746.666 1.375.872 1.57.97.196.098.311.082.426-.049.115-.132.492-.574.623-.77.131-.196.263-.164.443-.098.18.066 1.144.54 1.34.638.197.098.327.147.377.229.05.082.05.474-.114.932z"/>
  </svg>
);

