import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Settings,
  Building2,
  FileText,
  LayoutTemplate,
  Library,
  Users,
  ShieldAlert,
  Mail,
  Mailbox,
  Hash,
  HardDrive,
  MessageSquare,
  Globe,
} from 'lucide-react';
import PageShell from '../components/layout/PageShell';
import BrandDetailsSection from '../components/settings/BrandDetailsSection';
import UserControlCenterSection from '../components/settings/UserControlCenterSection';
import UserCustomizationSection from '../components/settings/UserCustomizationSection';
import IDRulesSection from '../components/settings/IDRulesSection';
import PdfMasterStudioSection from '../components/settings/PdfMasterStudioSection';
import ApplicationIconLibrarySection from '../components/settings/ApplicationIconLibrarySection';
import MailConfigurationSection from '../components/settings/MailConfigurationSection';
import ServiceTemplateSection from '../components/settings/ServiceTemplateSection';
import EmailTemplateSection from '../components/settings/EmailTemplateSection';
import FileManagerSection from '../components/settings/FileManagerSection';
import WhatsAppConfigurationSection from '../components/settings/WhatsAppConfigurationSection';
import { useTenant } from '../context/useTenant';
import useIsDesktopLayout from '../hooks/useIsDesktopLayout';

const SETTINGS_SECTIONS = [
  { key: 'brand', label: 'Brand Details', icon: Building2 },
  { key: 'pdfStudio', label: 'PDF Master Studio', icon: FileText },
  { key: 'svcTemplates', label: 'Application Templates', icon: LayoutTemplate },
  { key: 'appIconLibrary', label: 'Applications Icon Library', icon: Library },
  { key: 'users', label: 'User Management', icon: Users },
  { key: 'control', label: 'User Control Center', icon: ShieldAlert },
  { key: 'mail', label: 'Mail Configuration', icon: Mail },
  { key: 'mailTemplates', label: 'Email Templates', icon: Mailbox },
  { key: 'counters', label: 'ID Rules & Counters', icon: Hash },
  { key: 'whatsapp', label: 'WhatsApp Settings', icon: MessageSquare },
  { key: 'fileManager', label: 'File Manager', icon: HardDrive },
];

const TAB_ALIAS_MAP = {
  services: 'svcTemplates',
  serviceTemplates: 'svcTemplates',
  svcTemplates: 'svcTemplates',
  applicationTemplates: 'svcTemplates',
  appIcons: 'appIconLibrary',
  appIconLibrary: 'appIconLibrary',
  idRules: 'counters',
  counters: 'counters',
};

const MOBILE_SETTINGS_SECTIONS = [
  { key: 'control', label: 'User Control Center' },
  { key: 'appIconLibrary', label: 'Applications Icon Library' },
  { key: 'brand', label: 'Brand Details' },
  { key: 'pdfStudio', label: 'PDF Master Studio' },
];

