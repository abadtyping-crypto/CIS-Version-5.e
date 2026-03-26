/**
 * MOHRE Person Code (URN) Decoder Utility
 * 
 * Logic provided by USER:
 * - 14 Digits total.
 * - Digits 1-3: Nationality Code (e.g., 200 = Pakistan, 100 = India, 021 = UAE).
 * - Digits 4-9: Date of Birth (Format: DDMMYY or YYMMDD - to be verified).
 * - Digits 10-14: Sequential / System ID.
 */

const NATIONALITY_MAP = {
  '021': 'UNITED ARAB EMIRATES',
  '100': 'INDIA',
  '200': 'PAKISTAN',
  '300': 'EGYPT', // Assumption
  '400': 'BANGLADESH', // Assumption
  '500': 'PHILIPPINES', // Assumption
  '600': 'SRI LANKA', // Assumption
  '001': 'EGYPT', // User mentioned 001 for Egypt
};

/**
 * Decodes a 14-digit MOHRE Person Code.
 * @param {string} code 
 * @returns {object|null}
 */
export const decodeMohrePersonCode = (code) => {
  if (!code || typeof code !== 'string' || code.length !== 14) return null;

  const natCode = code.slice(0, 3);
  const dobRaw = code.slice(3, 9);
  const sequence = code.slice(9);

  // Attempt to parse DOB (Assuming DDMMYY or YYMMDD)
  // We'll try to guess based on common sense
  let dob = null;
  const d1 = parseInt(dobRaw.slice(0, 2));
  const d2 = parseInt(dobRaw.slice(2, 4));
  const d3 = parseInt(dobRaw.slice(4, 6));

  // Heuristic: If d1 > 31, it's probably YYMMDD
  if (d1 > 31) {
    // YYMMDD
    const yearPrefix = d1 > 30 ? '19' : '20'; // Simple threshold
    dob = `${yearPrefix}${dobRaw.slice(0, 2)}-${dobRaw.slice(2, 4)}-${dobRaw.slice(4, 6)}`;
  } else {
    // DDMMYY
    const yearPrefix = d3 > 30 ? '19' : '20';
    dob = `${yearPrefix}${dobRaw.slice(4, 6)}-${dobRaw.slice(2, 4)}-${dobRaw.slice(0, 2)}`;
  }

  return {
    personCode: code,
    nationalityCode: natCode,
    nationality: NATIONALITY_MAP[natCode] || 'UNKNOWN',
    dateOfBirth: dob,
    sequence: sequence
  };
};

/**
 * Validates if a nationality name matches its code.
 * @param {string} code 
 * @param {string} name 
 * @returns {boolean}
 */
export const validateNationalityMatch = (code, name) => {
  const decoded = decodeMohrePersonCode(code);
  if (!decoded || !name) return true; // Can't validate
  
  const expected = decoded.nationality.toUpperCase();
  const actual = name.toUpperCase();
  
  return expected === 'UNKNOWN' || actual.includes(expected) || expected.includes(actual);
};
