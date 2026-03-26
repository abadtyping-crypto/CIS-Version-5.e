import {
  collection,
  collectionGroup,
  deleteDoc,
  deleteField,
  arrayUnion,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, auth } from './firebaseConfig';
import { sendPasswordResetEmail } from 'firebase/auth';
import { toSafeDocId } from './idUtils';
import { buildSequenceKey, formatDisplayId, normalizeIdRule } from './idFormat';
import { buildNotificationPayload, generateNotificationId } from './notificationTemplate';
import { fetchGlobalPortalLogoMap } from './portalLogoLibraryStore';
import { normalizePageID } from '../../../developer-app/src/pages/HeaderControlCenterPage.jsx';
export { db, getDoc, doc };


const toSafeError = (error) => {
  if (!error) return 'unknown';
  if (typeof error === 'string') return error;
  if (error.message) return error.message;
  return 'unknown';
};

const PDF_DOCUMENT_TYPES = new Set([
  'paymentReceipt',
  'nextInvoice',
  'quotation',
  'performerInvoice',
  'statement',
  'portalStatement',
]);

const DIRECT_BALANCE_ACTION_APPROVE = 'portal_balance_adjust_approve';
const DIRECT_BALANCE_ACTION_REJECT = 'portal_balance_adjust_reject';

const toSafePdfDocumentType = (documentType) => {
  const next = String(documentType || '').trim();
  if (!PDF_DOCUMENT_TYPES.has(next)) {
    throw new Error(`Unsupported PDF document type: ${next || 'unknown'}`);
  }
  return next;
};

const toPdfTemplateDocRef = (tenantId, documentType) =>
  doc(
    db,
    'tenants',
    tenantId,
    'settings',
    'pdfTemplates',
    'templates',
    toSafePdfDocumentType(documentType),
  );

export const fetchGlobalHeaderConfig = async (pageID) => {
  try {
    const normalizedPageID = normalizePageID(pageID);
    const docRef = doc(db, 'global_header_configs', normalizedPageID);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { ok: true, data: snap.data() };
    }
    return { ok: false, error: 'Config not found' };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(
      `[backendStore] global header fetch failed global_header_configs/${pageID} (normalized=${normalizePageID(pageID)}): ${message}`,
    );
    return { ok: false, error: message };
  }
};

export const fetchGlobalInstructionAsset = async (instructionID) => {
  try {
    const safeId = String(instructionID || '').trim();
    if (!safeId) return { ok: false, error: 'instructionID is required' };
    const snap = await getDoc(doc(db, 'acis_global_instruction_library', safeId));
    if (snap.exists()) {
      return { ok: true, data: snap.data() };
    }
    return { ok: false, error: 'Instruction not found' };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] instruction fetch failed acis_global_instruction_library/${instructionID}: ${message}`);
    return { ok: false, error: message };
  }
};

export const upsertBackendDoc = async (collectionName, docId, payload) => {
  try {
    await setDoc(doc(db, collectionName, docId), { ...payload, updatedAt: serverTimestamp() }, { merge: true });
    return { ok: true };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] upsert failed ${collectionName}/${docId}: ${message}`);
    return { ok: false, error: message };
  }
};

export const deleteBackendDoc = async (collectionName, docId) => {
  try {
    await setDoc(doc(db, collectionName, docId), { deletedAt: serverTimestamp() }, { merge: true });
    return { ok: true };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] delete failed ${collectionName}/${docId}: ${message}`);
    return { ok: false, error: message };
  }
};

export const getBackendTenantDocs = async (collectionName, tenantId) => {
  if (collectionName === 'tenantUsers') return fetchTenantUsersMap(tenantId);
  if (collectionName === 'userControlPrefs') return fetchTenantUserControlMap(tenantId);
  return { ok: false, error: 'Unsupported tenant collection mapping.', rows: [] };
};

export const upsertTenantUserMap = async (tenantId, uid, payload) => {
  try {
    await setDoc(
      doc(db, 'tenants', tenantId, 'users', uid),
      {
        ...payload,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    return { ok: true };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] tenant user upsert failed tenants/${tenantId}/users/${uid}: ${message}`);
    return { ok: false, error: message };
  }
};

export const deleteTenantUserMap = async (tenantId, uid, deletedBy) => {
  try {
    await setDoc(doc(db, 'tenants', tenantId, 'users', uid), {
      deletedAt: serverTimestamp(),
      deletedBy,
    }, { merge: true });
    return { ok: true };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] tenant user delete failed tenants/${tenantId}/users/${uid}: ${message}`);
    return { ok: false, error: message };
  }
};

export const fetchTenantUsersMap = async (tenantId) => {
  try {
    const snap = await getDocs(collection(db, 'tenants', tenantId, 'users'));
    const rows = snap.docs.map((item) => {
      const data = item.data() || {};
      const storedUid = String(data.uid || '').trim();
      return {
        ...data,
        uid: item.id,
        legacyUid: storedUid && storedUid !== item.id ? storedUid : '',
      };
    });
    return { ok: true, rows };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] tenant users read failed tenants/${tenantId}/users: ${message}`);
    return { ok: false, error: message, rows: [] };
  }
};

export const upsertTenantUserControlMap = async (tenantId, uid, payload) => {
  try {
    await setDoc(doc(db, 'tenants', tenantId, 'userControlPrefs', uid), {
      ...payload,
      updatedAt: serverTimestamp(),
    });
    return { ok: true };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] userControl upsert failed tenants/${tenantId}/userControlPrefs/${uid}: ${message}`);
    return { ok: false, error: message };
  }
};

export const fetchTenantUserControlMap = async (tenantId) => {
  try {
    const snap = await getDocs(collection(db, 'tenants', tenantId, 'userControlPrefs'));
    const rows = snap.docs.map((item) => ({ uid: item.id, ...item.data() }));
    return { ok: true, rows };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] userControl read failed tenants/${tenantId}/userControlPrefs: ${message}`);
    return { ok: false, error: message, rows: [] };
  }
};

export const fetchTenantPortals = async (tenantId) => {
  try {
    const [portalSnap, txSnap, globalPortalLogoRes] = await Promise.all([
      getDocs(collection(db, 'tenants', tenantId, 'portals')),
      getDocs(collection(db, 'tenants', tenantId, 'portalTransactions')),
      fetchGlobalPortalLogoMap(),
    ]);
    const globalPortalLogoMap = globalPortalLogoRes?.ok ? globalPortalLogoRes.map : {};

    const balanceByPortal = {};
    txSnap.docs.forEach((item) => {
      const tx = item.data();
      const portalId = String(tx?.portalId || '');
      if (!portalId || tx?.deletedAt) return;

      const displayId = String(tx?.displayTransactionId || '');
      const isLoanMirrorEntry =
        !!tx?.personId &&
        (tx?.entityType === 'loanPerson' || tx?.type === 'disbursement' || tx?.type === 'repayment' || displayId.endsWith('-P'));
      if (tx?.affectsPortalBalance === false || isLoanMirrorEntry) return;

      const amount = Number(tx?.amount || 0);
      if (!Number.isFinite(amount)) return;
      balanceByPortal[portalId] = (balanceByPortal[portalId] || 0) + amount;
    });

    const rows = portalSnap.docs.map((item) => {
      const data = item.data();
      const portalLogoId = String(data?.portalLogoId || '').trim();
      const customLogoUrl = String(data?.logoUrl || '').trim();
      const universalLogoUrl = portalLogoId ? String(globalPortalLogoMap[portalLogoId]?.logoUrl || '').trim() : '';
      const resolvedLogoUrl = customLogoUrl || universalLogoUrl;
      const existingIconUrl = String(data?.iconUrl || '').trim();
      const resolvedIconUrl = resolvedLogoUrl || (portalLogoId ? '' : existingIconUrl);
      const computedBalance = balanceByPortal[item.id];
      const storedBalanceRaw = data?.balance ?? data?.Balance ?? 0;
      const storedBalance = Number(storedBalanceRaw);
      const balance = Number.isFinite(computedBalance)
        ? computedBalance
        : (Number.isFinite(storedBalance) ? storedBalance : 0);
      return {
        id: item.id,
        ...data,
        portalLogoId,
        logoUrl: resolvedLogoUrl,
        iconUrl: resolvedIconUrl,
        balance,
        balanceType: balance < 0 ? 'negative' : 'positive',
      };
    });
    return { ok: true, rows };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] portals read failed tenants/${tenantId}/portals: ${message}`);
    return { ok: false, error: message, rows: [] };
  }
};

export const upsertTenantPortal = async (tenantId, portalId, payload) => {
  try {
    const nextPayload = { ...(payload || {}) };

    if (nextPayload.Balance !== undefined && nextPayload.balance === undefined) {
      nextPayload.balance = nextPayload.Balance;
    }

    if (nextPayload.balance !== undefined) {
      const numericBalance = Number(nextPayload.balance);
      nextPayload.balance = Number.isFinite(numericBalance) ? numericBalance : 0;
      nextPayload.balanceType = nextPayload.balance < 0 ? 'negative' : 'positive';
    } else if (nextPayload.balanceType !== undefined) {
      const rawType = String(nextPayload.balanceType || '').toLowerCase();
      nextPayload.balanceType = rawType === 'negative' ? 'negative' : 'positive';
    }

    if (nextPayload.Balance !== undefined) {
      nextPayload.Balance = deleteField();
    }

    await setDoc(doc(db, 'tenants', tenantId, 'portals', portalId), {
      ...nextPayload,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    return { ok: true };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] portal upsert failed tenants/${tenantId}/portals/${portalId}: ${message}`);
    return { ok: false, error: message };
  }
};

export const deleteTenantPortal = async (tenantId, portalId, deletedBy) => {
  try {
    await updateDoc(doc(db, 'tenants', tenantId, 'portals', portalId), {
      status: 'frozen',
      isActive: false,
      frozenAt: serverTimestamp(),
      deletedAt: serverTimestamp(),
      deletedBy,
      updatedAt: serverTimestamp(),
    });
    return { ok: true };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] portal delete (freeze) failed tenants/${tenantId}/portals/${portalId}: ${message}`);
    return { ok: false, error: message };
  }
};

export const fetchLoanPersons = async (tenantId) => {
  try {
    const snap = await getDocs(collection(db, 'tenants', tenantId, 'loanPersons'));
    const rows = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
    return { ok: true, rows };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] loanPersons read failed tenants/${tenantId}/loanPersons: ${message}`);
    return { ok: false, error: message, rows: [] };
  }
};

export const upsertLoanPerson = async (tenantId, personId, payload) => {
  try {
    await setDoc(doc(db, 'tenants', tenantId, 'loanPersons', personId), {
      ...payload,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    return { ok: true };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] loanPerson upsert failed tenants/${tenantId}/loanPersons/${personId}: ${message}`);
    return { ok: false, error: message };
  }
};

export const deleteLoanPerson = async (tenantId, personId, deletedBy) => {
  try {
    await setDoc(doc(db, 'tenants', tenantId, 'loanPersons', personId), {
      deletedAt: serverTimestamp(),
      deletedBy,
    }, { merge: true });
    return { ok: true };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] loan person delete failed tenants/${tenantId}/loanPersons/${personId}: ${message}`);
    return { ok: false, error: message };
  }
};

export const upsertTenantTransaction = async (tenantId, txId, payload) => {
  try {
    await setDoc(doc(db, 'tenants', tenantId, 'transactions', txId), {
      ...payload,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    return { ok: true };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] transaction upsert failed tenants/${tenantId}/transactions/${txId}: ${message}`);
    return { ok: false, error: message };
  }
};

export const createDailyTransactionWithFinancials = async (tenantId, txId, payload) => {
  try {
    if (!tenantId || !txId) return { ok: false, error: 'Missing tenantId or txId.' };

    const clientId = String(payload?.clientId || '').trim();
    const portalId = String(payload?.paidPortalId || '').trim();
    const createdBy = String(payload?.createdBy || '').trim();
    if (!clientId || !portalId || !createdBy) {
      return { ok: false, error: 'Missing required financial fields (clientId, paidPortalId, createdBy).' };
    }

    const clientCharge = Number(payload?.clientCharge || 0);
    const governmentCharge = Number(payload?.govCharge ?? 0);
    const safeClientCharge = Number.isFinite(clientCharge) ? clientCharge : 0;
    const safeGovernmentCharge = Number.isFinite(governmentCharge) ? governmentCharge : 0;

    const dailyTxRef = doc(db, 'tenants', tenantId, 'dailyTransactions', txId);
    const clientRef = doc(db, 'tenants', tenantId, 'clients', clientId);
    const portalRef = doc(db, 'tenants', tenantId, 'portals', portalId);

    const transactionId = String(payload?.transactionId || txId).trim() || txId;
    const portalTxId = toSafeDocId(`${transactionId}-PORT`, 'portal_tx');
    const portalTxRef = doc(db, 'tenants', tenantId, 'portalTransactions', portalTxId);
    const negativeBalanceNotificationId = toSafeDocId(`negative_client_balance_${txId}`, 'ntf');
    const notificationRef = doc(db, 'tenants', tenantId, 'notifications', negativeBalanceNotificationId);
    const softDeleteAudience = ['super admin', 'admin', 'manager', 'accountant', 'staff'];

    let result = {
      ok: true,
      clientBalanceAfter: 0,
      portalBalanceAfter: 0,
      createdPortalTransaction: false,
      createdNegativeBalanceNotification: false,
    };

    await runTransaction(db, async (txn) => {
      const [clientSnap, portalSnap] = await Promise.all([
        txn.get(clientRef),
        txn.get(portalRef),
      ]);

      if (!clientSnap.exists()) throw new Error('Selected client not found.');
      if (!portalSnap.exists()) throw new Error('Selected portal not found.');

      const clientData = clientSnap.data() || {};
      const portalData = portalSnap.data() || {};

      const currentClientBalanceRaw = clientData.balance ?? clientData.openingBalance ?? 0;
      const currentPortalBalanceRaw = portalData.balance ?? 0;
      const currentClientBalance = Number.isFinite(Number(currentClientBalanceRaw)) ? Number(currentClientBalanceRaw) : 0;
      const currentPortalBalance = Number.isFinite(Number(currentPortalBalanceRaw)) ? Number(currentPortalBalanceRaw) : 0;

      const nextClientBalance = currentClientBalance - safeClientCharge;
      const nextPortalBalance = currentPortalBalance - safeGovernmentCharge;

      txn.set(
        dailyTxRef,
        {
          transactionId,
          applicationId: String(payload?.applicationId || ''),
          clientCharge: safeClientCharge,
          clientId,
          createdAt: String(payload?.createdAt || new Date().toISOString()),
          createdBy,
          dependentId: payload?.dependentId || null,
          govCharge: safeGovernmentCharge,
          invoiced: payload?.invoiced === true,
          paidPortalId: portalId,
          portalTransactionMethod: String(payload?.portalTransactionMethod || ''),
          profit: Number.isFinite(Number(payload?.profit)) ? Number(payload.profit) : safeClientCharge - safeGovernmentCharge,
          status: payload?.status || 'active',
        },
        { merge: false },
      );

      txn.set(
        clientRef,
        {
          openingBalance: nextClientBalance,
          balance: nextClientBalance,
          updatedAt: serverTimestamp(),
          updatedBy: createdBy,
        },
        { merge: true },
      );

      txn.set(
        portalRef,
        {
          balance: nextPortalBalance,
          balanceType: nextPortalBalance < 0 ? 'negative' : 'positive',
          updatedAt: serverTimestamp(),
          updatedBy: createdBy,
        },
        { merge: true },
      );

      if (safeGovernmentCharge > 0) {
        txn.set(
          portalTxRef,
          {
            portalId,
            displayTransactionId: transactionId,
            amount: -safeGovernmentCharge,
            type: 'Daily Transaction',
            category: 'Government Charge',
            method: payload?.portalTransactionMethod || '',
            description: `Government charge for ${transactionId}`,
            date: payload?.createdAt || new Date().toISOString(),
            entityType: 'transaction',
            entityId: txId,
            affectsPortalBalance: true,
            status: 'active',
            createdAt: serverTimestamp(),
            createdBy,
          },
          { merge: true },
        );
        result.createdPortalTransaction = true;
      }

      if (nextClientBalance < 0) {
        txn.set(
          notificationRef,
          {
            title: 'Insufficient Client Balance',
            message: `Transaction ${transactionId} resulted in a negative balance.`,
            eventKey: 'negativeClientBalance',
            tenantId,
            transactionId: txId,
            clientId,
            targetRoles: softDeleteAudience,
            routePath: `/t/${tenantId}/daily-transactions`,
            status: 'unread',
            createdAt: serverTimestamp(),
            createdBy,
          },
          { merge: true },
        );
        result.createdNegativeBalanceNotification = true;
      }

      result.clientBalanceAfter = nextClientBalance;
      result.portalBalanceAfter = nextPortalBalance;
    });

    return result;
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] daily transaction create failed tenants/${tenantId}/dailyTransactions/${txId}: ${message}`);
    return { ok: false, error: message };
  }
};