const SettingsPage = () => {
  const { tenant } = useTenant();
  const isDesktop = useIsDesktopLayout();
  const [isNavExpanded, setIsNavExpanded] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeSection = useMemo(() => {
    const requestedTab = searchParams.get('tab');
    if (!requestedTab) return 'brand';
    const nextSection = TAB_ALIAS_MAP[requestedTab] || requestedTab;
    return SETTINGS_SECTIONS.some((s) => s.key === nextSection) ? nextSection : 'brand';
  }, [searchParams]);

  const handleSectionChange = (sectionKey) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', sectionKey);
      return next;
    });
  };

  const sectionContent = useMemo(() => {
    if (!isDesktop) {
      if (activeSection === 'appIconLibrary') return <ApplicationIconLibrarySection />;
      if (activeSection === 'brand') return <BrandDetailsSection />;
      if (activeSection === 'pdfStudio') return <PdfMasterStudioSection />;
      return <UserControlCenterSection />;
    }
    if (activeSection === 'brand') return <BrandDetailsSection />;
    if (activeSection === 'pdfStudio') return <PdfMasterStudioSection />;
    if (activeSection === 'svcTemplates') return <ServiceTemplateSection />;
    if (activeSection === 'appIconLibrary') return <ApplicationIconLibrarySection />;
    if (activeSection === 'users') return <UserCustomizationSection />;
    if (activeSection === 'control') return <UserControlCenterSection />;
    if (activeSection === 'mail') return <MailConfigurationSection />;
    if (activeSection === 'mailTemplates') return <EmailTemplateSection />;
    if (activeSection === 'counters') return <IDRulesSection />;
    if (activeSection === 'fileManager') return <FileManagerSection />;
    if (activeSection === 'whatsapp') return <WhatsAppConfigurationSection />;
    return <BrandDetailsSection />;
  }, [activeSection, isDesktop]);

  return (
    <div className="settings-flat-ui">
      <PageShell
        title={`${tenant.name} Settings`}
        subtitle={isDesktop
          ? `Tenant-scoped configuration for branding, preferences, and operations. Currency: ${tenant.currency}`
          : 'Mobile access: User control and icon library customization.'}
        iconKey="settings"
        widthPreset="full"
      >
        {!isDesktop ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-(--c-muted)">
                Mobile Section
                <select
                  value={activeSection === 'appIconLibrary' ? 'appIconLibrary' : 'control'}
                  onChange={(event) => handleSectionChange(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-(--c-border) bg-(--c-panel) px-3 py-2 text-sm text-(--c-text) outline-none ring-1 ring-(--c-border)"
                >
                  {MOBILE_SETTINGS_SECTIONS.map((section) => (
                    <option key={section.key} value={section.key}>
                      {section.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="rounded-2xl border border-(--c-border) bg-(--c-surface) p-4">
              {sectionContent}
            </div>
          </div>
        ) : (
        <div className="grid min-h-0 xl:grid-cols-[auto_1fr] sm:gap-4 overflow-visible">
          <aside 
            onMouseEnter={() => setIsNavExpanded(true)}
            onMouseLeave={() => setIsNavExpanded(false)}
            className={`sticky top-3 z-20 hidden h-fit rounded-2xl border border-(--c-border) bg-(--c-surface) p-1.5 shadow-sm transition-all duration-300 ease-in-out xl:block ${isNavExpanded ? 'w-[232px]' : 'w-[58px]'}`}
          >
            <div className={`mb-2 flex py-1 ${isNavExpanded ? 'items-center gap-3 px-3' : 'justify-center px-0'}`}>
              <div className={`relative flex shrink-0 items-center justify-center rounded-xl ${isNavExpanded ? 'h-8 w-8 bg-(--c-accent)/10' : 'h-10 w-10 bg-(--c-accent)/12 ring-1 ring-(--c-accent)/15'}`}>
                <Settings strokeWidth={2} className={`${isNavExpanded ? 'h-4 w-4' : 'h-5.5 w-5.5'} text-(--c-accent)`} />
                {!isNavExpanded ? (
                  <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-(--c-accent)" />
                ) : null}
              </div>
              <p className={`text-[10px] font-semibold uppercase tracking-[0.12em] text-(--c-muted) transition-all duration-300 whitespace-nowrap overflow-hidden ${isNavExpanded ? 'opacity-100' : 'opacity-0'}`}>
                Settings
              </p>
            </div>
            <div className="grid gap-1">
              {SETTINGS_SECTIONS.map((section) => (
                <button
                  key={section.key}
                  type="button"
                  onClick={() => handleSectionChange(section.key)}
                  className={`group relative mx-auto flex h-[3.5rem] min-h-[3.5rem] items-center rounded-2xl text-left text-sm font-semibold transition-all duration-300 overflow-hidden ${
                    isNavExpanded ? 'w-full justify-start gap-3 px-3' : 'w-12 justify-center gap-0 px-0'
                  } ${
                    activeSection === section.key
                      ? 'bg-(--c-panel) text-(--c-text) ring-1 ring-(--c-accent)/20 shadow-sm'
                      : 'text-(--c-muted) hover:bg-(--c-panel) hover:text-(--c-text)'
                  }`}
                >
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                    <section.icon 
                      className={`h-5 w-5 transition-colors ${
                        activeSection === section.key
                          ? 'text-(--c-accent)'
                          : 'text-(--c-muted) group-hover:text-(--c-text)'
                      }`} 
                      strokeWidth={2.2}
                    />
                  </div>
                  <span className={`${isNavExpanded ? 'inline' : 'hidden'} whitespace-nowrap`}>
                    {section.label}
                  </span>
                  
                  {/* Tooltip for collapsed state */}
                  <div className={`${isNavExpanded ? 'hidden' : 'block'} absolute left-full ml-3 hidden group-hover:block rounded-lg bg-[var(--c-surface)] border border-[var(--c-border)] px-3 py-2 text-xs font-bold text-[var(--c-text)] shadow-2xl z-50 whitespace-nowrap ring-1 ring-black/5`}>
                    {section.label}
                  </div>
                </button>
              ))}
            </div>
          </aside>
          
          <div className="min-w-0 flex-1 overflow-visible">
            <div className="mb-3 xl:hidden">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-(--c-muted)">
                Quick Section
                <select
                  value={activeSection}
                  onChange={(event) => handleSectionChange(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-(--c-border) bg-(--c-panel) px-3 py-2 text-sm text-(--c-text) outline-none ring-1 ring-(--c-border)"
                >
                  {SETTINGS_SECTIONS.map((section) => (
                    <option key={section.key} value={section.key}>
                      {section.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            
            <div 
              key={activeSection}
              className="min-h-0 animate-in fade-in slide-in-from-bottom-2 duration-300"
            >
              {sectionContent}
            </div>
          </div>
        </div>
        )}
      </PageShell>
    </div>
  );
};

export default SettingsPage;
