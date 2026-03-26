/**
 * Smart Bulk Employee Parser Logic - "CONTEXT ANCHOR EDITION"
 * 
 * Restored for maximum performance. This scans the raw PDF text,
 * finds a 14-digit Person Code, and searches the nearby text 
 * (+/- 400 chars) to find the Name, IDs, and Dates without 
 * relying on unaligned exact Y-coordinates.
 */

const PERSON_CODE_REGEX = /\b\d{14}\b/g;
const EXPIRY_DATE_REGEX = /\b\d{2}\/\d{2}\/\d{4}\b/g;

// Essential Blacklist: Words that look like Names but are actually PDF labels or company parts.
const NAME_BLACKLIST = [
  'WORK PERMIT', 'ESTABLISHMENT', 'PERSON CODE', 'PASSPORT',
  'CARD NUMBER', 'EXPIRY DATE', 'NATIONALITY', 'NAME', 'EMPLOYEE',
  'SERIAL', 'STATUS', 'MINISTRY', 'HUMAN RESOURCES', 'MOHRE',
  'LABOR', 'EMIRATISATION', 'PAGE', 'TOTAL', 'DATE OF BIRTH',
  'REPORT', 'PRINTED', 'ACTIVE', 'CANCELLED', 'USER',
  'CARD TYPE', 'SALES OFFICER', 'OR TEMPORARY', 'PROFESSION',
  'GENDER', 'MALE', 'FEMALE', 'ELECTRONIC', 'MOBILE',
  'LIMITED', 'L.L.C', 'LLC', 'COMPANY', 'EST', 'GROUP' // Company name anchors
];

// Expanded Countries fallback (Used only if it explicitly finds it in the text near the person)
const COUNTRIES = [
  'INDIA', 'PAKISTAN', 'BANGLADESH', 'EGYPT', 'SYRIA', 'SRI LANKA', 
  'PHILIPPINES', 'NEPAL', 'NIGERIA', 'ETHIOPIA', 'INDONESIA', 'VIETNAM',
  'UNITED ARAB EMIRATES', 'UAE', 'MOROCCO', 'JORDAN', 'SUDAN', 'GHANA',
  'UGANDA', 'KENYA', 'CAMEROON', 'AFGHANISTAN', 'YEMEN', 'LEBANON', 'TUNISIA'
];