export const upsertTenantPortalTransaction = async (tenantId, txId, payload) => {
  try {
    await setDoc(doc(db, 'tenants', tenantId, 'portalTransactions', txId), {
      ...payload,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    return { ok: true };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] portalTransaction upsert failed tenants/${tenantId}/portalTransactions/${txId}: ${message}`);
    return { ok: false, error: message };
  }
};

export const upsertTenantNotification = async (tenantId, notificationId, payload) => {
  try {
    await setDoc(doc(db, 'tenants', tenantId, 'notifications', notificationId), {
      ...(payload || {}),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    return { ok: true };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] notification upsert failed tenants/${tenantId}/notifications/${notificationId}: ${message}`);
    return { ok: false, error: message };
  }
};

export const markTenantNotificationRead = async (tenantId, notificationId, uid) => {
  try {
    if (!tenantId || !notificationId || !uid) {
      return { ok: false, error: 'Missing tenantId, notificationId or uid.' };
    }
    await updateDoc(doc(db, 'tenants', tenantId, 'notifications', notificationId), {
      [`readByUid.${uid}`]: true,
      [`readAtByUid.${uid}`]: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { ok: true };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] notification mark read failed tenants/${tenantId}/notifications/${notificationId}: ${message}`);
    return { ok: false, error: message };
  }
};

export const markTenantNotificationActionTaken = async (tenantId, notificationId, uid, action = null) => {
  try {
    if (!tenantId || !notificationId || !uid) {
      return { ok: false, error: 'Missing tenantId, notificationId or uid.' };
    }
    const ref = doc(db, 'tenants', tenantId, 'notifications', notificationId);
    const actionKey = String(action?.actionKey || '').trim();
    const requestId = String(action?.requestId || '').trim();
    const isDirectBalanceAction =
      actionKey === DIRECT_BALANCE_ACTION_APPROVE || actionKey === DIRECT_BALANCE_ACTION_REJECT;
    const preGeneratedTxId = actionKey === DIRECT_BALANCE_ACTION_APPROVE
      ? await generatePortalBalanceAdjustmentDisplayId(tenantId)
      : '';

    await runTransaction(db, async (txn) => {
      const snap = await txn.get(ref);
      if (!snap.exists()) throw new Error('Notification not found.');
      const data = snap.data() || {};
      const existing = String(data.actionTakenBy || '').trim();
      if (existing && existing !== uid) {
        throw new Error('Action already taken by another user.');
      }

      if (isDirectBalanceAction) {
        if (!requestId) throw new Error('Balance adjustment request is missing.');

        const requestRef = getPortalBalanceAdjustmentRequestRef(tenantId, requestId);
        const requestSnap = await txn.get(requestRef);
        if (!requestSnap.exists()) throw new Error('Balance adjustment request not found.');
        const requestData = requestSnap.data() || {};

        const currentStatus = String(requestData.status || '').trim().toLowerCase();
        if (currentStatus !== 'pending') throw new Error('This request has already been processed.');

        const requesterUid = String(requestData.requestedBy || '').trim();
        if (requesterUid && requesterUid === uid) {
          throw new Error('Requester cannot approve or reject their own balance adjustment.');
        }

        const controlSnap = await txn.get(doc(db, 'tenants', tenantId, 'userControlPrefs', uid));
        const control = controlSnap.exists() ? (controlSnap.data() || {}) : {};
        const hasDeletePower = Boolean(control.softDeleteTransaction || control.hardDeleteTransaction);
        if (!hasDeletePower) {
          throw new Error('Only a user with delete power can approve this balance adjustment.');
        }

        const portalId = String(requestData.portalId || '').trim();
        const methodId = String(requestData.methodId || '').trim();
        const portalRef = doc(db, 'tenants', tenantId, 'portals', portalId);
        const portalSnap = await txn.get(portalRef);
        if (!portalSnap.exists()) throw new Error('Portal linked to this request was not found.');
        const portalData = portalSnap.data() || {};

        const methods = Array.isArray(portalData.methods) ? portalData.methods : [];
        if (!methods.includes(methodId)) {
          throw new Error('Linked method is no longer enabled on the portal.');
        }

        const delta = Number(requestData.delta || 0);
        const amountAbs = Math.abs(Number(requestData.amount || 0));
        const direction = String(requestData.direction || 'add').trim().toLowerCase() === 'subtract' ? 'subtract' : 'add';
        const reason = String(requestData.reason || '').trim();

        if (!Number.isFinite(delta) || delta === 0 || !Number.isFinite(amountAbs) || amountAbs <= 0) {
          throw new Error('Invalid adjustment payload.');
        }

        if (actionKey === DIRECT_BALANCE_ACTION_APPROVE) {
          const txId = preGeneratedTxId || `BADJ-${Date.now()}`;
          const portalTxId = toSafeDocId(`${txId}-P`, 'portal_tx');
          const nextStatus = Number(portalData.balance || 0) + delta < 0 ? 'negative' : 'positive';
          const nowIso = new Date().toISOString();

          txn.set(doc(db, 'tenants', tenantId, 'portalTransactions', portalTxId), {
            portalId,
            displayTransactionId: txId,
            amount: delta,
            type: 'Direct Balance Adjustment',
            category: 'Balance Adjustment',
            description: `${direction === 'subtract' ? 'Reduced' : 'Increased'} by ${uid}: ${reason}`,
            date: nowIso,
            transactionMethod: methodId,
            method: methodId,
            affectsPortalBalance: true,
            status: 'active',
            entityType: 'portalBalanceAdjustment',
            entityId: requestId,
            requestedBy: requesterUid,
            approvedBy: uid,
            createdBy: uid,
            updatedAt: serverTimestamp(),
          }, { merge: true });

          txn.set(portalRef, {
            balance: increment(delta),
            balanceType: nextStatus,
            updatedBy: uid,
            updatedAt: serverTimestamp(),
          }, { merge: true });

          txn.set(requestRef, {
            status: 'approved',
            approvedBy: uid,
            approvedAt: serverTimestamp(),
            txId,
            updatedAt: serverTimestamp(),
          }, { merge: true });
        } else {
          txn.set(requestRef, {
            status: 'rejected',
            rejectedBy: uid,
            rejectedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }, { merge: true });
        }
      }

      txn.update(ref, {
        actionTakenBy: uid,
        actionTakenAt: serverTimestamp(),
        actionTakenLabel: String(action?.label || '').trim(),
        actionTakenType: String(action?.actionType || '').trim(),
        actionKey: actionKey || '',
        [`readByUid.${uid}`]: true,
        [`readAtByUid.${uid}`]: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
    return { ok: true };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] notification action failed tenants/${tenantId}/notifications/${notificationId}: ${message}`);
    return { ok: false, error: message };
  }
};

export const fetchLoanPendingBalances = async (tenantId) => {
  try {
    const [loanPersonsSnap, txSnap] = await Promise.all([
      getDocs(collection(db, 'tenants', tenantId, 'loanPersons')),
      getDocs(collection(db, 'tenants', tenantId, 'portalTransactions')),
    ]);
    const pendingByPerson = {};
    const hasStoredPending = {};
    const normalizedByBatch = {};

    loanPersonsSnap.docs.forEach((item) => {
      const data = item.data() || {};
      if (data?.deletedAt) return;
      const personId = String(item.id || '').trim();
      if (!personId) return;
      const storedPending = Number(data?.pendingBalance);
      if (Number.isFinite(storedPending)) {
        pendingByPerson[personId] = storedPending;
        hasStoredPending[personId] = true;
      } else if (pendingByPerson[personId] === undefined) {
        pendingByPerson[personId] = 0;
      }
    });

    txSnap.docs.forEach((item) => {
      const tx = item.data() || {};
      if (tx?.deletedAt) return;

      const txTypeRaw = String(tx?.type || '').trim();
      const txType = txTypeRaw.toLowerCase();
      const isPortalLoanEntry =
        tx?.entityType === 'loanPerson' &&
        (txType === 'loan disbursement' || txType === 'loan repayment');
      const isLegacyLoanMirror =
        txType === 'disbursement' || txType === 'repayment';
      if (!isPortalLoanEntry && !isLegacyLoanMirror) return;

      const amount = Number(tx?.amount || 0);
      if (!Number.isFinite(amount) || amount === 0) return;

      const resolvedPersonId = String(
        isPortalLoanEntry ? tx?.entityId : tx?.personId,
      ).trim();
      if (!resolvedPersonId) return;
      if (hasStoredPending[resolvedPersonId]) return;

      const normalizedDirection = (
        txType === 'loan disbursement' || txType === 'disbursement'
      ) ? 'disbursement' : 'repayment';
      const displayTxId = String(tx?.displayTransactionId || item.id || '').trim();
      const displayBase = displayTxId.endsWith('-P')
        ? displayTxId.slice(0, -2)
        : displayTxId;
      const batchKey = String(tx?.batchId || displayBase || item.id).trim();
      if (!batchKey) return;

      const normalizedEntry = {
        personId: resolvedPersonId,
        direction: normalizedDirection,
        amount: Math.abs(amount),
        isLegacy: !isPortalLoanEntry,
      };
      const existingEntry = normalizedByBatch[batchKey];
      // Prefer canonical portal loan entry over legacy mirror if both exist.
      if (!existingEntry || (existingEntry.isLegacy && !normalizedEntry.isLegacy)) {
        normalizedByBatch[batchKey] = normalizedEntry;
      }
    });

    Object.values(normalizedByBatch).forEach((entry) => {
      const signedAmount = entry.direction === 'disbursement' ? entry.amount : -entry.amount;
      pendingByPerson[entry.personId] = (pendingByPerson[entry.personId] || 0) + signedAmount;
    });

    return { ok: true, rows: pendingByPerson };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] loan pending balances read failed tenants/${tenantId}/portalTransactions: ${message}`);
    return { ok: false, error: message, rows: {} };
  }
};

export const fetchRecentTransactions = async (tenantId, limitCount = 10) => {
  try {
    const q = query(
      collection(db, 'tenants', tenantId, 'portalTransactions'),
      orderBy('date', 'desc'),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    const rows = snap.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .filter((tx) => {
        if (tx?.deletedAt) return false;
        const displayId = String(tx?.displayTransactionId || tx?.id || '').trim();
        const txType = String(tx?.type || '').toLowerCase();
        const isLoanMirrorEntry =
          !!tx?.personId &&
          (tx?.entityType === 'loanPerson' || txType === 'disbursement' || txType === 'repayment' || displayId.endsWith('-P'));
        if (tx?.affectsPortalBalance === false || isLoanMirrorEntry) return false;
        return true;
      });
    return { ok: true, rows };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] recent transactions read failed: ${message}`);
    return { ok: false, error: message, rows: [] };
  }
};

export const fetchPortalTransactions = async (tenantId, portalId, startDate, endDate) => {
  try {
    const q = query(
      collection(db, 'tenants', tenantId, 'portalTransactions'),
      where('portalId', '==', portalId),
    );

    const snap = await getDocs(q);
    let rows = snap.docs
      .map(item => ({ id: item.id, ...item.data() }))
      .filter((item) => {
        if (item?.deletedAt) return false;
        const displayId = String(item?.displayTransactionId || item?.id || '').trim();
        const txType = String(item?.type || '').toLowerCase();
        const isLoanMirrorEntry =
          !!item?.personId &&
          (item?.entityType === 'loanPerson' || txType === 'disbursement' || txType === 'repayment' || displayId.endsWith('-P'));
        if (item?.affectsPortalBalance === false || isLoanMirrorEntry) return false;
        return true;
      });

    // Sort robustly even if some records do not have `date`.
    rows.sort((a, b) => {
      const aMillis = toDateMillis(a?.date || a?.createdAt || a?.updatedAt);
      const bMillis = toDateMillis(b?.date || b?.createdAt || b?.updatedAt);
      return bMillis - aMillis;
    });

    if (startDate) {
      const start = new Date(startDate).getTime();
      rows = rows.filter((r) => toDateMillis(r?.date || r?.createdAt || r?.updatedAt) >= start);
    }
    if (endDate) {
      const end = new Date(endDate).getTime();
      rows = rows.filter((r) => toDateMillis(r?.date || r?.createdAt || r?.updatedAt) <= end);
    }

    return { ok: true, rows };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] portal transactions read failed: ${message}`);
    return { ok: false, error: message, rows: [] };
  }
};

export const upsertTenantSyncEvent = async (tenantId, eventId, payload) => {
  void tenantId;
  void eventId;
  void payload;
  return { ok: true, skipped: true };
};

export const upsertTenantSettingDoc = async (tenantId, settingDocId, payload) => {
  try {
    await setDoc(
      doc(db, 'tenants', tenantId, 'settings', settingDocId),
      {
        ...payload,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    return { ok: true };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] settings upsert failed tenants/${tenantId}/settings/${settingDocId}: ${message}`);
    return { ok: false, error: message };
  }
};

export const getTenantSettingDoc = async (tenantId, settingDocId) => {
  try {
    const snap = await getDoc(doc(db, 'tenants', tenantId, 'settings', settingDocId));
    return {
      ok: true,
      data: snap.exists() ? snap.data() : null,
    };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] settings read failed tenants/${tenantId}/settings/${settingDocId}: ${message}`);
    return { ok: false, error: message, data: null };
  }
};

export const getTenantLoginSettings = async (tenantId) => {
  try {
    const snap = await getDoc(doc(db, 'tenants', tenantId, 'settings', 'loginPage'));
    return {
      ok: true,
      data: snap.exists() ? snap.data() : {
        privacyPolicy: '',
        announcement: { isVisible: false, title: '', message: '', imageUrl: '' },
        supportInfo: { whatsapp: '', email: '' }
      },
    };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] login settings read failed tenants/${tenantId}: ${message}`);
    return { ok: false, error: message, data: null };
  }
};

export const submitSupportTicket = async (tenantId, payload) => {
  try {
    const ticketRef = doc(collection(db, 'tenants', tenantId, 'supportTickets'));
    await setDoc(ticketRef, {
      ...payload,
      status: 'Open',
      createdAt: serverTimestamp(),
    });
    return { ok: true, ticketId: ticketRef.id };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] support ticket submit failed: ${message}`);
    return { ok: false, error: message };
  }
};

export const fetchTenantPdfTemplates = async (tenantId) => {
  try {
    const snap = await getDocs(collection(db, 'tenants', tenantId, 'settings', 'pdfTemplates', 'templates'));
    const rows = snap.docs.map((item) => ({ documentType: item.id, ...item.data() }));
    const byType = rows.reduce((acc, row) => {
      acc[row.documentType] = row;
      return acc;
    }, {});
    return { ok: true, rows, byType };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] pdfTemplates read failed tenants/${tenantId}/settings/pdfTemplates/templates: ${message}`);
    return { ok: false, error: message, rows: [], byType: {} };
  }
};

export const upsertTenantPdfTemplate = async (tenantId, documentType, payload) => {
  try {
    const ref = toPdfTemplateDocRef(tenantId, documentType);
    await setDoc(
      ref,
      {
        ...payload,
        documentType: toSafePdfDocumentType(documentType),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    return { ok: true };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] pdfTemplate upsert failed tenants/${tenantId}/settings/pdfTemplates/templates/${documentType}: ${message}`);
    return { ok: false, error: message };
  }
};

export const deleteTenantPdfTemplate = async (tenantId, documentType) => {
  try {
    const ref = toPdfTemplateDocRef(tenantId, documentType);
    await deleteDoc(ref);
    return { ok: true };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] pdfTemplate delete failed tenants/${tenantId}/settings/pdfTemplates/templates/${documentType}: ${message}`);
    return { ok: false, error: message };
  }
};

export const getTenantUserByUid = async (tenantId, uid) => {
  try {
    const snap = await getDoc(doc(db, 'tenants', tenantId, 'users', uid));
    return {
      ok: true,
      data: snap.exists() ? { uid: snap.id, ...snap.data() } : null,
    };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] user read failed tenants/${tenantId}/users/${uid}: ${message}`);
    return { ok: false, error: message, data: null };
  }
};

export const getTenantUserControlByUid = async (tenantId, uid) => {
  try {
    const snap = await getDoc(doc(db, 'tenants', tenantId, 'userControlPrefs', uid));
    return {
      ok: true,
      data: snap.exists() ? { uid: snap.id, ...snap.data() } : null,
    };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] userControl read failed tenants/${tenantId}/userControlPrefs/${uid}: ${message}`);
    return { ok: false, error: message, data: null };
  }
};

/**
 * Transaction Sequence Management
 * Stores counters in tenants/{tenantId}/settings/sequences
 */

export const getTransactionSequence = async (tenantId, typeKey) => {
  try {
    const snap = await getDoc(doc(db, 'tenants', tenantId, 'settings', 'transactionIdRules'));
    if (!snap.exists()) return 0;
    return snap.data()[typeKey] || 0;
  } catch (error) {
    console.warn(`[backendStore] failed to fetch sequence for ${typeKey}:`, error);
    return 0;
  }
};

export const incrementTransactionSequence = async (tenantId, typeKey) => {
  try {
    const ref = doc(db, 'tenants', tenantId, 'settings', 'transactionIdRules');
    // Using atomic increment to prevent race conditions during concurrent transaction creation
    await setDoc(ref, { [typeKey]: increment(1), updatedAt: serverTimestamp() }, { merge: true });
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data()[typeKey] : 1;
  } catch (error) {
    console.warn(`[backendStore] failed to increment sequence for ${typeKey}:`, error);
    return null;
  }
};

