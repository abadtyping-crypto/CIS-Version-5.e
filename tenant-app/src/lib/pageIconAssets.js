export const PAGE_ICON_ASSET_MAP = Object.freeze({
  dashboard: 'icon_page_dashboard',
  clientOnboarding: 'icon_page_client_onboarding',
  dailyTransactions: 'icon_page_daily_transactions',
  tasksTracking: 'icon_page_tasks_tracking',
  quotations: 'icon_page_quotations',
  proformaInvoices: 'icon_page_proforma_invoices',
  receivePayments: 'icon_page_receive_payments',
  invoiceManagement: 'icon_page_invoice_management',
  operationExpenses: 'icon_page_operation_expenses',
  portalManagement: 'icon_page_portal_management',
  documentCalendar: 'icon_page_document_calendar',
  settings: 'icon_page_settings',
  notifications: 'icon_page_notifications',
  recycleBin: 'icon_page_recycle_bin',
  profile: 'icon_page_user',
  sidebarToggle: 'icon_ui_sidebar_toggle',
  sidebarHamburger: 'icon_ui_sidebar_hamburger',
  search: 'icon_ui_search',
  bell: 'icon_ui_bell',
  user: 'icon_page_user',
});

const PAGE_ICON_KEY_ALIASES = Object.freeze({
  'client-onboarding': 'clientOnboarding',
  'daily-transactions': 'dailyTransactions',
  'tasks-tracking': 'tasksTracking',
  'proforma-invoices': 'proformaInvoices',
  'receive-payments': 'receivePayments',
  'invoice-management': 'invoiceManagement',
  'operation-expenses': 'operationExpenses',
  'portal-management': 'portalManagement',
  'document-calendar': 'documentCalendar',
  profile: 'profile',
  user: 'user',
  notifications: 'notifications',
  settings: 'settings',
});

export const resolvePageIconAssetId = (pageKey = '') => (
  PAGE_ICON_ASSET_MAP[String(pageKey || '').trim()]
  || PAGE_ICON_ASSET_MAP[PAGE_ICON_KEY_ALIASES[String(pageKey || '').trim()] || '']
  || ''
);

export const resolvePageIconUrl = (systemAssets = {}, pageKey = '') => {
  const assetId = resolvePageIconAssetId(pageKey);
  if (!assetId) return '';
  
  // Check for global seasonal variation (Winter, Summer, etc.)
  const variation = (systemAssets['electron_controller']?.systemIconVariation || 'default').toLowerCase();
  
  if (variation !== 'default') {
    const variationAssetId = `${assetId}_${variation}`;
    const variationUrl = String(systemAssets?.[variationAssetId]?.iconUrl || '').trim();
    if (variationUrl) return variationUrl;
  }

  // Fallback to default assetId
  return String(systemAssets?.[assetId]?.iconUrl || '').trim();
};
