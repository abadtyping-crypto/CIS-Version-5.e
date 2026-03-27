import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { addDoc, collection, deleteField, doc, getDocs, orderBy, query, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { CheckCircle2, Edit3, FileSpreadsheet, LibraryBig, Mail, Power, UploadCloud, X, XCircle } from 'lucide-react';
import { ProtectedLayout } from '../components/layout/ProtectedLayout';
import { db, storage } from '../lib/firebase';

const EMIRATE_OPTIONS = ['ABU DHABI', 'DUBAI', 'SHARJAH', 'AJMAN', 'UMM AL QUWAIN', 'RAS AL KHAIMAH', 'FUJAIRAH'];
const SCOPE_OPTIONS = [
  { value: 'all_emirates', label: 'All Emirates' },
  { value: 'specific_emirates', label: 'Specific Emirates' },
  { value: 'all_except', label: 'All Emirates EXCEPT' },
];
const EMPTY_FORM = { appName: '', description: '', linkedIconId: '', scopeType: 'all_emirates', targetEmirates: [], isActive: true };
const toUpperTrim = (v) => String(v || '').trim().toUpperCase();
const toSafeDocId = (value, fallback = 'item') => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || fallback;
};
const toAppDocId = (appName) => toSafeDocId(toUpperTrim(appName), 'app');
const getFileKey = (file) => `${file.name}-${file.size}-${file.lastModified}`;
const SYSTEM_ASSET_CATEGORIES = [
  {
    title: 'Main Onboarding Icons',
    items: [
      { id: 'icon_main_company', label: 'Company' },
      { id: 'icon_main_individual', label: 'Individual' },
      { id: 'icon_main_dependents', label: 'Dependents' },
    ],
  },
  {
    title: 'Emirates Icons',
    items: [
      { id: 'icon_emirate_abudhabi', label: 'Abu Dhabi' },
      { id: 'icon_emirate_ajman', label: 'Ajman' },
      { id: 'icon_emirate_dubai', label: 'Dubai' },
      { id: 'icon_emirate_fujairah', label: 'Fujairah' },
      { id: 'icon_emirate_rak', label: 'Ras Al Khaimah' },
      { id: 'icon_emirate_sharjah', label: 'Sharjah' },
      { id: 'icon_emirate_uaq', label: 'Umm Al Quwain' },
    ],
  },
  {
    title: 'Individual Relations',
    items: [
      { id: 'icon_rel_ind_daughter', label: 'Daughter' },
      { id: 'icon_rel_ind_domestic', label: 'Domestic Worker' },
      { id: 'icon_rel_ind_father', label: 'Father' },
      { id: 'icon_rel_ind_husband', label: 'Husband' },
      { id: 'icon_rel_ind_mother', label: 'Mother' },
      { id: 'icon_rel_ind_son', label: 'Son' },
      { id: 'icon_rel_ind_wife', label: 'Wife' },
    ],
  },
  {
    title: 'Company Relations',
    items: [
      { id: 'icon_rel_com_employee', label: 'Employee' },
      { id: 'icon_rel_com_investor', label: 'Investor' },
      { id: 'icon_rel_com_localagent', label: 'Local Service Agent' },
      { id: 'icon_rel_com_partner', label: 'Partner' },
    ],
  },
  {
    title: 'Portal Types',
    items: [
      { id: 'icon_portal_bank', label: 'Bank' },
      { id: 'icon_portal_card', label: 'Card Payment' },
      { id: 'icon_portal_cash', label: 'Petty Cash' },
      { id: 'icon_portal_portals', label: 'Portals' },
      { id: 'icon_portal_terminal', label: 'Terminal' },
    ],
  },
  {
    title: 'Portal Methods',
    items: [
      { id: 'icon_method_bank_transfer', label: 'Bank Transfer' },
      { id: 'icon_method_cash', label: 'Cash By Hand' },
      { id: 'icon_method_cdm_deposit', label: 'CDM Deposit' },
      { id: 'icon_method_cheque', label: 'Cheque Deposit' },
      { id: 'icon_method_online', label: 'Online Payment' },
      { id: 'icon_method_cash_withdrawals', label: 'Cash Withdrawals' },
      { id: 'icon_method_tabby', label: 'Tabby' },
      { id: 'icon_method_tamara', label: 'Tamara' },
    ],
  },
  {
    title: 'Page Navigation Icons',
    items: [
      { id: 'icon_page_dashboard', label: 'Dashboard' },
      { id: 'icon_page_client_onboarding', label: 'Clients Onboarding' },
      { id: 'icon_page_daily_transactions', label: 'Daily Transactions' },
      { id: 'icon_page_tasks_tracking', label: 'Task / Tracking' },
      { id: 'icon_page_quotations', label: 'Quotations' },
      { id: 'icon_page_proforma_invoices', label: 'Proforma Invoices' },
      { id: 'icon_page_receive_payments', label: 'Receive Payments' },
      { id: 'icon_page_invoice_management', label: 'Invoice Management' },
      { id: 'icon_page_operation_expenses', label: 'Operation Expenses' },
      { id: 'icon_page_portal_management', label: 'Portal Management' },
      { id: 'icon_page_document_calendar', label: 'Document Calendar' },
      { id: 'icon_page_settings', label: 'Settings' },
      { id: 'icon_page_notifications', label: 'Notifications' },
      { id: 'icon_page_user', label: 'Profile' },
      { id: 'icon_page_recycle_bin', label: 'Recycle Bin' },
    ],
  },
  {
    title: 'System Interface Assets',
    items: [
      { id: 'icon_ui_sidebar_toggle', label: 'Sidebar Toggle' },
      { id: 'icon_ui_sidebar_hamburger', label: 'Sidebar Hamburger' },
    ],
  },
  {
    title: 'Document Types',
    items: [
      { id: 'icon_doc_passport', label: 'Passport' },
      { id: 'icon_doc_emirates_id', label: 'Emirates ID' },
      { id: 'icon_doc_work_permit', label: 'Work Permit' },
      { id: 'icon_doc_person_code', label: 'Person Code' },
      { id: 'icon_doc_unified', label: 'Unified Number' },
    ],
  },
  {
    title: 'UI Actions & Theme',
    items: [
      { id: 'ui_theme_light', label: 'Theme: Light' },
      { id: 'ui_theme_dark', label: 'Theme: Dark' },
      { id: 'ui_action_view', label: 'Action: View (Eye)' },
      { id: 'ui_action_delete', label: 'Action: Delete (Trash)' },
      { id: 'ui_action_confirm', label: 'Action: Confirm (Check)' },
      { id: 'ui_action_restore', label: 'Action: Restore (Undo)' },
    ],
  },
  {
    title: 'Chat Assistant',
    items: [
      { id: 'icon_bot_uid', label: 'Bot Assistant Avatar' },
      { id: 'ui_chat_guide', label: 'Chat Guide Prompt' },
    ],
  },
  {
    title: 'Custom / Draft Icons',
    items: [
      { id: 'custom_icon_1', label: 'Custom Icon 1 (Draft)' },
      { id: 'custom_icon_2', label: 'Custom Icon 2 (Draft)' },
      { id: 'custom_icon_3', label: 'Custom Icon 3 (Draft)' },
      { id: 'custom_icon_4', label: 'Custom Icon 4 (Draft)' },
      { id: 'custom_icon_5', label: 'Custom Icon 5 (Draft)' },
      { id: 'custom_icon_6', label: 'Custom Icon 6 (Draft)' },
      { id: 'custom_icon_7', label: 'Custom Icon 7 (Draft)' },
      { id: 'custom_icon_8', label: 'Custom Icon 8 (Draft)' },
      { id: 'custom_icon_9', label: 'Custom Icon 9 (Draft)' },
      { id: 'custom_icon_10', label: 'Custom Icon 10 (Draft)' },
    ],
  },
];