export const ensureTransactionSequenceStart = async (tenantId, typeKey, sequenceStart) => {
  try {
    const startValue = Number(sequenceStart);
    if (!Number.isFinite(startValue) || startValue <= 0) return;
    const ref = doc(db, 'tenants', tenantId, 'settings', 'transactionIdRules');
    const snap = await getDoc(ref);
    const current = (snap.exists() ? snap.data()[typeKey] : 0) || 0;
    if (current >= startValue) return;
    await setDoc(ref, { [typeKey]: startValue - 1, updatedAt: serverTimestamp() }, { merge: true });
  } catch (error) {
    console.warn(`[backendStore] failed to ensure sequence start for ${typeKey}:`, error);
  }
};

/**
 * Executes an internal transfer between two portals.
 * Records two transactions (debit/credit) and an optional expense transaction for any fee.
 */
export const executeInternalTransfer = async (tenantId, { fromPortalId, fromMethodId, toPortalId, toMethodId, amount, fee, description, category, createdBy, displayTxId }) => {
  try {
    const transferAmount = Math.abs(Number(amount || 0));
    const transferFee = Math.max(0, Number(fee || 0));
    if (!fromPortalId || !toPortalId) {
      throw new Error('Source and destination portals are required.');
    }
    if (fromPortalId === toPortalId) {
      throw new Error('Source and destination portals must be different.');
    }
    if (!Number.isFinite(transferAmount) || transferAmount <= 0) {
      throw new Error('Transfer amount must be greater than zero.');
    }

    const portalRes = await fetchTenantPortals(tenantId);
    if (!portalRes.ok) throw new Error(portalRes.error || 'Failed to load portal balances.');
    const fromPortal = portalRes.rows.find((item) => item.id === fromPortalId);
    const toPortal = portalRes.rows.find((item) => item.id === toPortalId);
    if (!fromPortal || !toPortal) {
      throw new Error('Selected portal not found.');
    }
    const availableBalance = Number(fromPortal.balance || 0);
    if (availableBalance < transferAmount + transferFee) {
      throw new Error(`Insufficient funds in ${fromPortal.name || 'source portal'}.`);
    }

    const resolvedDisplayTxId = String(displayTxId || '').trim() || `TRF-${Date.now()}`;
    const batchId = `trf_${Date.now()}`;
    const debitId = toSafeDocId(`${resolvedDisplayTxId}-D`, 'portal_tx');
    const creditId = toSafeDocId(`${resolvedDisplayTxId}-C`, 'portal_tx');
    const sourceMethod = String(fromMethodId || '').trim();
    const destinationMethod = String(toMethodId || '').trim();
    let feeExpenseDisplayRef = '';

    // 1. Debit from Source
    const debitRes = await upsertTenantPortalTransaction(tenantId, debitId, {
      portalId: fromPortalId,
      displayTransactionId: resolvedDisplayTxId,
      amount: -transferAmount,
      type: 'Internal Transfer',
      category: category || 'Transfer',
      description: `Transfer to ${toPortal.name || toPortalId}${description ? `: ${description}` : ''}`,
      date: new Date().toISOString(),
      transferTarget: toPortalId,
      transactionMethod: sourceMethod,
      destinationMethod,
      batchId,
      createdBy,
    });
    if (!debitRes.ok) throw new Error(`Debit failed: ${debitRes.error}`);

    // 2. Credit to Destination
    const creditRes = await upsertTenantPortalTransaction(tenantId, creditId, {
      portalId: toPortalId,
      displayTransactionId: resolvedDisplayTxId,
      amount: transferAmount,
      type: 'Internal Transfer',
      category: category || 'Transfer',
      description: `Transfer from ${fromPortal.name || fromPortalId}${description ? `: ${description}` : ''}`,
      date: new Date().toISOString(),
      transferSource: fromPortalId,
      transactionMethod: destinationMethod,
      sourceMethod,
      batchId,
      createdBy,
    });
    if (!creditRes.ok) throw new Error(`Credit failed: ${creditRes.error}`);

    // 3. Handle Fee as a proper Operation Expense entry (EXP prefix) + linked fee transaction
    if (transferFee > 0) {
      feeExpenseDisplayRef = await generateNextTransactionId(tenantId, 'EXP');
      const expenseId = toSafeDocId(feeExpenseDisplayRef, 'exp');
      const feePortalTxId = toSafeDocId(`${feeExpenseDisplayRef}-EXP`, 'portal_tx');

      const feeRes = await upsertTenantPortalTransaction(tenantId, feePortalTxId, {
        portalId: fromPortalId,
        displayTransactionId: feeExpenseDisplayRef,
        amount: -transferFee,
        type: 'Operation Expenses',
        category: 'Transfer Fee',
        description: `Transfer fee for ${resolvedDisplayTxId} (${fromPortal.name || fromPortalId} -> ${toPortal.name || toPortalId})`,
        date: new Date().toISOString(),
        transactionMethod: sourceMethod,
        method: sourceMethod,
        linkedTransferId: resolvedDisplayTxId,
        entityType: 'operationExpense',
        entityId: expenseId,
        affectsPortalBalance: true,
        status: 'active',
        batchId,
        createdBy,
      });
      if (!feeRes.ok) throw new Error(`Transfer fee recording failed: ${feeRes.error}`);

      await setDoc(
        doc(db, 'tenants', tenantId, 'operationExpenses', expenseId),
        {
          displayRef: feeExpenseDisplayRef,
          expenseType: 'normal',
          category: 'Transfer Fee',
          description: `Auto-generated from internal transfer ${resolvedDisplayTxId}`,
          status: 'released',
          amountRequested: transferFee,
          amountApproved: transferFee,
          amountReleased: transferFee,
          requestedBy: createdBy,
          requestedByDisplayName: '',
          requestedAt: serverTimestamp(),
          approvedBy: createdBy,
          approvedAt: serverTimestamp(),
          releasedBy: createdBy,
          releasedAt: serverTimestamp(),
          releaseDate: new Date().toISOString(),
          releaseNote: `Released automatically for internal transfer ${resolvedDisplayTxId}.`,
          portalId: fromPortalId,
          portalName: String(fromPortal.name || fromPortalId),
          transactionMethodId: sourceMethod,
          transactionMethodName: sourceMethod,
          portalTransactionId: feePortalTxId,
          linkedTransferId: resolvedDisplayTxId,
          updatedAt: serverTimestamp(),
          updatedBy: createdBy,
          createdAt: serverTimestamp(),
        },
        { merge: true },
      );
    }

    await upsertTenantNotification(
      tenantId,
      generateNotificationId({ topic: 'finance', subTopic: 'transfer' }),
      {
        ...buildNotificationPayload({
          topic: 'finance',
          subTopic: 'transfer',
          type: 'create',
          title: 'Internal Transfer Posted',
          detail: `${resolvedDisplayTxId}: ${fromPortal.name || fromPortalId} → ${toPortal.name || toPortalId}`,
          createdBy,
          routePath: `/t/${tenantId}/portal-management`,
          actions: [
            { label: 'View Details', actionType: 'quickView' },
            { label: 'View', actionType: 'link', route: `/t/${tenantId}/portal-management` },
          ],
        }),
        eventType: 'create',
        entityType: 'internalTransfer',
        entityId: batchId,
        entityLabel: resolvedDisplayTxId,
        pageKey: 'portalManagement',
        sectionKey: 'internalTransfer',
        txId: resolvedDisplayTxId,
        quickView: {
          badge: 'Transfer',
          title: `${fromPortal.name || fromPortalId} → ${toPortal.name || toPortalId}`,
          subtitle: resolvedDisplayTxId,
          description: description || 'Internal transfer completed between two portals.',
          fields: [
            { label: 'From Portal', value: fromPortal.name || fromPortalId },
            { label: 'Sending Method', value: sourceMethod || 'Not specified' },
            { label: 'To Portal', value: toPortal.name || toPortalId },
            { label: 'Receiving Method', value: destinationMethod || 'Not specified' },
            { label: 'Amount', value: String(transferAmount) },
            ...(transferFee > 0 ? [{ label: 'Fee', value: String(transferFee) }] : []),
          ],
        },
      },
    ).catch(() => null);

    return { ok: true, batchId, displayTxId: resolvedDisplayTxId, feeExpenseDisplayRef };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] internal transfer failed: ${message}`);
    return { ok: false, error: message };
  }
};

/**
 * Executes a Loan Transaction (Disbursement or Repayment).
 * Records a single canonical portal transaction linked to loan person.
 */
export const executeLoanTransaction = async (tenantId, { personId, portalId, amount, type, description, transactionMethod, displayTxId, createdBy }) => {
  try {
    const txnAmount = Math.abs(Number(amount || 0));
    if (!personId || !portalId) throw new Error('Loan person and portal are required.');
    if (!Number.isFinite(txnAmount) || txnAmount <= 0) throw new Error('Amount must be greater than zero.');

    if (type === 'disbursement') {
      const portalRes = await fetchTenantPortals(tenantId);
      if (!portalRes.ok) throw new Error(portalRes.error || 'Failed to load portal balances.');
      const sourcePortal = portalRes.rows.find((item) => item.id === portalId);
      if (!sourcePortal) throw new Error('Selected portal not found.');
      if (Number(sourcePortal.balance || 0) < txnAmount) {
        throw new Error(`Insufficient funds in ${sourcePortal.name || 'selected portal'}.`);
      }
    }

    const resolvedDisplayTxId = String(displayTxId || '').trim() || `LON-${Date.now()}`;
    const batchId = `loan_${Date.now()}`;
    const date = new Date().toISOString();
    const portalTxId = toSafeDocId(resolvedDisplayTxId, 'portal_tx');
    const normalizedMethod = String(transactionMethod || '').trim();
    const methodLabel = normalizedMethod
      ? normalizedMethod.replace(/([A-Z])/g, ' $1').replace(/[_-]/g, ' ').trim()
      : '';
    const [personSnap, portalSnap] = await Promise.all([
      getDoc(doc(db, 'tenants', tenantId, 'loanPersons', personId)),
      getDoc(doc(db, 'tenants', tenantId, 'portals', portalId)),
    ]);
    if (!personSnap.exists()) throw new Error('Selected loan person not found.');
    if (!portalSnap.exists()) throw new Error('Selected portal not found.');
    const personData = personSnap.exists() ? (personSnap.data() || {}) : {};
    const portalData = portalSnap.exists() ? (portalSnap.data() || {}) : {};
    const personLabel = String(personData?.name || personData?.displayName || personId).trim() || personId;
    const portalLabel = String(portalData?.name || portalData?.displayPortalId || portalId).trim() || portalId;

    // 1. Record for Portal
    const portalTxRes = await upsertTenantPortalTransaction(tenantId, portalTxId, {
      portalId,
      displayTransactionId: resolvedDisplayTxId,
      amount: type === 'disbursement' ? -txnAmount : txnAmount,
      type: type === 'disbursement' ? 'Loan Disbursement' : 'Loan Repayment',
      description: `${type === 'disbursement' ? 'Loan to' : 'Repayment from'} ${personLabel}${methodLabel ? ` via ${methodLabel}` : ''}${description ? `: ${description}` : ''}`,
      date,
      entityId: personId,
      entityType: 'loanPerson',
      transactionMethod: normalizedMethod,
      batchId,
      createdBy,
    });
    if (!portalTxRes.ok) throw new Error(`Portal entry failed: ${portalTxRes.error}`);

    const pendingDelta = type === 'disbursement' ? txnAmount : -txnAmount;
    const personUpdatePayload = {
      pendingBalance: increment(pendingDelta),
      lastTransactionId: resolvedDisplayTxId,
      lastTransactionType: type,
      lastTransactionAt: date,
      lastPortalId: portalId,
      updatedBy: createdBy,
    };
    if (type === 'disbursement') {
      personUpdatePayload.totalDisbursed = increment(txnAmount);
    } else {
      personUpdatePayload.totalRepaid = increment(txnAmount);
    }
    const personUpdateRes = await upsertLoanPerson(tenantId, personId, personUpdatePayload);
    if (!personUpdateRes.ok) throw new Error(`Loan person update failed: ${personUpdateRes.error}`);

    await upsertTenantNotification(
      tenantId,
      generateNotificationId({ topic: 'finance', subTopic: 'loan' }),
      {
        ...buildNotificationPayload({
          topic: 'finance',
          subTopic: 'loan',
          type: 'create',
          title: type === 'repayment' ? 'Loan Repayment Recorded' : 'Loan Disbursement Recorded',
          detail: `${personLabel} • ${portalLabel}`,
          createdBy,
          routePath: `/t/${tenantId}/portal-management`,
          actions: [
            { label: 'View Details', actionType: 'quickView' },
            { label: 'View', actionType: 'link', route: `/t/${tenantId}/portal-management` },
          ],
        }),
        eventType: 'create',
        entityType: 'loanTransaction',
        entityId: batchId,
        entityLabel: resolvedDisplayTxId,
        pageKey: 'portalManagement',
        sectionKey: 'loanManagement',
        txId: resolvedDisplayTxId,
        quickView: {
          title: personLabel,
          subtitle: type === 'repayment' ? 'Loan Repayment' : 'Loan Disbursement',
          description: description || `${type === 'repayment' ? 'Repayment recorded against a loan person.' : 'Funds disbursed against a loan person.'}`,
          badge: 'Loan',
          fields: [
            { label: 'Tracking ID', value: resolvedDisplayTxId },
            { label: 'Loan Person', value: personLabel },
            { label: 'Portal', value: portalLabel },
            { label: 'Method', value: methodLabel || 'Not specified' },
            { label: 'Amount', value: String(txnAmount) },
            ...(description ? [{ label: 'Note', value: String(description).trim() }] : []),
          ],
        },
      },
    ).catch(() => null);

    return { ok: true, batchId, displayTxId: resolvedDisplayTxId };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] loan transaction failed: ${message}`);
    return { ok: false, error: message };
  }
};

/**
 * Recycle Bin Logic
 */

export const fetchDeletedEntities = async (tenantId, domain) => {
  try {
    const canonicalDomain = domain === 'transactions' ? 'dailyTransactions' : domain;
    const path = `tenants/${tenantId}/${canonicalDomain}`;
    const q = query(collection(db, path), where('deletedAt', '!=', null));
    const snap = await getDocs(q);
    return { ok: true, rows: snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) };
  } catch (error) {
    return { ok: false, error: toSafeError(error) };
  }
};

export const restoreEntity = async (tenantId, domain, entityId, restoredBy) => {
  try {
    if (domain === 'transactions') {
      const dailyTxRef = doc(db, 'tenants', tenantId, 'dailyTransactions', entityId);

      await runTransaction(db, async (txn) => {
        const txSnap = await txn.get(dailyTxRef);
        if (!txSnap.exists()) throw new Error('Transaction not found.');
        const data = txSnap.data() || {};
        const actor = restoredBy || 'system';

        const clientId = String(data?.clientId || '').trim();
        const portalId = String(data?.paidPortalId || '').trim();
        const clientChargeRaw = Number(data?.clientCharge ?? 0);
        const governmentChargeRaw = Number(data?.govCharge ?? 0);
        const clientCharge = Number.isFinite(clientChargeRaw) ? Math.abs(clientChargeRaw) : 0;
        const governmentCharge = Number.isFinite(governmentChargeRaw) ? Math.abs(governmentChargeRaw) : 0;
        const displayTxId = String(data?.transactionId || entityId);

        if (clientId) {
          const clientRef = doc(db, 'tenants', tenantId, 'clients', clientId);
          const clientSnap = await txn.get(clientRef);
          if (clientSnap.exists()) {
            const clientData = clientSnap.data() || {};
            const currentBalanceRaw = clientData?.balance ?? clientData?.openingBalance ?? 0;
            const currentBalance = Number.isFinite(Number(currentBalanceRaw)) ? Number(currentBalanceRaw) : 0;
            const nextBalance = currentBalance - clientCharge;
            txn.set(clientRef, {
              openingBalance: nextBalance,
              balance: nextBalance,
              updatedAt: serverTimestamp(),
              updatedBy: actor,
            }, { merge: true });
          }
        }

        if (portalId && governmentCharge > 0) {
          const portalRef = doc(db, 'tenants', tenantId, 'portals', portalId);
          const portalSnap = await txn.get(portalRef);
          if (portalSnap.exists()) {
            const portalData = portalSnap.data() || {};
            const currentPortalBalance = Number.isFinite(Number(portalData?.balance))
              ? Number(portalData.balance)
              : 0;
            const nextPortalBalance = currentPortalBalance - governmentCharge;
            txn.set(portalRef, {
              balance: nextPortalBalance,
              balanceType: nextPortalBalance < 0 ? 'negative' : 'positive',
              updatedAt: serverTimestamp(),
              updatedBy: actor,
            }, { merge: true });
          }

          const restorePortalTxId = toSafeDocId(`${entityId}-restore-charge`, 'portal_tx');
          txn.set(
            doc(db, 'tenants', tenantId, 'portalTransactions', restorePortalTxId),
            {
              portalId,
              displayTransactionId: `${displayTxId}-RSTR`,
              amount: -governmentCharge,
              type: 'Daily Transaction Restore',
              category: 'Recycle Bin',
              method: String(data?.portalTransactionMethod || ''),
              description: `Charge reapplied after restore for ${displayTxId}`,
              date: new Date().toISOString(),
              entityType: 'transaction',
              entityId,
              affectsPortalBalance: true,
              status: 'active',
              createdAt: serverTimestamp(),
              createdBy: actor,
              updatedAt: serverTimestamp(),
              updatedBy: actor,
            },
            { merge: true },
          );
        }

        const restorePayload = {
          deletedAt: deleteField(),
          deletedBy: deleteField(),
          status: 'active',
          lifecycleTag: 'revisalo',
          restoredAt: serverTimestamp(),
          restoredBy: actor,
        };
        txn.set(dailyTxRef, restorePayload, { merge: true });
      });
      return { ok: true };
    }

    const ref = doc(db, 'tenants', tenantId, domain, entityId);
    await updateDoc(ref, {
      deletedAt: deleteField(),
      deletedBy: deleteField(),
      updatedAt: serverTimestamp(),
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toSafeError(error) };
  }
};

export const permanentlyDeleteEntity = async (tenantId, domain, entityId) => {
  try {
    const canonicalDomain = domain === 'transactions' ? 'dailyTransactions' : domain;
    const ref = doc(db, 'tenants', tenantId, canonicalDomain, entityId);
    await deleteDoc(ref);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toSafeError(error) };
  }
};


