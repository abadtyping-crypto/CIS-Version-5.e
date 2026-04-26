import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  DEFAULT_QUOTATION_TERMS,
  PORTAL_STATEMENT_DISCLAIMER_TEXT,
  resolvePdfTemplateForRenderer,
  normalizePdfTemplatePayload,
  PDF_DEFAULT_TEMPLATE,
} from './pdfTemplateRenderer';
import { fetchTenantPdfTemplates, getTenantSettingDoc } from './backendStore';

const resolveTemplateTerms = (template, data, documentType) => {
  const quotationSpecificTerms = String(data?.termsAndConditions || '').trim();
  if (quotationSpecificTerms) return quotationSpecificTerms;
  const rawTerms = String(
    template?.termsAndConditions
    || (documentType === 'quotation' ? DEFAULT_QUOTATION_TERMS : '')
  ).trim();
  if (!rawTerms) return '';
  const expiryDate = String(data?.expiryDate || '').trim() || 'the selected expiry date';
  return rawTerms.replaceAll('{{expiryDate}}', expiryDate);
};

const resolvePortalStatementDisclaimer = (template, data) => {
  const portalName = String(data?.portalName || data?.recipientName || 'this portal').trim();
  const raw = String(template?.internalStatementDisclaimer || PORTAL_STATEMENT_DISCLAIMER_TEXT).trim();
  return raw.replaceAll('{{portalName}}', portalName || 'this portal');
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const coerceHex = (value, fallback = '#000000') => {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  const hex = raw.startsWith('#') ? raw : `#${raw}`;
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : fallback;
};

const applyColor = (hex, fallback = '#000000') => {
  const safe = coerceHex(hex, fallback);
  const r = parseInt(safe.slice(1, 3), 16);
  const g = parseInt(safe.slice(3, 5), 16);
  const b = parseInt(safe.slice(5, 7), 16);
  return [r, g, b];
};

const stripTrailingZeros = (valueText) =>
  String(valueText || '')
    .replace(/(\.\d*?[1-9])0+$/, '$1')
    .replace(/\.0+$/, '');

const parseAmountText = (value) => {
  const parsed = Number(String(value ?? '').replace(/,/g, '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

// Returns only the formatted number string (no prefix). The Dirham icon is drawn separately.
const formatAmount = (value, { trimTrailingZeros = false } = {}) => {
  const amount = Number(value || 0);
  const absolute = Number.isFinite(amount) ? Math.abs(amount) : 0;
  const sign = amount < 0 ? '-' : '';
  const raw = absolute.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const normalized = trimTrailingZeros ? stripTrailingZeros(raw) : raw;
  return `${sign}${normalized}`;
};

const formatCurrencyText = (value, { trimTrailingZeros = false } = {}) =>
  `AED ${formatAmount(value, { trimTrailingZeros })}`;

/**
 * Loads /dirham.svg and renders it to an offscreen canvas.
 * Returns a PNG data URL string, or null on failure.
 */
const loadDirhamIconBase64 = async () => {
  try {
    const resp = await fetch('/dirham.svg');
    if (!resp.ok) return null;
    const svgText = await resp.text();
    const blob = new Blob([svgText], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    return await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const size = 48;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(img, 0, 0, size, size);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  } catch {
    return null;
  }
};

/**
 * Draws amount text inline with dirham icon fallback at (x, y).
 */
const drawDirhamAmount = (
  doc,
  iconBase64,
  value,
  x,
  y,
  {
    iconSize = 10,
    trimTrailingZeros = false,
  } = {},
) => {
  const numStr = formatAmount(value, { trimTrailingZeros });
  let text = numStr;
  let textX = x;

  if (iconBase64) {
    const iconY = y - iconSize + 2;
    try {
      doc.addImage(iconBase64, 'PNG', x, iconY, iconSize, iconSize);
      textX = x + iconSize + 3;
    } catch {
      text = `AED ${numStr}`;
    }
  } else {
    text = `AED ${numStr}`;
  }

  doc.text(text, textX, y);
  return (textX - x) + doc.getTextWidth(text);
};

const readBrandingBankLines = (bank) => {
  if (!bank || typeof bank !== 'object') return [];
  return [
    bank.bankName ? `Bank: ${String(bank.bankName).trim()}` : '',
    bank.bankAccountName ? `A/C Name: ${String(bank.bankAccountName).trim()}` : '',
    bank.bankAccountNumber ? `A/C No: ${String(bank.bankAccountNumber).trim()}` : '',
    bank.bankIban ? `IBAN: ${String(bank.bankIban).trim()}` : '',
    bank.bankSwift ? `SWIFT: ${String(bank.bankSwift).trim()}` : '',
    bank.bankBranch ? `Branch: ${String(bank.bankBranch).trim()}` : '',
  ].filter(Boolean);
};

const normalizeFileNameToken = (value) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_-]/g, '');

const buildDateToken = (format) => {
  const d = new Date();
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  if (format === 'DDMMYYYY') return `${dd}${mm}${yyyy}`;
  if (format === 'YYMMDD') return `${yyyy.slice(2)}${mm}${dd}`;
  return `${yyyy}${mm}${dd}`;
};

const resolveDynamicFilename = (policy, data) => {
  if (!policy) return null;
  const tokens = [];
  if (policy.includeTxId) tokens.push(normalizeFileNameToken(data.txId));
  if (policy.includeDocType) tokens.push(normalizeFileNameToken(policy.label?.toUpperCase() || 'DOCUMENT'));
  if (policy.includeClientName) tokens.push(normalizeFileNameToken(data.recipientName));
  if (policy.includeDependentName && data.dependentName) tokens.push(normalizeFileNameToken(data.dependentName));
  if (policy.includeDate) tokens.push(buildDateToken(policy.dateFormat));
  if (policy.includeRandomSuffix) tokens.push(Math.random().toString(36).slice(2, 6).toUpperCase());

  if (tokens.length === 0) tokens.push('DOCUMENT');
  const rawBase = tokens.join('-');
  const maxLength = Number(policy.maxLength) || 120;
  const finalBase = rawBase.length > (maxLength - 4) ? rawBase.slice(0, Math.max(1, maxLength - 4)) : rawBase;
  return `${finalBase}.pdf`;
};

const normalizeItems = (items, fallbackDescription = 'Transaction details', fallbackAmount = 0) => {
  const source = Array.isArray(items) ? items : [];
  const mapped = source
    .map((item, index) => {
      const name = String(
        item?.name
        ?? item?.description
        ?? item?.applicationName
        ?? item?.serviceName
        ?? item?.title
        ?? ''
      ).trim() || `Item ${index + 1}`;
      const qty = Math.max(0, toNumber(item?.qty ?? item?.quantity ?? 1, 1));
      const unit = toNumber(item?.price ?? item?.amount ?? item?.unitPrice ?? item?.clientCharge ?? item?.govCharge ?? 0, 0);
      const total = toNumber(item?.total ?? item?.lineTotal ?? (qty * unit), qty * unit);
      return { name, qty, unit, total };
    })
    .filter((item) => item.name);

  if (mapped.length > 0) return mapped;

  const amount = toNumber(fallbackAmount, 0);
  return [{ name: String(fallbackDescription || 'Transaction details'), qty: 1, unit: amount, total: amount }];
};

const computeDocTotal = (normalizedItems, fallbackAmount = 0) => {
  const sum = normalizedItems.reduce((acc, item) => acc + toNumber(item.total, 0), 0);
  if (Math.abs(sum) > 0.0001) return sum;
  return toNumber(fallbackAmount, 0);
};

const imageToPngDataUrl = (source) => new Promise((resolve, reject) => {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, image.naturalWidth || image.width || 1);
      canvas.height = Math.max(1, image.naturalHeight || image.height || 1);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Unable to prepare image canvas.'));
        return;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/png'));
    } catch (error) {
      reject(error);
    }
  };
  image.onerror = () => reject(new Error('Unable to load PDF image.'));
  image.src = source;
});

