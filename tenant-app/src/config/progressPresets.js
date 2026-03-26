export const PROGRESS_STATUS = {
  IDLE: 'idle',
  LOADING: 'loading',
  SUCCESS: 'success',
  ERROR: 'error'
};

export const PROGRESS_SCOPE = {
  GLOBAL: 'global',
  ROUTE: 'route',
  BUTTON: 'button',
  SECTION: 'section',
  MODAL: 'modal'
};

export const PROGRESS_PRESETS = {
  ROUTE_CHANGE: {
    id: 'route-change',
    title: 'Optimizing Workspace',
    messages: ['Routing...', 'Loading data...', 'Preparing components...'],
    minVisibleMs: 800,
    scope: PROGRESS_SCOPE.ROUTE,
    priority: 10
  },
  PDF_GEN: {
    id: 'pdf-gen',
    title: 'Document Hub',
    messages: ['Generating PDF...', 'Finalizing layout...', 'Preparing download...'],
    minVisibleMs: 1200,
    scope: PROGRESS_SCOPE.GLOBAL,
    variant: 'processing'
  },
  AUTH: {
    id: 'auth-sync',
    title: 'Security Sync',
    messages: ['Authenticating...', 'Refreshing session...', 'Verifying credentials...'],
    minVisibleMs: 1000,
    scope: PROGRESS_SCOPE.GLOBAL,
    variant: 'security'
  },
  EMAIL_SEND: {
    id: 'email-send',
    title: 'Communication Hub',
    messages: ['Sending email...', 'Delivering message...', 'Syncing outbox...'],
    minVisibleMs: 1500,
    scope: PROGRESS_SCOPE.GLOBAL,
    variant: 'email'
  },
  SAVE_SETTINGS: {
    id: 'save-settings',
    title: 'Preference Sync',
    messages: ['Saving changes...', 'Updating cloud profile...', 'Applying theme...'],
    minVisibleMs: 600,
    scope: PROGRESS_SCOPE.GLOBAL
  }
};