const parseExcelRows = async (file) => {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  return rows.map((row, index) => ({
    rowNumber: index + 2,
    applicationName: String(row['Application Name'] || row['APPLICATION NAME'] || '').trim(),
    description: String(row['Description (Optional)'] || row['DESCRIPTION (OPTIONAL)'] || row.Description || '').trim(),
    iconName: String(row['Icon Name'] || row['ICON NAME'] || '').trim(),
  }));
};

const loadImage = (file) => new Promise((resolve, reject) => {
  const fr = new FileReader();
  fr.onload = () => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image load failed.'));
    img.src = fr.result;
  };
  fr.onerror = () => reject(new Error('File read failed.'));
  fr.readAsDataURL(file);
});

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const getCropRect = (img, crop) => {
  const zoom = clamp(Number(crop.zoom) || 1, 1, 6);
  const minSide = Math.min(img.naturalWidth, img.naturalHeight);
  const cropSize = Math.max(1, minSide / zoom);
  const maxX = Math.max(0, img.naturalWidth - cropSize);
  const maxY = Math.max(0, img.naturalHeight - cropSize);
  const cx = clamp(Number(crop.cx) || img.naturalWidth / 2, cropSize / 2, img.naturalWidth - cropSize / 2);
  const cy = clamp(Number(crop.cy) || img.naturalHeight / 2, cropSize / 2, img.naturalHeight - cropSize / 2);
  const sx = clamp(cx - cropSize / 2, 0, maxX);
  const sy = clamp(cy - cropSize / 2, 0, maxY);
  return { sx, sy, cropSize, zoom, cx: sx + cropSize / 2, cy: sy + cropSize / 2 };
};

const roundedRectPath = (ctx, x, y, width, height, radius) => {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};

const drawCropToCanvas = (canvas, img, crop) => {
  if (!canvas || !img) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const cw = canvas.width;
  const ch = canvas.height;
  const frameSize = Math.min(cw, ch) * 0.72;
  const fx = (cw - frameSize) / 2;
  const fy = (ch - frameSize) / 2;
  const { sx, sy, cropSize } = getCropRect(img, crop);

  ctx.clearRect(0, 0, cw, ch);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.58)';
  ctx.fillRect(0, 0, cw, ch);

  ctx.save();
  roundedRectPath(ctx, fx, fy, frameSize, frameSize, 24);
  ctx.clip();
  ctx.drawImage(img, sx, sy, cropSize, cropSize, fx, fy, frameSize, frameSize);
  ctx.restore();

  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 2;
  roundedRectPath(ctx, fx, fy, frameSize, frameSize, 24);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  roundedRectPath(ctx, fx + 1, fy + 1, frameSize - 2, frameSize - 2, 23);
  ctx.stroke();
};

const processTo128 = async (file, crop) => {
  const img = await loadImage(file);
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const { sx, sy, cropSize } = getCropRect(img, crop);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);
  // Safety background (Solid White) ensures icons are perfectly visible even if the source was transparent,
  // making them theme-proof in the Tenant App (Light/Dark mode).
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, 128, 128);
  ctx.drawImage(img, sx, sy, cropSize, cropSize, 0, 0, 128, 128);
  return new Promise((resolve, reject) => {
    // Flattening to JPEG forces the background to be solid and prevents transparency "ghosts".
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Canvas export failed.'))), 'image/jpeg', 0.95);
  });
};

