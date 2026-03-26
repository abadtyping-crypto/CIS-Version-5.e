import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/useAuth';
import { Facebook, Instagram, Twitter, Linkedin, Building2 } from 'lucide-react';
import { deleteField } from 'firebase/firestore';
import SettingCard from './SettingCard';
import { getTenantSettingDoc, upsertTenantNotification, upsertTenantSettingDoc } from '../../lib/backendStore';
import { createSyncEvent } from '../../lib/syncEvents';
import { useTenant } from '../../context/useTenant';
import { uploadBrandLogoAsset, validateBrandLogoAsset } from '../../lib/brandLogoStorage';
import { getCroppedImg } from '../../lib/imageStudioUtils';
import { buildNotificationPayload, generateNotificationId } from '../../lib/notificationTemplate';
import {
  createMobileContact,
  getFilledMobileContacts,
  normalizeMobileContacts,
  serializeMobileContacts,
} from '../../lib/mobileContactUtils';
import { 
  CompanyInfoSection, 
  SocialMediaSection, 
  BankDetailsSection, 
  LogoLibrarySection, 
  LogoUsageSection, 
  LogoEditorSection,
  WhatsAppIcon
} from './BrandingSubsections';

const inputClass =
  'mt-1 w-full rounded-xl border border-(--c-border) bg-(--c-panel) px-3 min-h-[56px] text-sm font-semibold text-(--c-text) outline-none transition focus:border-(--c-accent) focus:ring-2 focus:ring-(--c-ring)';

const labelClass = 'text-xs font-bold uppercase tracking-wider text-(--c-muted)';

const SOCIAL_PLATFORMS = [
  { key: 'instagramUrl', label: 'Instagram', icon: Instagram },
  { key: 'facebookUrl', label: 'Facebook', icon: Facebook },
  { key: 'twitterUrl', label: 'X (Twitter)', icon: Twitter },
  { key: 'linkedinUrl', label: 'LinkedIn', icon: Linkedin },
];

const LOGO_FUNCTIONS = [
  { key: 'paymentReceipt', label: 'Payment Receipt' },
  { key: 'nextInvoice', label: 'Next Invoice' },
  { key: 'quotation', label: 'Quotation' },
  { key: 'performerInvoice', label: 'Performer Invoice' },
  { key: 'statement', label: 'Statements' },
  { key: 'header', label: 'Header' },
  { key: 'footer', label: 'Footer' },
];

const MAX_LOGO_SLOTS = 10;

const defaultLogoLibrary = Array.from({ length: MAX_LOGO_SLOTS }, (_, index) => ({
  slotId: `logo_${index + 1}`,
  name: '', // Removed pre-filled name per user request
  url: '',
}));

const defaultLogoUsage = LOGO_FUNCTIONS.reduce((acc, item) => {
  acc[item.key] = 'logo_1';
  return acc;
}, {});

const toDigits = (value) => String(value || '').replace(/\D/g, '');

const toUpper = (value) => String(value || '').toUpperCase().trim();

const toLower = (value) => String(value || '').toLowerCase().trim();

const toProperCase = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const normalizePhone = (value) => toDigits(value).slice(0, 9);
const normalizePoBox = (value) => toDigits(value).slice(0, 8);
const createEmptyBankDetail = () => ({
  bankName: '',
  bankAccountName: '',
  bankAccountNumber: '',
  bankIban: '',
  bankSwift: '',
  bankBranch: '',
});

const normalizeBankDetail = (detail = {}) => ({
  bankName: String(detail.bankName || '').trim(),
  bankAccountName: String(detail.bankAccountName || '').trim(),
  bankAccountNumber: String(detail.bankAccountNumber || '').trim(),
  bankIban: String(detail.bankIban || '').trim().toUpperCase(),
  bankSwift: String(detail.bankSwift || '').trim().toUpperCase(),
  bankBranch: String(detail.bankBranch || '').trim(),
});

const hasAnyBankValue = (detail = {}) =>
  Object.values(detail).some((value) => String(value || '').trim().length > 0);

const logoFilterMap = {
  natural: { label: 'Natural', css: 'none', canvas: 'none' },
  vibrant: { label: 'Vibrant', css: 'saturate(1.18) contrast(1.1)', canvas: 'saturate(118%) contrast(110%)' },
  soft: { label: 'Soft', css: 'brightness(1.05) saturate(0.9)', canvas: 'brightness(105%) saturate(90%)' },
  mono: { label: 'Mono', css: 'grayscale(1) contrast(1.08)', canvas: 'grayscale(100%) contrast(108%)' },
};
const LOGO_OUTPUT_SIZE = 512;
const LOGO_MAX_BYTES = 240 * 1024;

