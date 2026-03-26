import {
  LayoutDashboard,
  UserRoundPlus,
  Activity,
  ListTodo,
  FileSearch2,
  FileDigit,
  HandCoins,
  FileText,
  Wallet,
  Globe,
  CalendarRange,
} from 'lucide-react';

const withIcon = (Icon, defaultClassName) => {
  const WrappedIcon = ({ className = defaultClassName, ...props }) => (
    <Icon className={className} strokeWidth={1.9} aria-hidden="true" {...props} />
  );
  WrappedIcon.displayName = `${Icon.displayName || 'Icon'}Wrapper`;
  return WrappedIcon;
};

export const DashboardIcon = withIcon(LayoutDashboard, 'h-6 w-6');
export const ClientOnboardingIcon = withIcon(UserRoundPlus, 'h-6 w-6');
export const DailyTransactionsIcon = withIcon(Activity, 'h-6 w-6');
export const TasksTrackingIcon = withIcon(ListTodo, 'h-6 w-6');
export const QuotationsIcon = withIcon(FileSearch2, 'h-6 w-6');
export const ProformaInvoicesIcon = withIcon(FileDigit, 'h-6 w-6');
export const ReceivePaymentsIcon = withIcon(HandCoins, 'h-6 w-6');
export const InvoiceManagementIcon = withIcon(FileText, 'h-6 w-6');
export const OperationExpensesIcon = withIcon(Wallet, 'h-6 w-6');
export const PortalManagementIcon = withIcon(Globe, 'h-6 w-6');
export const DocumentCalendarIcon = withIcon(CalendarRange, 'h-6 w-6');