const ScopePicker = ({ scopeType, targetEmirates, onScopeChange, onToggleEmirate, compact = false }) => (
  <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
    <select value={scopeType} onChange={(e) => onScopeChange(e.target.value)} className={`w-full rounded-xl border border-slate-300 bg-white ${compact ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm'} font-semibold text-slate-700 outline-none focus:border-blue-500`}>
      {SCOPE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
    {scopeType !== 'all_emirates' ? <div className="flex flex-wrap gap-1.5">{EMIRATE_OPTIONS.map((em) => <button key={em} type="button" onClick={() => onToggleEmirate(em)} className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${targetEmirates.includes(em) ? 'border-blue-500 bg-blue-600 text-white' : 'border-slate-300 bg-white text-slate-500'}`}>{em}</button>)}</div> : null}
  </div>
);

export const ApplicationLibraryPage = () => {
  const [activeTab, setActiveTab] = useState('global_libraries');
  const [iconRecords, setIconRecords] = useState([]);
  const [appRecords, setAppRecords] = useState([]);
  const [systemAssets, setSystemAssets] = useState({});
  const [iconFiles, setIconFiles] = useState([]);
  const [cropMap, setCropMap] = useState({});
  const [cropDialog, setCropDialog] = useState({ open: false, file: null, fileKey: '', mode: 'queue', icon: null });
  const [cropState, setCropState] = useState({ zoom: 1, cx: 0, cy: 0 });
  const [cropReferenceName, setCropReferenceName] = useState('');
  const [cropImage, setCropImage] = useState(null);
  const [mappedRows, setMappedRows] = useState([]);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [scopeMode, setScopeMode] = useState('batch');
  const [batchScopeType, setBatchScopeType] = useState('all_emirates');
  const [batchTargetEmirates, setBatchTargetEmirates] = useState([]);
  const [isSheetDragOver, setIsSheetDragOver] = useState(false);
  const [isUploadingIcons, setIsUploadingIcons] = useState(false);
  const [isReplacingIcon, setIsReplacingIcon] = useState(false);
  const [isSendingTemplate, setIsSendingTemplate] = useState(false);
  const [isParsingSheet, setIsParsingSheet] = useState(false);
  const [isImportingApps, setIsImportingApps] = useState(false);
  const [isTogglingApp, setIsTogglingApp] = useState(false);
  const [appModalOpen, setAppModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState(null);
  const [appForm, setAppForm] = useState(EMPTY_FORM);
  const [isSavingApp, setIsSavingApp] = useState(false);
  const [selectedAppIds, setSelectedAppIds] = useState([]);
  const [isDeletingApps, setIsDeletingApps] = useState(false);
  const [isNormalizingApps, setIsNormalizingApps] = useState(false);
  const [activeSystemVariation, setActiveSystemVariation] = useState('default');
  const replaceInputRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const isDraggingCropRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, cx: 0, cy: 0 });

  const iconsByName = useMemo(() => {
    const map = new Map();
    iconRecords.forEach((icon) => map.set(toUpperTrim(icon.iconName), icon));
    return map;
  }, [iconRecords]);

  const iconsById = useMemo(() => {
    const map = new Map();
    iconRecords.forEach((icon) => {
      if (icon?.id) map.set(icon.id, icon);
    });
    return map;
  }, [iconRecords]);

  const hydratedAppRecords = useMemo(() => (
    appRecords.map((app) => {
      const resolvedIconId = String(app.iconId || app.globalIconId || app.linkedIconId || '').trim();
      const resolvedIcon = iconsById.get(resolvedIconId) || null;
      return {
        ...app,
        iconId: resolvedIconId,
        globalIconId: resolvedIconId,
        linkedIconId: resolvedIconId,
        iconName: resolvedIcon?.iconName || String(app.iconName || ''),
        iconUrl: resolvedIcon?.iconUrl || '',
      };
    })
  ), [appRecords, iconsById]);

  const groupedApps = useMemo(() => {
    const groups = {};
    hydratedAppRecords.forEach((app) => {
      const key = app.iconName || 'UNASSIGNED';
      if (!groups[key]) {
        groups[key] = {
          iconName: key,
          iconUrl: app.iconUrl,
          apps: [],
        };
      }
      groups[key].apps.push(app);
    });
    return Object.values(groups).sort((a, b) => a.iconName.localeCompare(b.iconName));
  }, [hydratedAppRecords]);

  const iconOptions = useMemo(() => iconRecords.map((i) => ({ value: i.id, label: i.iconName })), [iconRecords]);
  const hasMissingIcons = mappedRows.some((row) => !row.iconFound);
  const isQueueUploadReady = useMemo(() => (
    iconFiles.length > 0
    && iconFiles.every((file) => Boolean(toUpperTrim(cropMap[getFileKey(file)]?.iconName)))
  ), [iconFiles, cropMap]);

  const loadIcons = async () => setIconRecords((await getDocs(query(collection(db, 'acis_global_icons'), orderBy('createdAt', 'desc')))).docs.map((d) => ({ id: d.id, ...d.data() })));
  const loadApps = async () => setAppRecords((await getDocs(query(collection(db, 'acis_global_applications'), orderBy('createdAt', 'desc')))).docs.map((d) => ({ id: d.id, ...d.data() })));
  const loadSystemAssets = async () => {
    const snap = await getDocs(collection(db, 'acis_system_assets'));
    const map = {};
    snap.docs.forEach((d) => { map[d.id] = d.data(); });
    setSystemAssets(map);
  };

  useEffect(() => {
    Promise.all([loadIcons(), loadApps(), loadSystemAssets()]).catch(() => setStatus({ type: 'error', message: 'Failed to load global libraries.' }));
  }, []);

  useEffect(() => {
    if (scopeMode !== 'batch') return;
    setMappedRows((prev) => prev.map((row) => ({ ...row, scopeType: batchScopeType, targetEmirates: batchScopeType === 'all_emirates' ? [] : [...batchTargetEmirates] })));
  }, [batchScopeType, batchTargetEmirates, scopeMode]);

  useEffect(() => {
    if (!cropDialog.open || !cropDialog.file) return;
    loadImage(cropDialog.file)
      .then((img) => {
        setCropImage(img);
        const existing = cropMap[cropDialog.fileKey];
        const existingCrop = existing?.crop || existing;
        if (existingCrop) {
          setCropState(existingCrop);
        } else {
          setCropState({ zoom: 1, cx: img.naturalWidth / 2, cy: img.naturalHeight / 2 });
        }
      })
      .catch(() => {});
  }, [cropDialog, cropMap]);

  useEffect(() => {
    if (!cropDialog.open || !cropImage) return;
    drawCropToCanvas(previewCanvasRef.current, cropImage, cropState);
  }, [cropDialog.open, cropImage, cropState]);
  const openCropDialog = (file, fileKey, mode = 'queue', icon = null) => {
    const existing = cropMap[fileKey];
    setCropImage(null);
    setCropState(existing?.crop || existing || { zoom: 1, cx: 0, cy: 0 });
    setCropReferenceName(existing?.iconName || '');
    setCropDialog({ open: true, file, fileKey, mode, icon });
  };

  const handleQueueFilesSelected = (files) => {
    const nextFiles = Array.from(files || []);
    setIconFiles(nextFiles);
    setCropMap({});
    if (!nextFiles.length) return;
    const firstFile = nextFiles[0];
    setCropImage(null);
    setCropState({ zoom: 1, cx: 0, cy: 0 });
    setCropReferenceName('');
    setCropDialog({ open: true, file: firstFile, fileKey: getFileKey(firstFile), mode: 'queue', icon: null });
  };

  const startCropDragging = (clientX, clientY) => {
    if (!cropImage || !previewCanvasRef.current) return;
    isDraggingCropRef.current = true;
    dragStartRef.current = { x: clientX, y: clientY, cx: cropState.cx, cy: cropState.cy };
  };

  const moveCropDragging = (clientX, clientY) => {
    if (!isDraggingCropRef.current || !cropImage || !previewCanvasRef.current) return;
    const canvas = previewCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const dx = (clientX - dragStartRef.current.x) * scaleX;
    const dy = (clientY - dragStartRef.current.y) * scaleY;
    const { cropSize } = getCropRect(cropImage, cropState);
    const ratio = cropSize / canvas.width;
    const proposedCx = dragStartRef.current.cx - (dx * ratio);
    const proposedCy = dragStartRef.current.cy - (dy * ratio);
    setCropState((prev) => {
      const half = cropSize / 2;
      return {
        ...prev,
        cx: clamp(proposedCx, half, cropImage.naturalWidth - half),
        cy: clamp(proposedCy, half, cropImage.naturalHeight - half),
      };
    });
  };

  const handleCropMouseDown = (event) => {
    startCropDragging(event.clientX, event.clientY);
  };

  const handleCropMouseMove = (event) => {
    moveCropDragging(event.clientX, event.clientY);
  };

  const handleCropTouchStart = (event) => {
    const touch = event.touches?.[0];
    if (!touch) return;
    startCropDragging(touch.clientX, touch.clientY);
  };

  const handleCropTouchMove = (event) => {
    const touch = event.touches?.[0];
    if (!touch) return;
    event.preventDefault();
    moveCropDragging(touch.clientX, touch.clientY);
  };

  const stopCropDragging = () => {
    isDraggingCropRef.current = false;
  };

  const handleCropWheel = (event) => {
    if (!cropImage || !previewCanvasRef.current) return;
    event.preventDefault();
    const canvas = previewCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    const frameSize = Math.min(canvas.width, canvas.height) * 0.72;
    const fx = (canvas.width - frameSize) / 2;
    const fy = (canvas.height - frameSize) / 2;
    if (x < fx || x > fx + frameSize || y < fy || y > fy + frameSize) return;

    setCropState((prev) => {
      const currentZoom = clamp(prev.zoom || 1, 1, 6);
      const zoomMultiplier = event.deltaY < 0 ? 1.08 : 0.92;
      const nextZoom = clamp(currentZoom * zoomMultiplier, 1, 6);
      const currentRect = getCropRect(cropImage, prev);
      const u = (x - fx) / frameSize;
      const v = (y - fy) / frameSize;
      const ix = currentRect.sx + (u * currentRect.cropSize);
      const iy = currentRect.sy + (v * currentRect.cropSize);
      const nextCropSize = Math.min(cropImage.naturalWidth, cropImage.naturalHeight) / nextZoom;
      const proposedSx = ix - (u * nextCropSize);
      const proposedSy = iy - (v * nextCropSize);
      const sx = clamp(proposedSx, 0, Math.max(0, cropImage.naturalWidth - nextCropSize));
      const sy = clamp(proposedSy, 0, Math.max(0, cropImage.naturalHeight - nextCropSize));
      return {
        zoom: nextZoom,
        cx: sx + nextCropSize / 2,
        cy: sy + nextCropSize / 2,
      };
    });
  };

  const handleCropConfirm = async () => {
    if (!cropDialog.file) return;
    if (cropDialog.mode === 'queue') {
      const iconName = toUpperTrim(cropReferenceName);
      if (!iconName) return;
      setCropMap((prev) => ({ ...prev, [cropDialog.fileKey]: { crop: cropState, iconName } }));
      setCropDialog({ open: false, file: null, fileKey: '', mode: 'queue', icon: null });
      setCropReferenceName('');
      return;
    }
    if (cropDialog.mode === 'system') {
      if (!cropDialog.icon) return;
      setIsReplacingIcon(true);
      try {
        const blob = await processTo128(cropDialog.file, cropState);
        const storageRef = ref(storage, `acis_system_assets/${cropDialog.icon.id}_${Date.now()}.png`);
        await uploadBytes(storageRef, blob, { contentType: 'image/png' });
        const iconUrl = await getDownloadURL(storageRef);
        await setDoc(doc(db, 'acis_system_assets', cropDialog.icon.id), {
          iconLabel: cropDialog.icon.label,
          iconUrl,
          lastUpdated: serverTimestamp(),
        }, { merge: true });
        await loadSystemAssets();
        setStatus({ type: 'success', message: `Updated system asset: ${cropDialog.icon.label}` });
        setCropDialog({ open: false, file: null, fileKey: '', mode: 'queue', icon: null });
      } catch (err) {
        setStatus({ type: 'error', message: err.message || 'System asset update failed.' });
      } finally {
        setIsReplacingIcon(false);
      }
      return;
    }
    if (!cropDialog.icon) return;
    setIsReplacingIcon(true);
    try {
      if (cropDialog.icon.iconUrl) {
        const previousStorageRef = ref(storage, cropDialog.icon.iconUrl);
        try {
          await deleteObject(previousStorageRef);
        } catch (deleteErr) {
          if (deleteErr?.code !== 'storage/object-not-found') throw deleteErr;
        }
      }
      const blob = await processTo128(cropDialog.file, cropState);
      const storageRef = ref(storage, `acis_global_icons/${cropDialog.icon.id}_${Date.now()}.png`);
      await uploadBytes(storageRef, blob, { contentType: 'image/png' });
      const iconUrl = await getDownloadURL(storageRef);
      await updateDoc(doc(db, 'acis_global_icons', cropDialog.icon.id), { iconUrl, updatedAt: serverTimestamp() });
      await loadIcons();
      setStatus({ type: 'success', message: `Replaced image for ${cropDialog.icon.iconName}.` });
      setCropDialog({ open: false, file: null, fileKey: '', mode: 'queue', icon: null });
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Icon replace failed.' });
    } finally {
      setIsReplacingIcon(false);
    }
  };

  const handleIconUpload = async () => {
    if (!iconFiles.length) return setStatus({ type: 'error', message: 'Select image files first.' });
    if (!isQueueUploadReady) return setStatus({ type: 'error', message: 'Set mandatory Icon Reference Name for every queued file.' });
    setIsUploadingIcons(true);
    try {
      for (const file of iconFiles) {
        const fileKey = getFileKey(file);
        const queueConfig = cropMap[fileKey];
        const iconName = toUpperTrim(queueConfig?.iconName);
        if (!iconName) throw new Error('Icon Reference Name is required for all uploads.');
        const crop = queueConfig?.crop || { zoom: 1 };
        const blob = await processTo128(file, crop);
        const storageRef = ref(storage, `acis_global_icons/${Date.now()}_${iconName.replace(/\s+/g, '_')}.png`);
        await uploadBytes(storageRef, blob, { contentType: 'image/png' });
        const iconUrl = await getDownloadURL(storageRef);
        await addDoc(collection(db, 'acis_global_icons'), { iconName, iconUrl, createdAt: serverTimestamp() });
      }
      setIconFiles([]);
      setCropMap({});
      await loadIcons();
      setStatus({ type: 'success', message: 'Icons uploaded (1:1, 128x128).' });
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Icon upload failed.' });
    } finally {
      setIsUploadingIcons(false);
    }
  };

  const handleSendSampleEmailFormat = async () => {
    const user = JSON.parse(localStorage.getItem('acisDevUser') || '{}');
    setIsSendingTemplate(true);
    try {
      await addDoc(collection(db, 'mail'), {
        to: user?.email ? [user.email] : [],
        message: {
          subject: 'ACIS Global App Library - Excel Sample Format',
          text: 'Columns: Application Name | Description (Optional) | Icon Name',
          html: '<p>Columns: <strong>Application Name</strong>, <strong>Description (Optional)</strong>, <strong>Icon Name</strong>.</p>',
        },
        source: 'developer-app-library-module',
        createdAt: serverTimestamp(),
      });
      setStatus({ type: 'success', message: 'Sample email trigger written to /mail.' });
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Template email trigger failed.' });
    } finally {
      setIsSendingTemplate(false);
    }
  };

  const handleExcelFile = async (file) => {
    if (!file) return;
    const nameStr = file.name.toLowerCase();
    if (!nameStr.endsWith('.xlsx') && !nameStr.endsWith('.csv')) return setStatus({ type: 'error', message: 'Only .xlsx or .csv allowed.' });
    setIsParsingSheet(true);
    try {
      const rows = await parseExcelRows(file);
      const mapped = rows.filter((r) => r.applicationName || r.iconName || r.description).map((row) => {
        const appName = toUpperTrim(row.applicationName);
        const iconName = toUpperTrim(row.iconName);
        const icon = iconsByName.get(iconName) || null;
        return {
          ...row,
          appName,
          iconName,
          iconId: icon?.id || '',
          iconFound: Boolean(icon),
          scopeType: batchScopeType,
          targetEmirates: batchScopeType === 'all_emirates' ? [] : [...batchTargetEmirates],
        };
      });
      setMappedRows(mapped);
      const missing = mapped.filter((row) => !row.iconFound).length;
      setStatus(missing ? { type: 'error', message: `${missing} row(s) have missing icons.` } : { type: 'success', message: `Parsed ${mapped.length} row(s).` });
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Excel parse failed.' });
    } finally {
      setIsParsingSheet(false);
    }
  };

  const handleImportMappedApplications = async () => {
    if (!mappedRows.length) return setStatus({ type: 'error', message: 'Upload an Excel or CSV file first.' });
    if (hasMissingIcons) return setStatus({ type: 'error', message: 'Fix missing icon links before import.' });
    setIsImportingApps(true);
    try {
      const batch = writeBatch(db);
      mappedRows.forEach((row) => {
        const appDocId = toAppDocId(row.appName);
        const existingByName = appRecords.find((a) => toUpperTrim(a.appName) === toUpperTrim(row.appName));
        const legacyIdToDelete = existingByName && existingByName.id !== appDocId ? existingByName.id : '';
        const appRef = doc(db, 'acis_global_applications', appDocId);

        const payload = {
          appName: toUpperTrim(row.appName),
          description: String(row.description || '').trim(),
          iconId: row.iconId,
          globalIconId: row.iconId,
          linkedIconId: row.iconId,
          iconName: row.iconName,
          scopeType: row.scopeType,
          targetEmirates: Array.isArray(row.targetEmirates) ? row.targetEmirates : [],
          isActive: true,
          updatedAt: serverTimestamp(),
        };

        if (!existingByName) {
          payload.createdAt = serverTimestamp();
          payload.services = [];
        }

        batch.set(appRef, payload, { merge: true });
        if (legacyIdToDelete) {
          batch.delete(doc(db, 'acis_global_applications', legacyIdToDelete));
        }
      });
      await batch.commit();
      await loadApps();
      setMappedRows([]);
      setStatus({ type: 'success', message: `Successfully imported/updated ${mappedRows.length} applications.` });
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Import failed.' });
    } finally {
      setIsImportingApps(false);
    }
  };

  const openNewAppModal = () => { setEditingApp(null); setAppForm(EMPTY_FORM); setAppModalOpen(true); };

  const openEditAppModal = (app) => {
    setEditingApp(app);
    setAppForm({
      appName: app.appName || '',
      description: app.description || '',
      linkedIconId: app.linkedIconId || app.iconId || app.globalIconId || '',
      scopeType: app.scopeType || 'all_emirates',
      targetEmirates: Array.isArray(app.targetEmirates) ? app.targetEmirates : [],
      isActive: app.isActive !== false,
    });
    setAppModalOpen(true);
  };

  const saveApplication = async () => {
    const appName = toUpperTrim(appForm.appName);
    if (!appName) return setStatus({ type: 'error', message: 'Application Name is required.' });
    if (!appForm.linkedIconId) return setStatus({ type: 'error', message: 'Icon is required.' });
    const icon = iconRecords.find((i) => i.id === appForm.linkedIconId);
    if (!icon) return setStatus({ type: 'error', message: 'Selected icon not found.' });
    const appDocId = toAppDocId(appName);
    const conflicting = appRecords.find((item) => item.id === appDocId && item.id !== editingApp?.id);
    if (conflicting && toUpperTrim(conflicting.appName) !== appName) {
      return setStatus({ type: 'error', message: 'Another application already uses this UID. Rename one app to keep a unique key.' });
    }
    setIsSavingApp(true);
    try {
      const payload = {
        appName,
        description: String(appForm.description || '').trim(),
        iconId: appForm.linkedIconId,
        globalIconId: appForm.linkedIconId,
        linkedIconId: appForm.linkedIconId,
        iconName: icon.iconName || '',
        scopeType: appForm.scopeType,
        targetEmirates: appForm.scopeType === 'all_emirates' ? [] : appForm.targetEmirates,
        isActive: appForm.isActive !== false,
        updatedAt: serverTimestamp(),
      };
      if (editingApp) {
        if (editingApp.id === appDocId) {
          await setDoc(doc(db, 'acis_global_applications', appDocId), payload, { merge: true });
        } else {
          const batch = writeBatch(db);
          batch.set(doc(db, 'acis_global_applications', appDocId), { ...payload, createdAt: editingApp.createdAt || serverTimestamp() }, { merge: true });
          batch.delete(doc(db, 'acis_global_applications', editingApp.id));
          await batch.commit();
        }
      } else {
        await setDoc(doc(db, 'acis_global_applications', appDocId), { ...payload, services: [], createdAt: serverTimestamp() }, { merge: true });
      }
      await loadApps();
      setAppModalOpen(false);
      setStatus({ type: 'success', message: editingApp ? 'Application updated.' : 'Application created.' });
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Save failed.' });
    } finally {
      setIsSavingApp(false);
    }
  };

  const toggleApplicationActive = async (app) => {
    setIsTogglingApp(true);
    try {
      await updateDoc(doc(db, 'acis_global_applications', app.id), { isActive: app.isActive === false, updatedAt: serverTimestamp() });
      await loadApps();
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Kill switch update failed.' });
    } finally {
      setIsTogglingApp(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (!selectedAppIds.length) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedAppIds.length} application(s)?`)) return;
    setIsDeletingApps(true);
    try {
      const batch = writeBatch(db);
      selectedAppIds.forEach(id => {
        batch.delete(doc(db, 'acis_global_applications', id));
      });
      await batch.commit();
      await loadApps();
      setSelectedAppIds([]);
      setStatus({ type: 'success', message: `Deleted ${selectedAppIds.length} application(s).` });
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Delete failed.' });
    } finally {
      setIsDeletingApps(false);
    }
  };

  const handleNormalizeApplicationRecords = async () => {
    if (!appRecords.length) {
      setStatus({ type: 'error', message: 'No applications found to normalize.' });
      return;
    }
    if (!window.confirm('Normalize all applications to app-name UID and icon UID-only mapping? This will migrate legacy IDs and remove app-level iconUrl fields.')) return;

    setIsNormalizingApps(true);
    try {
      const grouped = new Map();
      let skipped = 0;

      appRecords.forEach((app) => {
        const normalizedName = toUpperTrim(app?.appName);
        if (!normalizedName) {
          skipped += 1;
          return;
        }
        const targetId = toAppDocId(normalizedName);
        if (!grouped.has(targetId)) grouped.set(targetId, []);
        grouped.get(targetId).push(app);
      });

      const scoreCandidate = (app, targetId) => {
        let score = 0;
        if (app.id === targetId) score += 1000;
        if (String(app.iconId || app.globalIconId || app.linkedIconId || '').trim()) score += 100;
        if (String(app.description || '').trim()) score += 10;
        if (Array.isArray(app.services) && app.services.length > 0) score += 5;
        return score;
      };

      const setOps = [];
      const deleteIds = new Set();
      let migrated = 0;
      let mergedDuplicates = 0;

      grouped.forEach((group, targetId) => {
        const ordered = [...group].sort((a, b) => scoreCandidate(b, targetId) - scoreCandidate(a, targetId));
        const primary = ordered[0];
        if (!primary) return;

        const resolvedIconId = String(primary.iconId || primary.globalIconId || primary.linkedIconId || '').trim();
        const resolvedIcon = iconsById.get(resolvedIconId) || null;
        const payload = {
          appName: toUpperTrim(primary.appName),
          description: String(primary.description || '').trim(),
          iconId: resolvedIconId,
          globalIconId: resolvedIconId,
          linkedIconId: resolvedIconId,
          iconName: resolvedIcon?.iconName || String(primary.iconName || ''),
          scopeType: primary.scopeType || 'all_emirates',
          targetEmirates: Array.isArray(primary.targetEmirates) ? primary.targetEmirates : [],
          isActive: primary.isActive !== false,
          updatedAt: serverTimestamp(),
          iconUrl: deleteField(),
        };

        if (Array.isArray(primary.services)) payload.services = primary.services;
        if (primary.id !== targetId && primary.createdAt) payload.createdAt = primary.createdAt;

        setOps.push({ id: targetId, payload });
        if (primary.id !== targetId) {
          deleteIds.add(primary.id);
          migrated += 1;
        }

        ordered.slice(1).forEach((item) => {
          if (item.id !== targetId) {
            deleteIds.add(item.id);
            mergedDuplicates += 1;
          }
        });

        deleteIds.delete(targetId);
      });

      const opChunks = [];
      const MAX_BATCH_OPS = 400;
      let cursor = 0;
      while (cursor < setOps.length) {
        opChunks.push({ sets: setOps.slice(cursor, cursor + MAX_BATCH_OPS), deletes: [] });
        cursor += MAX_BATCH_OPS;
      }

      const deleteList = Array.from(deleteIds);
      let deleteCursor = 0;
      if (opChunks.length === 0) opChunks.push({ sets: [], deletes: [] });
      opChunks.forEach((chunk, index) => {
        const room = Math.max(0, MAX_BATCH_OPS - chunk.sets.length);
        if (room <= 0) return;
        const nextDeletes = deleteList.slice(deleteCursor, deleteCursor + room);
        opChunks[index].deletes = nextDeletes;
        deleteCursor += nextDeletes.length;
      });
      while (deleteCursor < deleteList.length) {
        opChunks.push({ sets: [], deletes: deleteList.slice(deleteCursor, deleteCursor + MAX_BATCH_OPS) });
        deleteCursor += MAX_BATCH_OPS;
      }

      for (const chunk of opChunks) {
        const batch = writeBatch(db);
        chunk.sets.forEach((item) => {
          batch.set(doc(db, 'acis_global_applications', item.id), item.payload, { merge: true });
        });
        chunk.deletes.forEach((id) => {
          batch.delete(doc(db, 'acis_global_applications', id));
        });
        // eslint-disable-next-line no-await-in-loop
        await batch.commit();
      }

      await loadApps();
      setSelectedAppIds([]);
      setStatus({
        type: 'success',
        message: `Normalization complete. ${setOps.length} canonical app IDs synced, ${migrated} migrated IDs replaced, ${mergedDuplicates} duplicate records removed${skipped ? `, ${skipped} skipped (missing name)` : ''}.`,
      });
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Normalization failed.' });
    } finally {
      setIsNormalizingApps(false);
    }
  };

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        <div className="flex items-end justify-between border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-800">Global Application Library</h1>
            <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-400">Icon & Application Management Dashboard</p>
          </div>
          <LibraryBig className="h-8 w-8 text-blue-600" />
        </div>

        {status.message ? <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${status.type === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700' : status.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-blue-200 bg-blue-50 text-blue-700'}`}>{status.message}</div> : null}

        <div className="flex gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          <button type="button" onClick={() => setActiveTab('global_libraries')} className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider transition ${activeTab === 'global_libraries' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>Global Libraries</button>
          <button type="button" onClick={() => setActiveTab('system_interface_assets')} className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider transition ${activeTab === 'system_interface_assets' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>System Interface Assets</button>
        </div>

        {activeTab === 'global_libraries' ? (
        <>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">Phase 1: Bulk Icon Upload (1:1, 128x128)</h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <label className="flex cursor-pointer items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm font-bold text-slate-600 transition hover:border-blue-400 hover:bg-blue-50">
              <UploadCloud className="h-5 w-5 text-blue-500" /> Select Multiple Image Files
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleQueueFilesSelected(e.target.files)} />
            </label>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Queued Files</p>
              <p className="mt-2 text-sm font-semibold text-slate-700">{iconFiles.length} selected</p>
              <div className="mt-2 max-h-28 overflow-y-auto space-y-1.5">
                {iconFiles.map((file) => {
                  const fileKey = getFileKey(file);
                  const configuredName = toUpperTrim(cropMap[fileKey]?.iconName);
                  return <div key={fileKey} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-2 py-1.5"><div className="min-w-0 pr-2"><p className="truncate text-[11px] font-semibold text-slate-600">{file.name}</p><p className={`text-[10px] font-bold ${configuredName ? 'text-emerald-600' : 'text-rose-500'}`}>{configuredName || 'Icon Reference Name required'}</p></div><button type="button" onClick={() => openCropDialog(file, fileKey)} className="rounded-md border border-slate-300 px-2 py-0.5 text-[10px] font-bold text-slate-600 transition hover:border-blue-400 hover:text-blue-600">Set Crop + Name</button></div>;
                })}
              </div>
              <button type="button" disabled={isUploadingIcons || !isQueueUploadReady} onClick={handleIconUpload} className="mt-3 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50">{isUploadingIcons ? 'Uploading...' : 'Upload to acis_global_icons'}</button>
            </div>
          </div>

          <p className="mt-3 text-xs font-semibold text-slate-500">Current icon library count: {iconRecords.length}</p>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {iconRecords.slice(0, 18).map((icon) => (
              <div key={icon.id} className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                <div className="aspect-square overflow-hidden rounded-lg border border-slate-200 bg-white"><img src={icon.iconUrl} alt={icon.iconName} className="h-full w-full object-contain" /></div>
                <p className="mt-1 truncate text-[10px] font-bold text-slate-600">{icon.iconName}</p>
                <button type="button" onClick={() => { replaceInputRef.current.value = ''; replaceInputRef.current.click(); replaceInputRef.current.onchange = (e) => { const file = e.target.files?.[0]; if (!file) return; openCropDialog(file, `${icon.id}-${file.name}-${file.lastModified}`, 'replace', icon); }; }} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-[10px] font-bold text-slate-600 transition hover:border-blue-400 hover:text-blue-600">Replace Image</button>
              </div>
            ))}
          </div>
          <input ref={replaceInputRef} type="file" accept="image/*" className="hidden" />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">Phase 2: Data Import</h2>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" onClick={handleSendSampleEmailFormat} disabled={isSendingTemplate} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-blue-400 hover:text-blue-600 disabled:opacity-50"><Mail className="h-4 w-4" />{isSendingTemplate ? 'Sending...' : 'Send Sample Email Format'}</button>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-blue-400 hover:text-blue-600"><FileSpreadsheet className="h-4 w-4" />Upload .xlsx / .csv<input type="file" accept=".xlsx, .csv" className="hidden" onChange={(e) => { handleExcelFile(e.target.files?.[0]); e.target.value = null; }} /></label>
            {isParsingSheet ? <span className="text-xs font-bold uppercase tracking-wide text-blue-600">Parsing...</span> : null}
          </div>
          <div onDragOver={(e) => { e.preventDefault(); setIsSheetDragOver(true); }} onDragLeave={(e) => { e.preventDefault(); setIsSheetDragOver(false); }} onDrop={(e) => { e.preventDefault(); setIsSheetDragOver(false); handleExcelFile(e.dataTransfer.files?.[0]); }} className={`mt-4 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${isSheetDragOver ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50'}`}><p className="text-sm font-bold text-slate-700">Drop your filled `.xlsx` or `.csv` file here</p><p className="mt-1 text-xs font-semibold text-slate-500">Application Name | Description (Optional) | Icon Name</p></div>
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Scope Mode</label>
              <select value={scopeMode} onChange={(e) => setScopeMode(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500"><option value="batch">Batch Scope</option><option value="item">Per Item Scope</option></select>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Default Scope</label>
              <ScopePicker scopeType={batchScopeType} targetEmirates={batchTargetEmirates} onScopeChange={setBatchScopeType} onToggleEmirate={(em) => setBatchTargetEmirates((prev) => (prev.includes(em) ? prev.filter((p) => p !== em) : [...prev, em]))} compact />
            </div>
          </div>

          {mappedRows.length > 0 ? <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200"><table className="min-w-full text-xs"><thead className="bg-slate-100 text-left uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2">Application</th><th className="px-3 py-2">Icon Name</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Scope</th></tr></thead><tbody>{mappedRows.map((row, index) => <tr key={`${row.rowNumber}-${row.appName}-${index}`} className="border-t border-slate-100"><td className="px-3 py-2"><p className="font-bold text-slate-800">{row.appName}</p><p className="text-[11px] text-slate-500">{row.description || 'No description'}</p></td><td className="px-3 py-2 font-semibold text-slate-700">{row.iconName}</td><td className="px-3 py-2">{row.iconFound ? <span className="inline-flex items-center gap-1 font-bold text-emerald-600"><CheckCircle2 className="h-4 w-4" />Matched</span> : <span className="inline-flex items-center gap-1 font-bold text-rose-600"><XCircle className="h-4 w-4" />Missing</span>}</td><td className="px-3 py-2">{scopeMode === 'item' ? <ScopePicker scopeType={row.scopeType} targetEmirates={row.targetEmirates} onScopeChange={(t) => setMappedRows((prev) => prev.map((r, i) => (i === index ? { ...r, scopeType: t, targetEmirates: t === 'all_emirates' ? [] : r.targetEmirates } : r)))} onToggleEmirate={(em) => setMappedRows((prev) => prev.map((r, i) => (i === index ? { ...r, targetEmirates: r.targetEmirates.includes(em) ? r.targetEmirates.filter((p) => p !== em) : [...r.targetEmirates, em] } : r)))} compact /> : <span className="font-semibold text-slate-600">Batch Scope Applied</span>}</td></tr>)}</tbody></table></div> : null}
          <button type="button" disabled={isImportingApps || mappedRows.length === 0 || hasMissingIcons} onClick={handleImportMappedApplications} className="mt-5 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50">{isImportingApps ? 'Importing...' : 'Import to acis_global_applications'}</button>
        </section>
        </>
        ) : (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">System Master Icons - Cloud Control</h2>
                <p className="mt-1 text-xs font-semibold text-slate-500">Upload/replace each fixed key. Every upload is cropped to 1:1 and resized to 128x128.</p>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-1.5">
                {[
                  { id: 'default', label: 'Default' },
                  { id: 'winter', label: 'Winter' },
                  { id: 'summer', label: 'Summer' },
                  { id: 'ramadan', label: 'Ramadan' },
                  { id: 'eid', label: 'Eid' },
                  { id: 'anniversary', label: 'Anniv' },
                ].map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setActiveSystemVariation(v.id)}
                    className={`rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition ${
                      activeSystemVariation === v.id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {SYSTEM_ASSET_CATEGORIES.map((category) => (
                <details key={category.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4" open>
                  <summary className="cursor-pointer text-sm font-black uppercase tracking-widest text-slate-600">{category.title}</summary>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {category.items.map((item) => {
                      const effectiveId = activeSystemVariation === 'default' ? item.id : `${item.id}_${activeSystemVariation}`;
                      const asset = systemAssets[effectiveId] || null;
                      return (
                        <div key={effectiveId} className={`rounded-xl border p-3 transition ${activeSystemVariation !== 'default' ? 'border-blue-200 bg-blue-50/30' : 'border-slate-200 bg-white'}`}>
                          <div className="flex items-center justify-between">
                            <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">{item.label}</p>
                            <p className="text-[10px] font-semibold text-blue-500">{activeSystemVariation.toUpperCase()}</p>
                          </div>
                          <div className="mt-2 aspect-square overflow-hidden rounded-lg border border-slate-200 bg-white">
                            {asset?.iconUrl ? (
                              <img src={asset.iconUrl} alt={item.label} className="h-full w-full object-contain" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-slate-400 bg-slate-50">No {activeSystemVariation} Image</div>
                            )}
                          </div>
                          <div className="mt-2 flex items-center justify-between text-[9px] font-bold text-slate-400">
                             <span>{effectiveId}</span>
                             <span>{asset?.lastUpdated ? 'SYNCED' : 'PENDING'}</span>
                          </div>
                          <label className={`mt-2 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2 text-[11px] font-bold transition ${activeSystemVariation !== 'default' ? 'border-blue-300 bg-white text-blue-600 hover:bg-blue-600 hover:text-white' : 'border-slate-300 bg-white text-slate-600 hover:border-blue-400 hover:text-blue-600'}`}>
                            <UploadCloud className="h-3.5 w-3.5" />
                            {asset?.iconUrl ? 'Replace' : 'Upload'} {activeSystemVariation}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                openCropDialog(file, `system-${effectiveId}-${file.lastModified}`, 'system', { ...item, id: effectiveId });
                              }}
                            />
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </details>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">Manage Global Applications</h2>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleNormalizeApplicationRecords}
                disabled={isNormalizingApps || isDeletingApps}
                className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
              >
                {isNormalizingApps ? 'Normalizing...' : 'Normalize UID + Icon UID'}
              </button>
              {selectedAppIds.length > 0 && (
                <button type="button" onClick={handleDeleteSelected} disabled={isDeletingApps} className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-bold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50">
                  {isDeletingApps ? 'Deleting...' : `Delete Selected (${selectedAppIds.length})`}
                </button>
              )}
              <button type="button" onClick={openNewAppModal} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white transition hover:opacity-90">Add Custom App</button>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-100 text-left uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="w-10 px-3 py-2 text-center">
                    <input 
                      type="checkbox" 
                      checked={appRecords.length > 0 && selectedAppIds.length === appRecords.length} 
                      onChange={(e) => setSelectedAppIds(e.target.checked ? appRecords.map(a => a.id) : [])} 
                      className="cursor-pointer rounded border-slate-300"
                    />
                  </th>
                  <th className="px-3 py-2">Application</th>
                  <th className="px-3 py-2">Icon</th>
                  <th className="px-3 py-2">Scope</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {groupedApps.map((group) => {
                  const groupAppIds = group.apps.map(a => a.id);
                  const isFullySelected = groupAppIds.length > 0 && groupAppIds.every(id => selectedAppIds.includes(id));
                  const isPartiallySelected = !isFullySelected && groupAppIds.some(id => selectedAppIds.includes(id));

                  return (
                    <React.Fragment key={group.iconName}>
                      {/* Group Header */}
                      <tr className="border-t border-slate-200 bg-slate-50">
                        <td className="w-10 px-3 py-2 text-center">
                          <input 
                            type="checkbox" 
                            checked={isFullySelected}
                            ref={el => { if (el) el.indeterminate = isPartiallySelected; }}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedAppIds(prev => Array.from(new Set([...prev, ...groupAppIds])));
                              } else {
                                setSelectedAppIds(prev => prev.filter(id => !groupAppIds.includes(id)));
                              }
                            }}
                            className="cursor-pointer rounded border-slate-300"
                          />
                        </td>
                        <td colSpan={5} className="px-3 py-2">
                           <div className="flex items-center justify-between gap-3">
                             <div className="flex items-center gap-2">
                             {group.iconUrl ? <img src={group.iconUrl} alt={group.iconName} className="h-6 w-6 rounded border border-slate-200 object-contain bg-white" /> : null}
                             <span className="font-black uppercase tracking-wider text-slate-700">{group.iconName} ({group.apps.length} applications)</span>
                             </div>
                             <button
                               type="button"
                               disabled={isTogglingApp}
                               onClick={async () => {
                                 setIsTogglingApp(true);
                                 const shouldDisable = group.apps.some((app) => app.isActive !== false);
                                 for (const item of group.apps) {
                                   if (Boolean(item.isActive !== false) === shouldDisable) {
                                     await toggleApplicationActive(item);
                                   }
                                 }
                                 setIsTogglingApp(false);
                               }}
                               className={`rounded-lg border px-3 py-1.5 text-[11px] font-bold transition ${
                                 group.apps.some((app) => app.isActive !== false)
                                   ? 'border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100'
                                   : 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                               }`}
                             >
                               {group.apps.some((app) => app.isActive !== false) ? 'Disable Group' : 'Enable Group'}
                             </button>
                           </div>
                        </td>
                      </tr>
                      
                      {/* Apps inside Group */}
                      {group.apps.map((app) => (
                        <tr key={app.id} className="border-t border-slate-100 bg-white">
                          <td className="w-10 px-3 py-2 text-center">
                            <input 
                              type="checkbox" 
                              checked={selectedAppIds.includes(app.id)} 
                              onChange={(e) => setSelectedAppIds(prev => e.target.checked ? [...prev, app.id] : prev.filter(id => id !== app.id))} 
                              className="cursor-pointer rounded border-slate-300 ml-4"
                            />
                          </td>
                          <td className="px-3 py-2 pl-6">
                            <p className="font-bold text-slate-800">{app.appName}</p>
                            <p className="text-[11px] text-slate-500">{app.description || 'No description'}</p>
                          </td>
                          <td className="px-3 py-2">
                             <span className="font-semibold text-slate-400">↳ Linked</span>
                          </td>
                          <td className="px-3 py-2 font-semibold text-slate-600">
                             {SCOPE_OPTIONS.find((s) => s.value === app.scopeType)?.label || 'All Emirates'}
                          </td>
                          <td className="px-3 py-2">
                             <button type="button" disabled={isTogglingApp} onClick={() => toggleApplicationActive(app)} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold ${app.isActive === false ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-emerald-300 bg-emerald-50 text-emerald-700'}`}>
                               <Power className="h-3.5 w-3.5" />{app.isActive === false ? 'DISABLED' : 'ENABLED'}
                             </button>
                          </td>
                          <td className="px-3 py-2">
                             <button type="button" onClick={() => openEditAppModal(app)} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700 transition hover:border-blue-400 hover:text-blue-600">
                               <Edit3 className="h-3.5 w-3.5" />Edit
                             </button>
                             <button
                               type="button"
                               disabled={isTogglingApp}
                               onClick={() => toggleApplicationActive(app)}
                               className={`ml-2 inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition ${
                                 app.isActive === false
                                   ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                   : 'border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100'
                               }`}
                             >
                               <Power className="h-3.5 w-3.5" />
                               {app.isActive === false ? 'Enable' : 'Disable'}
                             </button>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {cropDialog.open ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4">
            <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-black text-slate-800">Visual Drag Crop (1:1 • 128x128)</h3>
                <button
                  type="button"
                  onClick={() => {
                    stopCropDragging();
                    setCropDialog({ open: false, file: null, fileKey: '', mode: 'queue', icon: null });
                  }}
                  className="rounded-lg border border-slate-300 p-1.5 text-slate-500 hover:text-slate-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <canvas
                    ref={previewCanvasRef}
                    width={320}
                    height={320}
                    onMouseDown={handleCropMouseDown}
                    onMouseMove={handleCropMouseMove}
                    onMouseUp={stopCropDragging}
                    onMouseLeave={stopCropDragging}
                    onTouchStart={handleCropTouchStart}
                    onTouchMove={handleCropTouchMove}
                    onTouchEnd={stopCropDragging}
                    onWheel={handleCropWheel}
                    className="h-full w-full cursor-grab rounded-lg bg-slate-900/5 active:cursor-grabbing"
                  />
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Zoom
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={6}
                    step={0.01}
                    value={Number(cropState.zoom || 1)}
                    onChange={(event) => setCropState((prev) => ({ ...prev, zoom: clamp(Number(event.target.value) || 1, 1, 6) }))}
                    className="mt-2 w-full accent-blue-600"
                  />
                </div>
                <p className="text-xs font-semibold text-slate-500">Drag image to position. Use mouse wheel or zoom slider to scale. Bright rounded square is the final card crop.</p>
                {cropDialog.mode === 'queue' ? (
                  <label className="block">
                    <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Icon Reference Name *</span>
                    <input
                      value={cropReferenceName}
                      onChange={(e) => setCropReferenceName(e.target.value)}
                      placeholder="Example: ICP_IMMIGRATION"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 outline-none transition focus:border-blue-500"
                    />
                  </label>
                ) : null}
                <button
                  type="button"
                  onClick={handleCropConfirm}
                  disabled={cropDialog.mode === 'queue' ? !toUpperTrim(cropReferenceName) : isReplacingIcon}
                  className="w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  {cropDialog.mode === 'replace'
                    ? (isReplacingIcon ? 'Replacing...' : 'Replace Image')
                    : cropDialog.mode === 'system'
                      ? (isReplacingIcon ? 'Updating...' : 'Save System Asset')
                      : 'Save Crop Setting'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {appModalOpen ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4"><div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"><div className="mb-4 flex items-center justify-between"><h3 className="text-base font-black text-slate-800">{editingApp ? 'Edit Application' : 'New Application'}</h3><button type="button" onClick={() => setAppModalOpen(false)} className="rounded-lg border border-slate-300 p-1.5 text-slate-500 hover:text-slate-800"><X className="h-4 w-4" /></button></div><div className="grid gap-3 sm:grid-cols-2"><label className="sm:col-span-2"><span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Application Name *</span><input value={appForm.appName} onChange={(e) => setAppForm((p) => ({ ...p, appName: e.target.value.toUpperCase() }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500" /></label><label className="sm:col-span-2"><span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Description (Optional)</span><textarea rows={3} value={appForm.description} onChange={(e) => setAppForm((p) => ({ ...p, description: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500" /></label><label><span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Icon *</span><select value={appForm.linkedIconId} onChange={(e) => setAppForm((p) => ({ ...p, linkedIconId: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500"><option value="">Select Icon</option>{iconOptions.map((icon) => <option key={icon.value} value={icon.value}>{icon.label}</option>)}</select></label><label><span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Global Kill Switch</span><button type="button" onClick={() => setAppForm((p) => ({ ...p, isActive: !p.isActive }))} className={`w-full rounded-xl border px-3 py-2.5 text-sm font-bold ${appForm.isActive ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-rose-300 bg-rose-50 text-rose-700'}`}>{appForm.isActive ? 'ACTIVE' : 'INACTIVE'}</button></label><div className="sm:col-span-2"><span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Visibility Scope</span><ScopePicker scopeType={appForm.scopeType} targetEmirates={appForm.targetEmirates} onScopeChange={(t) => setAppForm((p) => ({ ...p, scopeType: t, targetEmirates: t === 'all_emirates' ? [] : p.targetEmirates }))} onToggleEmirate={(em) => setAppForm((p) => ({ ...p, targetEmirates: p.targetEmirates.includes(em) ? p.targetEmirates.filter((x) => x !== em) : [...p.targetEmirates, em] }))} /></div></div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setAppModalOpen(false)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">Cancel</button><button type="button" onClick={saveApplication} disabled={isSavingApp} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{isSavingApp ? 'Saving...' : (editingApp ? 'Save Changes' : 'Create Application')}</button></div></div></div> : null}
      </div>
    </ProtectedLayout>
  );
};
