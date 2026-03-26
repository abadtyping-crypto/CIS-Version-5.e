import React, { useState } from 'react';
import { ProtectedLayout } from '../components/layout/ProtectedLayout';
import { Building2, Search, Plus, MoreVertical, Edit2, ShieldBan, X, Loader2 } from 'lucide-react';
import { registerNewTenant } from '../lib/tenantStore';

// Dummy Data
const tenants = [
    { id: 'tn_1', name: 'Abad Typing Main', type: 'Primary Company', users: 15, status: 'Active', joined: 'Oct 2025' },
    { id: 'tn_2', name: 'Speedex Documents', type: 'Affiliate', users: 3, status: 'Active', joined: 'Jan 2026' },
    { id: 'tn_3', name: 'Al Noor Clearance', type: 'Affiliate', users: 0, status: 'Suspended', joined: 'Nov 2025' },
];

const EMIRATES_LIST = ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah'];

export const TenantManagementPage = () => {
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    return (
        <ProtectedLayout>
            <div className="space-y-6">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-slate-200">
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight">Tenants</h1>
                        <p className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest">Manage Companies & Access</p>
                    </div>
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                    >
                        <Plus size={18} />
                        Register Tenant
                    </button>
                </div>

                {/* Filters / Search Bar */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by company name or ID..."
                            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                    </div>
                    <select className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-600 outline-none focus:border-blue-500 cursor-pointer appearance-none">
                        <option value="all">Status: All</option>
                        <option value="active">Active Only</option>
                        <option value="suspended">Suspended</option>
                    </select>
                </div>

                {/* Tenant List */}
                <div className="grid grid-cols-1 gap-4">
                    {tenants.map(tenant => (
                        <div key={tenant.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow flex flex-col sm:flex-row gap-4 sm:items-center justify-between group">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-50 transition-colors">
                                    <Building2 className="w-6 h-6 text-slate-500 group-hover:text-blue-500" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold text-slate-800 text-lg">{tenant.name}</h3>
                                        <span className={`px-2 py-0.5 rounded-md text-[10px] uppercase font-bold tracking-widest ${tenant.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                                            }`}>
                                            {tenant.status}
                                        </span>
                                    </div>
                                    <p className="text-xs font-medium text-slate-400 mt-0.5">{tenant.type} • ID: {tenant.id}</p>
                                </div>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-6 sm:gap-8 pt-4 sm:pt-0 border-t border-slate-100 sm:border-0">
                                <div className="text-left sm:text-right">
                                    <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Users / Seats</p>
                                    <p className="font-bold text-slate-700">{tenant.users} Active</p>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit Tenant">
                                        <Edit2 size={18} />
                                    </button>
                                    <button className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Suspend Tenant">
                                        <ShieldBan size={18} />
                                    </button>
                                    <button className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors">
                                        <MoreVertical size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Add Tenant Modal */}
            <AddTenantModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />
        </ProtectedLayout>
    );
};

const AddTenantModal = ({ isOpen, onClose }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successId, setSuccessId] = useState('');
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        // A. Core
        companyName: '', backendPath: '', licenseNumber: '', emirate: 'Dubai',
        // B. Context
        ownerName: '', emiratesId: '', phone: '', whatsapp: '', telegram: '', email: '', emergencyContact: '',
        // C. System
        tenantType: 'Trial Period', allowedUsers: 2
    });

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError('');

        try {
            const res = await registerNewTenant(formData);
            setSuccessId(res.uid);
        } catch (err) {
            setError(err.message || 'Error saving tenant to Database');
            setIsSubmitting(false);
        }
    };

    const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

    if (successId) {
        return (
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center space-y-4 shadow-2xl animate-in zoom-in duration-300">
                    <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                        <Building2 size={32} />
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">Tenant Initialized!</h2>
                    <p className="text-sm font-medium text-slate-500">
                        The tenant has been registered. Their unique Backend UI is:<br />
                        <span className="font-mono bg-slate-100 text-slate-900 p-2 rounded block mt-4 font-bold tracking-widest text-xs border border-slate-200">{successId}</span>
                    </p>
                    <button
                        onClick={() => { setSuccessId(''); onClose(); }}
                        className="w-full mt-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors"
                    >
                        Done
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-[2rem] max-w-2xl w-full shadow-2xl animate-in slide-in-from-bottom-8 duration-300 my-8 flex flex-col max-h-[90vh]">

                <div className="flex items-center justify-between p-6 border-b border-slate-100 flex-shrink-0">
                    <div>
                        <h2 className="text-xl font-black text-slate-800">Register New Tenant</h2>
                        <p className="text-xs uppercase font-bold tracking-widest text-slate-400">Step 1: Onboarding Basics</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                    <form id="add-tenant-form" onSubmit={handleSubmit} className="space-y-8">

                        {error && (
                            <div className="p-3 font-bold text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-xl">
                                {error}
                            </div>
                        )}

                        {/* Core Details */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-black text-slate-900 border-b border-slate-100 pb-2">A. Core Tenant Details</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Company Name</label>
                                    <input required name="companyName" value={formData.companyName} onChange={handleChange} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Backend URL Path</label>
                                    <input required name="backendPath" value={formData.backendPath} onChange={handleChange} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" placeholder="e.g. abad-main" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">License Number</label>
                                    <input required name="licenseNumber" value={formData.licenseNumber} onChange={handleChange} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Issued Emirate</label>
                                    <select name="emirate" value={formData.emirate} onChange={handleChange} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none">
                                        {EMIRATES_LIST.map(em => <option key={em} value={em}>{em}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Contact Details */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-black text-slate-900 border-b border-slate-100 pb-2">B. Owner/Contact Info</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Owner Name</label>
                                    <input required name="ownerName" value={formData.ownerName} onChange={handleChange} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Emirates ID</label>
                                    <input required name="emiratesId" value={formData.emiratesId} onChange={handleChange} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Mobile Phone (Login)</label>
                                    <input required name="phone" value={formData.phone} onChange={handleChange} type="tel" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">WhatsApp Number</label>
                                    <input required name="whatsapp" value={formData.whatsapp} onChange={handleChange} type="tel" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Telegram Number</label>
                                    <input name="telegram" value={formData.telegram} onChange={handleChange} type="tel" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Email Address</label>
                                    <input required name="email" value={formData.email} onChange={handleChange} type="email" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Emergency Alternative Context</label>
                                    <input name="emergencyContact" value={formData.emergencyContact} onChange={handleChange} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" />
                                </div>
                            </div>
                        </div>

                        {/* System Details */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-black text-slate-900 border-b border-slate-100 pb-2">C. System / Access Specs</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Tenant Plan Level</label>
                                    <select name="tenantType" value={formData.tenantType} onChange={handleChange} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none">
                                        <option value="Trial Period">Trial Period</option>
                                        <option value="Premium Silver">Premium Silver</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Allowed User Count</label>
                                    <select name="allowedUsers" value={formData.allowedUsers} onChange={handleChange} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none">
                                        <option value={1}>1 User</option>
                                        <option value={2}>2 Users</option>
                                        <option value={3}>3 Users</option>
                                        <option value={5}>5 Users</option>
                                    </select>
                                </div>
                            </div>
                            <p className="text-xs text-slate-500 italic">Advanced access control to limits and specific reads/writes are configured later depending on the role generated by this init.</p>
                        </div>
                    </form>
                </div>

                <div className="flex-shrink-0 p-6 border-t border-slate-100 bg-slate-50 rounded-b-[2rem]">
                    <button
                        type="submit"
                        form="add-tenant-form"
                        disabled={isSubmitting}
                        className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white flex justify-center items-center gap-2 rounded-xl font-bold transition-all active:scale-95 disabled:opacity-50"
                    >
                        {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus size={20} />}
                        {isSubmitting ? 'Generating UID & Saving...' : 'Initialize Tenant'}
                    </button>
                </div>

            </div>
        </div>
    );
};