export const generateDisplayClientId = async (tenantId, type) => {
  // type: 'company' | 'individual' | 'dependent'
  const normalizedType = String(type || '').toLowerCase();
  const isDependent = normalizedType === 'dependent';

  const settingsRes = await getTenantSettingDoc(tenantId, 'transactionIdRules');
  const allRules = settingsRes.ok && settingsRes.data ? settingsRes.data : {};
  const clientIdMode = String(allRules.clientIdMode || 'unified').toLowerCase() === 'separate' ? 'separate' : 'unified';

  let ruleKey = 'CLID';
  let sequenceKey = 'lastClientSeq';
  let fallbackPrefix = 'CLID';

  if (isDependent) {
    ruleKey = 'DPID';
    sequenceKey = 'lastDependentSeq';
    fallbackPrefix = 'DPID';
  } else if (clientIdMode === 'separate' && normalizedType === 'company') {
    ruleKey = 'CCID';
    sequenceKey = 'lastCompanySeq';
    fallbackPrefix = 'CCID';
  } else if (clientIdMode === 'separate' && normalizedType === 'individual') {
    ruleKey = 'ICID';
    sequenceKey = 'lastIndividualSeq';
    fallbackPrefix = 'ICID';
  }

  const selectedRule = allRules[ruleKey] || (!isDependent ? allRules.CLID || {} : {});
  const normalizedRule = normalizeIdRule(
    selectedRule,
    fallbackPrefix,
  );
  const actualSeqKey = buildSequenceKey(sequenceKey, normalizedRule);
  await ensureTransactionSequenceStart(tenantId, actualSeqKey, normalizedRule.sequenceStart);
  const seq = await incrementTransactionSequence(tenantId, actualSeqKey);
  return formatDisplayId({
    prefix: normalizedRule.prefix,
    seq,
    padding: normalizedRule.padding,
    dateFormat: normalizedRule.dateEnabled ? normalizedRule.dateFormat : 'NONE',
    useSeparator: normalizedRule.useSeparator,
  });
};

export const previewDisplayClientId = async (tenantId, type) => {
  const normalizedType = String(type || '').toLowerCase();
  const isDependent = normalizedType === 'dependent';

  const settingsRes = await getTenantSettingDoc(tenantId, 'transactionIdRules');
  const allRules = settingsRes.ok && settingsRes.data ? settingsRes.data : {};
  const clientIdMode = String(allRules.clientIdMode || 'unified').toLowerCase() === 'separate' ? 'separate' : 'unified';

  let ruleKey = 'CLID';
  let sequenceKey = 'lastClientSeq';
  let fallbackPrefix = 'CLID';

  if (isDependent) {
    ruleKey = 'DPID';
    sequenceKey = 'lastDependentSeq';
    fallbackPrefix = 'DPID';
  } else if (clientIdMode === 'separate' && normalizedType === 'company') {
    ruleKey = 'CCID';
    sequenceKey = 'lastCompanySeq';
    fallbackPrefix = 'CCID';
  } else if (clientIdMode === 'separate' && normalizedType === 'individual') {
    ruleKey = 'ICID';
    sequenceKey = 'lastIndividualSeq';
    fallbackPrefix = 'ICID';
  }

  const selectedRule = allRules[ruleKey] || (!isDependent ? allRules.CLID || {} : {});
  const normalizedRule = normalizeIdRule(selectedRule, fallbackPrefix);
  const actualSeqKey = buildSequenceKey(sequenceKey, normalizedRule);
  const currentSeq = await getTransactionSequence(tenantId, actualSeqKey);
  const nextSeq = Math.max(currentSeq + 1, Number(normalizedRule.sequenceStart || 1));

  return formatDisplayId({
    prefix: normalizedRule.prefix,
    seq: nextSeq,
    padding: normalizedRule.padding,
    dateFormat: normalizedRule.dateEnabled ? normalizedRule.dateFormat : 'NONE',
    useSeparator: normalizedRule.useSeparator,
  });
};

export const generateDisplayPortalId = async (tenantId) => {
  const sequenceKey = 'lastPortalSeq';
  const ruleKey = 'PID';

  // Use the same settings rule key shown in Consolidated ID Prefixing UI (PID)
  const settingsRes = await getTenantSettingDoc(tenantId, 'transactionIdRules');
  const normalizedRule = normalizeIdRule(
    settingsRes.ok && settingsRes.data ? settingsRes.data[ruleKey] || {} : {},
    'PID',
  );
  const actualSeqKey = buildSequenceKey(sequenceKey, normalizedRule);
  await ensureTransactionSequenceStart(tenantId, actualSeqKey, normalizedRule.sequenceStart);
  const seq = await incrementTransactionSequence(tenantId, actualSeqKey);
  return formatDisplayId({
    prefix: normalizedRule.prefix,
    seq,
    padding: normalizedRule.padding,
    dateFormat: normalizedRule.dateEnabled ? normalizedRule.dateFormat : 'NONE',
    useSeparator: normalizedRule.useSeparator,
  });
};

export const generateDisplayDocumentRef = async (tenantId, docKey = 'quotation') => {
  try {
    const settingsRes = await getTenantSettingDoc(tenantId, 'transactionIdRules');
    const allRules = settingsRes.ok && settingsRes.data ? settingsRes.data : {};
    const storedRule = allRules.docRefCodes?.[docKey] || {};
    const fallbackPrefix = docKey === 'proformaInvoice' ? 'PRO' : 'QUOT';
    const normalizedRule = normalizeIdRule(storedRule, fallbackPrefix);
    const sequenceKey = buildSequenceKey(`docRef_${docKey}`, normalizedRule);
    await ensureTransactionSequenceStart(tenantId, sequenceKey, normalizedRule.sequenceStart);
    const seq = await incrementTransactionSequence(tenantId, sequenceKey);
    return formatDisplayId({
      prefix: normalizedRule.prefix,
      seq,
      padding: normalizedRule.padding,
      dateFormat: normalizedRule.dateEnabled ? normalizedRule.dateFormat : 'NONE',
      useSeparator: normalizedRule.useSeparator,
    });
  } catch (error) {
    console.warn(`[backendStore] document ref generation failed for ${docKey}:`, error);
    return `${String(docKey || 'DOC').toUpperCase()}-${Date.now()}`;
  }
};

const OPERATION_EXPENSE_ALLOWED_STATUSES = new Set(['requested', 'approved', 'released', 'rejected']);

const normalizeOperationExpenseStatus = (value, fallback = 'requested') => {
  const normalized = String(value || '').trim().toLowerCase();
  if (OPERATION_EXPENSE_ALLOWED_STATUSES.has(normalized)) return normalized;
  return fallback;
};

export const fetchTenantOperationExpenses = async (tenantId) => {
  try {
    const snap = await getDocs(collection(db, 'tenants', tenantId, 'operationExpenses'));
    const rows = snap.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .filter((item) => !item.deletedAt)
      .sort((a, b) => toDateMillis(b.createdAt || b.updatedAt || b.requestedAt) - toDateMillis(a.createdAt || a.updatedAt || a.requestedAt));
    return { ok: true, rows };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] operation expenses read failed tenants/${tenantId}/operationExpenses: ${message}`);
    return { ok: false, error: message, rows: [] };
  }
};

export const submitOperationExpenseRequest = async (tenantId, expenseId, payload = {}) => {
  try {
    if (!tenantId || !expenseId) return { ok: false, error: 'Missing tenantId or expenseId.' };

    const amountRequested = Math.max(0, Number(payload?.amountRequested ?? payload?.amount ?? 0));
    if (!(amountRequested > 0)) return { ok: false, error: 'Amount must be greater than zero.' };

    const requestedBy = String(payload?.requestedBy || payload?.createdBy || '').trim();
    if (!requestedBy) return { ok: false, error: 'Missing requester identity.' };

    const category = String(payload?.category || '').trim();
    if (!category) return { ok: false, error: 'Category is required.' };

    const expenseRef = doc(db, 'tenants', tenantId, 'operationExpenses', expenseId);

    await runTransaction(db, async (txn) => {
      const snap = await txn.get(expenseRef);
      const existing = snap.exists() ? (snap.data() || {}) : null;
      if (existing && (normalizeOperationExpenseStatus(existing.status, '') === 'released' || existing.portalTransactionId)) {
        throw new Error('Released expense cannot be edited as request.');
      }

      const nextExpenseType = String(payload?.expenseType || existing?.expenseType || 'normal').trim().toLowerCase() === 'salary'
        ? 'salary'
        : 'normal';

      txn.set(
        expenseRef,
        {
          displayRef: String(payload?.displayRef || existing?.displayRef || expenseId).trim() || expenseId,
          expenseType: nextExpenseType,
          category,
          description: String(payload?.description || '').trim(),
          status: 'requested',
          amountRequested,
          amountApproved: Number(existing?.amountApproved || 0) || 0,
          amountReleased: Number(existing?.amountReleased || 0) || 0,
          requestedBy,
          requestedByDisplayName: String(payload?.requestedByDisplayName || existing?.requestedByDisplayName || '').trim(),
          requestedAt: existing?.requestedAt || serverTimestamp(),
          salaryMode: nextExpenseType === 'salary'
            ? (String(payload?.salaryMode || '').trim().toLowerCase() === 'manual' ? 'manual' : 'user')
            : '',
          employeeUserId: String(payload?.employeeUserId || '').trim(),
          employeeName: String(payload?.employeeName || '').trim(),
          portalId: String(existing?.portalId || '').trim(),
          portalName: String(existing?.portalName || '').trim(),
          transactionMethodId: String(existing?.transactionMethodId || '').trim(),
          transactionMethodName: String(existing?.transactionMethodName || '').trim(),
          portalTransactionId: String(existing?.portalTransactionId || '').trim(),
          releaseNote: String(existing?.releaseNote || '').trim(),
          attachment: payload?.attachment || existing?.attachment || null,
          updatedAt: serverTimestamp(),
          updatedBy: requestedBy,
          ...(existing ? {} : { createdAt: serverTimestamp() }),
        },
        { merge: true },
      );
    });

    return { ok: true, id: expenseId };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] operation expense request failed tenants/${tenantId}/operationExpenses/${expenseId}: ${message}`);
    return { ok: false, error: message };
  }
};

export const approveOperationExpenseRequest = async (tenantId, expenseId, payload = {}) => {
  try {
    if (!tenantId || !expenseId) return { ok: false, error: 'Missing tenantId or expenseId.' };

    const approvedBy = String(payload?.approvedBy || '').trim();
    if (!approvedBy) return { ok: false, error: 'Missing approver identity.' };

    const expenseRef = doc(db, 'tenants', tenantId, 'operationExpenses', expenseId);
    let amountApprovedValue = 0;

    await runTransaction(db, async (txn) => {
      const snap = await txn.get(expenseRef);
      if (!snap.exists()) throw new Error('Expense request not found.');

      const data = snap.data() || {};
      const status = normalizeOperationExpenseStatus(data.status, 'requested');
      if (status === 'released' || data.portalTransactionId) throw new Error('Released expense cannot be approved again.');

      const fallbackAmount = Math.max(0, Number(data.amountRequested || 0));
      const nextAmountApproved = Math.max(0, Number(payload?.amountApproved ?? fallbackAmount));
      if (!(nextAmountApproved > 0)) throw new Error('Approved amount must be greater than zero.');
      amountApprovedValue = nextAmountApproved;

      txn.set(
        expenseRef,
        {
          status: 'approved',
          amountApproved: nextAmountApproved,
          approvalNote: String(payload?.approvalNote || '').trim(),
          approvedBy,
          approvedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          updatedBy: approvedBy,
        },
        { merge: true },
      );
    });

    return { ok: true, id: expenseId, amountApproved: amountApprovedValue };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] operation expense approval failed tenants/${tenantId}/operationExpenses/${expenseId}: ${message}`);
    return { ok: false, error: message };
  }
};

export const releaseOperationExpenseWithFinancials = async (tenantId, expenseId, payload = {}) => {
  try {
    if (!tenantId || !expenseId) return { ok: false, error: 'Missing tenantId or expenseId.' };

    const releasedBy = String(payload?.releasedBy || payload?.createdBy || '').trim();
    if (!releasedBy) return { ok: false, error: 'Missing releaser identity.' };

    const expenseRef = doc(db, 'tenants', tenantId, 'operationExpenses', expenseId);
    let releaseAmount = 0;
    let nextPortalBalance = 0;
    let nextPortalTxId = '';

    await runTransaction(db, async (txn) => {
      const expenseSnap = await txn.get(expenseRef);
      const exists = expenseSnap.exists();
      if (!exists && !payload?.createIfMissing) throw new Error('Expense request not found.');

      const expenseData = exists ? (expenseSnap.data() || {}) : {};
      const currentStatus = normalizeOperationExpenseStatus(expenseData.status, 'requested');

      if (currentStatus === 'released' || String(expenseData.portalTransactionId || '').trim()) {
        throw new Error('Released expense cannot be released twice.');
      }

      const category = String(payload?.category || expenseData.category || '').trim();
      if (!category) throw new Error('Category is required.');

      const displayRef = String(payload?.displayRef || expenseData.displayRef || expenseId).trim() || expenseId;
      const amountRequested = Math.max(0, Number(payload?.amountRequested ?? expenseData.amountRequested ?? payload?.amount ?? 0));
      releaseAmount = Math.max(0, Number(payload?.amountReleased ?? payload?.amount ?? 0));
      
      // Ensure amountApproved is a positive number.
      // Fall back if stored value is 0 (not yet approved), since ?? passes through 0.
      const _candidateApproved = Number(payload?.amountApproved ?? expenseData.amountApproved ?? 0);
      const amountApproved = _candidateApproved > 0
        ? _candidateApproved
        : (releaseAmount > 0 ? releaseAmount : amountRequested);

      if (!(releaseAmount > 0)) throw new Error('Release amount must be greater than zero.');

      const portalId = String(payload?.portalId || expenseData.portalId || '').trim();
      const transactionMethodId = String(payload?.transactionMethodId || expenseData.transactionMethodId || '').trim();
      if (!portalId) throw new Error('Release portal is required.');
      if (!transactionMethodId) throw new Error('Transaction method is required.');

      const portalRef = doc(db, 'tenants', tenantId, 'portals', portalId);
      const portalSnap = await txn.get(portalRef);
      if (!portalSnap.exists()) throw new Error('Selected portal not found.');
      const portalData = portalSnap.data() || {};
      const portalName = String(payload?.portalName || expenseData.portalName || portalData.name || portalId).trim();
      const transactionMethodName = String(payload?.transactionMethodName || expenseData.transactionMethodName || transactionMethodId).trim();

      const currentPortalBalance = Number(portalData.balance ?? 0) || 0;
      nextPortalBalance = currentPortalBalance - releaseAmount;

      nextPortalTxId = toSafeDocId(String(payload?.portalTransactionId || `${displayRef}-EXP`), 'portal_tx');
      const portalTxRef = doc(db, 'tenants', tenantId, 'portalTransactions', nextPortalTxId);
      const portalTxSnap = await txn.get(portalTxRef);
      if (portalTxSnap.exists()) throw new Error('Release blocked. Linked financial transaction already exists.');

      const releaseDate = String(payload?.releaseDate || new Date().toISOString());
      const description = String(payload?.description || expenseData.description || '').trim();

      txn.set(
        portalTxRef,
        {
          portalId,
          displayTransactionId: displayRef,
          amount: -releaseAmount,
          type: 'Operation Expenses',
          category,
          description: description || `Operation expense ${displayRef}`,
          date: releaseDate,
          transactionMethod: transactionMethodId,
          transactionMethodName,
          method: transactionMethodId,
          entityType: 'operationExpense',
          entityId: expenseId,
          affectsPortalBalance: true,
          status: 'active',
          createdAt: serverTimestamp(),
          createdBy: releasedBy,
          updatedAt: serverTimestamp(),
        },
        { merge: false },
      );

      txn.set(
        portalRef,
        {
          balance: nextPortalBalance,
          balanceType: nextPortalBalance < 0 ? 'negative' : 'positive',
          updatedAt: serverTimestamp(),
          updatedBy: releasedBy,
        },
        { merge: true },
      );

      const nextExpenseType = String(payload?.expenseType || expenseData.expenseType || 'normal').trim().toLowerCase() === 'salary'
        ? 'salary'
        : 'normal';

      txn.set(
        expenseRef,
        {
          displayRef,
          expenseType: nextExpenseType,
          category,
          description,
          status: 'released',
          amountRequested,
          amountApproved,
          amountReleased: releaseAmount,
          requestedBy: String(payload?.requestedBy || expenseData.requestedBy || releasedBy).trim(),
          requestedByDisplayName: String(payload?.requestedByDisplayName || expenseData.requestedByDisplayName || '').trim(),
          requestedAt: expenseData.requestedAt || serverTimestamp(),
          approvedBy: String(payload?.approvedBy || expenseData.approvedBy || releasedBy).trim(),
          approvedAt: expenseData.approvedAt || serverTimestamp(),
          approvalNote: String(payload?.approvalNote || expenseData.approvalNote || '').trim(),
          portalId,
          portalName,
          transactionMethodId,
          transactionMethodName,
          releaseNote: String(payload?.releaseNote || '').trim(),
          releasedBy,
          releasedAt: serverTimestamp(),
          portalTransactionId: nextPortalTxId,
          salaryMode: nextExpenseType === 'salary'
            ? (String(payload?.salaryMode || expenseData.salaryMode || '').trim().toLowerCase() === 'manual' ? 'manual' : 'user')
            : '',
          employeeUserId: String(payload?.employeeUserId || expenseData.employeeUserId || '').trim(),
          employeeName: String(payload?.employeeName || expenseData.employeeName || '').trim(),
          attachment: payload?.attachment || expenseData.attachment || null,
          updatedAt: serverTimestamp(),
          updatedBy: releasedBy,
          ...(!exists ? { createdAt: serverTimestamp() } : {}),
        },
        { merge: true },
      );
    });

    return {
      ok: true,
      id: expenseId,
      amountReleased: releaseAmount,
      portalBalanceAfter: nextPortalBalance,
      portalTransactionId: nextPortalTxId,
    };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] operation expense release failed tenants/${tenantId}/operationExpenses/${expenseId}: ${message}`);
    return { ok: false, error: message };
  }
};