const resolvePdfImageSource = async (source) => {
  const value = String(source || '').trim();
  if (!value) return '';
  if (value.startsWith('data:')) {
    if (value.startsWith('data:image/png') || value.startsWith('data:image/jpeg') || value.startsWith('data:image/jpg')) {
      return value;
    }
    try {
      return await imageToPngDataUrl(value);
    } catch {
      return value;
    }
  }
  try {
    const response = await fetch(value, { cache: 'no-store' });
    if (!response.ok) return value;
    const blob = await response.blob();
    if (!String(blob.type || '').startsWith('image/')) return value;
    const objectUrl = URL.createObjectURL(blob);
    try {
      return await imageToPngDataUrl(objectUrl);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    try {
      return await imageToPngDataUrl(value);
    } catch {
      return value;
    }
  }
};

const addImageWithFallbackFormat = (doc, source, x, y, w, h) => {
  if (!source) return false;
  const formats = ['PNG', 'JPEG', 'WEBP'];
  for (const format of formats) {
    try {
      doc.addImage(source, format, x, y, w, h, undefined, 'FAST');
      return true;
    } catch {
      // try next format
    }
  }
  return false;
};

const resolvePdfFont = (fontStyle) => {
  const safe = String(fontStyle || '').toLowerCase();
  if (safe === 'times') return { family: 'times', style: 'normal' };
  if (safe === 'courier') return { family: 'courier', style: 'normal' };
  if (safe === 'helvetica-bold') return { family: 'helvetica', style: 'bold' };
  return { family: 'helvetica', style: 'normal' };
};

const normalizeLogoLibrary = (branding) => {
  const library = Array.isArray(branding?.logoLibrary) ? branding.logoLibrary : [];
  const normalized = library
    .map((slot, index) => ({
      slotId: String(slot?.slotId || slot?.id || `logo_${index + 1}`).trim(),
      url: String(slot?.url || slot?.logoUrl || slot?.src || '').trim(),
    }))
    .filter((slot) => slot.slotId && slot.url);
  const fallbackLogoUrl = String(
    branding?.activeLogoUrl
    || branding?.logoUrl
    || branding?.iconUrl
    || branding?.brandLogoUrl
    || branding?.companyLogoUrl
    || ''
  ).trim();
  if (fallbackLogoUrl && !normalized.some((slot) => slot.url === fallbackLogoUrl)) {
    normalized.unshift({ slotId: 'brandingFallbackLogo', url: fallbackLogoUrl });
  }
  return normalized;
};

const normalizeEmailContacts = (branding) => {
  const source = Array.isArray(branding?.emailContacts) && branding.emailContacts.length
    ? branding.emailContacts
    : (Array.isArray(branding?.emails) ? branding.emails.map((value) => ({ value })) : []);
  return source
    .map((item, index) => ({
      key: `email:${index}`,
      legacyKey: index === 0 ? 'showPrimaryEmail' : `showEmail${index + 1}`,
      value: String(item?.value || item?.email || item || '').trim().toLowerCase(),
    }))
    .filter((item) => item.value);
};

const normalizeMobileContacts = (branding) => {
  const source = Array.isArray(branding?.mobileContacts) && branding.mobileContacts.length
    ? branding.mobileContacts
    : (Array.isArray(branding?.mobiles) ? branding.mobiles.map((value) => ({ value })) : []);
  return source
    .map((item, index) => ({
      key: `mobile:${index}`,
      legacyKey: index === 0 ? 'showPrimaryMobile' : `showMobile${index + 1}`,
      value: String(item?.value || item?.phone || item || '').trim(),
      whatsAppEnabled: item?.whatsAppEnabled === true,
    }))
    .filter((item) => item.value);
};

const normalizeBrandAddresses = (branding) => {
  const addressSource = Array.isArray(branding?.addresses) && branding.addresses.length
    ? branding.addresses
    : [
      branding?.primaryAddress,
      branding?.secondaryAddress,
      branding?.officeAddress,
      branding?.address,
      branding?.branchAddress,
    ].filter(Boolean);
  const addresses = addressSource
    .map((value, index) => ({
      key: `address:${index}`,
      value: String(value || '').trim(),
    }))
    .filter((item) => item.value);
  const poBoxNumber = String(branding?.poBoxNumber || '').trim();
  const poBoxEmirate = String(branding?.poBoxEmirate || '').trim();
  const poBox = poBoxNumber
    ? { key: 'poBox', value: `PO Box ${poBoxNumber}${poBoxEmirate ? `, ${poBoxEmirate}` : ''}` }
    : null;

  return { addresses, poBox };
};

const visibilityAllows = (map, key, legacyKey) => {
  if (!map || typeof map !== 'object') return true;
  if (map[key] === false) return false;
  if (legacyKey && map[legacyKey] === false) return false;
  return true;
};

const resolveMasterTemplate = (baseTemplate, masterTemplate, overrideTemplate, customizationDisabled) => {
  if (overrideTemplate) {
    return normalizePdfTemplatePayload({ ...PDF_DEFAULT_TEMPLATE, ...overrideTemplate });
  }
  if (customizationDisabled) {
    return normalizePdfTemplatePayload(PDF_DEFAULT_TEMPLATE);
  }
  return normalizePdfTemplatePayload({
    ...PDF_DEFAULT_TEMPLATE,
    ...(baseTemplate || {}),
    ...(masterTemplate || {}),
  });
};

const PDF_DOCUMENT_LABELS = {
  invoice: 'Invoice',
  quotation: 'Quotation',
  claim: 'Claim',
  acknowledgement: 'Acknowledgment',
  payment: 'Payment',
  clientStatement: 'Client Statement',
  portalStatement: 'Portal Statement',
  portalStatementQuotation: 'Portal Statement Quotation',
  paymentReceipt: 'Payment Receipt',
  nextInvoice: 'Invoice',
  performerInvoice: 'Proforma Invoice',
  statement: 'Client Statement',
};

const PDF_DOCUMENT_DEFAULT_FOOTERS = {
  invoice: 'This invoice is system generated and subject to recorded service and payment details.',
  quotation: 'This quotation is valid only for the stated period and is subject to government fee changes where applicable.',
  claim: 'This claim is issued for verification and settlement review.',
  acknowledgement: 'This acknowledgement confirms receipt of the recorded request or payment information.',
  payment: 'This payment record is generated from tenant payment entries.',
  clientStatement: 'This client statement is generated from recorded client ledger activity.',
  portalStatement: PORTAL_STATEMENT_DISCLAIMER_TEXT,
  portalStatementQuotation: 'This portal statement quotation is for portal reconciliation review only.',
  paymentReceipt: 'This payment receipt is generated from tenant payment entries.',
  nextInvoice: 'This invoice is system generated and subject to recorded service and payment details.',
  performerInvoice: 'This proforma invoice is issued for approval before final invoicing.',
  statement: 'This client statement is generated from recorded client ledger activity.',
};

const resolveDocumentTitle = (documentType, template) => {
  const pageConfig = template?.documentConfigs?.[documentType];
  return String(pageConfig?.titleText || template?.titleText || PDF_DOCUMENT_LABELS[documentType] || documentType || 'DOCUMENT').trim();
};

const resolveDocumentFooter = (documentType, template) => {
  const pageConfig = template?.documentConfigs?.[documentType];
  return String(pageConfig?.systemFooter || PDF_DOCUMENT_DEFAULT_FOOTERS[documentType] || template?.footerText || '').trim();
};

/**
 * Professional Portal Statement Generation utility.
 */
const generatePremiumPortalStatement = async ({
  data,
  save,
  returnBase64,
  template,
  dirhamIconBase64,
  finalFilename
}) => {
  try {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margins = { left: 40, right: 40, top: 40, bottom: 65 };
    const contentWidth = pageWidth - margins.left - margins.right;

    const accentHex = template?.accentColor || '#0f172a';
    const accentRgb = applyColor(accentHex, '#0f172a');

    // 1. Top Accent Bar
    doc.setFillColor(...accentRgb);
    doc.rect(0, 0, pageWidth, 8, 'F');

    // 2. Header Info
    let cursorY = margins.top + 10;
    const rows = Array.isArray(data?.statementRows) ? data.statementRows : [];
    const portalDisplayName = String(data?.portalName || data?.recipientName || 'Portal Activity').trim();
    const portalLogoEnabled = template?.portalLogoEnabled !== false;
    const portalLogoUrl = portalLogoEnabled
      ? String(data?.portalLogoUrl || data?.portalIconUrl || '').trim()
      : '';
    const portalLogoSource = await resolvePdfImageSource(portalLogoUrl);
    const brandingName = portalDisplayName;
    const leftHeaderTextX = portalLogoUrl ? margins.left + 54 : margins.left;
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(margins.left, cursorY - 10, contentWidth / 2 - 20, 75, 4, 4, 'F');
    
    // Left: Statement Title & Branding
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(26);
    doc.setTextColor(...accentRgb);
    doc.text('STATEMENT', leftHeaderTextX, cursorY + 20);

    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text(brandingName, leftHeaderTextX, cursorY + 38);

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    const portalNameLines = doc.splitTextToSize(`Prepared for: ${String(data?.recipientName || 'Client')}`, contentWidth / 2 - (portalLogoUrl ? 74 : 20));
    doc.text(portalNameLines, leftHeaderTextX, cursorY + 52);

    // Right: Tenant Details (Print Safe)
    const tenantLegalName = portalDisplayName;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(tenantLegalName, pageWidth - margins.right, cursorY + 20, { align: 'right' });
    
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    const tenantContactLines = [
      data?.portalType ? `Portal Type: ${data.portalType}` : '',
      data?.portalId ? `Portal ID: ${data.portalId}` : '',
      data?.portalMethod ? `Method: ${data.portalMethod}` : '',
    ].filter((s) => String(s || '').trim());
    
    let contactY = cursorY + 36;
    tenantContactLines.forEach(line => {
      doc.text(String(line), pageWidth - margins.right, contactY, { align: 'right' });
      contactY += 11;
    });

    // Draw Logo if available
    if (portalLogoSource) {
      addImageWithFallbackFormat(doc, portalLogoSource, margins.left + 5, cursorY - 5, 40, 40);
    }


    let openingBalance = rows.length > 0 && rows[0].description === 'Opening Balance' ? rows[0].balance : 0;
    let closingBalance = rows.length > 0 && rows[rows.length - 1].description === 'Closing Balance' ? rows[rows.length - 1].balance : 0;
    
    let debitTotal = 0;
    let creditTotal = 0;
    rows.forEach(r => {
      if (r.description !== 'Opening Balance' && r.description !== 'Closing Balance') {
        debitTotal += Number(r.debit || 0);
        creditTotal += Number(r.credit || 0);
      }
    });

    cursorY = Math.max(contactY, cursorY + 40 + portalNameLines.length * 15) + 16;

    // 3. Statement Summary Details
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margins.left, cursorY, contentWidth, 44, 4, 4, 'FD');
    
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('STATEMENT PERIOD', margins.left + 16, cursorY + 18);
    doc.text('REFERENCE ID', margins.left + contentWidth / 2, cursorY + 18, { align: 'center' });
    doc.text('GENERATED ON', margins.left + contentWidth - 16, cursorY + 18, { align: 'right' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    
    const desc = String(data?.description || '');
    const periodMatch = desc.match(/(\d{4}-\d{2}-\d{2})\s+to\s+(\d{4}-\d{2}-\d{2})/);
    const periodStr = periodMatch ? `${periodMatch[1]} TO ${periodMatch[2]}` : 'ALL TIME';
    
    doc.text(periodStr, margins.left + 16, cursorY + 32);
    doc.text(String(data?.statementRef || data?.txId || 'N/A').toUpperCase(), margins.left + contentWidth / 2, cursorY + 32, { align: 'center' });
    doc.text(String(data?.date || new Date().toISOString().slice(0, 10)), margins.left + contentWidth - 16, cursorY + 32, { align: 'right' });

    cursorY += 64;

    // 4. Financial Summary Cards (Reworked for 5 essential values)
    const cardSpacing = 8;
    const cardWidth = (contentWidth - (cardSpacing * 4)) / 5;
    const cards = [
      { label: 'OPENING BALANCE', value: openingBalance, color: [100, 116, 139] },
      { label: 'TOTAL RECEIVED / DEPOSITED', value: creditTotal, color: [16, 185, 129] },
      { label: 'TOTAL CREDIT', value: creditTotal, color: [5, 150, 105] }, // Placeholder separation
      { label: 'TOTAL DEBIT', value: debitTotal, color: [239, 68, 68] },
      { label: 'CLOSING BALANCE', value: closingBalance, color: accentRgb },
    ];

    cards.forEach((c, i) => {
      const cx = margins.left + (cardWidth + cardSpacing) * i;
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(cx, cursorY, cardWidth, 60, 4, 4, 'FD');
      
      doc.setFillColor(...c.color);
      doc.roundedRect(cx, cursorY, cardWidth, 4, 4, 4, 'F');
      doc.rect(cx, cursorY + 2, cardWidth, 2, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      const labelLines = doc.splitTextToSize(c.label, cardWidth - 10);
      doc.text(labelLines, cx + cardWidth / 2, cursorY + 16, { align: 'center' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(15, 23, 42);
      
      const valText = formatAmount(c.value, { trimTrailingZeros: false });
      const valWidth = doc.getTextWidth(valText);
      const iconSz = 7;
      const padding = 2;
      const totalW = dirhamIconBase64 ? (iconSz + padding + valWidth) : (doc.getTextWidth('AED ') + valWidth);
      const startX = cx + (cardWidth - totalW) / 2;
      
      drawDirhamAmount(doc, dirhamIconBase64, c.value, startX, cursorY + 45, {
        iconSize: iconSz,
        trimTrailingZeros: false
      });
    });

    cursorY += 84;

    // 5. Transactions Table
    autoTable(doc, {
      startY: cursorY,
      head: [['Date', 'Transaction Description', 'Credit In', 'Debit Out', 'Balance']],
      body: rows.map(r => {
        const d = String(r.date || '—');
        const descText = String(r.description || '—');
        const isOpt = descText === 'Opening Balance' || descText === 'Closing Balance';
        const creditVal = parseAmountText(r.credit);
        const debitVal = parseAmountText(r.debit);
        
        return [
          d,
          descText,
          isOpt ? '' : (creditVal > 0 ? formatAmount(creditVal) : '—'),
          isOpt ? '' : (debitVal > 0 ? formatAmount(debitVal) : '—'),
          formatAmount(r.balance),
        ];
      }),
      theme: 'grid',
      margin: { left: margins.left, right: margins.right },
      styles: {
        font: 'helvetica',
        fontSize: 8.5,
        cellPadding: { top: 6, bottom: 6, left: 6, right: 6 },
        lineColor: [241, 245, 249],
        lineWidth: 0.5,
        textColor: [51, 65, 85],
      },
      headStyles: {
        fillColor: accentRgb,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'left',
      },
      columnStyles: {
        0: { cellWidth: contentWidth * 0.14 },
        1: { cellWidth: contentWidth * 0.38 },
        2: { cellWidth: contentWidth * 0.16, halign: 'right' },
        3: { cellWidth: contentWidth * 0.16, halign: 'right' },
        4: { cellWidth: contentWidth * 0.16, halign: 'right', fontStyle: 'bold' },
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      didParseCell: (hookData) => {
        if (hookData.section !== 'body') return;
        const amountStr = String(hookData.cell.raw || '');
        const descText = String(hookData.row.raw[1] || '');
        const isOpt = descText === 'Opening Balance' || descText === 'Closing Balance';
        const isLedgerAmountColumn = hookData.column.index === 2 || hookData.column.index === 3;
        const amount = parseAmountText(amountStr);
        
        if (isOpt) {
            hookData.cell.styles.fontStyle = 'bold';
            hookData.cell.styles.textColor = [15, 23, 42];
            hookData.cell.styles.fillColor = [241, 245, 249];
        } else {
            // Index 2 is Credit In (Emerald), Index 3 is Debit Out (Rose)
            if (hookData.column.index === 2 && amount > 0) {
              hookData.cell.styles.textColor = [5, 150, 105];
            } else if (hookData.column.index === 3 && amount > 0) {
              hookData.cell.styles.textColor = [220, 38, 38];
            }
        }

        // Zero-value sanitization
        if (isLedgerAmountColumn && amount <= 0) {
          delete hookData.cell.__dirhamText;
          hookData.cell.text = isOpt ? [''] : ['—'];
        } else if (hookData.column.index >= 2 && amountStr && amount !== 0) {
          hookData.cell.__dirhamText = amountStr;
          hookData.cell.text = [''];
        } else if (hookData.column.index === 4) {
          hookData.cell.__dirhamText = amountStr;
          hookData.cell.text = [''];
        }
      },
      didDrawCell: (hookData) => {
        if (!dirhamIconBase64) return;
        if (hookData.section !== 'body') return;
        if (hookData.column.index < 2) return;
        
        const text = hookData.cell.__dirhamText;
        if (!text) return;
        
        const { x, y, width, height } = hookData.cell;
        const padding = 6;
        const iconSz = 7;
        const textWidth = doc.getTextWidth(text);
        const startX = x + width - padding - textWidth - iconSz - 2;
        const iconY = y + (height - iconSz) / 2 - 0.5;
        const textY = y + (height / 2) + 2.5;

        try {
          doc.addImage(dirhamIconBase64, 'PNG', startX, iconY, iconSz, iconSz);
        } catch { /* fallback to text drawing handled by jspdf if needed */ }

        doc.setFont('helvetica', hookData.cell.styles.fontStyle || 'normal');
        doc.setFontSize(hookData.cell.styles.fontSize || 8.5);
        if (hookData.cell.styles.textColor) {
          doc.setTextColor(...hookData.cell.styles.textColor);
        }
        doc.text(text, startX + iconSz + 2, textY);
      }
    });

    cursorY = doc.lastAutoTable.finalY + 30;

    // 6. Footer Disclaimer & Sign-off
    const disclaimerText = resolvePortalStatementDisclaimer(template, data);
    
    if (cursorY + 60 > pageHeight - margins.bottom) {
      doc.addPage();
      cursorY = margins.top;
    }

    doc.setDrawColor(226, 232, 240);
    doc.line(margins.left, cursorY, pageWidth - margins.right, cursorY);
    cursorY += 16;
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(220, 38, 38);
    doc.text('DISCLAIMER', margins.left, cursorY);
    
    cursorY += 12;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    const disclaimerLines = doc.splitTextToSize(disclaimerText, contentWidth);
    doc.text(disclaimerLines, margins.left, cursorY);

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 20, { align: 'center' });
    }

    const finalName = finalFilename || `PortalStatement_${String(data?.txId || Date.now())}.pdf`;

    if (save) {
      doc.save(finalName);
    }

    if (returnBase64) {
      const fullUri = doc.output('datauristring');
      const base64 = fullUri.split(',')[1];
      return { ok: true, doc, base64 };
    }

    return { ok: true, doc };
  } catch (error) {
    console.error('Premium PDF Generation failed:', error);
    return { ok: false, error: error.message };
  }
};

/**
 * Centered PDF generation utility.
 */
export const generateTenantPdf = async ({
  tenantId,
  documentType,
  data,
  save = true,
  returnBase64 = false,
  filename,
  templateOverride = null,
}) => {

  try {
    const dirhamIconBase64 = await loadDirhamIconBase64();
    const templatesRes = await fetchTenantPdfTemplates(tenantId);
    if (!templatesRes.ok) throw new Error('Failed to fetch templates.');

    const { template: rendererTemplate } = resolvePdfTemplateForRenderer({
      documentType,
      templateDoc: templatesRes.byType[documentType]
        || templatesRes.byType[documentType === 'invoice' ? 'nextInvoice' : documentType]
        || templatesRes.byType[documentType === 'payment' ? 'paymentReceipt' : documentType]
        || templatesRes.byType[documentType === 'clientStatement' ? 'statement' : documentType],
    });

    const prefRes = await getTenantSettingDoc(tenantId, 'preferenceSettings');
    const customizationDisabled = prefRes.ok && prefRes.data?.pdfCustomizationEnabled === false;

    const brandRes = await getTenantSettingDoc(tenantId, 'branding');
    const branding = brandRes.ok && brandRes.data ? brandRes.data : {};
    const masterRes = await getTenantSettingDoc(tenantId, 'pdfTemplate_default');
    const masterTemplate = masterRes.ok && masterRes.data ? masterRes.data : null;

    let finalFilename = filename;
    if (!finalFilename) {
      const idRulesRes = await getTenantSettingDoc(tenantId, 'transactionIdRules');
      if (idRulesRes.ok && idRulesRes.data?.filenamePolicies) {
        const policyKey = documentType === 'nextInvoice' ? 'proformaInvoice' : documentType;
        const policy = idRulesRes.data.filenamePolicies[policyKey];
        if (policy) {
          finalFilename = resolveDynamicFilename(policy, data);
        }
      }
    }

    const template = resolveMasterTemplate(rendererTemplate, masterTemplate, templateOverride, customizationDisabled);

    const {
      showCompanyName = true,
      showCompanyAddress = true,
      showBankDetails = true,
      showContactInfo = true,
      bankAccountsVisibility = [true],
      contactVisibilityMap = {},
      billingAddressPosition = 'right',
      portalLogoEnabled = true,
      portalTableEnabled = true,
      portalTableLayout = 'horizontal',
    } = template;

    const isPortalStatement = documentType === 'portalStatement';
    const isStatementLike = ['statement', 'clientStatement', 'portalStatementQuotation'].includes(documentType);

    if (isPortalStatement) {
      return await generatePremiumPortalStatement({
        data,
        save,
        returnBase64,
        template,
        dirhamIconBase64,
        finalFilename,
      });
    }

    const logoLibrary = normalizeLogoLibrary(branding);
    const logoUsage = branding.logoUsage || {};

    const headerLogoSlot = logoLibrary.find((slot) => slot.slotId === logoUsage.header);
    const footerLogoSlot = logoLibrary.find((slot) => slot.slotId === logoUsage.footer);
    const docLogoSlot = logoLibrary.find((slot) => slot.slotId === logoUsage[documentType]);
    const templateLogoSlot = logoLibrary.find((slot) => slot.slotId === String(template.logoSlotId || '').trim());
    const watermarkLogoSlot = logoLibrary.find((slot) => slot.slotId === String(template.watermarkLogoSlotId || '').trim());

    const headerImageUrl = '';
    const footerImageUrl = footerLogoSlot?.url || '';
    const docLogoUrl =
      templateLogoSlot?.url
      || docLogoSlot?.url
      || headerLogoSlot?.url
      || String(template.logoUrl || '').trim()
      || String(branding.activeLogoUrl || '').trim()
      || String(branding.logoUrl || '').trim()
      || String(branding.iconUrl || '').trim()
      || String(branding.brandLogoUrl || '').trim()
      || String(branding.companyLogoUrl || '').trim()
      || '';
    const watermarkLogoUrl = watermarkLogoSlot?.url || docLogoUrl;
    const portalLogoUrl = String(data?.portalLogoUrl || '').trim();
    const effectiveDocLogoUrl =
      isPortalStatement && portalLogoEnabled && portalLogoUrl
        ? portalLogoUrl
        : docLogoUrl;
    const [
      effectiveDocLogoSource,
      watermarkLogoSource,
      footerImageSource,
    ] = await Promise.all([
      resolvePdfImageSource(effectiveDocLogoUrl),
      resolvePdfImageSource(watermarkLogoUrl),
      resolvePdfImageSource(footerImageUrl),
    ]);

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margins = template.margins || PDF_DEFAULT_TEMPLATE.margins;
    const contentWidth = pageWidth - margins.left - margins.right;
    const runtimeFont = resolvePdfFont(template.fontStyle);
    doc.setFont(runtimeFont.family, runtimeFont.style);

    const normalizedItems = normalizeItems(data?.items, data?.description, data?.amount);
    const computedTotal = isPortalStatement
      ? toNumber(data?.amount, 0)
      : computeDocTotal(normalizedItems, data?.amount);
    const statementRows = Array.isArray(data?.statementRows) ? data.statementRows : [];
    const txId = String(data?.txId || 'N/A');
    const recipientName = String(data?.recipientName || 'Valued Client');
    const dateLabel = String(data?.date || new Date().toLocaleDateString());
    const subtitle = String(data?.description || '').trim();

    const brandingCompanyName = String(branding.companyName || branding.legalName || branding.brandName || '').trim();
    const { addresses: scannedAddresses, poBox } = normalizeBrandAddresses(branding);
    const visibleAddressLines = [
      ...scannedAddresses
        .filter((item) => visibilityAllows(contactVisibilityMap, item.key))
        .map((item) => item.value),
      ...(poBox && visibilityAllows(contactVisibilityMap, poBox.key) ? [poBox.value] : []),
    ];

    const brandingBankAccounts = Array.isArray(branding?.bankDetails) ? branding.bankDetails : [];
    const visibleBanks = brandingBankAccounts
      .filter((_, idx) => bankAccountsVisibility[idx] !== false)
      .map(readBrandingBankLines);

    const brandingContactLines = [];
    if (showContactInfo) {
      const emailContacts = normalizeEmailContacts(branding);
      const mobileContacts = normalizeMobileContacts(branding);
      const landlineContacts = Array.isArray(branding?.landlines) && branding.landlines.length
        ? branding.landlines
        : [branding?.landline].filter(Boolean);

      emailContacts.forEach((contact) => {
        if (visibilityAllows(contactVisibilityMap, contact.key, contact.legacyKey)) {
          brandingContactLines.push(`Email: ${contact.value}`);
        }
      });

      mobileContacts.forEach((contact) => {
        if (visibilityAllows(contactVisibilityMap, contact.key, contact.legacyKey)) {
          const prefix = contact.whatsAppEnabled ? '[WA] ' : '';
          brandingContactLines.push(`${prefix}Mobile: ${contact.value}`);
        }
      });

      landlineContacts.forEach((lineValue, idx) => {
        const normalizedLine = String(lineValue || '').trim();
        if (!normalizedLine) return;
        const key = idx === 0 ? 'showLandline' : `showLandline${idx + 1}`;
        if (contactVisibilityMap[key] !== false) {
          brandingContactLines.push(`Landline: ${normalizedLine}`);
        }
      });
    }

    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    const enableWatermark = template.enableWatermark === true;
    const watermarkOpacity = Math.min(0.35, Math.max(0.03, toNumber(template.watermarkOpacity, 0.08)));
    const watermarkScale = Math.min(1.3, Math.max(0.3, toNumber(template.watermarkScale, 0.7)));
    const watermarkPosition = String(template.watermarkPosition || 'center');
    const watermarkCenter = (() => {
      if (watermarkPosition === 'top') return { x: pageWidth / 2, y: pageHeight * 0.28 };
      if (watermarkPosition === 'bottom') return { x: pageWidth / 2, y: pageHeight * 0.72 };
      return { x: pageWidth / 2, y: pageHeight / 2 };
    })();

    if (enableWatermark) {
      try {
        doc.saveGraphicsState();
        doc.setGState(new doc.GState({ opacity: watermarkOpacity }));
        if (template.watermarkType === 'text') {
          const watermarkText = String(template.watermarkText || brandingCompanyName || 'ACIS').trim();
          if (watermarkText) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(54 * watermarkScale);
            doc.setTextColor(15, 23, 42);
            doc.text(watermarkText.toUpperCase(), watermarkCenter.x, watermarkCenter.y, {
              align: 'center',
              angle: watermarkPosition === 'diagonal' ? -35 : 0,
            });
          }
        } else if (watermarkLogoSource) {
          const wWidth = 220 * watermarkScale;
          const wHeight = 220 * watermarkScale;
          const wX = watermarkCenter.x - (wWidth / 2);
          const wY = watermarkCenter.y - (wHeight / 2);
          addImageWithFallbackFormat(doc, watermarkLogoSource, wX, wY, wWidth, wHeight);
        }
        doc.restoreGraphicsState();
      } catch (e) {
        console.warn('Watermark failed:', e);
        try {
          doc.restoreGraphicsState();
        } catch {
          // no-op
        }
      }
    }

    const brandingLines = [];
    if (showCompanyName && brandingCompanyName) brandingLines.push(brandingCompanyName);
    if (showCompanyAddress && visibleAddressLines.length) brandingLines.push(...visibleAddressLines);
    if (showContactInfo && brandingContactLines.length) brandingLines.push(...brandingContactLines);

    const hasLogo = Boolean(effectiveDocLogoSource);
    const logoIsCenter = template.logoPosition === 'center';
    const logoIsRight = template.logoPosition === 'right';
    const logoIsBottom = template.logoPosition === 'bottom';
    const titleText = resolveDocumentTitle(documentType, template).toUpperCase();
    const headerAccentRgb = applyColor(template.headerAccentColor || template.headerBackground, '#0f172a');
    const headerLooksWhite = headerAccentRgb.every((channel) => channel > 245);
    const safeHeaderAccentRgb = headerLooksWhite ? applyColor(PDF_DEFAULT_TEMPLATE.headerAccentColor, '#0f172a') : headerAccentRgb;

    const bodyFont = resolvePdfFont(template.fontStyle);
    const wrappedBrandingLines = [];
    doc.setFont(bodyFont.family, bodyFont.style);
    brandingLines.forEach((line, idx) => {
      doc.setFontSize(idx === 0 && showCompanyName && brandingCompanyName ? 11 : 8.5);
      const wrapped = doc.splitTextToSize(String(line), contentWidth - 20);
      wrappedBrandingLines.push({ lines: wrapped, isTitle: idx === 0 && showCompanyName && brandingCompanyName });
    });

    const brandingStartY = hasLogo && logoIsCenter ? 104 : 88;
    const brandingHeight = wrappedBrandingLines.reduce((total, row) => total + (row.lines.length * (row.isTitle ? 12 : 10)), 0);
    const headerHeight = Math.min(
      pageHeight - 220,
      Math.max(116, brandingStartY + brandingHeight + 18),
    );

    const headerRendered = addImageWithFallbackFormat(
      doc,
      headerImageUrl,
      margins.left,
      16,
      contentWidth,
      headerHeight - 16,
    );

    if (!headerRendered) {
      doc.setFillColor(...safeHeaderAccentRgb);
      doc.rect(0, 0, pageWidth, headerHeight, 'F');
    }

    if (!headerRendered) {
      if (hasLogo && !logoIsBottom) {
        let logoX = margins.left;
        if (logoIsCenter) logoX = (pageWidth - 60) / 2;
        if (logoIsRight) logoX = pageWidth - margins.right - 60;
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(logoX - 6, 14, 72, 72, 8, 8, 'F');
        addImageWithFallbackFormat(doc, effectiveDocLogoSource, logoX, 20, 60, 60);
      }

      let currentBrandingY = brandingStartY;
      doc.setTextColor(255, 255, 255);
      wrappedBrandingLines.forEach((row) => {
        doc.setFont(bodyFont.family, row.isTitle ? 'bold' : bodyFont.style);
        doc.setFontSize(row.isTitle ? 11 : 8.5);
        doc.text(row.lines, margins.left, currentBrandingY);
        currentBrandingY += row.lines.length * (row.isTitle ? 12 : 10);
      });

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont(bodyFont.family, 'bold');
      
      const titleAlign = logoIsRight ? 'left' : 'right';
      const titleX = logoIsRight ? margins.left : pageWidth - margins.right;
      const titleLines = doc.splitTextToSize(titleText, contentWidth * 0.42);
      doc.text(titleLines, titleX, 42, { align: titleAlign });

      const headerText = String(template.headerText || '').trim();
      if (headerText) {
        doc.setFontSize(10);
        doc.setFont(bodyFont.family, bodyFont.style);
        const lines = doc.splitTextToSize(headerText, 240);
        doc.text(lines, titleX, 66, { align: titleAlign });
      }
    }

    let cursorY = headerHeight + Math.max(24, margins.top);

    const ensurePageSpace = (requiredHeight = 80) => {
      const bottomLimit = pageHeight - Math.max(80, margins.bottom + 46);
      if (cursorY + requiredHeight <= bottomLimit) return;
      doc.addPage();
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
      cursorY = Math.max(42, margins.top);
    };

    doc.setTextColor(20, 23, 28);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`Reference: ${txId}`, margins.left, cursorY);
    doc.text(`Date: ${dateLabel}`, pageWidth - margins.right, cursorY, { align: 'right' });

    const renderRecipientBlock = (y) => {
      let currentY = y;
      doc.setFontSize(15);
      doc.setFont(bodyFont.family, 'bold');
      const label = 'Recipient: ';
      const align = billingAddressPosition === 'right' ? 'right' : 'left';
      const x = align === 'right' ? pageWidth - margins.right : margins.left;
      const recipientLines = doc.splitTextToSize(`${label}${recipientName}`, contentWidth * 0.56);
      doc.text(recipientLines, x, currentY, { align });
      currentY += Math.max(0, (recipientLines.length - 1) * 15);

      if (subtitle) {
        currentY += 16;
        doc.setFont(bodyFont.family, bodyFont.style);
        doc.setFontSize(10);
        const subtitleLines = doc.splitTextToSize(subtitle, contentWidth * 0.72);
        doc.text(subtitleLines, x, currentY, { align });
        return currentY + Math.max(14, subtitleLines.length * 10);
      }
      return currentY + 22;
    };

    if (billingAddressPosition !== 'bottom') {
      cursorY += 22;
      cursorY = renderRecipientBlock(cursorY);
    } else {
      cursorY += 22;
    }

    cursorY += 10;

    const isStatementDocument = isStatementLike;
    const shouldRenderTable = template.tableEnabled !== false && (!isPortalStatement || portalTableEnabled !== false);
    if (shouldRenderTable) {
      const currencyCellText = (value) => {
        if (dirhamIconBase64) return formatAmount(value, { trimTrailingZeros: isStatementDocument || isPortalStatement });
        if (isStatementDocument || isPortalStatement) return formatCurrencyText(value, { trimTrailingZeros: true });
        return formatCurrencyText(value);
      };
      const enableCurrencyCellIcon = Boolean(dirhamIconBase64);
      const useVerticalPortalTable = (isStatementDocument || isPortalStatement) && portalTableLayout === 'vertical';
      const isCompactLayout = String(template.bodyLayout || 'standard') === 'compact';
      const useStatementRows = (isStatementDocument || isPortalStatement) && statementRows.length > 0;
      const tableBody = useStatementRows
        ? (useVerticalPortalTable
          ? statementRows.flatMap((row, idx) => ([
            [`Entry ${idx + 1} Date`, String(row?.date || '—')],
            [`Entry ${idx + 1} Description`, String(row?.description || '—')],
            [`Entry ${idx + 1} Debit`, currencyCellText(row?.debit || 0)],
            [`Entry ${idx + 1} Credit`, currencyCellText(row?.credit || 0)],
            [`Entry ${idx + 1} Balance`, currencyCellText(row?.balance || 0)],
          ]))
          : statementRows.map((row) => ([
            String(row?.date || '—'),
            String(row?.description || '—'),
            currencyCellText(row?.debit || 0),
            currencyCellText(row?.credit || 0),
            currencyCellText(row?.balance || 0),
          ])))
        : (useVerticalPortalTable
          ? normalizedItems.map((item) => ([
            `${item.name}\nQty: ${item.qty} | Unit: ${currencyCellText(item.unit)}`,
            currencyCellText(item.total),
          ]))
          : normalizedItems.map((item) => ([
            item.name,
            String(item.qty),
            currencyCellText(item.unit),
            currencyCellText(item.total),
          ])));

      autoTable(doc, {
        startY: cursorY,
        head: useStatementRows
          ? (useVerticalPortalTable
            ? [['Field', 'Value']]
            : [['Date', 'Description', 'Debit', 'Credit', 'Balance']])
          : (useVerticalPortalTable
            ? [['Description', 'Amount']]
            : [['Description', 'Qty', 'Unit Price', 'Total']]),
        body: tableBody,
        theme: 'grid',
        margin: { left: margins.left, right: margins.right },
        styles: {
          font: bodyFont.family,
          fontSize: isCompactLayout ? 9 : 10,
          lineColor: [223, 226, 230],
          lineWidth: 0.6,
          cellPadding: isCompactLayout
            ? Math.max(3, toNumber(template.rowPadding, 8) / 2 - 1)
            : Math.max(4, toNumber(template.rowPadding, 8) / 2),
          textColor: [40, 40, 40],
        },
        headStyles: {
          fillColor: applyColor(template.tableAccentColor || template.accentColor, '#e67e22'),
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        columnStyles: useStatementRows
          ? (useVerticalPortalTable
            ? {
              0: { cellWidth: contentWidth * 0.35, fontStyle: 'bold' },
              1: { cellWidth: contentWidth * 0.65 },
            }
            : {
              0: { cellWidth: contentWidth * 0.16 },
              1: { cellWidth: contentWidth * 0.34 },
              2: { cellWidth: contentWidth * 0.16, halign: 'right', fontStyle: 'bold' },
              3: { cellWidth: contentWidth * 0.16, halign: 'right', fontStyle: 'bold' },
              4: { cellWidth: contentWidth * 0.18, halign: 'right', fontStyle: 'bold' },
            })
          : (useVerticalPortalTable
            ? {
              0: { cellWidth: contentWidth * 0.72 },
              1: { cellWidth: contentWidth * 0.28, halign: 'right', fontStyle: 'bold' },
            }
            : {
              0: { cellWidth: contentWidth * 0.52 },
              1: { cellWidth: contentWidth * 0.12, halign: 'center' },
              2: { cellWidth: contentWidth * 0.18, halign: 'right' },
              3: { cellWidth: contentWidth * 0.18, halign: 'right', fontStyle: 'bold' },
            }),
        didParseCell: (hookData) => {
          if (hookData.section !== 'body') return;

          const isNumericColumn = useStatementRows
            ? (useVerticalPortalTable ? hookData.column.index === 1 : [2, 3, 4].includes(hookData.column.index))
            : (useVerticalPortalTable ? hookData.column.index === 1 : [2, 3].includes(hookData.column.index));

          if (!isNumericColumn) return;

          if (useStatementRows && !useVerticalPortalTable) {
            const cellAmount = parseAmountText(hookData.cell.raw);
            if (hookData.column.index === 2) {
              hookData.cell.styles.textColor = cellAmount > 0 ? [190, 24, 24] : [130, 134, 140];
            } else if (hookData.column.index === 3) {
              hookData.cell.styles.textColor = cellAmount > 0 ? [4, 120, 87] : [130, 134, 140];
            } else {
              hookData.cell.styles.textColor = [36, 39, 45];
            }
          } else {
            hookData.cell.styles.textColor = [24, 24, 24];
          }

          if (enableCurrencyCellIcon) {
            hookData.cell.__dirhamText = String(hookData.cell.raw || '').trim();
            hookData.cell.text = [''];
          }
        },
        didDrawCell: (hookData) => {
          if (!enableCurrencyCellIcon || !dirhamIconBase64) return;
          if (hookData.section !== 'body') return;

          const numericColumns = useStatementRows
            ? (useVerticalPortalTable ? [1] : [2, 3, 4])
            : (useVerticalPortalTable ? [1] : [2, 3]);
          if (!numericColumns.includes(hookData.column.index)) return;

          const amountText = String(hookData.cell.__dirhamText || '').trim();
          if (!amountText) return;

          const { x, y, width, height } = hookData.cell;
          const padding = typeof hookData.cell.styles.cellPadding === 'number' ? hookData.cell.styles.cellPadding : 4;
          const iconSz = Math.min(height * 0.55, 9);
          const textWidth = doc.getTextWidth(amountText);
          const blockWidth = iconSz + 2 + textWidth;
          const halign = String(hookData.cell.styles.halign || '').toLowerCase();
          const startX = halign === 'right' ? (x + width - padding - blockWidth) : (x + padding);
          const iconY = y + (height - iconSz) / 2;
          const textY = y + (height / 2) + ((hookData.cell.styles.fontSize || 10) * 0.33);

          const textColor = Array.isArray(hookData.cell.styles.textColor)
            ? hookData.cell.styles.textColor
            : [24, 24, 24];

          try {
            doc.addImage(dirhamIconBase64, 'PNG', startX, iconY, iconSz, iconSz);
          } catch {
            return;
          }

          doc.setTextColor(textColor[0] ?? 24, textColor[1] ?? 24, textColor[2] ?? 24);
          doc.setFont('helvetica', hookData.cell.styles.fontStyle || 'normal');
          doc.setFontSize(hookData.cell.styles.fontSize || 10);
          doc.text(amountText, startX + iconSz + 2, textY);
        },
      });

      cursorY = (doc.lastAutoTable?.finalY || cursorY) + 24;
    }

    // Totals block (Quotation shows subtotal + discount + total)
    const quoteSubtotal = toNumber(data?.subtotalAmount, computedTotal);
    const quoteDiscount = toNumber(data?.discountAmount, 0);
    const showQuoteDiscount = documentType === 'quotation' && quoteDiscount > 0.0001;

    const drawTotalLine = (label, amount, y, color) => {
      const labelText = `${label}: `;
      const labelWidth = doc.getTextWidth(labelText);
      const valueText = formatAmount(amount, { trimTrailingZeros: isPortalStatement });
      const iconWidth = dirhamIconBase64 ? 14 : doc.getTextWidth('AED ');
      const startX = pageWidth - margins.right - (labelWidth + iconWidth + doc.getTextWidth(valueText));
      if (color) doc.setTextColor(...color);
      doc.text(labelText, startX, y);
      drawDirhamAmount(doc, dirhamIconBase64, amount, startX + labelWidth, y, {
        iconSize: 11,
        trimTrailingZeros: isPortalStatement,
      });
      return y;
    };

    ensurePageSpace(showQuoteDiscount ? 86 : 48);
    doc.setFont(bodyFont.family, 'bold');
    doc.setFontSize(14);
    if (showQuoteDiscount) {
      doc.setTextColor(...applyColor(template.bottomAccentColor || template.accentColor, '#e67e22'));
      drawTotalLine('Total Amount', quoteSubtotal, cursorY, applyColor(template.bottomAccentColor || template.accentColor, '#e67e22'));
      cursorY += 18;
      doc.setTextColor(120, 120, 120);
      drawTotalLine('Discount', -quoteDiscount, cursorY, [120, 120, 120]);
      cursorY += 18;
    }
    doc.setTextColor(...applyColor(template.bottomAccentColor || template.accentColor, '#e67e22'));
    const totalLabel = showQuoteDiscount ? 'Balance' : 'Grand Total';
    drawTotalLine(totalLabel, computedTotal, cursorY, applyColor(template.bottomAccentColor || template.accentColor, '#e67e22'));

    if (billingAddressPosition === 'bottom') {
      cursorY += 30;
      doc.setTextColor(20, 23, 28);
      cursorY = renderRecipientBlock(cursorY);
    }

    const resolvedTerms = template.enableTerms !== false ? resolveTemplateTerms(template, data, documentType) : '';
    if (resolvedTerms) {
      cursorY += 26;
      ensurePageSpace(80);
      doc.setFont(bodyFont.family, 'bold');
      doc.setFontSize(11);
      doc.setTextColor(36, 38, 42);
      doc.text('Terms and Conditions', margins.left, cursorY);

      cursorY += 16;
      doc.setFont(bodyFont.family, bodyFont.style);
      doc.setFontSize(9);
      const lines = doc.splitTextToSize(resolvedTerms, contentWidth);
      ensurePageSpace(Math.min(180, lines.length * 10 + 24));
      doc.text(lines, margins.left, cursorY);
      cursorY += lines.length * 10;
    }

    const footerInfoRows = [];
    if (showBankDetails && visibleBanks.length) {
      visibleBanks.forEach((bankLines, idx) => {
        footerInfoRows.push({ label: `Bank ${visibleBanks.length > 1 ? idx + 1 : ''}`, value: bankLines.join(' | ') });
      });
    }

    if (footerInfoRows.length) {
      cursorY += 18;
      ensurePageSpace(70);
      doc.setDrawColor(224, 227, 232);
      doc.line(margins.left, cursorY, pageWidth - margins.right, cursorY);
      cursorY += 14;
      doc.setFont(bodyFont.family, bodyFont.style);
      doc.setFontSize(9);
      doc.setTextColor(70, 74, 82);

      footerInfoRows.forEach((row) => {
        const lineText = `${row.label}: ${row.value}`;
        const wrapped = doc.splitTextToSize(lineText, contentWidth);
        ensurePageSpace(wrapped.length * 10 + 12);
        doc.text(wrapped, margins.left, cursorY);
        cursorY += Math.max(11, wrapped.length * 10);
      });
    }

    if (isPortalStatement) {
      const disclaimerText = resolvePortalStatementDisclaimer(template, data);
      cursorY += 16;
      doc.setDrawColor(224, 227, 232);
      doc.line(margins.left, cursorY, pageWidth - margins.right, cursorY);
      cursorY += 14;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(140, 40, 40);
      const disclaimerLines = doc.splitTextToSize(disclaimerText, contentWidth);
      doc.text(disclaimerLines, margins.left, cursorY);
      cursorY += Math.max(10, disclaimerLines.length * 10);
    }

    const footerY = pageHeight - Math.max(40, margins.bottom);
    if (cursorY > footerY - 92) {
      doc.addPage();
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
      cursorY = Math.max(42, margins.top);
    }

    if (hasLogo && logoIsBottom) {
      const bottomLogoWidth = 58;
      const bottomLogoHeight = 58;
      addImageWithFallbackFormat(
        doc,
        effectiveDocLogoSource,
        (pageWidth - bottomLogoWidth) / 2,
        footerY - 76,
        bottomLogoWidth,
        bottomLogoHeight,
      );
      doc.setDrawColor(...applyColor(template.bottomAccentColor || template.accentColor, '#e67e22'));
      doc.line(margins.left, footerY - 10, pageWidth - margins.right, footerY - 10);
    }

    const footerRendered = addImageWithFallbackFormat(
      doc,
      footerImageSource,
      margins.left,
      footerY - 38,
      contentWidth,
      40,
    );

    if (!footerRendered) {
      doc.setFont(bodyFont.family, bodyFont.style);
      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      const footerLines = doc.splitTextToSize(resolveDocumentFooter(documentType, template), contentWidth);
      if (footerLines.length) {
        doc.text(footerLines, pageWidth / 2, footerY - 14, { align: 'center' });
      }
      const footerLink = String(template.footerLink || '').trim();
      if (footerLink) {
        doc.setTextColor(...applyColor(template.bottomAccentColor || template.accentColor, '#e67e22'));
        doc.text(footerLink, pageWidth / 2, footerY, { align: 'center' });
      }
    }

    if (save) {
      doc.save(finalFilename || `${documentType}_${txId || Date.now()}.pdf`);
    }

    if (returnBase64) {
      const fullUri = doc.output('datauristring');
      const base64 = fullUri.split(',')[1];
      return { ok: true, doc, base64 };
    }

    return { ok: true, doc };
  } catch (error) {
    console.error('PDF Generation failed:', error);
    return { ok: false, error: error.message };
  }
};
