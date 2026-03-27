import { useEffect, useMemo, useState } from 'react';
import PageShell from '../components/layout/PageShell';
import { useTenant } from '../context/useTenant';
import { useAuth } from '../context/useAuth';
import { List, Users } from 'lucide-react';
import { ClientOnboardingIcon } from '../components/icons/AppIcons';
import CompanyRegistrationForm from '../components/onboarding/CompanyRegistrationForm';
import IndividualRegistrationForm from '../components/onboarding/IndividualRegistrationForm';
import DependentRegistrationForm from '../components/onboarding/DependentRegistrationForm';
import ClientLiveListSection from '../components/onboarding/ClientLiveListSection';
import useIsDesktopLayout from '../hooks/useIsDesktopLayout';
import { canUserPerformAction } from '../lib/userControlPreferences';
import { getCachedSystemAssetsSnapshot, getSystemAssets } from '../lib/systemAssetsCache';


const ClientsOnboardingPage = () => {
    const { tenantId } = useTenant();
    const { user } = useAuth();
    const isDesktop = useIsDesktopLayout();
    const canCreateClient = canUserPerformAction(tenantId, user, 'createClient');
    const [activeType, setActiveType] = useState(null); // 'company', 'individual', 'dependent'
    const [mobileView, setMobileView] = useState('actions'); // actions | list | company | individual | dependent
    const [flash, setFlash] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);

    const [systemAssets, setSystemAssets] = useState(() => getCachedSystemAssetsSnapshot());


    useEffect(() => {
        if (!flash) return undefined;
        const timer = setTimeout(() => setFlash(null), 15000);
        return () => clearTimeout(timer);
    }, [flash]);

    useEffect(() => {
        getSystemAssets().then(setSystemAssets).catch(() => { });
    }, []);

    const handleSuccess = (created) => {
        setActiveType(null);
        setMobileView('actions');
        setRefreshKey((prev) => prev + 1);
        setFlash({
            message: `Created ${created?.displayClientId || 'new entry'} successfully.`,
            detail: `${created?.tradeName || created?.fullName || 'Client'} • ${String(created?.type || '').toUpperCase()}`,
        });
    };

    const onboardingTypeConfig = useMemo(() => ([
        { id: 'company', label: 'Company', iconId: 'icon_main_company', fallbackIcon: '/company.png' },
        { id: 'individual', label: 'Individual', iconId: 'icon_main_individual', fallbackIcon: '/individual.png' },
        { id: 'dependent', label: 'Dependent', iconId: 'icon_main_dependents', fallbackIcon: '/dependent.png' }
    ].map((item) => ({
        ...item,
        icon: systemAssets[item.iconId]?.iconUrl || item.fallbackIcon,
    }))), [systemAssets]);

    const renderFormByType = (typeId, onCancel) => (
        <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4 shadow-sm sm:p-6">
            {typeId === 'company' ? (
                <CompanyRegistrationForm
                    activeType={typeId}
                    tenantId={tenantId}
                    user={user}
                    onCancel={onCancel}
                    onSuccess={handleSuccess}
                />
            ) : null}
            {typeId === 'individual' ? (
                <IndividualRegistrationForm
                    activeType={typeId}
                    tenantId={tenantId}
                    user={user}
                    onCancel={onCancel}
                    onSuccess={handleSuccess}
                />
            ) : null}
            {typeId === 'dependent' ? (
                <DependentRegistrationForm
                    activeType={typeId}
                    tenantId={tenantId}
                    user={user}
                    onCancel={onCancel}
                    onSuccess={handleSuccess}
                />
            ) : null}
        </div>
    );

    if (!isDesktop) {
        const currentFormType = mobileView === 'company' || mobileView === 'individual' || mobileView === 'dependent' ? mobileView : '';
        return (
            <PageShell
                title="Client Onboarding"
                subtitle="Mobile quick actions for registration and live client list."
                iconKey="clientOnboarding"
                widthPreset="data"
            >
                <div className="w-full space-y-4 pb-20">
                    {flash ? (
                        <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-800 shadow-sm">
                            <p className="font-bold">{flash.message}</p>
                            <p className="mt-0.5 text-xs">{flash.detail}</p>
                        </div>
                    ) : null}

                    {mobileView === 'actions' ? (
                        <section className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4 shadow-sm">
                            <div className="grid gap-3">
                                {onboardingTypeConfig.map((type) => (
                                    <button
                                        key={type.id}
                                        type="button"
                                        onClick={() => canCreateClient && setMobileView(type.id)}
                                        disabled={!canCreateClient}
                                        className="flex h-14 items-center gap-3 rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)] px-4 text-left hover:border-[var(--c-accent)] disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#F8F9FA] shadow-sm">
                                            <img src={type.icon} alt={type.label} className="h-full w-full object-cover" />
                                        </div>
                                        <span className="text-sm font-bold text-[var(--c-text)]">{type.label}</span>
                                    </button>
                                ))}
                                <button
                                    type="button"
                                    onClick={() => setMobileView('list')}
                                    className="mt-1 flex h-14 items-center gap-3 rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)] px-4 text-left hover:border-[var(--c-accent)]"
                                >
                                    <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--c-surface)]">
                                        <Users strokeWidth={1.5} className="h-4.5 w-4.5 text-[var(--c-accent)]" />
                                    </div>
                                    <span className="text-sm font-bold text-[var(--c-text)]">Live Client List</span>
                                </button>
                            </div>
                        </section>
                    ) : null}

                    {mobileView === 'list' ? (
                        <div className="space-y-3">
                            <button
                                type="button"
                                onClick={() => setMobileView('actions')}
                                className="inline-flex items-center gap-2 rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2 text-xs font-bold text-[var(--c-text)]"
                            >
                                <List strokeWidth={1.5} className="h-4 w-4" />
                                Back to Actions
                            </button>
                            <ClientLiveListSection
                                tenantId={tenantId}
                                user={user}
                                refreshKey={refreshKey}
                            />
                        </div>
                    ) : null}

                    {currentFormType ? (
                        <div className="space-y-3">
                            <button
                                type="button"
                                onClick={() => setMobileView('actions')}
                                className="inline-flex items-center gap-2 rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2 text-xs font-bold text-[var(--c-text)]"
                            >
                                <List strokeWidth={1.5} className="h-4 w-4" />
                                Back to Actions
                            </button>
                            {renderFormByType(currentFormType, () => setMobileView('actions'))}
                        </div>
                    ) : null}
                </div>
            </PageShell>
        );
    }

    return (
        <PageShell
            title="Clients Onboarding"
            subtitle="Register new companies, individuals, or dependents and track registration status live."
            iconKey="clientOnboarding"
            eyebrow="Onboarding"
            widthPreset="data"
        >
            <div className="w-full space-y-4 pb-12">
                {flash ? (
                    <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-800 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="font-bold">{flash.message}</p>
                                <p className="mt-0.5 text-xs">{flash.detail}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setFlash(null)}
                                className="rounded-lg border border-emerald-300 px-2 py-1 text-xs font-bold hover:bg-emerald-100"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                ) : null}

                {!activeType ? (
                    <>
                        <section className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4 shadow-sm">
                            <h2 className="text-base font-bold text-[var(--c-text)]">Client Registration</h2>
                            <p className="text-sm text-[var(--c-muted)]">Select a client type to begin the onboarding process.</p>
                            {!canCreateClient ? (
                                <p className="mt-3 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                                    You do not have permission to create clients.
                                </p>
                            ) : null}

                            <div className="mt-4 flex flex-wrap gap-3">
                                {onboardingTypeConfig.map(type => (
                                    <button
                                        key={type.id}
                                        onClick={() => canCreateClient && setActiveType(type.id)}
                                        disabled={!canCreateClient}
                                        className="group flex h-14 items-center gap-3 rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)] px-4 transition hover:border-[var(--c-accent)] hover:bg-[var(--c-accent)]/5 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <div className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#F8F9FA] ring-1 ring-slate-200/80">
                                            <img src={type.icon} alt={type.label} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                                        </div>
                                        <span className="text-sm font-bold text-[var(--c-text)]">{type.label}</span>
                                    </button>
                                ))}
                            </div>
                        </section>


                        <ClientLiveListSection
                            tenantId={tenantId}
                            user={user}
                            refreshKey={refreshKey}
                        />
                    </>
                ) : (
                    <div className="space-y-6">
                        <button
                            onClick={() => setActiveType(null)}
                            className="flex items-center gap-2 text-xs font-bold text-[var(--c-muted)] hover:text-[var(--c-accent)] transition"
                        >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                            </svg>
                            Back to Selection
                        </button>

                        {renderFormByType(activeType, () => setActiveType(null))}
                    </div>
                )}
            </div>

        </PageShell>

    );
};

export default ClientsOnboardingPage;
