import SettingCard from './SettingCard';
import { useTenant } from '../../context/useTenant';

const inputClass =
  'mt-1 w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2.5 text-sm text-[var(--c-text)] outline-none transition focus:border-[var(--c-accent)] focus:ring-2 focus:ring-[var(--c-ring)]';

const ProfileSection = () => {
  const { tenant } = useTenant();

  return (
    <SettingCard
      title="Company Profile"
      description="Primary organization details used across invoice and quotation templates."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-[var(--c-muted)]">
          Company Name
          <input className={inputClass} defaultValue={tenant.name} />
        </label>
        <label className="text-sm text-[var(--c-muted)]">
          Trade License
          <input className={inputClass} defaultValue="ACIS-2026-7781" />
        </label>
        <label className="text-sm text-[var(--c-muted)] sm:col-span-2">
          Address
          <input className={inputClass} defaultValue="Shop 01, Ammar Bin Yasir Street, Al Rashidiya 2, Ajman" />
        </label>
        <label className="text-sm text-[var(--c-muted)]">
          Email
          <input className={inputClass} defaultValue="admin@acis.ae" />
        </label>
        <label className="text-sm text-[var(--c-muted)]">
          Mobile
          <input className={inputClass} defaultValue="+971551012119" />
        </label>
      </div>
    </SettingCard>
  );
};

export default ProfileSection;
