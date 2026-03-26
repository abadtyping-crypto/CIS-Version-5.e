/**
 * Centralized Status Resolver for the Workflow System
 * Enforces unified status logic across Proformas, Tasks, and Tracking.
 * Prevents UI mismatches and data inconsistency.
 */

// --- PROFORMA STATUS --- //
// Allowed outputs: 'pending', 'partial', 'paid', 'cancelled'
export const resolveProformaStatus = (proforma, tasks = []) => {
  if (!proforma) return 'unknown';
  
  // Explicit hard overrides
  if (proforma.status === 'cancelled') return 'cancelled';

  // Proforma is considered 'paid' if all generated tasks are completed, or explicitly marked
  if (proforma.status === 'paid') return 'paid';

  // If there are linked tasks, derive status from task completeness
  if (tasks && tasks.length > 0) {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => resolveTaskStatus(t) === 'completed').length;
    const cancelledTasks = tasks.filter((t) => resolveTaskStatus(t) === 'cancelled').length;

    if (completedTasks + cancelledTasks === totalTasks) {
      if (completedTasks > 0) return 'paid';
      return 'cancelled';
    }
    if (completedTasks > 0) return 'partial';
    return 'pending';
  }

  // If amount paid is tracked directly on the proforma (alternative logic)
  const totalAmount = Number(proforma.totalAmount || 0);
  const paidAmount = Number(proforma.paidAmount || 0);
  
  if (totalAmount > 0) {
    if (paidAmount >= totalAmount) return 'paid';
    if (paidAmount > 0) return 'partial';
  }

  return 'pending';
};

// --- TASK STATUS --- //
// Allowed outputs: 'pending', 'completed', 'cancelled'
export const resolveTaskStatus = (task) => {
  if (!task) return 'unknown';

  const status = String(task.status || '').toLowerCase();
  
  if (status === 'cancelled') return 'cancelled';
  if (status === 'completed' || status === 'done') return 'completed';
  
  return 'pending';
};

// --- TRACKING STATUS --- //
// Allowed outputs: 'inProgress', 'completed', 'approved', 'modificationRequired', 'cancelled'
export const resolveTrackingStatus = (tracking) => {
  if (!tracking) return 'unknown';

  const status = String(tracking.status || '').toLowerCase();

  switch (status) {
    case 'cancelled':
      return 'cancelled';
    case 'completed':
    case 'done':
      return 'completed';
    case 'approved':
      return 'approved';
    case 'modificationrequired':
    case 'modification_required':
    case 'modification required':
    case 'modification':
      return 'modificationRequired';
    case 'inprogress':
    case 'in_progress':
    case 'in progress':
    case 'pending':
    default:
      return 'inProgress';
  }
};

/**
 * UI visual helper mapping status to display styles
 * Ensures unified presentation in tables/cards
 */
export const getStatusBadgeStyle = (statusLabel) => {
  switch (statusLabel) {
    case 'paid':
    case 'completed':
    case 'approved':
      return 'bg-[var(--c-success-soft)] text-[var(--c-success)] border-[var(--c-success)]';
    case 'cancelled':
      return 'bg-[var(--c-danger-soft)] text-[var(--c-danger)] border-[var(--c-danger)]';
    case 'partial':
    case 'modificationRequired':
      return 'bg-[var(--c-warning-soft)] text-[var(--c-warning)] border-[var(--c-warning)]';
    case 'pending':
    case 'inProgress':
    default:
      return 'bg-[var(--c-info-soft)] text-[var(--c-info)] border-[var(--c-info)]';
  }
};
