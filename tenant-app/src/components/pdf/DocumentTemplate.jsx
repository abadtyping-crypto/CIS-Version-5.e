import React from 'react';
import DirhamIcon from '../common/DirhamIcon';

const toTermsList = (terms) => {
  if (Array.isArray(terms)) return terms;
  if (terms == null) return [];
  const raw = String(terms);
  if (!raw.trim()) return [];
  return raw.split('\n');
};

const DocumentTemplate = ({ config = {}, tenantData = {}, transactionData = {} }) => {
  // 1. Unpack the exact settings from Part A
  const {
    logoPosition = 'top-left',
    showEmail = false,
    showPhone = false,
    showLandline = false,
    primaryColor = '#0f172a',
    borderThickness = 2,
    enableWatermark = false,
    watermarkOpacity = 0.08,
    showPayable = true,
    showAmountInWords = false,
    showBankDetails = false,
    showSignature = false,
    terms = [],
  } = config || {};

  const resolvedTerms = toTermsList(terms)
    .map((term) => String(term || '').trim())
    .filter(Boolean);

  // 2. Sovereign Layout Rule: Dynamic Logo Alignment
  const getHeaderAlignment = () => {
    if (logoPosition === 'center') return 'items-center text-center flex-col';
    if (logoPosition === 'top-right') return 'flex-row-reverse text-right';
    return 'flex-row text-left'; // default top-left
  };

  return (
    // A4 Canvas constraints: Fixed width, min-height, white background
    <div
      className="relative w-full max-w-[210mm] mx-auto min-h-[297mm] overflow-hidden bg-white p-12 text-black shadow-2xl border"
      style={{ borderWidth: `${borderThickness}px`, borderColor: primaryColor }}
    >
      {/* 🛡️ WATERMARK LAYER (Strictly z-0, cannot break layout) */}
      {enableWatermark && tenantData?.logo && (
        <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center">
          <img
            src={tenantData.logo}
            alt="Watermark"
            className="h-auto w-2/3 grayscale"
            style={{ opacity: watermarkOpacity }}
          />
        </div>
      )}

      {/* 📄 CONTENT LAYER (Strictly z-10, stays above watermark) */}
      <div className="relative z-10 flex h-full flex-col">
        {/* HEADER SECTION */}
        <header
          className={`flex ${getHeaderAlignment()} justify-between gap-6 border-b-2 pb-6 mb-8`}
          style={{ borderColor: primaryColor }}
        >
          {tenantData?.logo && (
            <img src={tenantData.logo} alt="Brand Logo" className="h-20 w-auto object-contain" />
          )}
          <div className="flex flex-col">
            <h1 className="text-3xl font-bold" style={{ color: primaryColor }}>
              {tenantData?.name || 'Company Name'}
            </h1>
            {/* Conditional Brand Wires */}
            <div className="mt-2 text-sm text-gray-600">
              {showEmail && tenantData?.email && <p>Email: {tenantData.email}</p>}
              {showPhone && tenantData?.phone && <p>Mobile: {tenantData.phone}</p>}
              {showLandline && tenantData?.landline && <p>Tel: {tenantData.landline}</p>}
            </div>
          </div>
        </header>

        {/* DOCUMENT METADATA */}
        <div className="mb-8 flex justify-between">
          <div>
            <h2 className="mb-1 text-2xl font-bold" style={{ color: primaryColor }}>
              Tax Invoice
            </h2>
            <p className="text-sm font-semibold text-gray-500">
              Invoice #: {transactionData?.invoiceNo || 'INV-00001'}
            </p>
            <p className="text-sm text-gray-500">Date: {new Date().toLocaleDateString()}</p>
          </div>
          <div className="text-right">
            <h3 className="font-bold text-gray-700">Billed To:</h3>
            <p className="font-medium text-gray-600">{transactionData?.clientName || 'Walk-in Client'}</p>
          </div>
        </div>

        {/* FINANCIAL TABLE */}
        <table className="mb-8 w-full border-collapse text-left">
          <thead>
            <tr className="border-b-2" style={{ borderColor: primaryColor }}>
              <th className="py-2 font-bold text-gray-700">Description</th>
              <th className="py-2 text-right font-bold text-gray-700">
                Amount (<DirhamIcon className="inline h-3 w-3 align-text-bottom" />)
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-200">
              <td className="py-4 text-gray-800">{transactionData?.serviceName || 'UAE Typing Service'}</td>
              <td className="py-4 text-right font-semibold text-gray-800">
                {transactionData?.amount ?? '0.00'}
              </td>
            </tr>
          </tbody>
        </table>

        {/* FINANCIAL SUMMARY & PAYABLE */}
        <div className="mb-8 flex justify-end">
          <div className="w-1/2">
            {showPayable && (
              <div
                className="flex justify-between rounded-md border bg-gray-50 p-3 text-lg font-bold"
                style={{ borderColor: `${primaryColor}40`, color: primaryColor }}
              >
                <span>Total Payable:</span>
                <span className="inline-flex items-center gap-1">
                  <DirhamIcon className="h-4 w-4" /> {transactionData?.amount ?? '0.00'}
                </span>
              </div>
            )}
            {showAmountInWords && (
              <p className="mt-2 text-right text-sm italic text-gray-500">
                * Amount in words: {transactionData?.amountInWords || 'Zero Dirhams'}
              </p>
            )}
          </div>
        </div>

        {/* FOOTER (Pushed to the absolute bottom of the A4 page) */}
        <div className="mt-auto pt-8">
          <div className="grid grid-cols-2 gap-8">
            {/* T&C + BANK DETAILS WIRING */}
            <div className="flex flex-col gap-6">
              {/* Only show T&C block if there is at least one non-empty term */}
              {resolvedTerms.length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-bold" style={{ color: primaryColor }}>
                    Terms & Conditions
                  </h4>
                  <ul className="list-disc space-y-1 pl-4 text-xs text-gray-600">
                    {resolvedTerms.map((term, i) => (
                      <li key={`${i}-${term}`}>{term}</li>
                    ))}
                  </ul>
                </div>
              )}

              {showBankDetails && tenantData?.bankDetails && (
                <div>
                  <h4 className="mb-1 text-sm font-bold" style={{ color: primaryColor }}>
                    Bank Details
                  </h4>
                  <p className="whitespace-pre-line text-xs text-gray-600">{tenantData.bankDetails}</p>
                </div>
              )}
            </div>

            {/* MANUAL SIGNATURE LINE */}
            {showSignature ? (
              <div className="flex flex-col items-end justify-end pb-4">
                <div className="mb-2 w-48 border-b-2 border-gray-400" />
                <p className="text-sm font-bold text-gray-600">Authorized Signature</p>
              </div>
            ) : (
              <div />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentTemplate;