export const fetchTenantQuotations = async (tenantId) => {
  try {
    const snap = await getDocs(collection(db, 'tenants', tenantId, 'quotations'));
    const rows = snap.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .filter((item) => !item.deletedAt)
      .sort((a, b) => toDateMillis(b.createdAt || b.updatedAt) - toDateMillis(a.createdAt || a.updatedAt));
    return { ok: true, rows };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] quotations read failed tenants/${tenantId}/quotations: ${message}`);
    return { ok: false, error: message, rows: [] };
  }
};

export const upsertTenantQuotation = async (tenantId, quotationId, payload) => {
  try {
    if (!tenantId || !quotationId) return { ok: false, error: 'Missing tenantId or quotationId.' };
    await setDoc(
      doc(db, 'tenants', tenantId, 'quotations', quotationId),
      {
        ...payload,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    return { ok: true, id: quotationId };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] quotation upsert failed tenants/${tenantId}/quotations/${quotationId}: ${message}`);
    return { ok: false, error: message };
  }
};

export const fetchTenantProformaInvoices = async (tenantId) => {
  try {
    const snap = await getDocs(collection(db, 'tenants', tenantId, 'proformaInvoices'));
    const rows = snap.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .filter((item) => !item.deletedAt)
      .sort((a, b) => toDateMillis(b.createdAt || b.updatedAt) - toDateMillis(a.createdAt || a.updatedAt));
    return { ok: true, rows };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] proforma read failed tenants/${tenantId}/proformaInvoices: ${message}`);
    return { ok: false, error: message, rows: [] };
  }
};

export const upsertTenantProformaInvoice = async (tenantId, proformaId, payload) => {
  try {
    if (!tenantId || !proformaId) return { ok: false, error: 'Missing tenantId or proformaId.' };
    const ref = doc(db, 'tenants', tenantId, 'proformaInvoices', proformaId);
    const snap = await getDoc(ref);
    await setDoc(
      ref,
      {
        ...payload,
        updatedAt: serverTimestamp(),
        ...(snap.exists() ? {} : { createdAt: serverTimestamp() }),
      },
      { merge: true },
    );
    return { ok: true, id: proformaId };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] proforma upsert failed tenants/${tenantId}/proformaInvoices/${proformaId}: ${message}`);
    return { ok: false, error: message };
  }
};

export const updateTenantProformaInvoiceStatus = async (tenantId, proformaId, status, updatedBy) => {
  try {
    if (!tenantId || !proformaId) return { ok: false, error: 'Missing tenantId or proformaId.' };
    const ref = doc(db, 'tenants', tenantId, 'proformaInvoices', proformaId);
    await updateDoc(ref, {
      status,
      updatedAt: serverTimestamp(),
      updatedBy: updatedBy || '',
    });
    return { ok: true };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] proforma status update failed: ${message}`);
    return { ok: false, error: message };
  }
};

const getPortalBalanceAdjustmentRequestRef = (tenantId, requestId) =>
  doc(db, 'tenants', tenantId, 'portalBalanceAdjustments', requestId);

const generatePortalBalanceAdjustmentDisplayId = async (tenantId) => {
  const typeKey = 'lastBADJSeq';
  const seq = await incrementTransactionSequence(tenantId, typeKey);
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const safeSeq = Number.isFinite(Number(seq)) ? Number(seq) : Date.now() % 10000;
  return `BADJ-${yyyy}${mm}${dd}-${String(safeSeq).padStart(4, '0')}`;
};

export const createPortalBalanceAdjustmentRequest = async (
  tenantId,
  {
    portalId,
    methodId,
    amount,
    direction = 'add',
    reason = '',
    requestedBy,
  } = {},
) => {
  try {
    const normalizedPortalId = String(portalId || '').trim();
    const normalizedMethodId = String(methodId || '').trim();
    const normalizedReason = String(reason || '').trim();
    const requesterUid = String(requestedBy || '').trim();
    const normalizedDirection = String(direction || 'add').trim().toLowerCase() === 'subtract' ? 'subtract' : 'add';
    const amountAbs = Math.abs(Number(amount || 0));

    if (!tenantId || !normalizedPortalId || !normalizedMethodId || !requesterUid) {
      return { ok: false, error: 'Missing portal, method, tenant, or requester context.' };
    }
    if (!Number.isFinite(amountAbs) || amountAbs <= 0) {
      return { ok: false, error: 'Adjustment amount must be greater than zero.' };
    }
    if (!normalizedReason) {
      return { ok: false, error: 'Reason is required for direct balance adjustment.' };
    }

    const portalRef = doc(db, 'tenants', tenantId, 'portals', normalizedPortalId);
    const portalSnap = await getDoc(portalRef);
    if (!portalSnap.exists()) return { ok: false, error: 'Selected portal was not found.' };
    const portalData = portalSnap.data() || {};

    const methods = Array.isArray(portalData.methods) ? portalData.methods : [];
    if (!methods.includes(normalizedMethodId)) {
      return { ok: false, error: 'Selected transaction method is not enabled for this portal.' };
    }

    const signedDelta = normalizedDirection === 'subtract' ? -amountAbs : amountAbs;
    const requestId = toSafeDocId(`BADJ-${Date.now()}-${Math.floor(Math.random() * 10000)}`, 'adj');
    const requestRef = getPortalBalanceAdjustmentRequestRef(tenantId, requestId);
    const requesterControlSnap = await getDoc(doc(db, 'tenants', tenantId, 'userControlPrefs', requesterUid));
    const requesterControl = requesterControlSnap.exists() ? (requesterControlSnap.data() || {}) : {};
    if (!requesterControl.directBalanceAdjust) {
      return { ok: false, error: 'Requester does not have direct balance adjustment permission.' };
    }

    const approverNotificationId = generateNotificationId({ topic: 'finance', subTopic: 'balance' });
    await setDoc(requestRef, {
      requestId,
      tenantId,
      portalId: normalizedPortalId,
      portalName: String(portalData.name || normalizedPortalId),
      methodId: normalizedMethodId,
      amount: amountAbs,
      direction: normalizedDirection,
      delta: signedDelta,
      reason: normalizedReason,
      status: 'pending',
      requestedBy: requesterUid,
      requestedAt: serverTimestamp(),
      notificationId: approverNotificationId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });

    await upsertTenantNotification(
      tenantId,
      approverNotificationId,
      {
        ...buildNotificationPayload({
          topic: 'finance',
          subTopic: 'balance',
          type: 'warning',
          title: 'Balance Adjustment Approval Required',
          detail: `${String(portalData.name || normalizedPortalId)} requires approval.`,
          createdBy: requesterUid,
          routePath: `/t/${tenantId}/portal-management/${normalizedPortalId}`,
          actions: [
            {
              label: 'Approve',
              actionType: 'api',
              actionKey: DIRECT_BALANCE_ACTION_APPROVE,
              requestId,
            },
            {
              label: 'Reject',
              actionType: 'api',
              actionKey: DIRECT_BALANCE_ACTION_REJECT,
              requestId,
            },
            { label: 'View Details', actionType: 'quickView' },
          ],
        }),
        eventType: 'balanceAdjustApproval',
        entityType: 'portal',
        entityId: normalizedPortalId,
        entityLabel: String(portalData.name || normalizedPortalId),
        pageKey: 'portalManagement',
        sectionKey: 'balanceAdjustment',
        targetRoles: ['super admin', 'admin', 'accountant', 'manager'],
        excludedUsers: [requesterUid],
        quickView: {
          badge: 'Approval',
          title: String(portalData.name || normalizedPortalId),
          subtitle: 'Direct Balance Adjustment Request',
          description: normalizedReason,
          fields: [
            { label: 'Method', value: normalizedMethodId },
            { label: 'Direction', value: normalizedDirection },
            { label: 'Amount', value: String(amountAbs) },
            { label: 'Requested By', value: requesterUid },
            { label: 'Request ID', value: requestId },
          ],
        },
      },
    );

    return { ok: true, status: 'pending', requestId, notificationId: approverNotificationId };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] direct balance request failed: ${message}`);
    return { ok: false, error: message };
  }
};

export const previewDisplayDocumentRef = async (tenantId, docKey = 'quotation') => {
  try {
    const settingsRes = await getTenantSettingDoc(tenantId, 'transactionIdRules');
    const allRules = settingsRes.ok && settingsRes.data ? settingsRes.data : {};
    const storedRule = allRules.docRefCodes?.[docKey] || {};
    const fallbackPrefix = docKey === 'proformaInvoice' ? 'PRO' : 'QUOT';
    const normalizedRule = normalizeIdRule(storedRule, fallbackPrefix);
    const sequenceKey = buildSequenceKey(`docRef_${docKey}`, normalizedRule);
    const currentSeq = await getTransactionSequence(tenantId, sequenceKey);
    const nextSeq = Math.max(currentSeq + 1, Number(normalizedRule.sequenceStart || 1));
    return formatDisplayId({
      prefix: normalizedRule.prefix,
      seq: nextSeq,
      padding: normalizedRule.padding,
      dateFormat: normalizedRule.dateEnabled ? normalizedRule.dateFormat : 'NONE',
      useSeparator: normalizedRule.useSeparator,
    });
  } catch (error) {
    console.warn(`[backendStore] document ref preview failed for ${docKey}:`, error);
    return `${String(docKey || 'DOC').toUpperCase()}-${Date.now()}`;
  }
};

export const cancelTenantProformaInvoice = async (tenantId, proformaId, updatedBy) => {
  try {
    if (!tenantId || !proformaId) return { ok: false, error: 'Missing tenantId or proformaId.' };
    
    const proformaRef = doc(db, 'tenants', tenantId, 'proformaInvoices', proformaId);
    const tasksQuery = query(collection(db, 'tenants', tenantId, 'tasks'), where('proformaId', '==', proformaId));
    
    // Fetch tasks to cancel
    const tasksSnap = await getDocs(tasksQuery);
    
    await runTransaction(db, async (txn) => {
      // 1. Mark proforma as cancelled
      txn.update(proformaRef, {
        status: 'cancelled',
        cancelledAt: serverTimestamp(),
        cancelledBy: updatedBy || '',
        updatedAt: serverTimestamp(),
        updatedBy: updatedBy || '',
      });
      
      // 2. Mark all linked tasks as cancelled
      tasksSnap.docs.forEach(taskDoc => {
        txn.update(taskDoc.ref, {
          status: 'cancelled',
          updatedAt: serverTimestamp(),
          updatedBy: updatedBy || '',
        });
      });
    });
    
    return { ok: true };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] proforma cancellation failed: ${message}`);
    return { ok: false, error: message };
  }
};


export const fetchTenantClientPayments = async (tenantId, filters = {}) => {
  try {
    const snap = await getDocs(collection(db, 'tenants', tenantId, 'clientPayments'));
    const normalizedClientId = String(filters?.clientId || '').trim();
    const normalizedType = String(filters?.type || '').trim().toLowerCase();
    const rows = snap.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .filter((item) => {
        if (item.deletedAt) return false;
        if (normalizedClientId && String(item.clientId || '').trim() !== normalizedClientId) return false;
        if (normalizedType && String(item.type || '').trim().toLowerCase() !== normalizedType) return false;
        return true;
      })
      .sort((a, b) => toDateMillis(b.receivedAt || b.createdAt || b.updatedAt) - toDateMillis(a.receivedAt || a.createdAt || a.updatedAt));
    return { ok: true, rows };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] client payment read failed tenants/${tenantId}/clientPayments: ${message}`);
    return { ok: false, error: message, rows: [] };
  }
};

export const upsertTenantClientPayment = async (tenantId, paymentId, payload) => {
  try {
    if (!tenantId || !paymentId) return { ok: false, error: 'Missing tenantId or paymentId.' };
    const ref = doc(db, 'tenants', tenantId, 'clientPayments', paymentId);
    const snap = await getDoc(ref);
    await setDoc(
      ref,
      {
        ...payload,
        updatedAt: serverTimestamp(),
        ...(snap.exists() ? {} : { createdAt: serverTimestamp() }),
      },
      { merge: true },
    );
    return { ok: true, id: paymentId };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] client payment upsert failed tenants/${tenantId}/clientPayments/${paymentId}: ${message}`);
    return { ok: false, error: message };
  }
};

export const convertQuotationToProforma = async (tenantId, quotationId, conversionPayload = {}) => {
  try {
    if (!tenantId || !quotationId) return { ok: false, error: 'Missing tenantId or quotationId.' };

    const quotationRef = doc(db, 'tenants', tenantId, 'quotations', quotationId);
    const quotationSnap = await getDoc(quotationRef);
    if (!quotationSnap.exists()) return { ok: false, error: 'Quotation not found.' };

    const quotation = quotationSnap.data() || {};
    if (quotation.proformaId) {
      return {
        ok: true,
        alreadyConverted: true,
        proformaId: String(quotation.proformaId || ''),
        proformaDisplayRef: String(quotation.proformaDisplayRef || ''),
      };
    }

    const actor = String(conversionPayload?.createdBy || quotation?.updatedBy || quotation?.createdBy || '').trim();
    const nextDisplayRef = String(conversionPayload?.displayRef || '').trim() || await generateDisplayDocumentRef(tenantId, 'proformaInvoice');
    const nextProformaId = toSafeDocId(nextDisplayRef, 'proforma');
    const proformaRef = doc(db, 'tenants', tenantId, 'proformaInvoices', nextProformaId);

    const sourceItems = Array.isArray(conversionPayload?.items) && conversionPayload.items.length
      ? conversionPayload.items
      : (Array.isArray(quotation.items) ? quotation.items : []);
    const normalizedItems = sourceItems.map((item, index) => {
      const qty = Math.max(1, Number(item?.qty || 1));
      const amount = Math.max(0, Number(item?.amount || 0));
      const lineTotal = Number.isFinite(Number(item?.lineTotal)) ? Number(item.lineTotal) : qty * amount;
      return {
        rowId: String(item?.rowId || `${index + 1}`),
        applicationId: String(item?.applicationId || ''),
        name: String(item?.name || ''),
        description: String(item?.description || ''),
        qty,
        amount,
        govCharge: Number(item?.govCharge || 0) || 0,
        lineTotal,
      };
    });
    const totalAmount = normalizedItems.reduce((sum, item) => sum + (Number(item.lineTotal) || 0), 0);
    const amountPaid = Math.max(0, Number(conversionPayload?.amountPaid || 0));
    const balanceDue = Math.max(0, totalAmount - amountPaid);

    await runTransaction(db, async (txn) => {
      const txQuotationSnap = await txn.get(quotationRef);
      if (!txQuotationSnap.exists()) throw new Error('Quotation not found.');
      const txQuotation = txQuotationSnap.data() || {};
      if (txQuotation.proformaId) throw new Error('Quotation is already converted.');

      txn.set(
        proformaRef,
        {
          displayRef: nextDisplayRef,
          sourceQuotationId: quotationId,
          sourceQuotationRef: String(txQuotation.displayRef || ''),
          quoteDate: txQuotation.quoteDate || '',
          clientId: txQuotation.clientId || null,
          clientSnapshot: txQuotation.clientSnapshot || {},
          dependentIds: txQuotation.dependentIds || [],
          dependentNames: txQuotation.dependentNames || [],
          items: normalizedItems,
          totalAmount,
          amountPaid,
          balanceDue,
          status: conversionPayload?.status || 'drafted',
          sentAt: null,
          canceledAt: null,
          canceledBy: '',
          createdBy: actor || '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          updatedBy: actor || '',
        },
        { merge: false },
      );

      txn.set(
        quotationRef,
        {
          status: 'converted',
          proformaId: nextProformaId,
          proformaDisplayRef: nextDisplayRef,
          acceptedAt: txQuotation.acceptedAt || serverTimestamp(),
          acceptedBy: txQuotation.acceptedBy || actor || '',
          convertedAt: serverTimestamp(),
          convertedBy: actor || '',
          updatedAt: serverTimestamp(),
          updatedBy: actor || '',
        },
        { merge: true },
      );
    });

    return {
      ok: true,
      proformaId: nextProformaId,
      proformaDisplayRef: nextDisplayRef,
      totalAmount,
      balanceDue,
    };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] quotation->proforma conversion failed tenants/${tenantId}/quotations/${quotationId}: ${message}`);
    return { ok: false, error: message };
  }
};

