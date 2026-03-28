import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, User, Building2 } from 'lucide-react';
import InputActionField from '../common/InputActionField';
import EmirateSelect from '../common/EmirateSelect';
import MobileContactsField from '../common/MobileContactsField';
import EmailContactsField from '../common/EmailContactsField';
import AddressField from '../common/AddressField';
import ActionProgressOverlay from '../common/ActionProgressOverlay';
import IdentityDocumentField from '../common/IdentityDocumentField';
import {
  upsertClient,
  generateDisplayClientId,
  checkIndividualDuplicate,
  checkTradeLicenseDuplicate,
} from '../../lib/backendStore';
import { createMobileContact, getPrimaryMobileContact, getFilledMobileContacts, serializeMobileContacts } from '../../lib/mobileContactUtils';

const typeOptions = [
  { id: 'company', label: 'Company', Icon: Building2 },
  { id: 'individual', label: 'Individual', Icon: User },
];

const QuickCreateError = ({ message }) => (
  message ? (
    <div className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
      {message}
    </div>
  ) : null
);

const QuotationClientQuickCreate = ({
  open,
  quotation,
  user,
  tenantId,
  onClose,
  onCreated,
}) => {
  const addIds = (list) =>
    (Array.isArray(list) ? list : []).map((item) => ({
      ...item,
      id: item.id || Math.random().toString(36).slice(2, 11),
    }));

  const prefill = useMemo(() => {
    const snap = quotation?.clientSnapshot || {};
    const modeFromData = snap.tradeName || snap.tradeLicenseNumber ? 'company' : 'individual';
    return {
      type: modeFromData,
      tradeName: snap.tradeName || '',
      fullName: snap.fullName || snap.name || '',
      tradeLicenseNumber: snap.tradeLicenseNumber || '',
      idType: snap.identificationMethod || (snap.emiratesId ? 'emirates_id' : 'passport'),
      idNumber: snap.emiratesId || snap.passportNumber || '',
      mobileContacts: (addIds(snap.mobileContacts).length ? addIds(snap.mobileContacts) : [createMobileContact()]),
      emailContacts: (addIds(snap.emailContacts).length ? addIds(snap.emailContacts) : [{ id: 'init-1', value: snap.primaryEmail || '' }]),
      address: snap.address || '',
      registeredEmirate: snap.registeredEmirate || '',
    };
  }, [quotation]);

  const [clientType, setClientType] = useState(prefill.type);
  const [form, setForm] = useState(prefill);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const lockRef = useRef(false);

  useEffect(() => {
    setClientType(prefill.type);
    setForm(prefill);
    setError('');
  }, [prefill, open]);

  if (!open) return null;

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const validate = () => {
    if (clientType === 'company') {
      if (!form.tradeName.trim()) return 'Trade name is required.';
      if (!form.tradeLicenseNumber.trim()) return 'Trade license number is required.';
      if (!form.registeredEmirate) return 'Registered Emirate is required.';
    } else {
      if (!form.fullName.trim()) return 'Full name is required.';
      if (!form.idNumber.trim()) return 'Identification is required.';
    }
    const primaryMobile = getPrimaryMobileContact(form.mobileContacts || []).value;
    if (!primaryMobile.trim()) return 'At least one mobile number is required.';
    const primaryEmail = (form.emailContacts?.[0]?.value || '').trim();
    if (!primaryEmail) return 'At least one email is required.';
    return '';
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    if (lockRef.current) return;
    lockRef.current = true;
    setIsSaving(true);
    setError('');
    try {
      const name = clientType === 'company' ? form.tradeName.trim().toUpperCase() : form.fullName.trim().toUpperCase();
      if (clientType === 'company') {
        const dup = await checkTradeLicenseDuplicate(tenantId, form.tradeLicenseNumber.trim().toUpperCase());
        if (dup) {
          setError('Trade License already exists.');
          return;
        }
      } else {
        const dup = await checkIndividualDuplicate(tenantId, {
          method: form.idType || 'emirates_id',
          emiratesId: form.idType === 'emirates_id' ? form.idNumber.trim() : '',
          passportNumber: form.idType === 'passport' ? form.idNumber.trim() : '',
          fullName: name,
        });
        if (dup) {
          setError('Identification already exists.');
          return;
        }
      }

      const displayClientId = await generateDisplayClientId(tenantId, clientType);
      const primaryMobile = getPrimaryMobileContact(form.mobileContacts || []).value;
      const secondaryMobile = getFilledMobileContacts(form.mobileContacts || [])[1]?.value || '';
      const primaryEmail = (form.emailContacts?.[0]?.value || '').trim().toLowerCase();
      const secondaryEmail = (form.emailContacts?.[1]?.value || '').trim().toLowerCase();

      const payload = {
        type: clientType,
        displayClientId,
        ...(clientType === 'company' ? { tradeName: name } : { fullName: name }),
        ...(clientType === 'company' ? { tradeLicenseNumber: form.tradeLicenseNumber.trim().toUpperCase() } : {}),
        ...(clientType !== 'company' ? { identificationMethod: form.idType } : {}),
        ...(clientType !== 'company' && form.idType === 'emirates_id' ? { emiratesId: form.idNumber.trim() } : {}),
        ...(clientType !== 'company' && form.idType === 'passport' ? { passportNumber: form.idNumber.trim() } : {}),
        registeredEmirate: form.registeredEmirate || '',
        address: form.address || '',
        primaryMobile,
        secondaryMobile,
        mobileContacts: serializeMobileContacts(form.mobileContacts || []),
        primaryEmail,
        secondaryEmail,
        emailContacts: (form.emailContacts || []).map((c) => ({
          id: c.id || Math.random().toString(36).slice(2, 11),
          value: String(c.value || '').trim().toLowerCase(),
        })).filter((c) => c.value),
        status: 'active',
        createdBy: user?.uid || '',
        tenantId,
      };

      const res = await upsertClient(tenantId, null, payload);
      if (!res.ok) {
        setError(res.error || 'Failed to create client.');
        return;
      }

      const snapshotRaw = {
        id: res.id,
        displayClientId,
        name,
        tradeName: payload.tradeName,
        fullName: payload.fullName,
        primaryMobile,
        primaryEmail,
        address: payload.address,
        registeredEmirate: payload.registeredEmirate,
        type: clientType,
      };
      const snapshot = Object.fromEntries(
        Object.entries(snapshotRaw).filter(([, v]) => v !== undefined && v !== null)
      );

      onCreated?.({ clientId: res.id, snapshot });
    } finally {
      setIsSaving(false);
      lockRef.current = false;
    }
  };

  return (
    <div className="fixed inset-0 z-[4000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--c-border)] px-4 py-3">
          <p className="text-sm font-bold text-[var(--c-text)]">Create Client to Proceed</p>
          <button
            type="button"
            aria-label="Close"
            className="compact-icon-action inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--c-border)] text-[var(--c-text)] hover:border-[var(--c-ring)]"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="grid gap-4 px-4 py-4 md:grid-cols-[220px_1fr]">
          <div className="space-y-2 rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)] p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--c-muted)]">Client Type</p>
            <div className="grid gap-2">
              {typeOptions.map(({ id, label, Icon }) => {
                const active = clientType === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setClientType(id)}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold transition ${active ? 'border-[var(--c-accent)] bg-[color:color-mix(in_srgb,var(--c-accent)_10%,var(--c-panel))] text-[var(--c-text)]' : 'border-[var(--c-border)] bg-[var(--c-panel)] text-[var(--c-muted)] hover:border-[var(--c-accent)]'}`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                    {active ? <Check className="ml-auto h-4 w-4 text-[var(--c-accent)]" /> : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            {clientType === 'company' ? (
              <div className="grid gap-3 md:grid-cols-3">
                <label className="space-y-1 md:col-span-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--c-muted)]">Trade Name *</span>
                  <InputActionField
                    value={form.tradeName}
                    onValueChange={(v) => setField('tradeName', String(v || '').toUpperCase())}
                    className="w-full"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--c-muted)]">Registered Emirate *</span>
                  <EmirateSelect
                    value={form.registeredEmirate}
                    onChange={(val) => setField('registeredEmirate', val)}
                  />
                </label>
                <label className="space-y-1 md:col-span-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--c-muted)]">Trade License *</span>
                  <InputActionField
                    value={form.tradeLicenseNumber}
                    onValueChange={(v) => setField('tradeLicenseNumber', String(v || '').toUpperCase())}
                    className="w-full"
                  />
                </label>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1 md:col-span-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--c-muted)]">Full Name *</span>
                  <InputActionField
                    value={form.fullName}
                    onValueChange={(v) => setField('fullName', String(v || '').toUpperCase())}
                    className="w-full"
                  />
                </label>
                <label className="space-y-1 md:col-span-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--c-muted)]">Identification *</span>
                  <IdentityDocumentField
                    type={form.idType || 'emirates_id'}
                    number={form.idNumber || ''}
                    allowedTypes={['emirates_id', 'passport']}
                    onTypeChange={(t) => setField('idType', t)}
                    onNumberChange={(n) => setField('idNumber', n)}
                  />
                </label>
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <MobileContactsField
                  label="Mobile Numbers *"
                  contacts={form.mobileContacts}
                  onChange={(contacts) => setField('mobileContacts', contacts)}
                />
              </div>
              <div className="md:col-span-2">
                <EmailContactsField
                  label="Email Addresses *"
                  contacts={form.emailContacts}
                  onChange={(list) => setField('emailContacts', list)}
                />
              </div>
              {clientType !== 'company' ? (
                <label className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--c-muted)]">Registered Emirate</span>
                  <EmirateSelect
                    value={form.registeredEmirate}
                    onChange={(val) => setField('registeredEmirate', val)}
                  />
                </label>
              ) : null}
              <div className="md:col-span-2">
                <AddressField value={form.address} onValueChange={(v) => setField('address', v)} />
              </div>
            </div>

            <QuickCreateError message={error} />

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                className="compact-action rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-4 py-2 text-sm font-semibold text-[var(--c-muted)] hover:text-[var(--c-text)]"
                onClick={onClose}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="compact-action rounded-xl bg-[var(--c-accent)] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-[var(--c-accent)]/20 hover:opacity-90 disabled:opacity-50"
                onClick={handleSubmit}
                disabled={isSaving}
              >
                Save & Continue
              </button>
            </div>
          </div>
        </div>
      </div>

      <ActionProgressOverlay
        open={isSaving}
        kind="process"
        title="Creating Client"
        subtitle="Capturing quick client profile to continue acceptance."
        status="Saving..."
      />
    </div>
  );
};

export default QuotationClientQuickCreate;
