import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PORTAL_STATEMENT_DISCLAIMER_TEXT, resolvePdfTemplateForRenderer, PDF_DEFAULT_TEMPLATE } from './pdfTemplateRenderer';
import { fetchTenantPdfTemplates, getTenantSettingDoc } from './backendStore';

const resolveTemplateTerms = (template, data) => {
  const quotationSpecificTerms = String(data?.termsAndConditions || '').trim();
  if (quotationSpecificTerms) return quotationSpecificTerms;
  const rawTerms = String(template?.termsAndConditions || '').trim();
  if (!rawTerms) return '';
  const expiryDate = String(data?.expiryDate || '').trim() || 'the selected expiry date';
  return rawTerms.replaceAll('{{expiryDate}}', expiryDate);
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
      text = `Dhs ${numStr}`;
    }
  } else {
    text = `Dhs ${numStr}`;
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

/**
 * Professional Portal Statement Generation utility.
 */
const generatePremiumPortalStatement = async ({
  data,
  save,
  returnBase64,
  template,
  branding,
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
    
    // Left: Statement Title & Branding
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(26);
    doc.setTextColor(...accentRgb);
    doc.text('STATEMENT', margins.left, cursorY + 20);

    const brandingName = String(branding?.legalName || branding?.brandName || 'Portal Activity').trim();
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text(brandingName, margins.left, cursorY + 38);

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    const portalNameLines = doc.splitTextToSize(`Prepared for: ${String(data?.recipientName || 'Client')}`, contentWidth / 2 - 20);
    doc.text(portalNameLines, margins.left, cursorY + 52);

    // Right: Tenant Details (Print Safe)
    const tenantLegalName = String(branding?.legalName || 'Sovereign Service').trim();
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(tenantLegalName, pageWidth - margins.right, cursorY + 20, { align: 'right' });
    
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    const tenantContactLines = [
      branding?.officeAddress,
      branding?.emirate ? `${branding.emirate}, ${branding.country || 'UAE'}` : '',
      branding?.emailContacts?.[0]?.value ? `Email: ${branding.emailContacts[0].value}` : '',
      branding?.mobileContacts?.[0]?.value ? `Tel: ${branding.mobileContacts[0].value}` : ''
    ].filter((s) => String(s || '').trim());
    
    let contactY = cursorY + 36;
    tenantContactLines.forEach(line => {
      doc.text(String(line), pageWidth - margins.right, contactY, { align: 'right' });
      contactY += 11;
    });

    // mica styling cues in header
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(margins.left, cursorY - 10, contentWidth / 2 - 20, 75, 4, 4, 'F');
    // Draw Logo if available
    const logoUrl = branding?.logoUrl || branding?.iconUrl || '';
    if (logoUrl) {
      addImageWithFallbackFormat(doc, logoUrl, margins.left + 5, cursorY - 5, 40, 40);
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
      const totalW = dirhamIconBase64 ? (iconSz + padding + valWidth) : (doc.getTextWidth('Dhs ') + valWidth);
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
    const disclaimerText = PORTAL_STATEMENT_DISCLAIMER_TEXT || "CONFIDENTIALITY NOTICE: This statement is highly confidential. If you are not the intended recipient, any disclosure, copying, distribution or any action taken or omitted to be taken in reliance on it, is strictly prohibited and may be unlawful.";
    
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
}) => {
  try {
    const dirhamIconBase64 = await loadDirhamIconBase64();
    const templatesRes = await fetchTenantPdfTemplates(tenantId);
    if (!templatesRes.ok) throw new Error('Failed to fetch templates.');

    const { template } = resolvePdfTemplateForRenderer({
      documentType,
      templateDoc: templatesRes.byType[documentType],
    });

    const prefRes = await getTenantSettingDoc(tenantId, 'preferenceSettings');
    const customizationDisabled = prefRes.ok && prefRes.data?.pdfCustomizationEnabled === false;

    const brandRes = await getTenantSettingDoc(tenantId, 'branding');
    const branding = brandRes.ok && brandRes.data ? brandRes.data : {};

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

    const sourceTemplate = customizationDisabled ? PDF_DEFAULT_TEMPLATE : template;

    const {
      showCompanyName = true,
      showCompanyAddress = true,
      showBankDetails = false,
      showContactInfo = true,
      bankAccountsVisibility = [true],
      contactVisibilityMap = {},
      billingAddressPosition = 'right',
      portalLogoEnabled = true,
      portalTableEnabled = true,
      portalTableLayout = 'horizontal',
    } = sourceTemplate;

    const isPortalStatement = documentType === 'portalStatement';

    if (isPortalStatement) {
      return await generatePremiumPortalStatement({
        data,
        save,
        returnBase64,
        template: sourceTemplate,
        branding,
        dirhamIconBase64,
        finalFilename,
      });
    }

    const logoLibrary = Array.isArray(branding.logoLibrary) ? branding.logoLibrary : [];
    const logoUsage = branding.logoUsage || {};

    const headerLogoSlot = logoLibrary.find((slot) => slot.slotId === logoUsage.header);
    const footerLogoSlot = logoLibrary.find((slot) => slot.slotId === logoUsage.footer);
    const docLogoSlot = logoLibrary.find((slot) => slot.slotId === logoUsage[documentType]);
    const templateLogoSlot = logoLibrary.find((slot) => slot.slotId === String(template.logoSlotId || '').trim());

    const headerImageUrl = headerLogoSlot?.url || '';
    const footerImageUrl = footerLogoSlot?.url || '';
    const docLogoUrl =
      templateLogoSlot?.url
      || docLogoSlot?.url
      || headerLogoSlot?.url
      || String(template.logoUrl || '').trim()
      || '';
    const portalLogoUrl = String(data?.portalLogoUrl || '').trim();
    const effectiveDocLogoUrl =
      isPortalStatement && portalLogoEnabled && portalLogoUrl
        ? portalLogoUrl
        : docLogoUrl;

    const format = String(template.paperSize || 'A4').toUpperCase() === 'A4' ? 'a4' : 'letter';
    const doc = new jsPDF({
      orientation: template.orientation,
      unit: 'pt',
      format,
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margins = template.margins;
    const contentWidth = pageWidth - margins.left - margins.right;

    const normalizedItems = normalizeItems(data?.items, data?.description, data?.amount);
    const computedTotal = isPortalStatement
      ? toNumber(data?.amount, 0)
      : computeDocTotal(normalizedItems, data?.amount);
    const statementRows = Array.isArray(data?.statementRows) ? data.statementRows : [];
    const txId = String(data?.txId || 'N/A');
    const recipientName = String(data?.recipientName || 'Valued Client');
    const dateLabel = String(data?.date || new Date().toLocaleDateString());
    const subtitle = String(data?.description || '').trim();

    const brandingCompanyName = String(branding.legalName || branding.brandName || '').trim();
    const brandingAddresses = [
      branding?.officeAddress,
      branding?.emirate,
      branding?.country,
    ].filter((s) => String(s || '').trim()).map(s => String(s).trim());

    const brandingBankAccounts = Array.isArray(branding?.bankDetails) ? branding.bankDetails : [];
    const visibleBanks = brandingBankAccounts
      .filter((_, idx) => bankAccountsVisibility[idx])
      .map(readBrandingBankLines);

    const brandingContactLines = [];
    if (showContactInfo) {
      const emailContacts = Array.isArray(branding?.emailContacts) ? branding.emailContacts : [];
      const mobileContacts = Array.isArray(branding?.mobileContacts) ? branding.mobileContacts : [];

      emailContacts.forEach((c, idx) => {
        const key = idx === 0 ? 'showPrimaryEmail' : `showEmail${idx + 1}`;
        if (contactVisibilityMap[key] !== false && c.value) {
          brandingContactLines.push(`Email: ${c.value}`);
        }
      });

      mobileContacts.forEach((c, idx) => {
        const key = idx === 0 ? 'showPrimaryMobile' : `showMobile${idx + 1}`;
        if (contactVisibilityMap[key] !== false && c.value) {
          const prefix = c.whatsAppEnabled ? '[WA] ' : '';
          brandingContactLines.push(`${prefix}Mobile: ${c.value}`);
        }
      });

      if (branding?.landline && contactVisibilityMap.showLandline !== false) {
        brandingContactLines.push(`Landline: ${branding.landline}`);
      }
    }

    doc.setFillColor(...applyColor(template.backgroundColor, '#ffffff'));
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    if (template.backgroundType === 'gradient') {
      const start = applyColor(template.gradientStart, '#fff6e8');
      const end = applyColor(template.gradientEnd, '#f7d8a8');
      const steps = 60;
      const rectHeight = pageHeight / steps;
      for (let i = 0; i < steps; i += 1) {
        const ratio = i / (steps - 1);
        const r = Math.round(start[0] + (end[0] - start[0]) * ratio);
        const g = Math.round(start[1] + (end[1] - start[1]) * ratio);
        const b = Math.round(start[2] + (end[2] - start[2]) * ratio);
        doc.setFillColor(r, g, b);
        doc.rect(0, i * rectHeight, pageWidth, rectHeight + 1, 'F');
      }
    }

    const headerHeight = 100;
    const headerRendered = addImageWithFallbackFormat(
      doc,
      headerImageUrl,
      margins.left,
      16,
      contentWidth,
      headerHeight - 16,
    );

    if (headerRendered && isPortalStatement && portalLogoEnabled && effectiveDocLogoUrl) {
      const badgeSize = 48;
      const badgePadding = 4;
      const badgeX = margins.left;
      const badgeY = 20;
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(badgeX - badgePadding, badgeY - badgePadding, badgeSize + (badgePadding * 2), badgeSize + (badgePadding * 2), 8, 8, 'F');
      addImageWithFallbackFormat(doc, effectiveDocLogoUrl, badgeX, badgeY, badgeSize, badgeSize);
    }

    if (!headerRendered) {
      doc.setFillColor(...applyColor(template.headerBackground, '#0f172a'));
      doc.rect(0, 0, pageWidth, headerHeight, 'F');

      if (effectiveDocLogoUrl) {
        addImageWithFallbackFormat(doc, effectiveDocLogoUrl, margins.left, 20, 60, 60);
      }

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text(String(template.titleText || documentType || 'DOCUMENT').toUpperCase(), pageWidth - margins.right, 42, { align: 'right' });

      const headerText = String(template.headerText || '').trim();
      if (headerText) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const lines = doc.splitTextToSize(headerText, 240);
        doc.text(lines, pageWidth - margins.right, 62, { align: 'right' });
      }
    }

    let cursorY = headerHeight + margins.top;

    doc.setTextColor(20, 23, 28);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`Reference: ${txId}`, margins.left, cursorY);
    doc.text(`Date: ${dateLabel}`, pageWidth - margins.right, cursorY, { align: 'right' });

    const renderRecipientBlock = (y) => {
      let currentY = y;
      doc.setFontSize(15);
      doc.setFont('helvetica', 'bold');
      const label = 'Recipient: ';
      const align = billingAddressPosition === 'right' ? 'right' : 'left';
      const x = align === 'right' ? pageWidth - margins.right : margins.left;
      doc.text(`${label}${recipientName}`, x, currentY, { align });

      if (subtitle) {
        currentY += 16;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        const subtitleLines = doc.splitTextToSize(subtitle, contentWidth);
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

    const shouldRenderTable = !isPortalStatement || portalTableEnabled !== false;
    if (shouldRenderTable) {
      const currencyCellText = (value) => {
        if (isPortalStatement) return formatAmount(value, { trimTrailingZeros: true });
        return formatCurrencyText(value);
      };
      const enableCurrencyCellIcon = Boolean(dirhamIconBase64) && isPortalStatement;
      const useVerticalPortalTable = isPortalStatement && portalTableLayout === 'vertical';
      const isCompactLayout = String(template.bodyLayout || 'standard') === 'compact';
      const useStatementRows = isPortalStatement && statementRows.length > 0;
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
          fontSize: isCompactLayout ? 9 : 10,
          lineColor: [223, 226, 230],
          lineWidth: 0.6,
          cellPadding: isCompactLayout
            ? Math.max(3, toNumber(template.rowPadding, 8) / 2 - 1)
            : Math.max(4, toNumber(template.rowPadding, 8) / 2),
          textColor: [40, 40, 40],
        },
        headStyles: {
          fillColor: applyColor(template.accentColor, '#e67e22'),
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
      const iconWidth = dirhamIconBase64 ? 14 : doc.getTextWidth('Dhs ');
      const startX = pageWidth - margins.right - (labelWidth + iconWidth + doc.getTextWidth(valueText));
      if (color) doc.setTextColor(...color);
      doc.text(labelText, startX, y);
      drawDirhamAmount(doc, dirhamIconBase64, amount, startX + labelWidth, y, {
        iconSize: 11,
        trimTrailingZeros: isPortalStatement,
      });
      return y;
    };

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    if (showQuoteDiscount) {
      doc.setTextColor(...applyColor(template.accentColor, '#e67e22'));
      drawTotalLine('Total Amount', quoteSubtotal, cursorY, applyColor(template.accentColor, '#e67e22'));
      cursorY += 18;
      doc.setTextColor(120, 120, 120);
      drawTotalLine('Discount', -quoteDiscount, cursorY, [120, 120, 120]);
      cursorY += 18;
    }
    doc.setTextColor(...applyColor(template.accentColor, '#e67e22'));
    const totalLabel = showQuoteDiscount ? 'Balance' : 'Grand Total';
    drawTotalLine(totalLabel, computedTotal, cursorY, applyColor(template.accentColor, '#e67e22'));

    if (billingAddressPosition === 'bottom') {
      cursorY += 30;
      doc.setTextColor(20, 23, 28);
      cursorY = renderRecipientBlock(cursorY);
    }

    const resolvedTerms = documentType === 'quotation' ? resolveTemplateTerms(template, data) : '';
    if (resolvedTerms) {
      cursorY += 26;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(36, 38, 42);
      doc.text('Terms and Conditions', margins.left, cursorY);

      cursorY += 16;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const lines = doc.splitTextToSize(resolvedTerms, contentWidth);
      doc.text(lines, margins.left, cursorY);
      cursorY += lines.length * 10;
    }

    const footerInfoRows = [];
    if (showCompanyName && brandingCompanyName) {
      footerInfoRows.push({ label: 'Company', value: brandingCompanyName });
    }
    if (showCompanyAddress && brandingAddresses.length) {
      footerInfoRows.push({ label: 'Address', value: brandingAddresses.join(' | ') });
    }
    if (showBankDetails && visibleBanks.length) {
      visibleBanks.forEach((bankLines, idx) => {
        footerInfoRows.push({ label: `Bank ${visibleBanks.length > 1 ? idx + 1 : ''}`, value: bankLines.join(' | ') });
      });
    }
    if (showContactInfo && brandingContactLines.length) {
      footerInfoRows.push({ label: 'Contact', value: brandingContactLines.join(' | ') });
    }

    if (footerInfoRows.length) {
      cursorY += 18;
      doc.setDrawColor(224, 227, 232);
      doc.line(margins.left, cursorY, pageWidth - margins.right, cursorY);
      cursorY += 14;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(70, 74, 82);

      footerInfoRows.forEach((row) => {
        const lineText = `${row.label}: ${row.value}`;
        const wrapped = doc.splitTextToSize(lineText, contentWidth);
        doc.text(wrapped, margins.left, cursorY);
        cursorY += Math.max(11, wrapped.length * 10);
      });
    }

    if (isPortalStatement) {
      const disclaimerText = PORTAL_STATEMENT_DISCLAIMER_TEXT;
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

    const footerY = pageHeight - margins.bottom;
    const footerRendered = addImageWithFallbackFormat(
      doc,
      footerImageUrl,
      margins.left,
      footerY - 38,
      contentWidth,
      40,
    );

    if (!footerRendered) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      const footerLines = doc.splitTextToSize(String(template.footerText || '').trim(), contentWidth);
      if (footerLines.length) {
        doc.text(footerLines, pageWidth / 2, footerY - 14, { align: 'center' });
      }
      const footerLink = String(template.footerLink || '').trim();
      if (footerLink) {
        doc.setTextColor(...applyColor(template.accentColor, '#e67e22'));
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