export const markQuotationAsConverted = async (tenantId, quotationId, proformaId, proformaDisplayRef, actor) => {
  try {
    if (!tenantId || !quotationId) return { ok: false, error: 'Missing tenantId or quotationId.' };
    const quotationRef = doc(db, 'tenants', tenantId, 'quotations', quotationId);
    
    await updateDoc(quotationRef, {
      status: 'converted',
      proformaId: proformaId || null,
      proformaDisplayRef: proformaDisplayRef || '',
      convertedAt: serverTimestamp(),
      convertedBy: actor || '',
      updatedAt: serverTimestamp(),
      updatedBy: actor || '',
    });
    
    return { ok: true };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] markQuotationAsConverted failed: ${message}`);
    return { ok: false, error: message };
  }
};

export const recordClientPaymentWithFinancials = async (tenantId, paymentId, payload) => {
  try {
    if (!tenantId || !paymentId) return { ok: false, error: 'Missing tenantId or paymentId.' };

    const clientId = String(payload?.clientId || '').trim();
    const portalId = String(payload?.portalId || '').trim();
    const methodId = String(payload?.methodId || '').trim();
    const proformaId = String(payload?.proformaId || '').trim();
    const actor = String(payload?.createdBy || '').trim();
    const amount = Math.max(0, Number(payload?.amount || 0));

    if (!clientId || !portalId || !actor) {
      return { ok: false, error: 'Missing required fields (clientId, portalId, createdBy).' };
    }
    if (!(amount > 0)) return { ok: false, error: 'Payment amount must be greater than zero.' };

    const displayRef = String(payload?.displayRef || paymentId).trim() || paymentId;
    const referenceType = String(payload?.referenceType || (proformaId ? 'proforma_linked' : 'general_balance')).trim() || 'general_balance';
    const receivedAt = String(payload?.receivedAt || new Date().toISOString());

    const paymentRef = doc(db, 'tenants', tenantId, 'clientPayments', paymentId);
    const clientRef = doc(db, 'tenants', tenantId, 'clients', clientId);
    const portalRef = doc(db, 'tenants', tenantId, 'portals', portalId);
    const portalTxId = toSafeDocId(`${displayRef}-PAY`, 'portal_tx');
    const portalTxRef = doc(db, 'tenants', tenantId, 'portalTransactions', portalTxId);
    const proformaRef = proformaId ? doc(db, 'tenants', tenantId, 'proformaInvoices', proformaId) : null;

    const result = {
      ok: true,
      clientBalanceAfter: 0,
      portalBalanceAfter: 0,
      proformaStatusAfter: '',
      proformaBalanceDueAfter: null,
    };

    await runTransaction(db, async (txn) => {
      const [clientSnap, portalSnap, proformaSnap] = await Promise.all([
        txn.get(clientRef),
        txn.get(portalRef),
        proformaRef ? txn.get(proformaRef) : Promise.resolve(null),
      ]);

      if (!clientSnap.exists()) throw new Error('Selected client not found.');
      if (!portalSnap.exists()) throw new Error('Selected portal not found.');
      if (proformaRef && proformaSnap && !proformaSnap.exists()) throw new Error('Linked proforma not found.');

      const clientData = clientSnap.data() || {};
      const portalData = portalSnap.data() || {};
      const currentClientBalance = Number(clientData.balance ?? clientData.openingBalance ?? 0) || 0;
      const currentPortalBalance = Number(portalData.balance ?? 0) || 0;
      const nextClientBalance = currentClientBalance + amount;
      const nextPortalBalance = currentPortalBalance + amount;

      txn.set(
        paymentRef,
        {
          displayRef,
          type: 'payment',
          amount,
          clientId,
          portalId,
          methodId,
          proformaId: proformaId || null,
          referenceType,
          note: String(payload?.note || '').trim(),
          receivedAt,
          createdBy: actor,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: false },
      );

      txn.set(
        clientRef,
        {
          openingBalance: nextClientBalance,
          balance: nextClientBalance,
          updatedAt: serverTimestamp(),
          updatedBy: actor,
        },
        { merge: true },
      );

      txn.set(
        portalRef,
        {
          balance: nextPortalBalance,
          balanceType: nextPortalBalance < 0 ? 'negative' : 'positive',
          updatedAt: serverTimestamp(),
          updatedBy: actor,
        },
        { merge: true },
      );

      txn.set(
        portalTxRef,
        {
          portalId,
          displayTransactionId: displayRef,
          amount,
          type: 'Client Payment',
          category: 'Client Collection',
          method: methodId || '',
          description: `Client payment ${displayRef}`,
          date: receivedAt,
          entityType: 'clientPayment',
          entityId: paymentId,
          affectsPortalBalance: true,
          status: 'active',
          createdAt: serverTimestamp(),
          createdBy: actor,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      if (proformaRef && proformaSnap && proformaSnap.exists()) {
        const proformaData = proformaSnap.data() || {};
        const totalAmount = Number(proformaData.totalAmount || 0) || 0;
        const currentPaid = Math.max(0, Number(proformaData.amountPaid || 0) || 0);
        const nextPaid = Math.max(0, currentPaid + amount);
        const nextBalanceDue = Math.max(0, totalAmount - nextPaid);
        const nextStatus = nextBalanceDue <= 0 ? 'paid' : (nextPaid > 0 ? 'partially_paid' : (proformaData.status || 'sent'));

        txn.set(
          proformaRef,
          {
            amountPaid: nextPaid,
            balanceDue: nextBalanceDue,
            status: nextStatus,
            lastPaymentId: paymentId,
            lastPaymentAt: serverTimestamp(),
            paymentIds: arrayUnion(paymentId),
            updatedAt: serverTimestamp(),
            updatedBy: actor,
          },
          { merge: true },
        );

        result.proformaStatusAfter = nextStatus;
        result.proformaBalanceDueAfter = nextBalanceDue;
      }

      result.clientBalanceAfter = nextClientBalance;
      result.portalBalanceAfter = nextPortalBalance;
    });

    return result;
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] client payment record failed tenants/${tenantId}/clientPayments/${paymentId}: ${message}`);
    return { ok: false, error: message };
  }
};

export const recordClientRefundWithFinancials = async (tenantId, refundId, payload) => {
  try {
    if (!tenantId || !refundId) return { ok: false, error: 'Missing tenantId or refundId.' };

    const clientId = String(payload?.clientId || '').trim();
    const portalId = String(payload?.portalId || '').trim();
    const methodId = String(payload?.methodId || '').trim();
    const proformaId = String(payload?.proformaId || '').trim();
    const actor = String(payload?.createdBy || '').trim();
    const amount = Math.max(0, Number(payload?.amount || 0));

    if (!clientId || !portalId || !actor) {
      return { ok: false, error: 'Missing required fields (clientId, portalId, createdBy).' };
    }
    if (!(amount > 0)) return { ok: false, error: 'Refund amount must be greater than zero.' };

    const displayRef = String(payload?.displayRef || refundId).trim() || refundId;
    const referenceType = String(payload?.referenceType || (proformaId ? 'proforma_linked' : 'general_balance')).trim() || 'general_balance';
    const receivedAt = String(payload?.receivedAt || new Date().toISOString());

    const refundRef = doc(db, 'tenants', tenantId, 'clientPayments', refundId);
    const clientRef = doc(db, 'tenants', tenantId, 'clients', clientId);
    const portalRef = doc(db, 'tenants', tenantId, 'portals', portalId);
    const portalTxId = toSafeDocId(`${displayRef}-REFUND`, 'portal_tx');
    const portalTxRef = doc(db, 'tenants', tenantId, 'portalTransactions', portalTxId);
    const proformaRef = proformaId ? doc(db, 'tenants', tenantId, 'proformaInvoices', proformaId) : null;

    const result = {
      ok: true,
      clientBalanceAfter: 0,
      portalBalanceAfter: 0,
      proformaStatusAfter: '',
      proformaBalanceDueAfter: null,
    };

    await runTransaction(db, async (txn) => {
      const [clientSnap, portalSnap, proformaSnap] = await Promise.all([
        txn.get(clientRef),
        txn.get(portalRef),
        proformaRef ? txn.get(proformaRef) : Promise.resolve(null),
      ]);

      if (!clientSnap.exists()) throw new Error('Selected client not found.');
      if (!portalSnap.exists()) throw new Error('Selected portal not found.');
      if (proformaRef && proformaSnap && !proformaSnap.exists()) throw new Error('Linked proforma not found.');

      const clientData = clientSnap.data() || {};
      const portalData = portalSnap.data() || {};
      const currentClientBalance = Number(clientData.balance ?? clientData.openingBalance ?? 0) || 0;
      const currentPortalBalance = Number(portalData.balance ?? 0) || 0;
      if (currentClientBalance < amount) throw new Error('Refund blocked. Client balance is not sufficient.');
      if (currentPortalBalance < amount) throw new Error('Refund blocked. Portal balance is not sufficient.');

      const nextClientBalance = currentClientBalance - amount;
      const nextPortalBalance = currentPortalBalance - amount;

      txn.set(
        refundRef,
        {
          displayRef,
          type: 'refund',
          amount,
          clientId,
          portalId,
          methodId,
          proformaId: proformaId || null,
          referenceType,
          note: String(payload?.note || '').trim(),
          receivedAt,
          createdBy: actor,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: false },
      );

      txn.set(
        clientRef,
        {
          openingBalance: nextClientBalance,
          balance: nextClientBalance,
          updatedAt: serverTimestamp(),
          updatedBy: actor,
        },
        { merge: true },
      );

      txn.set(
        portalRef,
        {
          balance: nextPortalBalance,
          balanceType: nextPortalBalance < 0 ? 'negative' : 'positive',
          updatedAt: serverTimestamp(),
          updatedBy: actor,
        },
        { merge: true },
      );

      txn.set(
        portalTxRef,
        {
          portalId,
          displayTransactionId: displayRef,
          amount: -amount,
          type: 'Client Refund',
          category: 'Refund',
          method: methodId || '',
          description: `Client refund ${displayRef}`,
          date: receivedAt,
          entityType: 'clientPayment',
          entityId: refundId,
          affectsPortalBalance: true,
          status: 'active',
          createdAt: serverTimestamp(),
          createdBy: actor,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      if (proformaRef && proformaSnap && proformaSnap.exists()) {
        const proformaData = proformaSnap.data() || {};
        const totalAmount = Number(proformaData.totalAmount || 0) || 0;
        const currentPaid = Math.max(0, Number(proformaData.amountPaid || 0) || 0);
        const nextPaid = Math.max(0, currentPaid - amount);
        const nextBalanceDue = Math.max(0, totalAmount - nextPaid);
        const existingStatus = String(proformaData.status || '').toLowerCase();
        const nextStatus = existingStatus === 'canceled'
          ? 'canceled'
          : (nextBalanceDue <= 0 ? 'paid' : (nextPaid > 0 ? 'partially_paid' : 'sent'));

        txn.set(
          proformaRef,
          {
            amountPaid: nextPaid,
            balanceDue: nextBalanceDue,
            status: nextStatus,
            lastRefundId: refundId,
            lastRefundAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            updatedBy: actor,
          },
          { merge: true },
        );

        result.proformaStatusAfter = nextStatus;
        result.proformaBalanceDueAfter = nextBalanceDue;
      }

      result.clientBalanceAfter = nextClientBalance;
      result.portalBalanceAfter = nextPortalBalance;
    });

    return result;
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] client refund record failed tenants/${tenantId}/clientPayments/${refundId}: ${message}`);
    return { ok: false, error: message };
  }
};

export const checkTradeLicenseDuplicate = async (tenantId, licenseNumber) => {
  const q = query(collection(db, 'tenants', tenantId, 'clients'), where('tradeLicenseNumber', '==', licenseNumber));
  const snap = await getDocs(q);
  return !snap.empty;
};

export const checkIndividualDuplicate = async (tenantId, identityInput) => {
  const rootClientsRef = collection(db, 'tenants', tenantId, 'clients');
  const dependentsRef = collectionGroup(db, 'dependents');

  if (typeof identityInput === 'string') {
    const [rootSnap, depSnap] = await Promise.all([
      getDocs(query(rootClientsRef, where('emiratesId', '==', identityInput))),
      getDocs(query(dependentsRef, where('tenantId', '==', tenantId))),
    ]);
    const depExists = depSnap.docs.some((item) => String(item.data()?.emiratesId || '') === String(identityInput));
    return !rootSnap.empty || depExists;
  }

  const method = String(identityInput?.method || 'emiratesId');
  const emiratesId = String(identityInput?.emiratesId || '').replace(/-/g, '').trim();
  const passportNumber = String(identityInput?.passportNumber || '').toUpperCase().trim();
  const fullName = String(identityInput?.fullName || '').toUpperCase().trim();

  if (method === 'emiratesId') {
    const [rootSnap, depSnap] = await Promise.all([
      getDocs(query(rootClientsRef, where('emiratesId', '==', emiratesId))),
      getDocs(query(dependentsRef, where('tenantId', '==', tenantId))),
    ]);
    const depExists = depSnap.docs.some((item) => String(item.data()?.emiratesId || '') === emiratesId);
    return !rootSnap.empty || depExists;
  }

  const [rootSnap, depSnap] = await Promise.all([
    getDocs(rootClientsRef),
    getDocs(query(dependentsRef, where('tenantId', '==', tenantId))),
  ]);
  const allDocs = [...rootSnap.docs, ...depSnap.docs];
  return allDocs.some((item) => {
    const data = item.data() || {};
    if (data.deletedAt) return false;
    const existingPassport = String(data.passportNumber || '').toUpperCase().trim();
    const existingName = String(data.fullName || '').toUpperCase().trim();
    return existingPassport === passportNumber && existingName === fullName;
  });
};
export const searchClients = async (tenantId, queryStr) => {
  try {
    const clientsRef = collection(db, 'tenants', tenantId, 'clients');
    const q = query(clientsRef, where('status', '==', 'active'));
    const snap = await getDocs(q);
    const results = snap.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(c =>
        (c.fullName && c.fullName.toUpperCase().includes(queryStr.toUpperCase())) ||
        (c.tradeName && c.tradeName.toUpperCase().includes(queryStr.toUpperCase())) ||
        (c.emiratesId && c.emiratesId.includes(queryStr)) ||
        (c.tradeLicenseNumber && c.tradeLicenseNumber.includes(queryStr))
      );
    return { ok: true, rows: results.slice(0, 10) };
  } catch (error) {
    return { ok: false, error: toSafeError(error) };
  }
};

export const fetchTenantTransactions = async (tenantId) => {
  try {
    const snap = await getDocs(collection(db, 'tenants', tenantId, 'dailyTransactions'));
    const rows = snap.docs.map((item) => {
      const data = item.data() || {};
      return {
        id: item.id,
        ...data,
        displayTransactionId: data.transactionId || item.id,
        amount: Number(data.clientCharge || 0),
        date: data.createdAt || null,
        type: 'Daily Transaction',
      };
    });
    return { ok: true, rows };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] transactions read failed tenants/${tenantId}/dailyTransactions: ${message}`);
    return { ok: false, error: message, rows: [] };
  }
};

