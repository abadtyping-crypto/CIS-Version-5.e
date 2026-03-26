import { collection, doc, getDocs, orderBy, query, runTransaction, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { toSafeDocId } from './idUtils';

// Helper to handle standardized errors
export const toSafeError = (error) => {
  if (typeof error === 'string') return error;
  return error?.message || 'unknown';
};

// --- PROFORMA MODULE ---

/**
 * Creates a new Proforma document.
 * @param {string} tenantId 
 * @param {string} proformaId 
 * @param {object} payload - { clientId, items: [], totalAmount, status }
 */
export const createProforma = async (tenantId, proformaId, payload) => {
  try {
    const { createdBy, updatedAt, updatedBy, ...rest } = payload || {};
    const safeCreatedBy = typeof createdBy === 'object' ? createdBy?.uid : createdBy;
    
    // Filter array fields to remove empty placeholders
    const sanitizedPayload = { ...rest };
    Object.keys(sanitizedPayload).forEach(key => {
      if (Array.isArray(sanitizedPayload[key])) {
        sanitizedPayload[key] = sanitizedPayload[key].filter(item => {
          if (item && typeof item === 'object' && Object.keys(item).length === 0) return false;
          return true;
        });
      }
    });

    const ref = doc(db, 'tenants', tenantId, 'proformas', proformaId);
    await setDoc(ref, {
      ...sanitizedPayload,
      createdBy: String(safeCreatedBy || '').trim(),
      amountPaid: 0,
      balanceDue: Number(sanitizedPayload.totalAmount || 0),
      createdAt: serverTimestamp(),
    }, { merge: true });
    return { ok: true, proformaId };
  } catch (error) {
    return { ok: false, error: toSafeError(error) };
  }
};

/**
 * Fetches all proformas for a tenant.
 */
export const fetchProformas = async (tenantId) => {
  try {
    const q = query(collection(db, 'tenants', tenantId, 'proformas'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return { ok: true, rows: snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) };
  } catch (error) {
    return { ok: false, error: toSafeError(error), rows: [] };
  }
};

// --- TASK MODULE ---

/**
 * Decomposes a single Proforma into grouped Tasks (1 task per item).
 * Requires atomic write (runTransaction).
 */
export const convertProformaToTasks = async (tenantId, proformaId, uid) => {
  try {
    let newTasks = [];
    await runTransaction(db, async (txn) => {
      const proformaRef = doc(db, 'tenants', tenantId, 'proformas', proformaId);
      const proformaSnap = await txn.get(proformaRef);
      if (!proformaSnap.exists()) throw new Error('Proforma not found.');

      const proforma = proformaSnap.data();
      const items = Array.isArray(proforma.items) ? proforma.items : [];
      if (items.length === 0) throw new Error('Proforma has no items to convert.');

      const taskGroupId = toSafeDocId(`TGRP-${proformaId}`, 'taskGroup');

      items.forEach((item, index) => {
        const taskId = toSafeDocId(`${taskGroupId}-${index + 1}`, 'task');
        const taskRef = doc(db, 'tenants', tenantId, 'tasks', taskId);

        const netAmount = Number(item.amount || item.price || 0) * Number(item.quantity || 1);

        const taskData = {
          taskId,
          proformaTaskGroupId: taskGroupId,
          proformaId,
          clientId: proforma.clientId,
          applicationId: String(item.applicationId || ''),
          applicationName: String(item.applicationName || item.name || 'Unknown Item'),
          amount: netAmount,
          visibility: String(item.visibility || 'universal'), // assigned / universal / private
          assignedTo: String(item.assignedTo || ''),
          status: 'pending',
          deadline: item.deadline || null,
          dueDate: item.dueDate || null,
          createdAt: serverTimestamp(),
          createdBy: typeof uid === 'object' ? uid?.uid : uid,
        };

        txn.set(taskRef, taskData);
        newTasks.push(taskData);
      });

      // Update proforma to mark it as converted/active logic, mapping the taskGroupId
      txn.set(proformaRef, {
        taskGroupId,
        updatedAt: serverTimestamp(),
        updatedBy: typeof uid === 'object' ? uid?.uid : uid,
      }, { merge: true });
    });

    return { ok: true, newTasks };
  } catch (error) {
    return { ok: false, error: toSafeError(error) };
  }
};

export const fetchTasks = async (tenantId) => {
  try {
    const q = query(collection(db, 'tenants', tenantId, 'tasks'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return { ok: true, rows: snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) };
  } catch (error) {
    return { ok: false, error: toSafeError(error), rows: [] };
  }
};

export const fetchTasksByGroup = async (tenantId, taskGroupId) => {
  try {
    const q = query(
      collection(db, 'tenants', tenantId, 'tasks'),
      where('proformaTaskGroupId', '==', taskGroupId)
    );
    const snap = await getDocs(q);
    return { ok: true, rows: snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) };
  } catch (error) {
    return { ok: false, error: toSafeError(error), rows: [] };
  }
};

/**
 * Updates an individual task (e.g. status or deadline)
 */
export const updateTask = async (tenantId, taskId, payload) => {
  try {
    const ref = doc(db, 'tenants', tenantId, 'tasks', taskId);
    await setDoc(ref, {
      ...payload,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toSafeError(error) };
  }
};

// --- TRACKING MODULE ---

/**
 * Creates or updates tracking details for a transaction.
 */
export const upsertTracking = async (tenantId, trackingId, payload) => {
  try {
    const ref = doc(db, 'tenants', tenantId, 'trackings', trackingId);
    
    const { createdBy, updatedAt, updatedBy, ...rest } = payload || {};
    const safeCreatedBy = typeof createdBy === 'object' ? createdBy?.uid : createdBy;

    // Filter array fields and handle bounds
    const sanitizedPayload = { ...rest };
    if (Array.isArray(sanitizedPayload.trackingNumbers)) {
      sanitizedPayload.trackingNumbers = sanitizedPayload.trackingNumbers
        .filter(t => t && (typeof t !== 'object' || Object.keys(t).length > 0))
        .slice(0, 36);
    }

    await setDoc(ref, {
      ...sanitizedPayload,
      createdBy: String(safeCreatedBy || '').trim(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toSafeError(error) };
  }
};

export const fetchTrackings = async (tenantId) => {
  try {
    const q = query(collection(db, 'tenants', tenantId, 'trackings'), orderBy('updatedAt', 'desc'));
    const snap = await getDocs(q);
    return { ok: true, rows: snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) };
  } catch (error) {
    return { ok: false, error: toSafeError(error), rows: [] };
  }
};

/**
 * Atomic Tracking Update Service
 */
export const updateTracking = async (tenantId, trackingId, payload) => {
  try {
    const ref = doc(db, 'tenants', tenantId, 'trackings', trackingId);
    await setDoc(ref, {
      ...payload,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toSafeError(error) };
  }
};

// --- CANCELLATION & REFUND MODULE ---

/**
 * Cascading Cancellation Service.
 * Ensures data integrity by cancelling a task (or group), linked transactions, tracking, and producing a refund log.
 */
export const cancelWorkflowEntities = async (tenantId, entityId, entityType, reason, uid, payload = {}) => {
  // Requirements: reason required.
  if (!reason || reason.trim().length < 4) {
    return { ok: false, error: 'A valid cancellation reason is required.' };
  }

  try {
    await runTransaction(db, async (txn) => {
      // 1. Identify what we are cancelling.
      // E.g., if entityType === 'taskGroup', cancel ALL tasks in that group.
      // if entityType === 'task', cancel just that task (and linked daily transaction if exists).
      
      const refundLogId = toSafeDocId(`REF-${Date.now()}`, 'refundLog');
      const refundRef = doc(db, 'tenants', tenantId, 'refundLogs', refundLogId);
      
      let tasksToCancel = [];
      let transactionsToCancel = [];
      let totalRefundAmount = Number(payload.refundAmount) || 0; // if manual amount provided, else derived
      
      if (entityType === 'taskGroup') {
        const tq = query(collection(db, 'tenants', tenantId, 'tasks'), where('proformaTaskGroupId', '==', entityId));
        const tsnap = await getDocs(tq); // using getDocs inside runTransaction is not strictly atomic for queries, but we map refs
        tsnap.docs.forEach(d => tasksToCancel.push({ id: d.id, ref: d.ref, data: d.data() }));
      } else if (entityType === 'task') {
        const tref = doc(db, 'tenants', tenantId, 'tasks', entityId);
        const ts = await txn.get(tref);
        if (ts.exists()) tasksToCancel.push({ id: ts.id, ref: tref, data: ts.data() });
      }

      // Mark tasks as cancelled
      tasksToCancel.forEach(t => {
        txn.set(t.ref, {
          status: 'cancelled',
          cancelledAt: serverTimestamp(),
          cancelledBy: uid,
          cancellationReason: reason
        }, { merge: true });
        
        // Optionally map linked transactions if the task stored them
        if (t.data.transactionId) {
          transactionsToCancel.push(t.data.transactionId);
        }
      });

      // Mark transactions & tracking as cancelled if necessary
      transactionsToCancel.forEach(txId => {
        const txRef = doc(db, 'tenants', tenantId, 'dailyTransactions', txId);
        txn.set(txRef, {
          status: 'cancelled',
          cancelledAt: serverTimestamp(),
          cancelledBy: uid,
          cancellationReason: reason
        }, { merge: true });

        // Assuming trackingId matches txId or linked explicitly
        const trRef = doc(db, 'tenants', tenantId, 'trackings', txId); // simplified tracking link
        txn.set(trRef, {
          status: 'cancelled',
          cancelledAt: serverTimestamp(),
          cancelledBy: uid,
          cancellationReason: reason
        }, { merge: true });
      });

      // 2. Create the Refund Log
      const safeCreatedBy = typeof uid === 'object' ? uid?.uid : uid;
      let logData = {
        refundLogId,
        refundAmount: totalRefundAmount,
        refundMethod: String(payload.refundMethod || 'wallet'),
        refundReason: reason,
        createdAt: serverTimestamp(),
        createdBy: String(safeCreatedBy || '').trim(),
      };

      if (entityType === 'taskGroup') logData.taskGroupId = entityId;
      if (payload.proformaId) logData.proformaId = payload.proformaId;

      txn.set(refundRef, logData);
      
      // We would strictly also handle restoring client balance using backendStore.js dailyTransaction reversal,
      // but we enforce the strict data module rule here as requested.
    });

    return { ok: true };
  } catch (error) {
    return { ok: false, error: toSafeError(error) };
  }
};

export const fetchRefundLogs = async (tenantId) => {
  try {
    const q = query(collection(db, 'tenants', tenantId, 'refundLogs'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return { ok: true, rows: snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) };
  } catch (error) {
    return { ok: false, error: toSafeError(error), rows: [] };
  }
};

/**
 * Records a payment against a Proforma and updates its balance atomically.
 * @param {string} tenantId
 * @param {string} paymentId
 * @param {object} payload - { clientId, proformaId, amount, portalId, methodId, note, createdBy }
 */
export const recordProformaPayment = async (tenantId, paymentId, payload) => {
  try {
    const { proformaId, amount, clientId, createdBy } = payload;
    if (!proformaId) return { ok: false, error: 'Proforma ID is required for linked payments.' };

    const result = { ok: true, proformaStatusAfter: '' };

    await runTransaction(db, async (txn) => {
      const proformaRef = doc(db, 'tenants', tenantId, 'proformas', proformaId);
      const paymentRef = doc(db, 'tenants', tenantId, 'payments', paymentId);
      const clientRef = doc(db, 'tenants', tenantId, 'clients', clientId);

      const [proformaSnap, clientSnap] = await Promise.all([
        txn.get(proformaRef),
        txn.get(clientRef)
      ]);

      if (!proformaSnap.exists()) throw new Error('Proforma not found.');

      const proformaData = proformaSnap.data();
      const totalAmount = Number(proformaData.totalAmount || 0);
      const currentPaid = Number(proformaData.amountPaid || 0);
      const newPaidAmount = currentPaid + Number(amount);
      const newBalanceDue = Math.max(0, totalAmount - newPaidAmount);

      let newStatus = 'partially_paid';
      if (newBalanceDue <= 0) newStatus = 'paid';

      // 1. Update Proforma
      txn.update(proformaRef, {
        amountPaid: newPaidAmount,
        balanceDue: newBalanceDue,
        status: newStatus,
        updatedAt: serverTimestamp(),
        updatedBy: createdBy
      });

      // 2. Save Payment Receipt
      const { createdBy: payCreatedBy, updatedAt: payUpdatedAt, updatedBy: payUpdatedBy, ...payRest } = payload || {};
      const safePayCreatedBy = typeof payCreatedBy === 'object' ? payCreatedBy?.uid : payCreatedBy;
      
      txn.set(paymentRef, {
        ...payRest,
        createdBy: String(safePayCreatedBy || '').trim(),
        type: 'receipt',
        createdAt: serverTimestamp(),
      });

      // 3. Update Client Balance (simplified)
      if (clientSnap.exists()) {
        const currentBalance = Number(clientSnap.data().balance || 0);
        txn.update(clientRef, {
          balance: currentBalance + Number(amount),
          updatedAt: serverTimestamp()
        });
      }

      result.proformaStatusAfter = newStatus;
    });

    return result;
  } catch (error) {
    return { ok: false, error: toSafeError(error) };
  }
};

/**
 * Atomic Conversion: Quotation -> Proforma
 */
export const convertQuotationToProforma = async (tenantId, quotationId, proformaId, uid) => {
  try {
    await runTransaction(db, async (txn) => {
      const qRef = doc(db, 'tenants', tenantId, 'quotations', quotationId);
      const pRef = doc(db, 'tenants', tenantId, 'proformas', proformaId);
      
      const qSnap = await txn.get(qRef);
      if (!qSnap.exists()) throw new Error('Quotation not found.');
      
      const qData = qSnap.data();
      if (qData.status === 'converted') throw new Error('Quotation already converted.');
      
      // 1. Create Proforma (carrying over items and client snapshot)
      const safeCreatedBy = typeof uid === 'object' ? uid?.uid : uid;
      const proformaPayload = {
        clientId: qData.clientId || null,
        clientSnapshot: qData.clientSnapshot || {},
        items: (qData.items || []).filter(item => {
           if (item && typeof item === 'object' && Object.keys(item).length === 0) return false;
           return true;
        }),
        totalAmount: qData.totalAmount || 0,
        amountPaid: 0,
        balanceDue: qData.totalAmount || 0,
        originQuotationId: quotationId,
        status: 'pending',
        createdAt: serverTimestamp(),
        createdBy: String(safeCreatedBy || '').trim(),
      };
      
      txn.set(pRef, proformaPayload);
      
      // 2. Mark Quotation as Accepted & Converted
      txn.update(qRef, {
        status: 'accepted',
        isConverted: true,
        convertedToProformaId: proformaId,
        convertedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toSafeError(error) };
  }
};
