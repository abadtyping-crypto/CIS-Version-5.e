import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, markTenantNotificationActionTaken, markTenantNotificationRead } from '../lib/backendStore';
import { canUserPerformAction } from '../lib/userControlPreferences';
import { fetchGlobalPortalLogoMap } from '../lib/portalLogoLibraryStore';

const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const toArray = (value) => (Array.isArray(value) ? value : []);

const isAudienceMatch = (notification, user) => {
  if (!user?.uid) return false;
  const uid = String(user.uid || '').trim();
  const role = String(user.role || '').trim().toLowerCase();
  const targetUsers = toArray(notification?.targetUsers).map((item) => String(item || '').trim());
  const excludedUsers = toArray(notification?.excludedUsers).map((item) => String(item || '').trim());
  const targetRoles = toArray(notification?.targetRoles).map((item) => String(item || '').trim().toLowerCase());

  if (excludedUsers.includes(uid)) return false;
  if (!targetUsers.length && !targetRoles.length) return true;
  if (targetUsers.includes(uid)) return true;
  if (role && targetRoles.includes(role)) return true;
  return false;
};

const isEventAllowedForUser = (tenantId, notification, user) => {
  const eventKey = String(notification?.eventKey || '').trim();
  if (!eventKey) return true;
  if (eventKey === 'softDeleteTransaction') {
    return canUserPerformAction(tenantId, user, 'softDeleteTransaction');
  }
  if (eventKey === 'hardDeleteTransaction') {
    return canUserPerformAction(tenantId, user, 'hardDeleteTransaction');
  }
  if (eventKey === 'negativeClientBalance') {
    return canUserPerformAction(tenantId, user, 'softDeleteTransaction');
  }
  return true;
};

const isReadForUser = (notification, uid) => {
  if (!uid) return false;
  const readByUidMap = notification?.readByUid;
  if (readByUidMap && typeof readByUidMap === 'object' && readByUidMap[uid]) return true;

  const readArrays = [
    notification?.readBy,
    notification?.readByUids,
    notification?.readUsers,
    notification?.readByUserIds,
  ];
  if (readArrays.some((list) => toArray(list).includes(uid))) return true;

  return notification?.read === true;
};

export const useTenantNotifications = (tenantId, user) => {
  const [rows, setRows] = useState([]);
  const [usersByUid, setUsersByUid] = useState({});
  const [portalsById, setPortalsById] = useState({});
  const [globalPortalLogosById, setGlobalPortalLogosById] = useState({});

  useEffect(() => {
    if (!tenantId) return () => {};

    const unsubscribe = onSnapshot(
      collection(db, 'tenants', tenantId, 'notifications'),
      (snap) => {
        const nextRows = snap.docs
          .map((item) => ({ id: item.id, ...item.data() }))
          .filter((item) => !item.deletedAt)
          .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
        setRows(nextRows);
      },
      () => {
        setRows([]);
      },
    );

    return unsubscribe;
  }, [tenantId]);

  useEffect(() => {
    let active = true;

    fetchGlobalPortalLogoMap()
      .then((res) => {
        if (!active) return;
        if (!res?.ok) {
          setGlobalPortalLogosById({});
          return;
        }
        setGlobalPortalLogosById(res.map || {});
      })
      .catch(() => {
        if (!active) return;
        setGlobalPortalLogosById({});
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!tenantId) return () => {};

    const unsubscribe = onSnapshot(
      collection(db, 'tenants', tenantId, 'portals'),
      (snap) => {
        const next = {};
        snap.docs.forEach((item) => {
          next[item.id] = item.data() || {};
        });
        setPortalsById(next);
      },
      () => setPortalsById({}),
    );

    return unsubscribe;
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return () => {};

    const unsubscribe = onSnapshot(
      collection(db, 'tenants', tenantId, 'users'),
      (snap) => {
        const next = {};
        snap.docs.forEach((item) => {
          next[item.id] = item.data() || {};
        });
        setUsersByUid(next);
      },
      () => setUsersByUid({}),
    );

    return unsubscribe;
  }, [tenantId]);

  const filteredRows = useMemo(() => {
    return rows
      .filter((item) => isAudienceMatch(item, user))
      .filter((item) => isEventAllowedForUser(tenantId, item, user))
      .map((item) => {
        const creatorUid = String(item?.createdBy || '');
        const creator = usersByUid[creatorUid] || {};
        const entityId = String(item?.entityId || '');
        const entityType = String(item?.entityType || '');
        const portal = entityType === 'portal' ? (portalsById[entityId] || null) : null;
        const portalLogoId = portal ? String(portal.portalLogoId || '').trim() : '';
        const universalPortalLogoUrl = portalLogoId
          ? String(globalPortalLogosById?.[portalLogoId]?.logoUrl || '').trim()
          : '';
        const resolvedPortalIconUrl = portal
          ? String(portal.logoUrl || universalPortalLogoUrl || portal.iconUrl || '').trim()
          : '';
        const actionTakenBy = String(item?.actionTakenBy || '').trim();
        const actionByUser = actionTakenBy ? (usersByUid[actionTakenBy] || {}) : null;
        const uid = String(user?.uid || '');
        return {
          ...item,
          isRead: isReadForUser(item, uid),
          createdByUser: {
            uid: creatorUid,
            displayName: creator.displayName || creator.name || creator.email || 'Unknown user',
            photoURL: creator.photoURL || '',
          },
          actionTakenByUser: actionTakenBy ? {
            uid: actionTakenBy,
            displayName: actionByUser?.displayName || actionByUser?.name || actionByUser?.email || actionTakenBy,
            photoURL: actionByUser?.photoURL || '',
          } : null,
          entityMeta: portal ? {
            iconUrl: resolvedPortalIconUrl,
            logoId: portalLogoId,
            name: portal.name || entityId,
            balance: Number(portal.balance || 0),
            balanceType: String(portal.balanceType || (Number(portal.balance || 0) < 0 ? 'negative' : 'positive')),
          } : null,
        };
      });
  }, [rows, tenantId, user, usersByUid, portalsById, globalPortalLogosById]);

  const unreadCount = useMemo(() => {
    return filteredRows.reduce((count, item) => count + (item.isRead ? 0 : 1), 0);
  }, [filteredRows]);

  const recentNotifications = useMemo(() => filteredRows.slice(0, 10), [filteredRows]);

  const markAsRead = useCallback(async (notificationId) => {
    const uid = String(user?.uid || '');
    if (!tenantId || !notificationId || !uid) return { ok: false, error: 'Missing notification read context.' };
    return markTenantNotificationRead(tenantId, notificationId, uid);
  }, [tenantId, user]);

  const markActionTaken = useCallback(async (notificationId, action) => {
    const uid = String(user?.uid || '');
    if (!tenantId || !notificationId || !uid) return { ok: false, error: 'Missing notification action context.' };
    return markTenantNotificationActionTaken(tenantId, notificationId, uid, action);
  }, [tenantId, user]);

  return {
    notifications: filteredRows,
    recentNotifications,
    unreadCount,
    markAsRead,
    markActionTaken,
    isLoading: false,
  };
};