const validateNineDigitUae = (digits) => {
  if (!digits) return '';
  if (digits.startsWith('0')) return 'Leading 0 is not allowed.';
  if (digits.length > 9) return 'Maximum 9 digits allowed.';
  return '';
};

const BrandDetailsSection = () => {
  const { tenant, tenantId } = useTenant();
  const { user } = useAuth();
  const [form, setForm] = useState({
    companyName: toUpper(tenant?.name || ''),
    brandName: '',
    landlines: [''],
    mobiles: [''],
    mobileContacts: [createMobileContact()],
    addresses: [''],
    emirate: '',
    poBoxNumber: '',
    poBoxEmirate: '',
    emails: [{ id: 'default', value: '' }],
    webAddress: '',
    bankName: '',
    bankAccountName: '',
    bankAccountNumber: '',
    bankIban: '',
    bankSwift: '',
    bankBranch: '',
    bankDetails: [createEmptyBankDetail()],
    locationPin: '',
    facebookUrl: '',
    instagramUrl: '',
    twitterUrl: '',
    linkedinUrl: '',
    whatsappUrl: '',
  });

  const [errors, setErrors] = useState({});
  const [saveMessage, setSaveMessage] = useState('');
  
  // Dynamic Social Media State
  const [activeSocialKeys, setActiveSocialKeys] = useState([]);

  const [logoLibrary, setLogoLibrary] = useState(defaultLogoLibrary);
  const [logoUsage, setLogoUsage] = useState(defaultLogoUsage);
  const [visibleSlotsCount, setVisibleSlotsCount] = useState(1);
  const [logoErrors, setLogoErrors] = useState({});
  const [logoUploading, setLogoUploading] = useState({});
  const [activeLogoEditorSlotId, setActiveLogoEditorSlotId] = useState('');
  const [logoRawUrl, setLogoRawUrl] = useState('');
  const [logoSourceUrl, setLogoSourceUrl] = useState('');
  const [logoZoom, setLogoZoom] = useState(1);
  const [logoRotation, setLogoRotation] = useState(0);
  const [logoFilter, setLogoFilter] = useState('natural');
  const [logoDirty, setLogoDirty] = useState(false);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
    setLogoDirty(true);
  }, []);

  const setRotationWrapper = (val) => {
    setLogoRotation(val);
    setLogoDirty(true);
  };

  useEffect(() => {
    let active = true;
    getTenantSettingDoc(tenantId, 'branding').then((result) => {
      if (!active || !result.ok || !result.data) return;
      const data = result.data;
      const fallbackPrimaryBank = normalizeBankDetail({
        bankName: data.bankName || '',
        bankAccountName: data.bankAccountName || '',
        bankAccountNumber: data.bankAccountNumber || '',
        bankIban: data.bankIban || '',
        bankSwift: data.bankSwift || '',
        bankBranch: data.bankBranch || '',
      });

      const incomingBankDetails = Array.isArray(data.bankDetails) && data.bankDetails.length
        ? data.bankDetails.map(normalizeBankDetail).filter(hasAnyBankValue)
        : [];

      const normalizedBankDetails = incomingBankDetails.length
        ? incomingBankDetails
        : (hasAnyBankValue(fallbackPrimaryBank) ? [fallbackPrimaryBank] : [createEmptyBankDetail()]);

      const primaryBank = normalizedBankDetails[0] || createEmptyBankDetail();

      setForm((prev) => ({
        ...prev,
        companyName: toUpper(data.companyName || prev.companyName),
        brandName: toUpper(data.brandName || ''),
        landlines: Array.isArray(data.landlines) && data.landlines.length 
          ? data.landlines.map(normalizePhone) 
          : [normalizePhone(data.landline1 || '')].filter(Boolean).concat(data.landline2 ? [normalizePhone(data.landline2)] : []),
        mobiles: Array.isArray(data.mobiles) && data.mobiles.length 
          ? data.mobiles.map(normalizePhone) 
          : [normalizePhone(data.mobile1 || '')].filter(Boolean).concat(data.mobile2 ? [normalizePhone(data.mobile2)] : []),
        mobileContacts: normalizeMobileContacts(data.mobileContacts, Array.isArray(data.mobiles) && data.mobiles.length
          ? data.mobiles
          : [data.mobile1 || '', data.mobile2 || '']),
        addresses: Array.isArray(data.addresses) && data.addresses.length
          ? data.addresses
          : [String(data.primaryAddress || '')].filter(Boolean).concat(data.secondaryAddress ? [String(data.secondaryAddress)] : []),
        emirate: String(data.emirate || ''),
        poBoxNumber: normalizePoBox(data.poBoxNumber || ''),
        poBoxEmirate: String(data.poBoxEmirate || ''),
        emails: Array.isArray(data.emails) && data.emails.length 
          ? data.emails.map(v => ({ id: Math.random().toString(36).slice(2, 11), value: String(v).toLowerCase() })) 
          : [{ id: 'default', value: toLower(data.email1 || '') }].filter(c => c.value),
        webAddress: toLower(data.webAddress || ''),
        bankName: primaryBank.bankName,
        bankAccountName: primaryBank.bankAccountName,
        bankAccountNumber: primaryBank.bankAccountNumber,
        bankIban: primaryBank.bankIban,
        bankSwift: primaryBank.bankSwift,
        bankBranch: primaryBank.bankBranch,
        bankDetails: normalizedBankDetails,
        locationPin: String(data.locationPin || ''),
        facebookUrl: toLower(data.facebookUrl || ''),
        instagramUrl: toLower(data.instagramUrl || ''),
        twitterUrl: toLower(data.twitterUrl || ''),
        linkedinUrl: toLower(data.linkedinUrl || ''),
        whatsappUrl: toLower(data.whatsappUrl || ''),
      }));
      
      const incomingSocials = [];
      if (data.instagramUrl) incomingSocials.push('instagramUrl');
      if (data.facebookUrl) incomingSocials.push('facebookUrl');
      if (data.twitterUrl) incomingSocials.push('twitterUrl');
      if (data.linkedinUrl) incomingSocials.push('linkedinUrl');
      
      // Default to one empty slot if none exist
      setActiveSocialKeys(incomingSocials.length > 0 ? incomingSocials : [SOCIAL_PLATFORMS[0].key]);
      
      const incomingLibrary = Array.isArray(data.logoLibrary) ? data.logoLibrary : [];
      const normalizedLibrary = defaultLogoLibrary.map((slot) => {
        const match = incomingLibrary.find((item) => item.slotId === slot.slotId);
        return match
          ? {
            slotId: slot.slotId,
            name: String(match.name || slot.name),
            url: String(match.url || ''),
          }
          : slot;
      });
      setLogoLibrary(normalizedLibrary);
      const incomingUsage = data.logoUsage && typeof data.logoUsage === 'object' ? data.logoUsage : {};
      const allowedSlots = new Set(defaultLogoLibrary.map((slot) => slot.slotId));
      const sanitizedUsage = LOGO_FUNCTIONS.reduce((acc, item) => {
        const candidate = String(incomingUsage[item.key] || defaultLogoUsage[item.key] || 'logo_1');
        acc[item.key] = allowedSlots.has(candidate) ? candidate : 'logo_1';
        return acc;
      }, {});
      setLogoUsage(sanitizedUsage);

      // Calculate how many slots should be visible (at least 1, up to the highest slot with data)
      let maxActiveIndex = 0;
      normalizedLibrary.forEach((slot, index) => {
        if (slot.url || slot.name) maxActiveIndex = index;
      });
      setVisibleSlotsCount(Math.min(MAX_LOGO_SLOTS, Math.max(1, maxActiveIndex + 1)));

    });
    return () => {
      active = false;
    };
  }, [tenantId]);

  useEffect(() => {
    if (!logoRawUrl || !logoRawUrl.startsWith('blob:')) return () => { };
    return () => {
      URL.revokeObjectURL(logoRawUrl);
    };
  }, [logoRawUrl]);



  useEffect(() => {
    if (form.landlines.length === 0) setForm(prev => ({ ...prev, landlines: [''] }));
    if (!Array.isArray(form.mobileContacts) || form.mobileContacts.length === 0) setForm(prev => ({ ...prev, mobileContacts: [createMobileContact()] }));
    if (form.addresses.length === 0) setForm(prev => ({ ...prev, addresses: [''] }));
    if (!Array.isArray(form.emails) || form.emails.length === 0) setForm(prev => ({ ...prev, emails: [{ id: 'default', value: '' }] }));
  }, [form.landlines, form.mobileContacts, form.addresses, form.emails]);

  const poBoxDisabled = !toDigits(form.poBoxNumber);

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateArrayField = (key, index, value) => {
    setForm(prev => {
      const cloned = [...prev[key]];
      cloned[index] = value;
      return { ...prev, [key]: cloned };
    });
  };

  const addArrayField = (key) => {
    setForm(prev => ({ ...prev, [key]: [...prev[key], ''] }));
  };

  const removeArrayField = (key, index) => {
    setForm(prev => ({
      ...prev,
      [key]: prev[key].filter((_, i) => i !== index)
    }));
  };

  const handlePhoneArrayChange = (key, index, value) => {
    updateArrayField(key, index, toDigits(value).slice(0, 9));
  };

  const updateMobileContacts = (contacts) => {
    setForm((prev) => ({
      ...prev,
      mobileContacts: contacts,
      mobiles: getFilledMobileContacts(contacts).map((contact) => normalizePhone(contact.value)),
    }));
  };

  const handlePoBoxChange = (value) => {
    const nextPoBox = toDigits(value).slice(0, 8);
    setForm((prev) => ({
      ...prev,
      poBoxNumber: nextPoBox,
      poBoxEmirate: nextPoBox ? prev.poBoxEmirate : '',
    }));
  };

  const addSocialPlatform = () => {
    const available = SOCIAL_PLATFORMS.find(p => !activeSocialKeys.includes(p.key));
    if (available) {
      setActiveSocialKeys([...activeSocialKeys, available.key]);
    }
  };

  const updateBankDetailField = (index, key, value) => {
    setForm((prev) => {
      const next = Array.isArray(prev.bankDetails) && prev.bankDetails.length
        ? [...prev.bankDetails]
        : [createEmptyBankDetail()];
      next[index] = {
        ...(next[index] || createEmptyBankDetail()),
        [key]: value,
      };
      return { ...prev, bankDetails: next };
    });
  };

  const addBankDetail = () => {
    setForm((prev) => ({
      ...prev,
      bankDetails: [...(prev.bankDetails || [createEmptyBankDetail()]), createEmptyBankDetail()],
    }));
  };

  const removeBankDetail = (index) => {
    setForm((prev) => {
      const next = (prev.bankDetails || []).filter((_, i) => i !== index);
      return {
        ...prev,
        bankDetails: next.length ? next : [createEmptyBankDetail()],
      };
    });
  };

  const removeSocialPlatform = (key) => {
    setActiveSocialKeys(activeSocialKeys.filter(k => k !== key));
    updateField(key, '');
  };

  const changeSocialPlatform = (oldKey, newKey) => {
    setActiveSocialKeys(activeSocialKeys.map(k => k === oldKey ? newKey : k));
    // Carry over the value to the new key
    updateField(newKey, form[oldKey]);
    updateField(oldKey, '');
  };

  const removeLogoSlot = (slotId) => {
    setLogoLibrary((prev) =>
      prev.map((s) => (s.slotId === slotId ? { ...s, name: '', url: '' } : s))
    );
    // Adjust usage to logo_1 if deleting an assigned slot
    setLogoUsage((prev) => {
      const nextUsage = { ...prev };
      Object.keys(nextUsage).forEach((funcKey) => {
        if (nextUsage[funcKey] === slotId) {
          nextUsage[funcKey] = 'logo_1';
        }
      });
      return nextUsage;
    });
  };

  const updateLogoSlot = (slotId, patch) => {
    setLogoLibrary((prev) =>
      prev.map((slot) => (slot.slotId === slotId ? { ...slot, ...patch } : slot)),
    );
  };

  const openLogoEditor = (slotId) => {
    const slot = logoLibrary.find((item) => item.slotId === slotId);
    setActiveLogoEditorSlotId(slotId);
    setLogoSourceUrl(slot?.url || '');
    setLogoZoom(1);
    setLogoRotation(0);
    setLogoFilter('natural');
    setLogoDirty(false);
    setCroppedAreaPixels(null);
  };

  const closeLogoEditor = () => {
    setActiveLogoEditorSlotId('');
    setLogoRawUrl('');
    setLogoSourceUrl('');
    setLogoZoom(1);
    setLogoRotation(0);
    setLogoFilter('natural');
    setLogoDirty(false);
    setCroppedAreaPixels(null);
  };

  const onLogoEditorFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !activeLogoEditorSlotId) return;
    const validationError = validateBrandLogoAsset(file);
    if (validationError) {
      setLogoErrors((prev) => ({ ...prev, [activeLogoEditorSlotId]: validationError }));
      return;
    }

    try {
      const nextUrl = URL.createObjectURL(file);
      setLogoRawUrl(nextUrl);
      setLogoSourceUrl(nextUrl);
      setLogoZoom(1);
      setLogoRotation(0);
      setLogoFilter('natural');
      setLogoDirty(true);
      setLogoErrors((prev) => ({ ...prev, [activeLogoEditorSlotId]: '' }));
    } catch {
      setLogoErrors((prev) => ({ ...prev, [activeLogoEditorSlotId]: 'Unable to read image file.' }));
    }
  };

  const onLogoEditorReset = () => {
    if (!activeLogoEditorSlotId) return;
    const slot = logoLibrary.find((item) => item.slotId === activeLogoEditorSlotId);
    setLogoSourceUrl(slot?.url || '');
    setLogoRotation(0);
    setLogoFilter('natural');
    setLogoDirty(false);
    setCroppedAreaPixels(null);
    setLogoErrors((prev) => ({ ...prev, [activeLogoEditorSlotId]: '' }));
  };

  const handleLogoUpload = async (slotId, fileBlob) => {
    if (!fileBlob) return;
    const validationError = validateBrandLogoAsset(fileBlob);
    if (validationError) {
      setLogoErrors((prev) => ({ ...prev, [slotId]: validationError }));
      return;
    }
    setLogoUploading((prev) => ({ ...prev, [slotId]: true }));
    const slot = logoLibrary.find((item) => item.slotId === slotId);
    const result = await uploadBrandLogoAsset({
      tenantId,
      slotId,
      oldUrl: slot?.url,
      fileBlob,
    });
    setLogoUploading((prev) => ({ ...prev, [slotId]: false }));
    if (!result.ok) {
      setLogoErrors((prev) => ({ ...prev, [slotId]: result.error || 'Upload failed.' }));
      return;
    }
    updateLogoSlot(slotId, { url: result.url });
    setLogoErrors((prev) => ({ ...prev, [slotId]: '' }));
  };

  const applyLogoEditor = async () => {
    if (!activeLogoEditorSlotId) return;
    if (!logoDirty || !logoRawUrl || !croppedAreaPixels) {
      setLogoErrors((prev) => ({ ...prev, [activeLogoEditorSlotId]: 'Adjust crop or choose file before upload.' }));
      return;
    }

    try {
      const processedBlob = await getCroppedImg(
        logoRawUrl,
        croppedAreaPixels,
        logoRotation,
        logoFilterMap[logoFilter]?.canvas || 'none'
      );
      await handleLogoUpload(activeLogoEditorSlotId, processedBlob);
      closeLogoEditor();
    } catch (error) {
      setLogoErrors((prev) => ({ ...prev, [activeLogoEditorSlotId]: error?.message || 'Logo processing failed.' }));
    }
  };

  const visibleLogoSlots = logoLibrary.slice(0, visibleSlotsCount);
  const assignedOptions = visibleLogoSlots.filter(s => s.url || s.slotId === 'logo_1'); // Always keep Logo 1 as fallback

  const onSave = async () => {
    const bankDetailsPayload = (Array.isArray(form.bankDetails) ? form.bankDetails : [])
      .map(normalizeBankDetail)
      .filter(hasAnyBankValue);

    const primaryBank = bankDetailsPayload[0] || createEmptyBankDetail();
    const normalizedLogoLibrary = defaultLogoLibrary
      .map((baseSlot) => {
        const slot = logoLibrary.find((item) => item.slotId === baseSlot.slotId) || baseSlot;
        return {
          slotId: baseSlot.slotId,
          name: String(slot.name || baseSlot.name || '').trim(),
          url: String(slot.url || '').trim(),
        };
      })
      .filter((slot) => slot.name || slot.url);
    const activeLogoSlotIds = new Set(normalizedLogoLibrary.map((slot) => slot.slotId));
    const normalizedLogoUsage = LOGO_FUNCTIONS.reduce((acc, item) => {
      const candidate = String(logoUsage[item.key] || '').trim();
      if (activeLogoSlotIds.has(candidate)) acc[item.key] = candidate;
      return acc;
    }, {});

    const normalized = {
      companyName: toUpper(form.companyName),
      brandName: toUpper(form.brandName),
      landlines: form.landlines.map(normalizePhone).filter(Boolean),
      mobiles: getFilledMobileContacts(form.mobileContacts).map((contact) => normalizePhone(contact.value)).filter(Boolean),
      mobileContacts: serializeMobileContacts(form.mobileContacts),
      addresses: form.addresses.map(toProperCase).filter(Boolean),
      emirate: form.emirate || '',
      poBoxNumber: normalizePoBox(form.poBoxNumber),
      poBoxEmirate: normalizePoBox(form.poBoxNumber) ? form.poBoxEmirate || '' : '',
      emails: form.emails.map(c => toLower(c?.value || c)).filter(Boolean),
      webAddress: toLower(form.webAddress),
      bankName: primaryBank.bankName,
      bankAccountName: primaryBank.bankAccountName,
      bankAccountNumber: primaryBank.bankAccountNumber,
      bankIban: primaryBank.bankIban,
      bankSwift: primaryBank.bankSwift,
      bankBranch: primaryBank.bankBranch,
      bankDetails: bankDetailsPayload,
      locationPin: String(form.locationPin || '').trim(),
      facebookUrl: toLower(form.facebookUrl),
      instagramUrl: toLower(form.instagramUrl),
      twitterUrl: toLower(form.twitterUrl),
      linkedinUrl: toLower(form.linkedinUrl),
      whatsappUrl: toLower(form.whatsappUrl),
      logoLibrary: normalizedLogoLibrary,
      logoUsage: normalizedLogoUsage,
    };

    const payload = {
      updatedBy: user.uid,
    };
    if (normalized.companyName) payload.companyName = normalized.companyName;
    if (normalized.brandName) payload.brandName = normalized.brandName;
    if (normalized.landlines.length) payload.landlines = normalized.landlines;
    if (normalized.mobiles.length) payload.mobiles = normalized.mobiles;
    if (normalized.mobileContacts.length) payload.mobileContacts = normalized.mobileContacts;
    if (normalized.addresses.length) payload.addresses = normalized.addresses;
    if (normalized.emirate) payload.emirate = normalized.emirate;
    if (normalized.poBoxNumber) payload.poBoxNumber = normalized.poBoxNumber;
    if (normalized.poBoxNumber && normalized.poBoxEmirate) payload.poBoxEmirate = normalized.poBoxEmirate;
    if (normalized.emails.length) payload.emails = normalized.emails;
    if (normalized.webAddress) payload.webAddress = normalized.webAddress;
    if (normalized.bankName) payload.bankName = normalized.bankName;
    if (normalized.bankAccountName) payload.bankAccountName = normalized.bankAccountName;
    if (normalized.bankAccountNumber) payload.bankAccountNumber = normalized.bankAccountNumber;
    if (normalized.bankIban) payload.bankIban = normalized.bankIban;
    if (normalized.bankSwift) payload.bankSwift = normalized.bankSwift;
    if (normalized.bankBranch) payload.bankBranch = normalized.bankBranch;
    if (normalized.bankDetails.length) payload.bankDetails = normalized.bankDetails;
    if (normalized.locationPin) payload.locationPin = normalized.locationPin;
    if (normalized.facebookUrl) payload.facebookUrl = normalized.facebookUrl;
    if (normalized.instagramUrl) payload.instagramUrl = normalized.instagramUrl;
    if (normalized.twitterUrl) payload.twitterUrl = normalized.twitterUrl;
    if (normalized.linkedinUrl) payload.linkedinUrl = normalized.linkedinUrl;
    if (normalized.whatsappUrl) payload.whatsappUrl = normalized.whatsappUrl;
    if (normalized.logoLibrary.length) payload.logoLibrary = normalized.logoLibrary;
    if (Object.keys(normalized.logoUsage).length) payload.logoUsage = normalized.logoUsage;

    [
      'companyName',
      'brandName',
      'emirate',
      'poBoxNumber',
      'poBoxEmirate',
      'webAddress',
      'bankName',
      'bankAccountName',
      'bankAccountNumber',
      'bankIban',
      'bankSwift',
      'bankBranch',
      'locationPin',
      'facebookUrl',
      'instagramUrl',
      'twitterUrl',
      'linkedinUrl',
      'whatsappUrl',
      // legacy fields to keep document clean after migration
      'landline1',
      'landline2',
      'mobile1',
      'mobile2',
      'primaryAddress',
      'secondaryAddress',
      'email1',
    ].forEach((key) => {
      if (!(key in payload)) payload[key] = deleteField();
    });
    ['landlines', 'mobiles', 'mobileContacts', 'addresses', 'emails', 'bankDetails', 'logoLibrary'].forEach((key) => {
      if (!(key in payload)) payload[key] = deleteField();
    });
    if (!('logoUsage' in payload)) payload.logoUsage = deleteField();

    const nextErrors = {};

    if (!normalized.companyName && !normalized.brandName) {
      nextErrors.companyName = 'Provide Company Name or Brand Name.';
      nextErrors.brandName = 'Provide Company Name or Brand Name.';
    }

    const allPhones = [...normalized.landlines, ...normalized.mobiles];
    let phoneError = '';
    allPhones.forEach((digits) => {
      const err = validateNineDigitUae(digits);
      if (err) phoneError = err;
    });
    if (phoneError) nextErrors.phones = phoneError;

    if (normalized.poBoxNumber.length > 8) {
      nextErrors.poBoxNumber = 'Maximum 8 digits allowed.';
    }

    bankDetailsPayload.forEach((detail, index) => {
      if (detail.bankIban && detail.bankIban.length < 10) {
        nextErrors[`bankIban_${index}`] = 'IBAN looks too short.';
        if (index === 0) nextErrors.bankIban = 'IBAN looks too short.';
      }
      if (detail.bankSwift && detail.bankSwift.length < 6) {
        nextErrors[`bankSwift_${index}`] = 'SWIFT code looks too short.';
        if (index === 0) nextErrors.bankSwift = 'SWIFT code looks too short.';
      }
    });
    const invalidLogo = normalized.logoLibrary.some((slot) => slot.url && !slot.name);
    if (invalidLogo) {
      nextErrors.logoLibrary = 'Each uploaded logo must have a name.';
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length) {
      setSaveMessage('Fix validation errors before saving.');
      return;
    }

    setForm((prev) => ({
      ...prev,
      companyName: normalized.companyName,
      brandName: normalized.brandName,
      landlines: normalized.landlines.length ? normalized.landlines : [''],
      mobiles: normalized.mobiles.length ? normalized.mobiles : [''],
      mobileContacts: normalized.mobileContacts.length
        ? normalizeMobileContacts(normalized.mobileContacts)
        : [createMobileContact()],
      addresses: normalized.addresses.length ? normalized.addresses : [''],
      emails: normalized.emails.length 
          ? normalized.emails.map(v => ({ id: Math.random().toString(36).slice(2, 11), value: v })) 
          : [{ id: 'default', value: '' }],
      webAddress: normalized.webAddress,
      locationPin: normalized.locationPin,
      bankName: normalized.bankName,
      bankAccountName: normalized.bankAccountName,
      bankAccountNumber: normalized.bankAccountNumber,
      bankIban: normalized.bankIban,
      bankSwift: normalized.bankSwift,
      bankBranch: normalized.bankBranch,
      bankDetails: normalized.bankDetails.length ? normalized.bankDetails : [createEmptyBankDetail()],
      facebookUrl: normalized.facebookUrl,
      instagramUrl: normalized.instagramUrl,
      twitterUrl: normalized.twitterUrl,
      linkedinUrl: normalized.linkedinUrl,
      whatsappUrl: normalized.whatsappUrl,
    }));

    const write = await upsertTenantSettingDoc(tenantId, 'branding', payload);
    if (!write.ok) {
      setSaveMessage(`Brand details save failed: ${write.error}`);
      return;
    }

    await createSyncEvent({
      tenantId,
      eventType: 'update',
      entityType: 'settingsBranding',
      entityId: 'branding',
      changedFields: Object.keys(payload),
      createdBy: user.uid,
    });

    // Emit an in-app notification for brand updates.
    // Keep this non-blocking so save success is not affected by notification write failures.
    const notificationId = generateNotificationId({ topic: 'settings', subTopic: 'brand' });
    const savedBrandName = normalized.brandName || normalized.companyName || 'Brand Details';
    const message = `Brand settings updated for ${savedBrandName}.`;
    upsertTenantNotification(
      tenantId,
      notificationId,
      buildNotificationPayload({
        topic: 'settings',
        subTopic: 'brand',
        type: 'update',
        title: 'Brand Settings Updated',
        message,
        createdBy: user.uid,
        routePath: '/settings?tab=brand',
        actionPresets: ['view'],
      }),
    ).catch(() => {
      // Intentionally silent in UI.
    });

    setSaveMessage('Brand details saved successfully.');
  };

  if (!user) return null;

  const normalizedSaveMessage = String(saveMessage || '').toLowerCase();
  const statusMessage = saveMessage || 'Last saved changes will be applied instantly.';
  const statusClass = !saveMessage
    ? 'border-(--c-border) bg-(--c-panel) text-(--c-muted)'
    : (normalizedSaveMessage.includes('failed') ||
      normalizedSaveMessage.includes('error') ||
      normalizedSaveMessage.includes('fix'))
      ? 'border-rose-500/40 bg-rose-500/10 text-rose-300'
      : (normalizedSaveMessage.includes('pending')
        ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
        : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300');

  return (
    <>
      <SettingCard
        title="Brand Details"
        description="Company identity and statutory settings with strict save-time normalization."
        icon={Building2}
      >
        <div className="space-y-6">
          <CompanyInfoSection
            form={form}
            errors={errors}
            updateField={updateField}
            addArrayField={addArrayField}
            removeArrayField={removeArrayField}
            handlePhoneArrayChange={handlePhoneArrayChange}
            updateMobileContacts={updateMobileContacts}
            handlePoBoxChange={handlePoBoxChange}
            updateArrayField={updateArrayField}
            poBoxDisabled={poBoxDisabled}
            labelClass={labelClass}
            inputClass={inputClass}
          />

          <SocialMediaSection
            activeSocialKeys={activeSocialKeys}
            form={form}
            updateField={updateField}
            addSocialPlatform={addSocialPlatform}
            removeSocialPlatform={removeSocialPlatform}
            changeSocialPlatform={changeSocialPlatform}
            socialPlatforms={SOCIAL_PLATFORMS}
          />
          
          <BankDetailsSection
            form={form}
            errors={errors}
            updateBankDetailField={updateBankDetailField}
            addBankDetail={addBankDetail}
            removeBankDetail={removeBankDetail}
            labelClass={labelClass}
            inputClass={inputClass}
          />

          <LogoLibrarySection
            visibleLogoSlots={visibleLogoSlots}
            logoErrors={logoErrors}
            logoUploading={logoUploading}
            openLogoEditor={openLogoEditor}
            removeLogoSlot={removeLogoSlot}
            updateLogoSlot={updateLogoSlot}
            setVisibleSlotsCount={setVisibleSlotsCount}
            maxLogoSlots={MAX_LOGO_SLOTS}
          />

          <LogoUsageSection
            logoUsage={logoUsage}
            logoFunctions={LOGO_FUNCTIONS}
            assignedOptions={assignedOptions}
            setLogoUsage={setLogoUsage}
          />

          <div className="flex items-center justify-between border-t border-(--c-border) pt-8">
            <p className={`max-w-[70%] rounded-lg border px-3 py-2 text-xs font-semibold ${statusClass}`}>
              {statusMessage}
            </p>
            <button
              onClick={onSave}
              className="group flex items-center gap-2 rounded-xl bg-(--c-accent) px-8 py-3 text-sm font-bold text-white shadow-lg transition-all hover:brightness-110 active:scale-95 shadow-(--c-accent)/20"
            >
              Save All Changes
            </button>
          </div>
        </div>
      </SettingCard>

      <LogoEditorSection
        activeLogoEditorSlotId={activeLogoEditorSlotId}
        logoLibrary={logoLibrary}
        logoSourceUrl={logoSourceUrl}
        logoZoom={logoZoom}
        setLogoZoom={setLogoZoom}
        logoRotation={logoRotation}
        setRotationWrapper={setRotationWrapper}
        onCropComplete={onCropComplete}
        onLogoEditorFileChange={onLogoEditorFileChange}
        onLogoEditorReset={onLogoEditorReset}
        applyLogoEditor={applyLogoEditor}
        closeLogoEditor={closeLogoEditor}
        logoUploading={logoUploading}
        logoErrors={logoErrors}
      />
    </>
  );
};

export default BrandDetailsSection;

