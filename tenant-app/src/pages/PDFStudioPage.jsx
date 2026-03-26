import { useMemo, useRef, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import PDFStudioConfig from '../components/pdf/PDFStudioConfig';
import DocumentTemplate from '../components/pdf/DocumentTemplate';
import { useTenant } from '../context/useTenant';

const PDFStudioPage = () => {
  const { tenant } = useTenant();
  const printRef = useRef(null);

  // Master State from Part A
  const [pdfConfig, setPdfConfig] = useState({});

  const tenantData = useMemo(
    () => ({
      logo: tenant?.logoUrl || '',
      name: tenant?.name || 'Company Name',
      email: '',
      phone: '',
      landline: '',
      bankDetails: '',
    }),
    [tenant],
  );

  // Mock Transaction Data for Live Preview purposes
  // In production, this can be passed in via props or router state
  const mockTransaction = useMemo(
    () => ({
      invoiceNo: 'INV-2026-001',
      clientName: 'Ahmad Al Mansoori',
      serviceName: 'Golden Visa Processing - Category A',
      amount: '2,500.00',
      amountInWords: 'Two Thousand Five Hundred Dirhams Only',
    }),
    [],
  );

  // Safe Print/Download Logic
  const handlePrint = () => {
    // Note for Developer: Wire this to your preferred PDF library
    // (e.g., html2pdf.js, react-to-print, or Electron's native print-to-pdf)
    window.print();
  };

  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-[var(--c-bg)]">
      {/* LEFT COLUMN: Controls (Part A) */}
      <div className="glass h-full w-1/3 min-w-[350px] max-w-[450px] overflow-y-auto border-r border-[var(--c-border)] p-6">
        <PDFStudioConfig onConfigChange={setPdfConfig} />
      </div>

      {/* RIGHT COLUMN: Live Preview (Part B) */}
      <div className="flex h-full min-h-0 flex-1 flex-col bg-[color:color-mix(in_srgb,var(--c-panel)_35%,transparent)]">
        {/* Action Bar */}
        <div className="glass flex h-16 items-center justify-end border-b border-[var(--c-border)] px-8">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handlePrint}
              className="flex h-10 items-center gap-2 rounded-xl border border-[var(--c-border)] bg-[color:color-mix(in_srgb,white_92%,var(--c-surface)_8%)] px-4 font-semibold text-[var(--c-text)] shadow-sm transition hover:bg-[color:color-mix(in_srgb,white_85%,var(--c-surface)_15%)]"
            >
              <Printer size={18} /> Print
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="flex h-10 items-center gap-2 rounded-xl bg-[var(--c-accent)] px-4 font-semibold text-[var(--c-on-accent)] shadow-md transition hover:opacity-90"
            >
              <Download size={18} /> Download PDF
            </button>
          </div>
        </div>

        {/* A4 Canvas Container */}
        <div className="flex flex-1 justify-center overflow-y-auto p-8 items-start">
          <div className="print-container" ref={printRef}>
            <DocumentTemplate config={pdfConfig} tenantData={tenantData} transactionData={mockTransaction} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PDFStudioPage;