export const parseMohreEmployeeList = (rawText) => {
  if (!rawText || typeof rawText !== 'string') return [];

  const employees = [];
  const cleanText = rawText.replace(/[ \t]+/g, ' ').toUpperCase();
  const matches = [...cleanText.matchAll(PERSON_CODE_REGEX)];
  const seenCodes = new Set();
  const sequence = [];
  
  for (const match of matches) {
    const code = match[0];
    if (!seenCodes.has(code)) {
      seenCodes.add(code);
      sequence.push({ code, index: match.index });
    }
  }

  // MOHRE Application Type Keywords (Used as the absolute STOP point for Employee Names)
  const PERMIT_KEYWORDS = [
    'NEW ELECTRONIC WORK',
    'RENEW ELECTRONIC WORK',
    'NATIONAL AND GCC ELECTRONIC',
    'MODIFY-NATIONAL AND GCC',
    'ELECTRONIC WORK PERMIT FOR',
    'GOLDEN VISA WORK PERMIT',
    'PRE APPROVAL FOR WORK',
    'NEW ON HUSBAND/FATHER',
    // Catch-alls for messy extraction
    'ELECTRONIC WORK',
    'WORK PERMIT'
  ];

  for (let i = 0; i < sequence.length; i++) {
    const current = sequence[i];
    const prev = sequence[i - 1];
    const next = sequence[i + 1];

    let startBoundary = prev ? prev.index + 14 : Math.max(0, current.index - 300);
    const textBeforeCode = cleanText.slice(startBoundary, current.index);
    const lastParagraphBreak = textBeforeCode.lastIndexOf('\n\n');
    if (lastParagraphBreak !== -1) {
       startBoundary = startBoundary + lastParagraphBreak;
    }

    const endBoundary = next ? next.index : Math.min(cleanText.length, current.index + 300);
    const context = cleanText.slice(startBoundary, endBoundary).replace(/\n/g, ' ');

    let extractedName = 'UNKNOWN EMPLOYEE';
    let extractedCard = '';
    let extractedPassport = '';

    // 1. Discover Passport (Usually the first alphanumeric word > 6 chars)
    const idMatches = context.match(/\b[A-Z0-9]{6,15}\b/g) || [];
    const validPassports = idMatches.filter(p => !p.match(/^\d{14}$/) && !p.match(/^\d{9}$/)); // Ignore PersonCode and CardID
    extractedPassport = validPassports[0] || '';

    // 2. Discover Keywords & Extract Name
    // Name starts after passport, ends exactly at the Permit Keyword.
    let searchStart = extractedPassport ? (context.indexOf(extractedPassport) + extractedPassport.length) : 0;
    
    let keywordFoundAt = context.length;
    let foundKeyword = null;

    for (const kw of PERMIT_KEYWORDS) {
        const kwIdx = context.indexOf(kw, searchStart);
        if (kwIdx !== -1 && kwIdx < keywordFoundAt) {
            keywordFoundAt = kwIdx;
            foundKeyword = kw;
        }
    }

    if (keywordFoundAt < context.length) {
        let possibleName = context.slice(searchStart, keywordFoundAt).trim();
        // Clean leftover Arabic or random numbers if any
        possibleName = possibleName.replace(/[\d]/g, '').trim(); 
        if (possibleName.length > 3) extractedName = possibleName;

        // 3. Discover Card ID (First 9 digit number immediately AFTER the keyword!)
        const textAfterKeyword = context.slice(keywordFoundAt + foundKeyword.length);
        const cardMatch = textAfterKeyword.match(/\b\d{9}\b/);
        extractedCard = cardMatch ? cardMatch[0] : '';
    } else {
        // Fallback Name discovery if no keyword found
        const potentialNames = context.match(/[A-Z]{3,}(?:\s[A-Z]{3,}){1,5}/g) || [];
        const nameCandidates = potentialNames
          .filter(n => n.length > 5) 
          .filter(n => !NAME_BLACKLIST.some(kw => n.includes(kw))) 
          .filter(n => !COUNTRIES.includes(n))
          .sort((a, b) => b.length - a.length);
        if (nameCandidates.length > 0) extractedName = nameCandidates[0].trim();

        const cardMatches = context.match(/\b\d{9}\b/g) || [];
        extractedCard = cardMatches.find(c => !current.code.includes(c)) || '';
    }

    // 4. Discover Expiry Date & Nationality
    const expiryDates = context.match(EXPIRY_DATE_REGEX) || [];
    const foundCountry = COUNTRIES.find(c => context.includes(` ${c} `) || context.includes(`${c}`));

    employees.push({
      personCode: current.code,
      passportNumber: extractedPassport,
      fullName: extractedName,
      nationality: foundCountry || 'UNKNOWN',
      dateOfBirth: '',
      cardId: extractedCard,
      expiryDate: expiryDates.length > 0 ? expiryDates[expiryDates.length - 1] : '',
      status: 'pending'
    });
  }

  return employees;
};

/**
 * Standard text-layer extraction. 
 * Reads the native PDF items and joins them into a clean string mapped precisely in order.
 */
export const extractPdfText = async (fileBlob) => {
  if (!fileBlob) throw new Error('No file provided.');

  const pdfjsLib = await import('pdfjs-dist');
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    try {
      const workerUrl = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url);
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl.href;
    } catch {
      pdfjsLib.GlobalWorkerOptions.workerSrc = '';
    }
  }

  const arrayBuffer = await fileBlob.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pageTexts = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    
    // Simple top-to-bottom, left-to-right sorting (Smooths out PDF anomalies without forcing exact Rows)
    const sortedItems = [...textContent.items].sort((a, b) => {
      // If items are roughly on the same vertical line (within 5px), sort them horizontally
      if (Math.abs(a.transform[5] - b.transform[5]) < 5) {
        return a.transform[4] - b.transform[4];
      }
      // Otherwise, sort them vertically top to bottom
      return b.transform[5] - a.transform[5];
    });

    const pageText = sortedItems.map(item => item.str).join(' ');
    pageTexts.push(pageText);
  }

  return pageTexts.join('\n');
};