export const fetchTenantNotifications = async (tenantId) => {
  try {
    const snap = await getDocs(collection(db, 'tenants', tenantId, 'notifications'));
    const rows = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
    return { ok: true, rows };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] notifications read failed tenants/${tenantId}/notifications: ${message}`);
    return { ok: false, error: message, rows: [] };
  }
};

const toDateMillis = (value) => {
  if (!value) return 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const addUserLookupEntry = (lookup, key, user) => {
  const normalized = String(key || '').trim();
  if (!normalized) return;
  if (!lookup[normalized]) lookup[normalized] = user;
  const lowered = normalized.toLowerCase();
  if (!lookup[lowered]) lookup[lowered] = user;
};

const findTenantUser = (lookup, item) => {
  const createdByUser = item?.createdByUser;
  const candidates = [
    item?.createdBy,
    item?.createdByUid,
    item?.createdByEmail,
    item?.createdByUserEmail,
    typeof createdByUser === 'string' ? createdByUser : '',
    createdByUser?.uid,
    createdByUser?.email,
  ];

  for (const candidate of candidates) {
    const normalized = String(candidate || '').trim();
    if (!normalized) continue;
    if (lookup[normalized]) return lookup[normalized];
    const lowered = normalized.toLowerCase();
    if (lookup[lowered]) return lookup[lowered];
  }

  return null;
};

export const fetchTenantClients = async (tenantId) => {
  try {
    const [clientsSnap, dependentSnap, usersRes] = await Promise.all([
      getDocs(collection(db, 'tenants', tenantId, 'clients')),
      getDocs(query(collectionGroup(db, 'dependents'), where('tenantId', '==', tenantId))),
      fetchTenantUsersMap(tenantId),
    ]);

    const usersByUid = {};
    const userLookup = {};
    if (usersRes.ok) {
      (usersRes.rows || []).forEach((item) => {
        if (!item?.uid) return;
        usersByUid[item.uid] = item;
        if (item.legacyUid && !usersByUid[item.legacyUid]) {
          usersByUid[item.legacyUid] = item;
        }
        // Also index by email to allow direct lookup if createdBy is an email
        if (item.email && !usersByUid[item.email]) {
          usersByUid[item.email] = item;
        }
        addUserLookupEntry(userLookup, item.uid, item);
        addUserLookupEntry(userLookup, item.legacyUid, item);
        addUserLookupEntry(userLookup, item.email, item);
      });
    }

    const rootRows = clientsSnap.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .filter((item) => !item.deletedAt && String(item.type || '').toLowerCase() !== 'dependent');

    const dependentRows = dependentSnap.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .filter((item) => !item.deletedAt);

    const rows = [...rootRows, ...dependentRows]
      .map((item) => {
        const resolvedUser = findTenantUser(userLookup, item);
        if (!resolvedUser) return item;

        return {
          ...item,
          createdByUser: {
            uid: resolvedUser.uid,
            displayName: resolvedUser.displayName || '',
            email: resolvedUser.email || '',
            photoURL: resolvedUser.photoURL || '/avatar.png',
            role: resolvedUser.role || '',
          },
          createdByDisplayName: resolvedUser.displayName || item.createdByDisplayName || resolvedUser.email || '',
          createdByEmail: item.createdByEmail || resolvedUser.email || '',
        };
      })
      .sort((a, b) => toDateMillis(b.createdAt) - toDateMillis(a.createdAt));

    return { ok: true, rows, usersByUid };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] clients read failed tenants/${tenantId}/clients: ${message}`);
    return { ok: false, error: message, rows: [], usersByUid: {} };
  }
};

export const updateTenantClient = async (tenantId, clientId, payload) => {
  try {
    const rootRef = doc(db, 'tenants', tenantId, 'clients', clientId);
    const rootSnap = await getDoc(rootRef);

    const immutableKeys = new Set([
      'displayClientId',
      'openingBalance',
      'balanceType',
      'type',
      'tenantId',
      'createdAt',
      'createdBy',
    ]);
    const safePayload = {};
    Object.entries(payload || {}).forEach(([key, value]) => {
      if (immutableKeys.has(key)) return;
      if (value === undefined) return;
      safePayload[key] = value;
    });

    if (rootSnap.exists()) {
      await setDoc(
        rootRef,
        {
          ...safePayload,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      return { ok: true };
    }

    const depSnap = await getDocs(query(collectionGroup(db, 'dependents'), where('tenantId', '==', tenantId)));
    const depDoc = depSnap.docs.find((item) => String(item.data()?.displayClientId || '') === String(clientId));
    if (!depDoc) {
      return { ok: false, error: 'Client record not found.' };
    }

    await setDoc(
      depDoc.ref,
      {
        ...safePayload,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    return { ok: true };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] client update failed tenants/${tenantId}/clients/${clientId}: ${message}`);
    return { ok: false, error: message };
  }
};

export const deleteTenantClientCascade = async (tenantId, clientId, deletedBy) => {
  try {
    const batch = [];
    const clientRef = doc(db, 'tenants', tenantId, 'clients', clientId);
    batch.push(
      updateDoc(clientRef, {
        status: 'archived',
        isActive: false,
        archivedAt: serverTimestamp(),
        deletedAt: serverTimestamp(),
        deletedBy,
        updatedAt: serverTimestamp(),
      })
    );
    const dependentsSnap = await getDocs(
      query(collection(db, 'tenants', tenantId, 'dependents'), where('parentId', '==', clientId))
    );
    dependentsSnap.docs.forEach((item) => {
      batch.push(
        updateDoc(item.ref, {
          status: 'archived',
          isActive: false,
          archivedAt: serverTimestamp(),
          deletedAt: serverTimestamp(),
          deletedBy,
          updatedAt: serverTimestamp(),
        })
      );
    });
    await Promise.all(batch);
    return { ok: true };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] client cascade delete (archive) failed tenants/${tenantId}/clients/${clientId}: ${message}`);
    return { ok: false, error: message };
  }
};

export const incrementClientSequence = async (tenantId, sequenceKey) => {
  const ref = doc(db, 'tenants', tenantId, 'settings', 'transactionIdRules');
  await setDoc(ref, { [sequenceKey]: increment(1) }, { merge: true });
  const snap = await getDoc(ref);
  return snap.data()[sequenceKey];
};

export const upsertClient = async (tenantId, clientId, payload) => {
  try {
    const isNew = !clientId;
    const preferredId = payload?.displayClientId ? toSafeDocId(payload.displayClientId, 'client') : '';
    const finalId = clientId || preferredId || doc(collection(db, 'temp')).id;

    const clientRef = doc(db, 'tenants', tenantId, 'clients', finalId);
    await setDoc(clientRef, {
      ...payload,
      updatedAt: serverTimestamp(),
      ...(isNew ? { createdAt: serverTimestamp() } : {}),
    }, { merge: true });

    return { ok: true, id: finalId };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] client upsert failed tenants/${tenantId}/clients/${clientId}: ${message}`);
    return { ok: false, error: message };
  }
};

export const upsertDependentUnderParent = async (
  tenantId,
  parentClientId,
  dependentId,
  payload,
) => {
  try {
    if (!tenantId || !parentClientId || !dependentId) {
      return { ok: false, error: 'Missing tenantId, parentClientId, or dependentId.' };
    }

    const dependentPayload = {
      ...payload,
      parentId: parentClientId,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    };

    // Plan path: tenants/{tenantId}/clients/{parentClientId}/dependents/{dependentId}
    await setDoc(
      doc(db, 'tenants', tenantId, 'clients', parentClientId, 'dependents', dependentId),
      dependentPayload,
      { merge: true },
    );

    return { ok: true, id: dependentId };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] dependent upsert failed tenants/${tenantId}/clients/${parentClientId}/dependents/${dependentId}: ${message}`);
    return { ok: false, error: message };
  }
};

export const requestPasswordReset = async (tenantId, email) => {
  try {
    // 1. Attempt standard Firebase Auth password reset if possible
    if (auth) {
      try {
        await sendPasswordResetEmail(auth, email);
      } catch (authErr) {
        console.warn(`[backendStore] Firebase Native Auth reset failed:`, authErr.message);
      }
    }

    // 2. Fetch tenant mail config for SMTP fallback/notification
    const cfgRes = await fetchTenantMailConfig(tenantId);
    const cfg = cfgRes.ok && cfgRes.data ? cfgRes.data : {};

    const subject = 'Password Reset Request';
    const html = `
      <h3>Password Reset Requested</h3>
      <p>We've received a request to reset the password for ${email}.</p>
      <p>If you have Firebase Authentication enabled, you should also receive an official reset link from Google.</p>
      <p>If you don't use Firebase Auth, please contact your administrator to manually grant a new password.</p>
    `;

    const smtpSend = await trySendViaElectronSmtp({
      config: cfg,
      to: email,
      subject,
      html,
    });

    if (!smtpSend.ok && !smtpSend.skipped) {
      return { ok: false, error: smtpSend.error || 'Failed to dispatch email via SMTP.' };
    }

    if (smtpSend.skipped && !auth) {
      return { ok: false, error: 'Email service is unavailable in web version. Please use the Desktop app for password resets.' };
    }

    return { ok: true };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] Password reset request failed for ${email}: ${message}`);
    return { ok: false, error: message };
  }
};

/**
 * Sends a branded email with a PDF document attached.
 * Assumes Firebase Trigger Email extension is configured.
 */
export const sendTenantDocumentEmail = async (tenantId, email, documentType, pdfBase64, data) => {
  try {
    const cfgRes = await fetchTenantMailConfig(tenantId);
    const cfg = cfgRes.ok && cfgRes.data ? cfgRes.data : {};

    const tenantRef = doc(db, 'tenants', tenantId);
    const tenantSnap = await getDoc(tenantRef);
    const tenantData = tenantSnap.exists() ? tenantSnap.data() : {};
    const tenantName = tenantData.name || 'ACIS Platform';
    const brandColor = tenantData.brandColor || '#e67e22';

    const cleanType = documentType.replace(/([A-Z])/g, ' $1').toLowerCase();

    // Choose template based on document type
    let subjectTemplate = `${tenantName} - Your ${cleanType}`;
    let htmlTemplate = `
      <div style="background-color: #f8fafc; padding: 40px 20px; font-family: sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <div style="background-color: {{brandColor}}; height: 6px;"></div>
          <div style="padding: 40px;">
            <p style="margin: 0 0 20px; font-size: 20px; font-weight: 800; color: #1e293b; letter-spacing: -0.02em;">{{tenantName}}</p>
            <div style="color: #475569; font-size: 16px; line-height: 1.6;">
              <h2 style="color: #1e293b; font-size: 18px; margin-top: 0;">Hello {{recipientName}},</h2>
              <p>Please find attached your <strong>{{documentType}}</strong> for transaction <strong>{{txId}}</strong>.</p>
              <p>This document was generated and delivered via <strong>{{tenantName}}</strong>.</p>
              <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #f1f5f9;">
                <p style="margin: 0; font-size: 14px; font-weight: 700; color: #1e293b;">Best regards,</p>
                <p style="margin: 4px 0 0; font-size: 13px; color: #64748b;">The {{tenantName}} Team</p>
                <p style="margin: 16px 0 0; font-size: 12px; color: #94a3b8;">Questions? <a href="mailto:{{supportEmail}}" style="color: {{brandColor}}; text-decoration: none;">{{supportEmail}}</a></p>
              </div>
            </div>
          </div>
          <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #f1f5f9;">
            <p style="margin: 0; font-size: 11px; color: #94a3b8;">© {{year}} {{tenantName}}. All rights reserved.</p>
          </div>
        </div>
      </div>
    `;

    if (documentType === 'portalStatement') {
      subjectTemplate = cfg.statementSubject || subjectTemplate;
      htmlTemplate = cfg.statementHtml || htmlTemplate;
    }

    const tokens = {
      tenantName,
      brandColor,
      year: new Date().getFullYear(),
      recipientName: data.recipientName || 'Client',
      documentType: cleanType,
      txId: data.txId || '-',
      supportEmail: cfg.replyTo || cfg.fromEmail || '',
    };

    const subject = applyTemplateTokens(subjectTemplate, tokens);
    const html = applyTemplateTokens(htmlTemplate, tokens);

    const attachments = [
      {
        filename: `${documentType}_${data.txId}.pdf`,
        content: pdfBase64,
        encoding: 'base64',
      }
    ];

    const smtpSend = await trySendViaElectronSmtp({
      config: cfg,
      to: email,
      subject,
      html,
      attachments
    });

    if (smtpSend.ok) return { ok: true };
    if (smtpSend.skipped) {
      return { ok: false, error: 'Email service (SMTP) is only available in the Desktop application.' };
    }
    return { ok: false, error: smtpSend.error || 'Failed to send document email.' };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] Email send failed for ${email}: ${message}`);
    return { ok: false, error: message };
  }
};

export const fetchTenantMailConfig = async (tenantId) => {
  return getTenantSettingDoc(tenantId, 'mailConfiguration');
};

export const upsertTenantMailConfig = async (tenantId, payload) => {
  return upsertTenantSettingDoc(tenantId, 'mailConfiguration', payload);
};

const applyTemplateTokens = (template, tokens) => {
  let output = String(template || '');
  Object.entries(tokens || {}).forEach(([key, value]) => {
    const token = `{{${key}}}`;
    output = output.split(token).join(String(value ?? ''));
  });
  return output;
};

const trySendViaElectronSmtp = async ({ config, to, subject, html, attachments }) => {
  try {
    if (typeof window === 'undefined') return { ok: false, skipped: true, reason: 'no_window' };
    const send = window?.electron?.mail?.send;
    if (typeof send !== 'function') return { ok: false, skipped: true, reason: 'not_electron' };

    // Build configurations for available mail providers
    const smtp = { // Mail provider config
      host: config.smtpHost,
      port: config.smtpPort,
      user: config.smtpUser,
      pass: config.smtpPass,
      fromName: config.fromName,
      fromEmail: config.fromEmail,
      replyTo: config.replyTo,
    };

    const google = {
      clientId: config.gmailClientId,
      clientSecret: config.gmailClientSecret,
      refreshToken: config.gmailRefreshToken,
      userEmail: config.gmailEmail,
      fromName: config.fromName,
      replyTo: config.replyTo,
    };

    const hasSmtp = smtp.host && smtp.port && smtp.user && smtp.pass;
    const hasGoogle = google.clientId && google.clientSecret && google.refreshToken;
    if (!hasSmtp && !hasGoogle) return { ok: false, skipped: true, reason: 'config_missing' };

    const res = await send({
      smtp: hasSmtp ? smtp : null,
      google: hasGoogle ? google : null,
      message: {
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        attachments,
      },
    });

    if (res?.ok) return { ok: true, skipped: false };
    return { ok: false, skipped: false, error: res?.error || 'Mail send failed.' };
  } catch (error) {
    return { ok: false, skipped: false, error: toSafeError(error) };
  }
};

