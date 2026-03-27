import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCcw, Wallet, Calendar, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import PageShell from '../components/layout/PageShell';
import ClientSearchField from '../components/dailyTransaction/ClientSearchField';
import PortalTransactionSelector from '../components/common/PortalTransactionSelector';
import GenericSelectField from '../components/common/GenericSelectField';
import CurrencyValue from '../components/common/CurrencyValue';
import InputActionField from '../components/common/InputActionField';
import ActionProgressOverlay from '../components/common/ActionProgressOverlay';
import { useTenant } from '../context/useTenant';
import { useAuth } from '../context/useAuth';
import {
  fetchTenantClients,
  fetchTenantPortals,
  fetchTenantProformaInvoices,
  generateDisplayDocumentRef,
} from '../lib/backendStore';
import { recordProformaPayment } from '../lib/workflowStore';
import { toSafeDocId } from '../lib/idUtils';

const ReceivePaymentsPage = () => {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const prefillClientId = String(searchParams.get('clientId') || '').trim();
  const prefillProformaId = String(searchParams.get('proformaId') || '').trim();

  const [displayRef, setDisplayRef] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedPortalId, setSelectedPortalId] = useState('');
  const [selectedMethodId, setSelectedMethodId] = useState('');
  const [selectedProformaId, setSelectedProformaId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [showPortalBalance, setShowPortalBalance] = useState(false);

  const [portals, setPortals] = useState([]);
  const [proformas, setProformas] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [statusType, setStatusType] = useState('info');

  const pushStatus = (message, nextType = 'info') => {
    setStatus(message);
    setStatusType(nextType);
  };

  const loadData = useCallback(async () => {
    if (!tenantId) return;
    const [nextRef, clientsRes, portalsRes, proformaRes] = await Promise.all([
      generateDisplayDocumentRef(tenantId, 'clientPayment'),
      fetchTenantClients(tenantId),
      fetchTenantPortals(tenantId),
      fetchTenantProformaInvoices(tenantId),
    ]);

    setDisplayRef(nextRef);
    if (clientsRes.ok) {
      const rows = clientsRes.rows || [];
      if (prefillClientId) {
        const found = rows.find((item) => String(item.id) === prefillClientId || String(item.displayClientId) === prefillClientId);
        if (found) setSelectedClient(found);
      }
    }
    if (portalsRes.ok) setPortals(portalsRes.rows || []);
    if (proformaRes.ok) {
      setProformas(proformaRes.rows || []);
      if (prefillProformaId) setSelectedProformaId(prefillProformaId);
    }
  }, [tenantId, prefillClientId, prefillProformaId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedPortal = useMemo(
    () => portals.find((item) => item.id === selectedPortalId) || null,
    [portals, selectedPortalId],
  );

  const availableProformas = useMemo(() => {
    if (!selectedClient?.id) return [];
    return proformas.filter((item) => {
      if (String(item.clientId || '') !== String(selectedClient.id)) return false;
      const statusValue = String(item.status || '').toLowerCase();
      return statusValue !== 'canceled' && statusValue !== 'paid';
    });
  }, [proformas, selectedClient]);

  const activeProforma = useMemo(() => 
    availableProformas.find(p => p.id === selectedProformaId) || null
  , [availableProformas, selectedProformaId]);

  const numericAmount = useMemo(() => Math.max(0, Number(amount || 0)), [amount]);
  const proformaBalanceDue = useMemo(() => Number(activeProforma?.balanceDue ?? activeProforma?.totalAmount ?? 0), [activeProforma]);
  const remainingProformaBalance = Math.max(0, proformaBalanceDue - numericAmount);

  const resetForm = async () => {
    const nextRef = await generateDisplayDocumentRef(tenantId, 'clientPayment');
    setDisplayRef(nextRef);
    setAmount('');
    setNote('');
    setDate(new Date().toISOString().slice(0, 10));
    setSelectedMethodId('');
    setSelectedProformaId('');
    setStatus('');
    setShowPortalBalance(false);
  };

  const handleSubmit = async (event) => {
    if (event) event.preventDefault();
    if (isSaving) return;

    if (!selectedClient?.id) return pushStatus('Please select a client.', 'error');
    if (!selectedProformaId) return pushStatus('Please select a Proforma Invoice.', 'error');
    if (!selectedPortalId) return pushStatus('Please select a receiving portal.', 'error');
    if (!selectedMethodId) return pushStatus('Please select a payment method.', 'error');
    if (!(numericAmount > 0)) return pushStatus('Amount must be greater than zero.', 'error');

    setIsSaving(true);
    const paymentId = toSafeDocId(displayRef, 'receipt');
    
    const payload = {
      displayRef,
      clientId: selectedClient.id,
      proformaId: selectedProformaId,
      portalId: selectedPortalId,
      methodId: selectedMethodId,
      amount: numericAmount,
      receivedAt: new Date(date).toISOString(),
      note,
      createdBy: user?.uid || '',
    };

    const res = await recordProformaPayment(tenantId, paymentId, payload);

    if (res.ok) {
      pushStatus(`Payment ${displayRef} recorded. Proforma is now ${res.proformaStatusAfter.replace('_', ' ')}.`, 'success');
      await loadData();
      await resetForm();
    } else {
      pushStatus(res.error || 'Failed to record payment.', 'error');
    }
    setIsSaving(false);
  };

  return (
    <PageShell
      title="Receive Payments"
      iconKey="receivePayments"
      widthPreset="form"
    >
      <div className="flex flex-col gap-6">
        
        {status && (
          <div className={`rounded-xl border p-4 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${statusType === 'error' ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
            {statusType === 'error' ? <AlertCircle strokeWidth={1.5} size={18} /> : <CheckCircle2 strokeWidth={1.5} size={18} />}
            <span className="text-sm font-bold">{status}</span>
          </div>
        )}

        <div className="compact-card glass border border-[var(--c-border)] shadow-sm flex flex-col gap-5">
          <div className="flex items-center justify-between border-b border-[var(--c-border)] pb-4">
             <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-[var(--c-muted)]">Reference Number</h3>
                <p className="text-lg font-bold text-[var(--c-text)]">{displayRef || 'Loading...'}</p>
             </div>
             <button
                onClick={resetForm}
                className="flex items-center gap-2 rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-4 py-2 text-xs font-black text-[var(--c-text)] hover:bg-[var(--c-surface)] transition"
              >
                <RefreshCcw strokeWidth={1.5} className="h-4 w-4" /> Reset
              </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-[var(--c-muted)]">Payment Date</label>
              <InputActionField
                type="date"
                value={date}
                onValueChange={setDate}
                className="w-full"
                showPasteButton={false}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-[var(--c-muted)]">Client Selection</label>
              <ClientSearchField
                onSelect={(c) => { setSelectedClient(c); setSelectedProformaId(''); }}
                selectedId={selectedClient?.id}
                filterType="parent"
                placeholder="Search clients..."
              />
            </div>
          </div>

          {selectedClient && (
            <div className="animate-in fade-in slide-in-from-top-4 duration-300 space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--c-muted)]">Select Pending Proforma</label>
                <GenericSelectField
                  label="Pending Proforma"
                  placeholder="-- Choose a Proforma --"
                  icon={FileText}
                  value={selectedProformaId}
                  onChange={setSelectedProformaId}
                  options={availableProformas.map((p) => ({
                    value: p.id,
                    label: `${p.displayRef || p.id} (Due: AED ${p.balanceDue?.toLocaleString()})`,
                  }))}
                  className="w-full"
                />
              </div>

              {activeProforma && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-in zoom-in-95 duration-200">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[var(--c-muted)]">Payment Amount (AED)</label>
                    <InputActionField
                      type="number"
                      value={amount}
                      onValueChange={setAmount}
                      placeholder="0.00"
                      className="w-full"
                      showPasteButton={false}
                    />
                  </div>

                  <div className="rounded-2xl border border-[var(--c-accent)]/30 bg-[var(--c-accent)]/5 p-4 flex flex-col justify-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--c-accent)] opacity-70">Remaining Balance</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xl font-black text-[var(--c-text)]">
                        AED {remainingProformaBalance.toLocaleString()}
                      </span>
                      {remainingProformaBalance === 0 && numericAmount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-700">
                          Clear <CheckCircle2 strokeWidth={1.5} size={10} />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <PortalTransactionSelector
            portalLabel="Receiving Portal"
            methodLabel="Payment Method"
            portalId={selectedPortalId}
            methodId={selectedMethodId}
            onPortalChange={(pid) => { setSelectedPortalId(pid); setSelectedMethodId(''); }}
            onMethodChange={setSelectedMethodId}
            portals={portals}
            portal={selectedPortal}
            placeholder="Select portal..."
            showBalancePanel={true}
            showBalance={showPortalBalance}
            onToggleBalance={() => setShowPortalBalance(!showPortalBalance)}
            projectedBalance={selectedPortal ? Number(selectedPortal.balance || 0) + numericAmount : null}
            className="border-t border-[var(--c-border)] pt-5 mt-2"
          />

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--c-muted)]">Payment Reference / Note</label>
            <InputActionField
              multiline={true}
              rows={2}
              value={note}
              onValueChange={setNote}
              placeholder="e.g. Cheque #12345 or Bank Transfer ID..."
              className="w-full"
            />
          </div>

          <div className="border-t border-[var(--c-border)] pt-4 flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={isSaving || !selectedProformaId || numericAmount <= 0}
              className="flex h-14 min-w-[200px] items-center justify-center gap-2 rounded-2xl bg-[var(--c-accent)] px-8 font-black text-white shadow-lg shadow-[var(--c-accent)]/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-40 disabled:scale-100"
            >
              <Wallet strokeWidth={1.5} size={20} />
              {isSaving ? 'Processing...' : 'Record Payment'}
            </button>
          </div>
        </div>
      </div>

      <ActionProgressOverlay
        open={isSaving}
        title="Processing Payment"
        subtitle="Updating Proforma balance and synchronizing financial ledger..."
        status="Executing atomic transaction..."
      />
    </PageShell>
  );
};

export default ReceivePaymentsPage;
