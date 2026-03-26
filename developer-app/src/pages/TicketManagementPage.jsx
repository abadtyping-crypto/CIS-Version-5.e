import React from 'react';
import { ProtectedLayout } from '../components/layout/ProtectedLayout';
import { Search, History, Filter, MessageCircle, AlertCircle, CheckCircle } from 'lucide-react';

export const TicketManagementPage = () => {
    // Dummy Data
    const tickets = [
        { id: 'TKT-1082', title: 'Payment Gateway Integration Issue', tenant: 'Speedex Documents', priority: 'High', status: 'Open', time: '2h ago' },
        { id: 'TKT-1081', title: 'Cannot login to Dashboard', tenant: 'Al Noor Clearance', priority: 'Critical', status: 'In Progress', time: '5h ago' },
        { id: 'TKT-1080', title: 'Update ID Rules format to 2026', tenant: 'Abad Typing Main', priority: 'Low', status: 'Closed', time: '1d ago' },
    ];

    const getStatusIcon = (status) => {
        if (status === 'Open') return <AlertCircle className="w-5 h-5 text-rose-500" />;
        if (status === 'Closed') return <CheckCircle className="w-5 h-5 text-emerald-500" />;
        return <History className="w-5 h-5 text-indigo-500" />;
    };

    const getPriorityColor = (prio) => {
        if (prio === 'Critical') return 'bg-rose-100 text-rose-700 border-rose-200';
        if (prio === 'High') return 'bg-amber-100 text-amber-700 border-amber-200';
        return 'bg-slate-100 text-slate-700 border-slate-200';
    };

    return (
        <ProtectedLayout>
            <div className="space-y-6">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-slate-200">
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight">Support Desk</h1>
                        <p className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest">Client Tickets & Issues</p>
                    </div>
                    <div className="flex gap-2">
                        <button className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-bold transition-all">
                            <Filter size={18} />
                            Filters
                        </button>
                    </div>
                </div>

                {/* Ticket List Layout */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

                    {/* Toolbar */}
                    <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search by Ticket ID or Title..."
                                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            />
                        </div>
                    </div>

                    {/* Tickets (List style for better scanning) */}
                    <div className="divide-y divide-slate-100">
                        {tickets.map(ticket => (
                            <div key={ticket.id} className="p-4 hover:bg-blue-50/50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 group cursor-pointer">

                                <div className="flex items-start gap-4 flex-1">
                                    <div className="mt-1">
                                        {getStatusIcon(ticket.status)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2 mb-1">
                                            <span className="text-xs font-black text-slate-400 tracking-widest">{ticket.id}</span>
                                            <span className={`text-[9px] uppercase font-black px-2 py-0.5 rounded border ${getPriorityColor(ticket.priority)}`}>
                                                {ticket.priority}
                                            </span>
                                        </div>
                                        <h3 className="font-bold text-slate-900 truncate">{ticket.title}</h3>
                                        <p className="text-sm text-slate-500 mt-1">{ticket.tenant}</p>
                                    </div>
                                </div>

                                {/* Right Side Actions/Time */}
                                <div className="flex items-center justify-between md:flex-col md:items-end md:justify-center gap-2 border-t border-slate-100 md:border-0 pt-3 md:pt-0">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{ticket.time}</p>
                                    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 text-xs font-bold transition-colors opacity-100 md:opacity-0 group-hover:opacity-100">
                                        <MessageCircle size={14} />
                                        Reply
                                    </button>
                                </div>

                            </div>
                        ))}
                    </div>

                    {/* Pagination / Footer Placeholder */}
                    <div className="p-4 border-t border-slate-100 bg-slate-50 text-center">
                        <p className="text-xs font-bold text-slate-400 tracking-widest uppercase">Showing 3 of 12 Open Tickets</p>
                    </div>

                </div>

            </div>
        </ProtectedLayout>
    );
};
