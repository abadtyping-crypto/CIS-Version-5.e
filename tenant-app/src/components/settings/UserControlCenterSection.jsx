import { useEffect, useState } from 'react';
import { useTenant } from '../../context/useTenant';
import { fetchTenantUsersMap } from '../../lib/backendStore';
import UserFunctionAccessSection from './UserFunctionAccessSection';

const UserControlCenterSection = () => {
  const { tenantId } = useTenant();
  const [decoratedUsers, setDecoratedUsers] = useState([]);
  const [selectedUid, setSelectedUid] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    fetchTenantUsersMap(tenantId).then((res) => {
      if (res.ok) {
        setDecoratedUsers(res.rows);
        if (res.rows.length > 0) setSelectedUid(res.rows[0].uid);
      }
      setIsLoading(false);
    });
  }, [tenantId]);

  const selectedUser = decoratedUsers.find((u) => u.uid === selectedUid);

  if (isLoading) return <p className="text-xs text-(--c-muted)">Loading users...</p>;

  return (
    <div className="space-y-6">
      {/* User Selection Row */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-(--c-muted)">Select Tenant User</p>
          <span className="text-[10px] font-bold text-(--c-accent) bg-(--c-accent)/10 px-2 py-0.5 rounded-full">
            {decoratedUsers.length} Total
          </span>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
          {decoratedUsers.map((u) => (
            <button
              key={u.uid}
              type="button"
              onClick={() => setSelectedUid(u.uid)}
              className={`flex min-w-[180px] max-w-[220px] items-center gap-3 rounded-2xl border p-3 transition text-left ${selectedUid === u.uid
                ? 'border-(--c-accent) bg-(--c-accent)/5 shadow-sm'
                : 'border-(--c-border) bg-(--c-panel) hover:border-(--c-muted)'
                }`}
            >
              <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl font-bold transition ${selectedUid === u.uid ? 'bg-(--c-accent) text-white' : 'bg-(--c-surface) text-(--c-text)'
                }`}>
                {String(u.displayName || u.email || '?').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-bold truncate ${selectedUid === u.uid ? 'text-(--c-accent)' : 'text-(--c-text)'}`}>
                  {u.displayName || 'Unnamed'}
                </p>
                <p className="text-[10px] uppercase font-bold text-(--c-muted)">
                  {u.role || 'Staff'}
                </p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Content Area */}
      {selectedUser ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between rounded-2xl border border-(--c-border) bg-(--c-surface) p-2 shadow-sm">
            <div className="rounded-xl bg-(--c-accent) px-5 py-2.5 text-xs font-bold text-white shadow-md">
              Function Access
            </div>
            <div className="hidden pr-4 sm:flex flex-col items-end">
              <p className="text-sm font-bold text-(--c-text)">{selectedUser.displayName}</p>
              <p className="text-[10px] uppercase font-bold text-(--c-muted)">{selectedUser.email || selectedUser.role}</p>
            </div>
          </div>

          <div className="grid gap-6">
            <UserFunctionAccessSection tenantId={tenantId} selectedUser={selectedUser} />
          </div>
        </div>
      ) : (
        <div className="flex h-64 items-center justify-center rounded-3xl border-2 border-dashed border-(--c-border) bg-(--c-panel)/30">
          <div className="text-center">
            <p className="text-sm font-bold text-(--c-muted)">No User Selected</p>
            <p className="text-xs text-(--c-muted)/60">Choose a user from the row above to manage preferences</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserControlCenterSection;
