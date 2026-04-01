import React, { useEffect, useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { Mail, Phone, MapPin, Globe, ArrowRight, Lock, UserCheck, MessageCircle } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { signInWithGoogle, checkDeveloperAccess, auth, db } from './lib/firebase';
import { DashboardPage } from './pages/DashboardPage';
import { TenantManagementPage } from './pages/TenantManagementPage';
import { TicketManagementPage } from './pages/TicketManagementPage';
import { ApplicationLibraryPage } from './pages/ApplicationLibraryPage';
import { PlatformSettingsPage } from './pages/PlatformSettingsPage';
import { InstructionsLibraryPage } from './pages/InstructionsLibraryPage';
import { HeaderControlCenterPage } from './pages/HeaderControlCenterPageImpl';
import { ElectronMain } from './layouts/ElectronMain';
import { TenantApplicationLibrary } from './pages/TenantApplicationLibrary';
import DownloadPage from './pages/DownloadPage';
import { normalizePublicSiteConfig, PUBLIC_SITE_CONFIG_DOC, PUBLIC_SITE_DEFAULTS } from './lib/publicSiteConfig';

const LandingPage = () => {
    const navigate = useNavigate();
    const [siteConfig, setSiteConfig] = useState(PUBLIC_SITE_DEFAULTS);

    useEffect(() => {
        const loadPublicSiteConfig = async () => {
            try {
                const snap = await getDoc(doc(db, PUBLIC_SITE_CONFIG_DOC.collection, PUBLIC_SITE_CONFIG_DOC.id));
                if (snap.exists()) {
                    setSiteConfig(normalizePublicSiteConfig(snap.data()));
                }
            } catch {
                // Keep defaults if config load fails
            }
        };
        loadPublicSiteConfig();
    }, []);

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-200">
            {/* Navbar Minimalist */}
            <nav className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-10 max-w-7xl mx-auto">
                <button
                    onClick={() => navigate('/login')}
                    className="group flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200 bg-white/50 backdrop-blur-md hover:bg-white hover:shadow-sm transition-all text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-blue-600"
                >
                    <Lock className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                    Developer Portal
                </button>
            </nav>

            {/* Hero Section */}
            <main className="relative flex flex-col items-center justify-center min-h-screen px-4 overflow-hidden pt-20">

                {/* Background decorations */}
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-100 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob"></div>
                <div className="absolute top-[20%] right-[-10%] w-[35%] h-[40%] bg-teal-100 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-2000"></div>

                <div className="text-center relative z-10 max-w-3xl mx-auto space-y-8 flex flex-col items-center">

                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-[10px] font-black uppercase tracking-widest mb-4">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
                        </span>
                        {siteConfig.badgeText}
                    </div>

                    <h1 className="text-5xl md:text-7xl font-black tracking-tight text-slate-900 leading-tight">
                        {siteConfig.heroTitleLine1} <br className="hidden md:block" />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-teal-500">
                            {siteConfig.heroTitleLine2}
                        </span>
                    </h1>

                    <p className="text-slate-500 max-w-xl mx-auto text-lg leading-relaxed">
                        {siteConfig.heroDescription}
                    </p>

                    <div className="flex flex-wrap justify-center gap-4 pt-4">
                        <a href={siteConfig.whatsappUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-slate-900 text-white font-bold text-sm shadow-xl shadow-slate-900/20 hover:scale-105 transition-all">
                            <MessageCircle className="w-4 h-4" />
                            Contact via WhatsApp
                        </a>
                        <a href={siteConfig.websiteUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-white text-slate-900 font-bold text-sm border border-slate-200 shadow-sm hover:border-blue-200 hover:bg-blue-50 transition-all">
                            <Globe className="w-4 h-4 text-blue-600" />
                            Visit Website
                        </a>
                    </div>

                </div>

                {/* Contact Info Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-8 max-w-5xl mx-auto mt-24 mb-12 relative z-10 w-full px-4">

                    <div className="p-6 rounded-3xl bg-white border border-slate-100 shadow-sm flex flex-col items-center text-center space-y-3 group hover:-translate-y-1 transition-transform">
                        <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                            <Phone className="w-5 h-5 text-blue-600" />
                        </div>
                        <h3 className="font-bold text-slate-900 text-sm uppercase tracking-widest">Connect</h3>
                        <p className="text-slate-500 font-medium">{siteConfig.contactPhone}</p>
                    </div>

                    <div className="p-6 rounded-3xl bg-white border border-slate-100 shadow-sm flex flex-col items-center text-center space-y-3 group hover:-translate-y-1 transition-transform">
                        <div className="w-12 h-12 rounded-2xl bg-teal-50 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                            <Mail className="w-5 h-5 text-teal-600" />
                        </div>
                        <h3 className="font-bold text-slate-900 text-sm uppercase tracking-widest">General Enquiries</h3>
                        <p className="text-slate-500 font-medium">{siteConfig.contactEmail}</p>
                    </div>

                    <a href={siteConfig.mapUrl} target="_blank" rel="noreferrer" className="p-6 rounded-3xl bg-white border border-slate-100 shadow-sm flex flex-col items-center text-center space-y-3 group hover:-translate-y-1 transition-transform cursor-pointer">
                        <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                            <MapPin className="w-5 h-5 text-amber-600" />
                        </div>
                        <h3 className="font-bold text-slate-900 text-sm uppercase tracking-widest">Business Address</h3>
                        <p className="text-slate-500 font-medium text-sm leading-relaxed">
                            {siteConfig.addressLine1}
                            {siteConfig.addressLine2 ? <><br />{siteConfig.addressLine2}</> : null}
                        </p>
                    </a>

                </div>

                {/* Social Links Footer */}
                <div className="text-center pb-8 pt-8 space-x-6">
                    <a href={siteConfig.facebookUrl} target="_blank" rel="noreferrer" className="text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-blue-600 transition-colors">Facebook</a>
                    <a href={siteConfig.instagramUrl} target="_blank" rel="noreferrer" className="text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-pink-600 transition-colors">Instagram</a>
                </div>

            </main>
        </div>
    );
};

const LoginPage = () => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [statusText, setStatusText] = useState('');
    const [error, setError] = useState('');

    const handleGoogleLogin = async () => {
        setIsLoading(true);
        setError('');
        setStatusText('Waiting for Google Login...');
        try {
            const user = await signInWithGoogle();
            console.log("Logged in user:", user.uid);

            setStatusText('Verifying Developer Clearance...');
            const access = await checkDeveloperAccess(user.uid);

            if (access.granted) {
                setStatusText('Access Granted. Redirecting...');
                localStorage.setItem('acisDevUser', JSON.stringify(access.data));
                navigate('/dashboard');
            } else {
                await auth.signOut();
                setError(access.reason || 'Access denied.');
            }
        } catch (err) {
            setError(err.message || 'Authentication failed. Please try again.');
        } finally {
            setIsLoading(false);
            setStatusText('');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans">
            <div className="w-full max-w-md p-8 md:p-12 bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 text-center space-y-8 animate-in fade-in zoom-in-95 duration-500 relative overflow-hidden">

                {isLoading && (
                    <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-10 flex flex-col items-center justify-center space-y-4">
                        <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
                        <p className="text-sm font-bold text-slate-600 uppercase tracking-widest animate-pulse">{statusText}</p>
                    </div>
                )}

                <div className="mx-auto w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-2">
                    <UserCheck className="w-8 h-8 text-blue-600" />
                </div>

                <div className="space-y-2">
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Developer Portal</h2>
                    <p className="text-sm font-medium text-slate-500">Secure access for Abad System Developers.</p>
                </div>

                {error && (
                    <div className="p-4 text-xs font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-2xl leading-relaxed">
                        ⚠️ Security Alert: {error}
                    </div>
                )}

                <button
                    onClick={handleGoogleLogin}
                    disabled={isLoading}
                    className="w-full relative flex items-center justify-center gap-3 px-6 py-4 bg-white border-2 border-slate-100 rounded-2xl font-bold text-slate-700 hover:border-blue-200 hover:bg-blue-50 transition-all focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:opacity-50"
                >
                    <svg className="w-5 h-5 absolute left-6" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /><path fill="none" d="M1 1h22v22H1z" /></svg>
                    <span className="ml-4 tracking-wide font-black">Continue with Google</span>
                </button>

                <div className="pt-4">
                    <button onClick={() => navigate('/')} className="text-xs font-bold text-slate-400 hover:text-slate-600 flex items-center justify-center gap-1 mx-auto group">
                        <ArrowRight className="w-3 h-3 rotate-180 group-hover:-translate-x-1 transition-transform" />
                        Back to Home
                    </button>
                </div>
            </div>
        </div>
    );
};

function App() {
    return (
        <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dl/:fileId" element={<DownloadPage />} />
            
            {/* Developer Shell with Tenant Prefix */}
            <Route path="/t/:tenantId" element={<ElectronMain />}>
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="apps" element={<TenantApplicationLibrary />} />
                <Route path="settings" element={<HeaderControlCenterPage />} />
            </Route>

            {/* Legacy / Direct Routes */}
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/tenants" element={<TenantManagementPage />} />
            <Route path="/tickets" element={<TicketManagementPage />} />
            <Route path="/libraries" element={<ApplicationLibraryPage />} />
            <Route path="/portal-logo-library" element={<ApplicationLibraryPage defaultTab="portal_logo_library" />} />
            <Route path="/instructions-library" element={<InstructionsLibraryPage />} />
            <Route path="/header-control-center" element={<HeaderControlCenterPage />} />
            <Route path="/platform-settings" element={<PlatformSettingsPage />} />
        </Routes>
    );
}

export default App;
