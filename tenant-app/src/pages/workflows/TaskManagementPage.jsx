import { useEffect, useState, useCallback } from 'react';
import { useTenant } from '../../context/useTenant';
import { fetchTasks, updateTask } from '../../lib/workflowStore';
import { resolveTaskStatus, getStatusBadgeStyle } from '../../lib/statusResolver';
import PageShell from '../../components/layout/PageShell';
import { CheckSquare, Calendar, Users, AlertCircle, XCircle } from 'lucide-react';
import CancellationModal from '../../components/workflows/CancellationModal';

const TaskManagementPage = () => {
  const { tenantId } = useTenant();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [deadlineEditId, setDeadlineEditId] = useState(null);
  const [deadlineValue, setDeadlineValue] = useState('');
  
  const [cancellationContext, setCancellationContext] = useState(null); // { type: 'task' | 'taskGroup', id: string, entityLabel: string }

  const loadTasks = useCallback(async () => {
    setLoading(true);
    const res = await fetchTasks(tenantId);
    if (res.ok) setTasks(res.rows);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    if (tenantId) {
        const timer = setTimeout(() => loadTasks(), 0);
        return () => clearTimeout(timer);
    }
  }, [tenantId, loadTasks]);

  const handleUpdateDeadline = async (taskId) => {
    if (!deadlineValue) return;
    await updateTask(tenantId, taskId, { deadline: deadlineValue });
    setDeadlineEditId(null);
    setDeadlineValue('');
    loadTasks();
  };

  const handleBulkCancelGroup = (taskGroupId) => {
    setCancellationContext({
       type: 'taskGroup',
       id: taskGroupId,
       entityLabel: `Task Group ${taskGroupId}`
    });
  };

  // Grouping tasks by proformaTaskGroupId
  const groupedTasks = tasks.reduce((acc, task) => {
     const g = task.proformaTaskGroupId || 'Standalone Tasks';
     if (!acc[g]) acc[g] = [];
     acc[g].push(task);
     return acc;
  }, {});

  return (
    <PageShell
      title="Task Management"
      iconKey="tasksTracking"
      widthPreset="data"
      actionSlot={
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--c-muted)]">
           {tasks.length} Active Tasks
        </p>
      }
    >
      <div className="flex flex-col gap-6 relative">
        {loading ? (
           <p className="text-center text-sm font-bold opacity-50 p-4">Loading tasks...</p>
        ) : Object.keys(groupedTasks).length === 0 ? (
           <div className="compact-card glass border border-[var(--c-border)] shadow-sm text-center py-10 opacity-60 flex flex-col items-center">
              <CheckSquare strokeWidth={1.5} size={40} className="mb-3 text-[var(--c-muted)]" />
              <p className="text-sm font-bold uppercase tracking-widest text-[var(--c-muted)]">No tasks found</p>
           </div>
        ) : (
           Object.entries(groupedTasks).map(([groupId, groupTasks]) => (
               <div key={groupId} className="flex flex-col gap-3">
                   {/* Group Header */}
                   <div className="flex items-center justify-between border-b-2 border-[var(--c-border)] pb-2 mb-2 ml-1">
                       <h3 className="text-sm font-black uppercase tracking-[0.15em] text-[var(--c-text)]">
                           {groupId}
                       </h3>
                       {groupId !== 'Standalone Tasks' && groupTasks.some(t => resolveTaskStatus(t) !== 'cancelled' && resolveTaskStatus(t) !== 'completed') && (
                           <button
                             onClick={() => handleBulkCancelGroup(groupId)}
                             className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--c-danger)] hover:bg-[var(--c-danger-soft)] px-2 py-1 rounded transition-colors"
                           >
                              <XCircle strokeWidth={2.5} size={14} /> Bulk Cancel Group
                           </button>
                       )}
                   </div>

                   {/* Tasks (Cards Layout instead of Tables) */}
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                       {groupTasks.map(task => {
                           const status = resolveTaskStatus(task);
                           const badgeStyle = getStatusBadgeStyle(status);
                           
                           return (
                               <div key={task.taskId} className="compact-card glass border border-[var(--c-border)] rounded-2xl p-4 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow bg-[var(--c-surface)]">
                                  <div className="flex items-start justify-between mb-3 border-b border-[var(--c-border)] pb-3">
                                      <div className="flex-1 min-w-0 pr-3">
                                          <div className="flex items-center gap-2 mb-1">
                                             <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${badgeStyle}`}>
                                                {status}
                                             </span>
                                          </div>
                                          <h4 className="font-bold text-base text-[var(--c-text)] line-clamp-1" title={task.applicationName}>{task.applicationName}</h4>
                                          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--c-muted)] mt-1">{task.clientId || 'Unknown Client'}</p>
                                      </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-3 mb-4">
                                      <div>
                                          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--c-muted)] mb-1">
                                             <AlertCircle strokeWidth={1.5} size={10} /> Amount
                                          </p>
                                          <p className="font-semibold text-sm">AED {Number(task.amount || 0).toLocaleString()}</p>
                                      </div>
                                      <div>
                                          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--c-muted)] mb-1">
                                             <Users strokeWidth={1.5} size={10} /> Assignee
                                          </p>
                                          <p className="font-semibold text-sm truncate">{task.assignedTo || 'Unassigned'}</p>
                                      </div>
                                  </div>

                                  <div className="bg-[color:color-mix(in_srgb,var(--c-panel)_80%,transparent)] -mx-4 -mb-4 px-4 py-3 rounded-b-2xl border-t border-[var(--c-border)] flex items-center justify-between">
                                      <div className="flex-1 min-w-0 pr-2">
                                         <p className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[var(--c-muted)] mb-0.5">
                                            <Calendar strokeWidth={1.5} size={10} /> Deadline
                                         </p>
                                         {deadlineEditId === task.taskId ? (
                                             <div className="flex items-center gap-2">
                                                <input 
                                                  type="date" 
                                                  className="text-xs bg-white border border-[var(--c-border)] rounded px-1 py-0.5 outline-none focus:border-[var(--c-accent)]"
                                                  value={deadlineValue}
                                                  onChange={e => setDeadlineValue(e.target.value)}
                                                />
                                                <div className="flex gap-1">
                                                   <button onClick={() => handleUpdateDeadline(task.taskId)} className="text-[var(--c-success)] font-bold text-[10px] uppercase">Save</button>
                                                   <button onClick={() => setDeadlineEditId(null)} className="text-[var(--c-muted)] font-bold text-[10px] uppercase">Cancel</button>
                                                </div>
                                             </div>
                                         ) : (
                                            <p 
                                              className="font-semibold text-xs text-[var(--c-accent)] cursor-pointer hover:underline hover:decoration-dashed" 
                                              onClick={() => {
                                                  if (status !== 'cancelled' && status !== 'completed') {
                                                      setDeadlineEditId(task.taskId);
                                                      setDeadlineValue(task.deadline || '');
                                                  }
                                              }}
                                              title="Click to override deadline"
                                              style={{ textDecorationThickness: '2px', textUnderlineOffset: '3px' }}
                                            >
                                               {task.deadline || 'No Deadline'}
                                            </p>
                                         )}
                                      </div>
                                      <p className="text-[9px] font-black uppercase tracking-[0.15em] text-[var(--c-muted)] opacity-50 border border-[var(--c-border)] px-1.5 py-0.5 rounded cursor-help" title={task.taskId}>
                                         {task.taskId.split('-').pop() || 'ID'}
                                      </p>
                                  </div>
                               </div>
                           );
                       })}
                   </div>
               </div>
           ))
        )}
      </div>

      {/* Cancellation Modal Hook */}
      {cancellationContext && (
         <CancellationModal
             entityType={cancellationContext.type}
             entityId={cancellationContext.id}
             entityLabel={cancellationContext.entityLabel}
             onClose={() => setCancellationContext(null)}
             onSuccess={() => {
                 setCancellationContext(null);
                 loadTasks();
             }}
         />
      )}
    </PageShell>
  );
};

export default TaskManagementPage;