export const sendTenantWelcomeEmail = async (
  tenantId,
  { toEmail, clientName, clientType, displayClientId, forceSend = false },
) => {
  try {
    const cfgRes = await fetchTenantMailConfig(tenantId);
    const cfg = cfgRes.ok && cfgRes.data ? cfgRes.data : {};
    if (!forceSend && !cfg.enableWelcomeEmail) return { ok: true, skipped: true, reason: 'disabled' };

    const type = String(clientType || '').toLowerCase();
    if (!forceSend && type === 'company' && cfg.welcomeForCompany === false) {
      return { ok: true, skipped: true, reason: 'company_disabled' };
    }
    if (!forceSend && type === 'individual' && cfg.welcomeForIndividual === false) {
      return { ok: true, skipped: true, reason: 'individual_disabled' };
    }

    const email = String(toEmail || '').trim().toLowerCase();
    if (!email) return { ok: true, skipped: true, reason: 'missing_email' };

    const subjectTemplate = cfg.welcomeSubject || 'Welcome to {{tenantName}}';
    const htmlTemplate =
      cfg.welcomeHtml ||
      '<h3>Welcome {{clientName}}</h3><p>Your client ID is <strong>{{displayClientId}}</strong>.</p><p>Thank you for joining {{tenantName}}.</p>';

    const tenantSnap = await getDoc(doc(db, 'tenants', tenantId));
    const tenantData = tenantSnap.exists() ? tenantSnap.data() : {};
    const tenantName = tenantData.name || 'Our Organization';
    const brandColor = tenantData.brandColor || '#e67e22';

    const tokens = {
      tenantName,
      brandColor,
      year: new Date().getFullYear(),
      recipientName: clientName || 'Client',
      clientName: clientName || 'Client',
      clientType: clientType || 'client',
      displayClientId: displayClientId || '-',
      supportEmail: cfg.replyTo || cfg.fromEmail || '',
    };

    const subject = applyTemplateTokens(subjectTemplate, tokens);
    const html = applyTemplateTokens(htmlTemplate, tokens);

    const smtpSend = await trySendViaElectronSmtp({
      config: cfg,
      to: email,
      subject,
      html,
    });
    if (smtpSend.ok) return { ok: true, skipped: false, channel: 'smtp' };
    if (!smtpSend.skipped) return { ok: false, error: smtpSend.error || 'SMTP send failed.' };

    return { ok: false, skipped: true, error: 'Welcome email cannot be sent from web version. Use Desktop app.' };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] welcome email failed: ${message}`);
    return { ok: false, error: message };
  }
};

/**
 * Marks a transaction as soft-deleted.
 */
export const softDeleteTransaction = async (tenantId, txId, deletedBy) => {
  try {
    const dailyTxRef = doc(db, 'tenants', tenantId, 'dailyTransactions', txId);
    const softDeleteAudience = ['super admin', 'admin', 'manager', 'accountant', 'staff'];
    const hardDeleteAudience = ['super admin', 'admin', 'manager'];

    await runTransaction(db, async (txn) => {
      const txSnap = await txn.get(dailyTxRef);
      if (!txSnap.exists()) throw new Error('Transaction not found.');

      const data = txSnap.data() || {};
      const normalizedStatus = String(data?.status || '').toLowerCase();
      const isInvoiced = data?.invoiced === true || Boolean(data?.invoiceId) || normalizedStatus === 'invoiced';
      if (isInvoiced) {
        throw new Error('This application cannot be deleted because this application already converted to invoice.');
      }

      if (data?.deletedAt || normalizedStatus === 'deleted') return;

      const clientId = String(data?.clientId || '').trim();
      const portalId = String(data?.paidPortalId || '').trim();
      const clientChargeRaw = Number(data?.clientCharge ?? 0);
      const governmentChargeRaw = Number(data?.govCharge ?? 0);
      const clientCharge = Number.isFinite(clientChargeRaw) ? Math.abs(clientChargeRaw) : 0;
      const governmentCharge = Number.isFinite(governmentChargeRaw) ? Math.abs(governmentChargeRaw) : 0;

      const actorId = deletedBy || 'unknown';
      const displayTxId = String(data?.transactionId || txId);
      const deletedPayload = {
        status: 'deleted',
        deletedAt: serverTimestamp(),
        deletedBy: actorId,
      };

      if (clientId) {
        const clientRef = doc(db, 'tenants', tenantId, 'clients', clientId);
        const clientSnap = await txn.get(clientRef);
        if (clientSnap.exists()) {
          const clientData = clientSnap.data() || {};
          const currentBalanceRaw = clientData?.balance ?? clientData?.openingBalance ?? 0;
          const currentBalance = Number.isFinite(Number(currentBalanceRaw)) ? Number(currentBalanceRaw) : 0;
          const nextBalance = currentBalance + clientCharge;
          txn.set(clientRef, {
            openingBalance: nextBalance,
            balance: nextBalance,
            updatedAt: serverTimestamp(),
            updatedBy: actorId,
          }, { merge: true });
        }
      }

      if (portalId) {
        const portalRef = doc(db, 'tenants', tenantId, 'portals', portalId);
        const portalSnap = await txn.get(portalRef);
        if (portalSnap.exists()) {
          const portalData = portalSnap.data() || {};
          const currentPortalBalance = Number.isFinite(Number(portalData?.balance))
            ? Number(portalData.balance)
            : 0;
          const nextPortalBalance = currentPortalBalance + governmentCharge;

          txn.set(portalRef, {
            balance: nextPortalBalance,
            balanceType: nextPortalBalance < 0 ? 'negative' : 'positive',
            updatedAt: serverTimestamp(),
            updatedBy: actorId,
          }, { merge: true });
        }

        if (governmentCharge > 0) {
          const reversalPortalTxId = toSafeDocId(`${txId}-soft-delete-reversal`, 'portal_tx');
          txn.set(
            doc(db, 'tenants', tenantId, 'portalTransactions', reversalPortalTxId),
            {
              portalId,
              displayTransactionId: `${displayTxId}-REV`,
              amount: governmentCharge,
              type: 'Daily Transaction Reversal',
              category: 'Recycle Bin',
              method: String(data?.portalTransactionMethod || ''),
              description: `Reversal after soft delete for ${displayTxId}`,
              date: new Date().toISOString(),
              entityType: 'transaction',
              entityId: txId,
              affectsPortalBalance: true,
              status: 'active',
              createdAt: serverTimestamp(),
              createdBy: actorId,
              updatedAt: serverTimestamp(),
              updatedBy: actorId,
            },
            { merge: true },
          );
        }
      }

      const softDeleteNotificationId = toSafeDocId(`soft-delete-${txId}`, 'ntf');
      txn.set(
        doc(db, 'tenants', tenantId, 'notifications', softDeleteNotificationId),
        {
          title: 'Application moved to recycle bin',
          message: `${displayTxId} is in recycle bin. Confirm and retrieve if needed.`,
          eventKey: 'softDeleteTransaction',
          tenantId,
          transactionId: txId,
          entityId: txId,
          entityType: 'transaction',
          targetRoles: softDeleteAudience,
          routePath: `/t/${tenantId}/daily-transactions`,
          actionLabel: 'Confirm & Retrieve',
          actionType: 'restore',
          status: 'unread',
          createdAt: serverTimestamp(),
          createdBy: actorId,
          updatedAt: serverTimestamp(),
          updatedBy: actorId,
        },
        { merge: true },
      );

      txn.set(
        doc(db, 'tenants', tenantId, 'notifications', toSafeDocId(`hard-delete-option-${txId}`, 'ntf')),
        {
          title: 'Permanent remove or Retrieve this application',
          message: `${displayTxId} can be permanently removed or retrieved from recycle bin.`,
          eventKey: 'hardDeleteTransaction',
          tenantId,
          transactionId: txId,
          entityId: txId,
          entityType: 'transaction',
          targetRoles: hardDeleteAudience,
          routePath: `/t/${tenantId}/daily-transactions`,
          status: 'unread',
          createdAt: serverTimestamp(),
          createdBy: actorId,
          updatedAt: serverTimestamp(),
          updatedBy: actorId,
        },
        { merge: true },
      );

      txn.set(dailyTxRef, deletedPayload, { merge: true });
    });

    return { ok: true };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] soft delete failed for ${txId}:`, message);
    return { ok: false, error: message };
  }
};

const TASK_STATUS_SET = new Set(['pending', 'in_progress', 'completed', 'cancelled']);

const normalizeTaskStatus = (value) => {
  const next = String(value || '').trim().toLowerCase();
  return TASK_STATUS_SET.has(next) ? next : 'pending';
};

const normalizeTaskPayload = (payload = {}) => {
  const assignedUserIds = Array.from(
    new Set(
      (Array.isArray(payload.assignedUserIds) ? payload.assignedUserIds : [])
        .map((uid) => String(uid || '').trim())
        .filter(Boolean),
    ),
  );

  const transactionNumbersSnapshot = Array.from(
    new Set(
      (Array.isArray(payload.transactionNumbersSnapshot) ? payload.transactionNumbersSnapshot : [])
        .map((item) => String(item || '').trim())
        .filter(Boolean),
    ),
  );

  return {
    title: String(payload.title || '').trim(),
    description: String(payload.description || '').trim(),
    status: normalizeTaskStatus(payload.status),
    assignedUserIds,
    clientId: String(payload.clientId || '').trim() || null,
    dependentId: String(payload.dependentId || '').trim() || null,
    proformaId: String(payload.proformaId || '').trim() || null,
    dailyTransactionId: String(payload.dailyTransactionId || '').trim() || null,
    trackingId: String(payload.trackingId || '').trim() || null,
    trackingNumber: String(payload.trackingNumber || '').trim() || null,
    transactionNumbersSnapshot,
  };
};

export const fetchTenantTasks = async (tenantId) => {
  try {
    const snap = await getDocs(collection(db, 'tenants', tenantId, 'tasks'));
    const rows = snap.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .filter((item) => !item.deletedAt)
      .sort((a, b) => toDateMillis(b.updatedAt || b.createdAt) - toDateMillis(a.updatedAt || a.createdAt));
    return { ok: true, rows };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] tasks read failed tenants/${tenantId}/tasks: ${message}`);
    return { ok: false, error: message, rows: [] };
  }
};

export const createTenantTask = async (tenantId, payload = {}) => {
  try {
    if (!tenantId) return { ok: false, error: 'Missing tenant id.' };
    const normalized = normalizeTaskPayload(payload);
    if (!normalized.title) return { ok: false, error: 'Task title is required.' };
    if (normalized.assignedUserIds.length === 0) return { ok: false, error: 'At least one assignee is required.' };

    const taskRef = doc(collection(db, 'tenants', tenantId, 'tasks'));
    await setDoc(taskRef, {
      ...normalized,
      createdBy: String(payload.createdBy || '').trim() || null,
      updatedBy: String(payload.createdBy || '').trim() || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { ok: true, id: taskRef.id };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] task create failed tenants/${tenantId}/tasks: ${message}`);
    return { ok: false, error: message };
  }
};

export const updateTenantTask = async (tenantId, taskId, payload = {}) => {
  try {
    if (!tenantId || !taskId) return { ok: false, error: 'Missing task context.' };
    const normalized = normalizeTaskPayload(payload);
    if (!normalized.title) return { ok: false, error: 'Task title is required.' };
    if (normalized.assignedUserIds.length === 0) return { ok: false, error: 'At least one assignee is required.' };

    const taskRef = doc(db, 'tenants', tenantId, 'tasks', taskId);
    const taskSnap = await getDoc(taskRef);
    if (!taskSnap.exists()) {
      return { ok: false, error: 'Task does not exist anymore.' };
    }
    const taskData = taskSnap.data() || {};
    if (taskData.deletedAt) {
      return { ok: false, error: 'Task is deleted and cannot be updated.' };
    }

    await updateDoc(taskRef, {
      ...normalized,
      updatedBy: String(payload.updatedBy || '').trim() || null,
      updatedAt: serverTimestamp(),
    });
    return { ok: true };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] task update failed tenants/${tenantId}/tasks/${taskId}: ${message}`);
    return { ok: false, error: message };
  }
};


export const updateTenantTaskStatus = async (tenantId, taskId, status, updatedBy) => {
  try {
    if (!tenantId || !taskId) return { ok: false, error: 'Missing task context.' };
    const normalizedStatus = normalizeTaskStatus(status);

    const taskRef = doc(db, 'tenants', tenantId, 'tasks', taskId);
    const taskSnap = await getDoc(taskRef);
    if (!taskSnap.exists()) {
      return { ok: false, error: 'Task does not exist anymore.' };
    }
    const taskData = taskSnap.data() || {};
    if (taskData.deletedAt) {
      return { ok: false, error: 'Task is deleted and cannot be updated.' };
    }

    await updateDoc(taskRef, {
      status: normalizedStatus,
      updatedBy: String(updatedBy || '').trim() || null,
      updatedAt: serverTimestamp(),
    });
    return { ok: true };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] task status update failed tenants/${tenantId}/tasks/${taskId}: ${message}`);
    return { ok: false, error: message };
  }
};

export const updateDailyTransactionReference = async (tenantId, txId, referenceValue, updatedBy) => {
  try {
    if (!tenantId || !txId) return { ok: false, error: 'Missing tenantId or transaction id.' };
    await setDoc(
      doc(db, 'tenants', tenantId, 'dailyTransactions', txId),
      {
        trackingNumber: String(referenceValue || '').trim(),
        updatedAt: serverTimestamp(),
        updatedBy: String(updatedBy || '').trim(),
      },
      { merge: true },
    );
    return { ok: true };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] daily transaction reference update failed for ${txId}: ${message}`);
    return { ok: false, error: message };
  }
};

export const assignDailyTransactionTrackingId = async (tenantId, txId, trackingId, updatedBy) => {
  try {
    if (!tenantId || !txId) return { ok: false, error: 'Missing tenantId or transaction id.' };
    await setDoc(
      doc(db, 'tenants', tenantId, 'dailyTransactions', txId),
      {
        trackingEnabled: true,
        trackingId: String(trackingId || '').trim() || null,
        updatedAt: serverTimestamp(),
        updatedBy: String(updatedBy || '').trim(),
      },
      { merge: true },
    );
    return { ok: true };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] daily transaction tracking update failed for ${txId}: ${message}`);
    return { ok: false, error: message };
  }
};

export const generateAndAssignDailyTransactionTrackingId = async (tenantId, txId, updatedBy) => {
  try {
    if (!tenantId || !txId) return { ok: false, error: 'Missing tenantId or transaction id.' };

    const settingsRef = doc(db, 'tenants', tenantId, 'settings', 'transactionIdRules');
    const dailyTxRef = doc(db, 'tenants', tenantId, 'dailyTransactions', txId);
    const safeUpdatedBy = String(updatedBy || '').trim();

    const result = await runTransaction(db, async (txn) => {
      const [settingsSnap, dailyTxSnap] = await Promise.all([
        txn.get(settingsRef),
        txn.get(dailyTxRef),
      ]);

      if (!dailyTxSnap.exists()) throw new Error('Daily transaction not found for tracking assignment.');

      const dailyData = dailyTxSnap.data() || {};
      const existingTrackingId = String(dailyData?.trackingId || '').trim();
      if (existingTrackingId) {
        txn.set(
          dailyTxRef,
          {
            trackingEnabled: true,
            updatedAt: serverTimestamp(),
            updatedBy: safeUpdatedBy,
          },
          { merge: true },
        );
        return existingTrackingId;
      }

      const settingsData = settingsSnap.exists() ? (settingsSnap.data() || {}) : {};
      const normalizedRule = normalizeIdRule(settingsData?.TRK || {}, 'TRK');
      const sequenceKey = buildSequenceKey('TRK', normalizedRule);

      const rawCurrent = Number(settingsData?.[sequenceKey] || 0);
      const currentSeq = Number.isFinite(rawCurrent) ? rawCurrent : 0;
      const minBase = Math.max(0, Number(normalizedRule.sequenceStart || 1) - 1);
      const nextSeq = Math.max(currentSeq, minBase) + 1;

      const trackingId = formatDisplayId({
        prefix: normalizedRule.prefix,
        seq: nextSeq,
        padding: normalizedRule.padding,
        dateFormat: normalizedRule.dateEnabled ? normalizedRule.dateFormat : 'NONE',
        useSeparator: normalizedRule.useSeparator,
      });

      txn.set(
        settingsRef,
        {
          [sequenceKey]: nextSeq,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      txn.set(
        dailyTxRef,
        {
          trackingEnabled: true,
          trackingId,
          updatedAt: serverTimestamp(),
          updatedBy: safeUpdatedBy,
        },
        { merge: true },
      );

      return trackingId;
    });

    return { ok: true, trackingId: result };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] generate+assign tracking failed for ${txId}: ${message}`);
    return { ok: false, error: message };
  }
};

/**
 * Fetches recent active daily transactions for a tenant.
 */
export const fetchRecentDailyTransactions = async (tenantId, limitCount = 50) => {
  try {
    const txRef = collection(db, 'tenants', tenantId, 'dailyTransactions');
    const q = query(
      txRef,
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    const rows = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return { ok: true, rows };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] recent transactions fetch failed:`, message);
    return { ok: false, error: message, rows: [] };
  }
};

export const fetchDailyTransactionsPage = async (tenantId, { pageSize = 50, cursor = null } = {}) => {
  try {
    const txRef = collection(db, 'tenants', tenantId, 'dailyTransactions');
    const constraints = [
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc'),
      limit(pageSize),
    ];
    if (cursor) constraints.push(startAfter(cursor));
    const q = query(txRef, ...constraints);
    const snap = await getDocs(q);
    const rows = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
    const lastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
    return { ok: true, rows, lastDoc, hasNext: snap.docs.length === pageSize };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] daily transaction paged fetch failed:`, message);
    return { ok: false, error: message, rows: [], lastDoc: null, hasNext: false };
  }
};



// ─── Integrations (Drive, etc.) ───────────────────────────────────────────────

export const fetchTenantIntegrationConfig = async (tenantId) => {
  try {
    const snap = await getDoc(doc(db, 'tenants', tenantId, 'settings', 'integrations'));
    return { ok: true, data: snap.exists() ? snap.data() : null };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] integrations read failed tenants/${tenantId}/settings/integrations: ${message}`);
    return { ok: false, error: message, data: null };
  }
};

export const upsertTenantIntegrationConfig = async (tenantId, payload) => {
  try {
    await setDoc(
      doc(db, 'tenants', tenantId, 'settings', 'integrations'),
      { ...payload, updatedAt: serverTimestamp() },
      { merge: true },
    );
    return { ok: true };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[backendStore] integrations upsert failed tenants/${tenantId}/settings/integrations: ${message}`);
    return { ok: false, error: message };
  }
};

export const generateNextTransactionId = async (tenantId, ruleKey = 'DTID') => {
  try {
    // 1. Fetch customizable rules
    const settingsRes = await getTenantSettingDoc(tenantId, 'transactionIdRules');
    const fallbackPrefix = ruleKey === 'DTID' ? 'APP' : ruleKey;
    const normalizedRule = normalizeIdRule(
      settingsRes.ok && settingsRes.data ? settingsRes.data[ruleKey] || {} : {},
      fallbackPrefix,
    );
    const actualSeqKey = buildSequenceKey(ruleKey, normalizedRule);

    // Ensure sequence hasn't fallen behind manual start
    await ensureTransactionSequenceStart(tenantId, actualSeqKey, normalizedRule.sequenceStart);

    // 2. Fetch/Increment sequence
    const seq = await incrementTransactionSequence(tenantId, actualSeqKey);
    if (!seq) throw new Error('Failed to increment sequence.');

    // 3. Format output (unified)
    return formatDisplayId({
      prefix: normalizedRule.prefix,
      seq,
      padding: normalizedRule.padding,
      dateFormat: normalizedRule.dateEnabled ? normalizedRule.dateFormat : 'NONE',
      useSeparator: normalizedRule.useSeparator,
    });
  } catch (error) {
    console.warn(`[backendStore] next ID generation failed for ${ruleKey}:`, error);
    return `${ruleKey}_${Date.now()}`;
  }
};
