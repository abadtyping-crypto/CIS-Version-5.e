import React, { useState, useEffect, useCallback } from 'react';
import { ProtectedLayout } from '../components/layout/ProtectedLayout';
import { MonitorSmartphone, Save, Loader2, AppWindow, X, Check, UploadCloud, Crop } from 'lucide-react';
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import Cropper from 'react-easy-crop';

const MIN_CROP_ZOOM = 1;
const MAX_CROP_ZOOM = 8;
const clampZoom = (value) => Math.min(MAX_CROP_ZOOM, Math.max(MIN_CROP_ZOOM, Number(value) || MIN_CROP_ZOOM));

const getCroppedImg = (imageSrc, pixelCrop, outputWidth = 256, outputHeight = 256) => {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.src = imageSrc;
        image.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = outputWidth;
            canvas.height = outputHeight;
            const ctx = canvas.getContext('2d');
            
            ctx.drawImage(
                image,
                pixelCrop.x,
                pixelCrop.y,
                pixelCrop.width,
                pixelCrop.height,
                0,
                0,
                outputWidth,
                outputHeight
            );

            canvas.toBlob((blob) => {
                resolve(blob);
            }, 'image/png', 1.0);
        };
        image.onerror = (err) => reject(err);
    });
};

export const PlatformSettingsPage = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState('');
    const [formData, setFormData] = useState({
        electronTitle: 'ACIS',
        electronSubtitle: 'Desktop Workspace',
        electronHeaderIcon: '',
        electronFooterIcon: '',
        footerIconOpacity: 0.28,
        privacyPolicy: '',
        termsAndConditions: '',
        systemIconVariation: 'default',
    });
    const [broadcastForm, setBroadcastForm] = useState({
        type: 'update',
        title: '',
        message: '',
        imageUrl: '',
        linkUrl: '',
        speedSec: 22,
        fontColor: '#f8fafc',
    });
    const [broadcastRows, setBroadcastRows] = useState([]);
    const [isBroadcastLoading, setIsBroadcastLoading] = useState(true);
    const [isBroadcastSaving, setIsBroadcastSaving] = useState(false);

    const [isUploadingHeader, setIsUploadingHeader] = useState(false);
    const [isUploadingFooter, setIsUploadingFooter] = useState(false);
    const [isUploadingProfile, setIsUploadingProfile] = useState(false);
    const [isUploadingBroadcastImage, setIsUploadingBroadcastImage] = useState(false);
    const [profilePageIcon, setProfilePageIcon] = useState('');

    // Cropper State
    const [showCropper, setShowCropper] = useState(false);
    const [cropImageSrc, setCropImageSrc] = useState(null);
    const [cropTargetField, setCropTargetField] = useState('');
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const controllerRef = doc(db, 'acis_system_assets', 'electron_controller');
                const profileIconRef = doc(db, 'acis_system_assets', 'icon_page_user');
                const [docSnap, profileIconSnap] = await Promise.all([
                    getDoc(controllerRef),
                    getDoc(profileIconRef),
                ]);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setFormData({
                        electronTitle: data.title || 'ACIS',
                        electronSubtitle: data.subtitle || 'Desktop Workspace',
                        electronHeaderIcon: data.headerIcon || '',
                        electronFooterIcon: data.footerIcon || '',
                        footerIconOpacity: Number(data.footerIconOpacity ?? 0.28),
                        privacyPolicy: data.privacyPolicy || '',
                        termsAndConditions: data.termsAndConditions || '',
                        systemIconVariation: data.systemIconVariation || 'default',
                    });
                }
                if (profileIconSnap.exists()) {
                    setProfilePageIcon(String(profileIconSnap.data()?.iconUrl || '').trim());
                }
            } catch (err) {
                console.error('Failed to load platform settings', err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchSettings();
    }, []);

    useEffect(() => {
        const loadBroadcasts = async () => {
            setIsBroadcastLoading(true);
            try {
                const snap = await getDocs(query(collection(db, 'acis_global_broadcasts'), orderBy('createdAt', 'desc')));
                setBroadcastRows(snap.docs.map((item) => ({ id: item.id, ...item.data() })));
            } catch (err) {
                console.error('Failed to load global broadcasts', err);
            } finally {
                setIsBroadcastLoading(false);
            }
        };
        loadBroadcasts();
    }, []);

    const handleChange = (e) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const onFileSelect = (e, fieldName) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            setCropImageSrc(event.target.result);
            setCropTargetField(fieldName);
            setCrop({ x: 0, y: 0 });
            setZoom(MIN_CROP_ZOOM);
            setShowCropper(true);
        };
        e.target.value = null; // reset input
    };

    const onCropComplete = useCallback((croppedArea, croppedAreaPixelsLatest) => {
        setCroppedAreaPixels(croppedAreaPixelsLatest);
    }, []);

    const handleConfirmCrop = async () => {
        if (!croppedAreaPixels || !cropImageSrc) return;
        
        const fieldName = cropTargetField;
        const isHeader = fieldName === 'electronHeaderIcon';
        const isFooter = fieldName === 'electronFooterIcon';
        const isProfile = fieldName === 'profilePageIcon';
        const isBroadcastImage = fieldName === 'broadcastImage';
        const outputWidth = isFooter ? 720 : 256;
        const outputHeight = isFooter ? 240 : 256;
        setShowCropper(false);
        if (isHeader) setIsUploadingHeader(true);
        else if (isFooter) setIsUploadingFooter(true);
        else if (isProfile) setIsUploadingProfile(true);
        else if (isBroadcastImage) setIsUploadingBroadcastImage(true);

        try {
            // Generate cropped output using target dimensions (footer icon uses wide landscape mode)
            const croppedBlob = await getCroppedImg(cropImageSrc, croppedAreaPixels, outputWidth, outputHeight);
            
            // Cleanup old storage asset if replacing
            const oldUrl = isBroadcastImage
                ? broadcastForm.imageUrl
                : (isProfile ? profilePageIcon : formData[fieldName]);
            if (oldUrl && oldUrl.includes('firebasestorage')) {
                try {
                    const decodedUrl = decodeURIComponent(oldUrl.split('/o/')[1].split('?alt=media')[0]);
                    const oldRef = ref(storage, decodedUrl);
                    await deleteObject(oldRef);
                } catch (e) {
                    console.log('Skipping cleanup of old file');
                }
            }

            // Upload the new perfectly-cropped snippet
            const fileId = isBroadcastImage
                ? `acis_global_broadcast_images/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`
                : isProfile
                    ? `acis_system_assets/icon_page_user_${Date.now()}.png`
                : `master_app_assets/${fieldName}_${Date.now()}.png`;
            const storageRef = ref(storage, fileId);
            await uploadBytes(storageRef, croppedBlob);
            const downloadURL = await getDownloadURL(storageRef);

            if (isBroadcastImage) {
                setBroadcastForm((prev) => ({ ...prev, imageUrl: downloadURL }));
                setSaveStatus('✅ Broadcast image cropped and uploaded.');
            } else if (isProfile) {
                await setDoc(doc(db, 'acis_system_assets', 'icon_page_user'), {
                    iconLabel: 'Profile',
                    iconUrl: downloadURL,
                    lastUpdated: serverTimestamp(),
                }, { merge: true });
                setProfilePageIcon(downloadURL);
                setSaveStatus('✅ Profile branding icon cropped and uploaded.');
            } else {
                setFormData(prev => ({ ...prev, [fieldName]: downloadURL }));
                setSaveStatus(`✅ ${isHeader ? 'Header' : 'Footer'} Icon cropped and successfully uploaded!`);
            }
        } catch (err) {
            console.error('Manual crop upload failed:', err);
            setSaveStatus('❌ Failed to upload cropped image.');
        } finally {
            if (isHeader) setIsUploadingHeader(false);
            else if (isFooter) setIsUploadingFooter(false);
            else if (isProfile) setIsUploadingProfile(false);
            else if (isBroadcastImage) setIsUploadingBroadcastImage(false);
            setCropImageSrc(null);
            setCropTargetField('');
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        setSaveStatus('');
        try {
            const docRef = doc(db, 'acis_system_assets', 'electron_controller');
            await setDoc(docRef, {
                title: formData.electronTitle,
                subtitle: formData.electronSubtitle,
                headerIcon: formData.electronHeaderIcon,
                footerIcon: formData.electronFooterIcon,
                footerIconOpacity: Math.min(1, Math.max(0.05, Number(formData.footerIconOpacity) || 0.28)),
                privacyPolicy: formData.privacyPolicy,
                termsAndConditions: formData.termsAndConditions,
                systemIconVariation: formData.systemIconVariation || 'default',
                updatedAt: new Date().toISOString()
            }, { merge: true });
            
            setSaveStatus('✅ Global settings successfully deployed to all tenants!');
            setTimeout(() => setSaveStatus(''), 5000);
        } catch (err) {
            console.error('Failed to save settings', err);
            setSaveStatus('❌ Failed to save settings.');
        } finally {
            setIsSaving(false);
        }
    };

    const refreshBroadcasts = async () => {
        const snap = await getDocs(query(collection(db, 'acis_global_broadcasts'), orderBy('createdAt', 'desc')));
        setBroadcastRows(snap.docs.map((item) => ({ id: item.id, ...item.data() })));
    };

    const handleCreateBroadcast = async () => {
        const title = String(broadcastForm.title || '').trim();
        const message = String(broadcastForm.message || '').trim();
        const linkUrl = String(broadcastForm.linkUrl || '').trim();
        const fontColor = String(broadcastForm.fontColor || '').trim() || '#f8fafc';
        const speedSec = Math.min(120, Math.max(8, Number(broadcastForm.speedSec) || 22));
        if (!title || !message) {
            setSaveStatus('❌ Broadcast title and message are required.');
            return;
        }
        setIsBroadcastSaving(true);
        try {
            await addDoc(collection(db, 'acis_global_broadcasts'), {
                type: broadcastForm.type || 'update',
                title,
                message,
                imageUrl: String(broadcastForm.imageUrl || ''),
                linkUrl,
                speedSec,
                fontColor,
                isActive: true,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
            setBroadcastForm({
                type: 'update',
                title: '',
                message: '',
                imageUrl: '',
                linkUrl: '',
                speedSec: 22,
                fontColor: '#f8fafc',
            });
            setSaveStatus('✅ Global flying notification posted.');
            await refreshBroadcasts();
        } catch (err) {
            console.error('Failed to create global broadcast', err);
            setSaveStatus('❌ Failed to post broadcast.');
        } finally {
            setIsBroadcastSaving(false);
        }
    };

    const handleToggleBroadcast = async (row) => {
        try {
            await updateDoc(doc(db, 'acis_global_broadcasts', row.id), {
                isActive: row.isActive === false,
                updatedAt: serverTimestamp(),
            });
            await refreshBroadcasts();
        } catch (err) {
            console.error('Failed to toggle broadcast', err);
            setSaveStatus('❌ Failed to update broadcast status.');
        }
    };

    const handleDeleteBroadcast = async (row) => {
        const allow = window.confirm(`Delete broadcast "${row.title || row.id}"?`);
        if (!allow) return;
        try {
            if (row?.imageUrl && String(row.imageUrl).includes('firebasestorage')) {
                try {
                    const decodedUrl = decodeURIComponent(String(row.imageUrl).split('/o/')[1].split('?alt=media')[0]);
                    const imageRef = ref(storage, decodedUrl);
                    await deleteObject(imageRef);
                } catch (cleanupErr) {
                    console.warn('Broadcast image cleanup skipped:', cleanupErr);
                }
            }
            await deleteDoc(doc(db, 'acis_global_broadcasts', row.id));
            await refreshBroadcasts();
        } catch (err) {
            console.error('Failed to delete broadcast', err);
            setSaveStatus('❌ Failed to delete broadcast.');
        }
    };

    const cropAspect = cropTargetField === 'electronFooterIcon' ? 3 : 1;
    const activeBroadcastRows = broadcastRows.filter((row) => row?.isActive !== false);

    return (
        <ProtectedLayout>
            <style>{`
                @keyframes acisTickerMove {
                    0% { transform: translateX(0%); }
                    100% { transform: translateX(-50%); }
                }
            `}</style>
            {showCropper && (
                <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-sm flex flex-col items-center justify-center p-4">
                    <div className="w-full max-w-2xl bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[80vh]">
                        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                            <h3 className="font-black text-slate-800 flex items-center gap-2">
                                <Crop size={18} className="text-blue-600" />
                                Manual Crop Studio
                            </h3>
                            <button onClick={() => setShowCropper(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="relative flex-1 bg-black/5" style={{ minHeight: '300px' }}>
                            <Cropper
                                image={cropImageSrc}
                                crop={crop}
                                zoom={zoom}
                                aspect={cropAspect}
                                zoomSpeed={0.08}
                                showGrid={false}
                                restrictPosition={false}
                                onCropChange={setCrop}
                                onZoomChange={(value) => setZoom(clampZoom(value))}
                                onCropComplete={onCropComplete}
                            />
                        </div>
                        
                        <div className="p-6 bg-slate-50 border-t border-slate-200 space-y-4">
                            <p className="text-xs font-semibold text-slate-500">
                                Drag image to move crop area. Footer icon uses wide landscape crop (3:1). Mouse wheel and slider provide fine zoom control.
                            </p>
                            <div className="flex items-center gap-4">
                                <label className="text-xs font-bold uppercase tracking-widest text-slate-500 w-24">Zoom Adjust</label>
                                <button
                                    type="button"
                                    onClick={() => setZoom((prev) => clampZoom(prev - 0.05))}
                                    className="h-8 w-8 shrink-0 rounded-lg border border-slate-300 bg-white text-sm font-black text-slate-700 hover:border-blue-400 hover:text-blue-700"
                                    aria-label="Zoom out"
                                >
                                    -
                                </button>
                                <input
                                    type="range"
                                    value={zoom}
                                    min={MIN_CROP_ZOOM}
                                    max={MAX_CROP_ZOOM}
                                    step={0.005}
                                    aria-labelledby="Zoom"
                                    onChange={(e) => setZoom(clampZoom(e.target.value))}
                                    className="flex-1 accent-blue-600"
                                />
                                <button
                                    type="button"
                                    onClick={() => setZoom((prev) => clampZoom(prev + 0.05))}
                                    className="h-8 w-8 shrink-0 rounded-lg border border-slate-300 bg-white text-sm font-black text-slate-700 hover:border-blue-400 hover:text-blue-700"
                                    aria-label="Zoom in"
                                >
                                    +
                                </button>
                                <span className="w-14 text-right text-xs font-black text-slate-600">
                                    {(Number(zoom || 1) * 100).toFixed(0)}%
                                </span>
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    onClick={() => setShowCropper(false)}
                                    className="px-6 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmCrop}
                                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
                                >
                                    <Check size={18} /> Approve Crop & Upload
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <header>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">Platform Settings</h1>
                    <p className="text-sm font-bold text-slate-400 mt-1 flex items-center gap-2 uppercase tracking-widest">
                        <AppWindow size={16} /> Global Desktop Controller
                    </p>
                </header>

                <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8">
                    <form onSubmit={handleSave} className="space-y-8">
                        <div className="space-y-4">
                            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
                                <MonitorSmartphone className="text-blue-600" />
                                Electron Container Configurations
                            </h3>
                            <p className="text-sm font-medium text-slate-500">
                                This overrides the Title Bar text and branding globally for every single tenant operating via the ACIS Electron executable framework. Changes apply immediately upon tenant restart/reload.
                            </p>

                            {isLoading ? (
                                <div className="py-8 flex justify-center">
                                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                    <div>
                                        <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Master Electron Title</label>
                                        <input 
                                            required 
                                            name="electronTitle" 
                                            value={formData.electronTitle} 
                                            onChange={handleChange} 
                                            className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-800 shadow-sm focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" 
                                            placeholder="e.g. ACIS" 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Master Subtitle</label>
                                        <input 
                                            name="electronSubtitle" 
                                            value={formData.electronSubtitle} 
                                            onChange={handleChange} 
                                            className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-800 shadow-sm focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" 
                                            placeholder="Optional subtitle" 
                                        />
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Global System Icon Variation (Seasonal Switch)</label>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                            {[
                                                { id: 'default', label: 'Default', color: 'bg-slate-100 text-slate-700' },
                                                { id: 'winter', label: 'Winter', color: 'bg-blue-100 text-blue-700' },
                                                { id: 'summer', label: 'Summer', color: 'bg-amber-100 text-amber-700' },
                                                { id: 'ramadan', label: 'Ramadan', color: 'bg-indigo-100 text-indigo-700' },
                                                { id: 'eid', label: 'Eid', color: 'bg-emerald-100 text-emerald-700' },
                                                { id: 'anniversary', label: 'Anniversary', color: 'bg-rose-100 text-rose-700' },
                                            ].map((opt) => (
                                                <button
                                                    key={opt.id}
                                                    type="button"
                                                    onClick={() => setFormData(prev => ({ ...prev, systemIconVariation: opt.id }))}
                                                    className={`px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                                                        formData.systemIconVariation === opt.id
                                                            ? `${opt.color} border-current ring-2 ring-offset-2 ring-blue-500/20 shadow-sm opacity-100 scale-105`
                                                            : 'bg-white border-slate-200 text-slate-400 opacity-60 hover:opacity-100'
                                                    }`}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                        <p className="mt-2 text-[10px] font-bold text-slate-400 italic">
                                            * When a variation is active, the app appends the suffix (e.g., `_winter`) to icon IDs. Fallback to default if not found.
                                        </p>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Global Header Bar Icon</label>
                                        <div className="flex gap-4 items-center">
                                            {formData.electronHeaderIcon ? (
                                                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-white p-1.5 shadow-sm overflow-hidden bg-checkered">
                                                    <img src={formData.electronHeaderIcon} alt="Preview" className="h-full w-full object-cover rounded-lg" />
                                                </div>
                                            ) : (
                                                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 p-1 shadow-sm text-slate-400">
                                                    No Image
                                                </div>
                                            )}
                                            <div className="flex-1 space-y-1 text-sm">
                                                <div className="relative inline-block">
                                                    <input 
                                                        type="file" 
                                                        accept="image/*" 
                                                        onChange={(e) => onFileSelect(e, 'electronHeaderIcon')}
                                                        disabled={isUploadingHeader}
                                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" 
                                                    />
                                                    <button type="button" disabled={isUploadingHeader} className="px-5 py-2.5 bg-slate-900 border border-slate-700 hover:bg-slate-800 text-white font-bold rounded-xl transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg">
                                                        {isUploadingHeader ? <Loader2 className="w-4 h-4 animate-spin" /> : <><UploadCloud size={16} /> Visual Manual Crop & Upload</>}
                                                    </button>
                                                </div>
                                                <p className="text-xs text-slate-500 font-medium">Select an image to open the visual cropping studio. You fully control the exact square slice!</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Profile Page Branding Icon</label>
                                        <div className="flex gap-4 items-center">
                                            {profilePageIcon ? (
                                                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-white p-1.5 shadow-sm overflow-hidden bg-checkered">
                                                    <img src={profilePageIcon} alt="Profile page icon preview" className="h-full w-full object-cover rounded-lg" />
                                                </div>
                                            ) : (
                                                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 p-1 shadow-sm text-slate-400">
                                                    No Image
                                                </div>
                                            )}
                                            <div className="flex-1 space-y-1 text-sm">
                                                <div className="relative inline-block">
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={(e) => onFileSelect(e, 'profilePageIcon')}
                                                        disabled={isUploadingProfile}
                                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                                                    />
                                                    <button type="button" disabled={isUploadingProfile} className="px-5 py-2.5 bg-slate-900 border border-slate-700 hover:bg-slate-800 text-white font-bold rounded-xl transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg">
                                                        {isUploadingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <><UploadCloud size={16} /> Visual Manual Crop & Upload</>}
                                                    </button>
                                                </div>
                                                <p className="text-xs text-slate-500 font-medium">Uploads the branded asset used by the tenant Profile page header for both `profile` and `user` keys.</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Global Footer Icon</label>
                                        <div className="space-y-3">
                                            <div className="rounded-2xl border border-slate-200 bg-slate-900 p-3">
                                                <p className="mb-2 text-[11px] font-black uppercase tracking-widest text-slate-300">Live Footer Watermark Preview</p>
                                                <div className="relative overflow-hidden rounded-xl border border-slate-700 bg-slate-800 px-3 py-2">
                                                    <div className="flex items-center justify-between">
                                                        <div className="relative h-12 w-[220px] overflow-hidden rounded-lg">
                                                            {formData.electronFooterIcon ? (
                                                                <img
                                                                    src={formData.electronFooterIcon}
                                                                    alt="Footer watermark preview"
                                                                    className="h-full w-full object-cover"
                                                                    style={{ opacity: Math.min(1, Math.max(0.05, Number(formData.footerIconOpacity) || 0.28)) }}
                                                                />
                                                            ) : null}
                                                        </div>
                                                        <div className="text-[10px] font-bold text-slate-400">Privacy Policy | Terms & Conditions</div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex gap-4 items-center">
                                            {formData.electronFooterIcon ? (
                                                <div className="flex h-16 w-48 shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-white p-1.5 shadow-sm overflow-hidden bg-checkered">
                                                    <img src={formData.electronFooterIcon} alt="Preview" className="h-full w-full object-cover rounded-lg" />
                                                </div>
                                            ) : (
                                                <div className="flex h-16 w-48 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 p-1 shadow-sm text-slate-400">
                                                    No Image
                                                </div>
                                            )}
                                            <div className="flex-1 space-y-1 text-sm">
                                                <div className="relative inline-block">
                                                    <input 
                                                        type="file" 
                                                        accept="image/*" 
                                                        onChange={(e) => onFileSelect(e, 'electronFooterIcon')}
                                                        disabled={isUploadingFooter}
                                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" 
                                                    />
                                                    <button type="button" disabled={isUploadingFooter} className="px-5 py-2.5 bg-slate-900 border border-slate-700 hover:bg-slate-800 text-white font-bold rounded-xl transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg">
                                                        {isUploadingFooter ? <Loader2 className="w-4 h-4 animate-spin" /> : <><UploadCloud size={16} /> Visual Manual Crop & Upload</>}
                                                    </button>
                                                </div>
                                                <p className="text-xs text-slate-500 font-medium">Landscape crop mode (720x240) is used for footer watermark/logo.</p>
                                                <div className="pt-1">
                                                    <label className="mb-1 block text-[11px] font-black uppercase tracking-widest text-slate-500">Footer Watermark Opacity</label>
                                                    <div className="flex items-center gap-3">
                                                        <input
                                                            type="range"
                                                            min={0.05}
                                                            max={1}
                                                            step={0.01}
                                                            value={Math.min(1, Math.max(0.05, Number(formData.footerIconOpacity) || 0.28))}
                                                            onChange={(e) => setFormData((prev) => ({ ...prev, footerIconOpacity: Number(e.target.value) }))}
                                                            className="flex-1 accent-blue-600"
                                                        />
                                                        <span className="w-14 text-right text-xs font-black text-slate-600">
                                                            {Math.round((Math.min(1, Math.max(0.05, Number(formData.footerIconOpacity) || 0.28))) * 100)}%
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        </div>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Privacy Policy (Global)</label>
                                        <textarea
                                            name="privacyPolicy"
                                            value={formData.privacyPolicy}
                                            onChange={handleChange}
                                            rows={4}
                                            className="w-full resize-y rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-800 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20"
                                            placeholder="Write privacy policy content shown in tenant footer modal."
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Terms & Conditions (Global)</label>
                                        <textarea
                                            name="termsAndConditions"
                                            value={formData.termsAndConditions}
                                            onChange={handleChange}
                                            rows={4}
                                            className="w-full resize-y rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-800 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20"
                                            placeholder="Write terms & conditions content shown in tenant footer modal."
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="pt-6 border-t border-slate-100 flex items-center justify-between gap-4">
                            <span className="text-sm font-bold text-emerald-600">{saveStatus}</span>
                            <button
                                type="submit"
                                disabled={isSaving || isLoading}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3.5 rounded-xl font-black tracking-wide shadow-xl shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                                DEPLOY GLOBAL SETTINGS
                            </button>
                        </div>
                    </form>
                </div>

                <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8">
                    <div className="mb-5">
                        <h3 className="text-lg font-black text-slate-800">Global Flying Notifications</h3>
                        <p className="text-sm font-semibold text-slate-500">Post comments, events, issue alerts, and new updates for all tenants.</p>
                    </div>
                    <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Now Running In Tenant Footer</p>
                        {activeBroadcastRows.length === 0 ? (
                            <p className="mt-2 text-sm font-semibold text-slate-500">No active broadcast is running now.</p>
                        ) : (
                            <div className="mt-2 space-y-2">
                                {activeBroadcastRows.slice(0, 6).map((row, idx) => (
                                    <div key={row.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-700">#{idx + 1}</span>
                                        <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-black uppercase text-blue-700">{row.type || 'general_notice'}</span>
                                        <span className="truncate text-xs font-bold text-slate-700">{row.title || row.id}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <label className="text-xs font-black uppercase tracking-widest text-slate-500">
                            Type
                            <select
                                value={broadcastForm.type}
                                onChange={(e) => setBroadcastForm((prev) => ({ ...prev, type: e.target.value }))}
                                className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20"
                            >
                                <option value="security_issue">Security Issues</option>
                                <option value="system_maintenance">System Maintenance</option>
                                <option value="common_wishes">Common Wishes (National Day / Christmas)</option>
                                <option value="new_tools_launching">New Tools Launching</option>
                                <option value="service_outage">Service Outage</option>
                                <option value="bug_fix">Bug Fix</option>
                                <option value="policy_update">Policy Update</option>
                                <option value="general_notice">General Notice</option>
                            </select>
                        </label>
                        <label className="text-xs font-black uppercase tracking-widest text-slate-500">
                            Title
                            <input
                                value={broadcastForm.title}
                                onChange={(e) => setBroadcastForm((prev) => ({ ...prev, title: e.target.value }))}
                                className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20"
                                placeholder="Short headline"
                            />
                        </label>
                    </div>
                    <label className="mt-4 block text-xs font-black uppercase tracking-widest text-slate-500">
                        Message
                        <textarea
                            value={broadcastForm.message}
                            onChange={(e) => setBroadcastForm((prev) => ({ ...prev, message: e.target.value }))}
                            rows={3}
                            className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20"
                            placeholder="Write the update body shown as flying notification."
                        />
                    </label>
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <label className="text-xs font-black uppercase tracking-widest text-slate-500">
                            Link URL (Optional)
                            <input
                                value={broadcastForm.linkUrl}
                                onChange={(e) => setBroadcastForm((prev) => ({ ...prev, linkUrl: e.target.value }))}
                                className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20"
                                placeholder="https://..."
                            />
                        </label>
                        <label className="text-xs font-black uppercase tracking-widest text-slate-500">
                            Marquee Speed (Sec)
                            <input
                                type="number"
                                min={8}
                                max={120}
                                value={broadcastForm.speedSec}
                                onChange={(e) => setBroadcastForm((prev) => ({ ...prev, speedSec: e.target.value }))}
                                className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20"
                                placeholder="22"
                            />
                        </label>
                        <label className="text-xs font-black uppercase tracking-widest text-slate-500">
                            Font Color
                            <div className="mt-2 flex items-center gap-2">
                                <input
                                    type="color"
                                    value={broadcastForm.fontColor || '#f8fafc'}
                                    onChange={(e) => setBroadcastForm((prev) => ({ ...prev, fontColor: e.target.value }))}
                                    className="h-11 w-14 rounded-lg border border-slate-200 bg-white p-1"
                                />
                                <input
                                    value={broadcastForm.fontColor}
                                    onChange={(e) => setBroadcastForm((prev) => ({ ...prev, fontColor: e.target.value }))}
                                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20"
                                    placeholder="#f8fafc"
                                />
                            </div>
                        </label>
                    </div>
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-900 p-3">
                        <p className="mb-2 text-[11px] font-black uppercase tracking-widest text-slate-300">Live Footer Preview</p>
                        <div className="flex h-11 items-center gap-2 overflow-hidden rounded-lg bg-slate-800 px-2">
                            <span className="rounded-md bg-slate-700 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-100">
                                {broadcastForm.type || 'general_notice'}
                            </span>
                            <div className="relative min-w-0 flex-1 overflow-hidden">
                                <div
                                    className="inline-flex min-w-max items-center whitespace-nowrap text-sm font-bold"
                                    style={{
                                        color: broadcastForm.fontColor || '#f8fafc',
                                        animation: `acisTickerMove ${Math.max(8, Number(broadcastForm.speedSec) || 22)}s linear infinite`,
                                    }}
                                >
                                    <span className="pr-10">{`${broadcastForm.title || 'Title'} - ${broadcastForm.message || 'Message preview...'}`}</span>
                                    <span className="pr-10">{`${broadcastForm.title || 'Title'} - ${broadcastForm.message || 'Message preview...'}`}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs font-black uppercase tracking-widest text-slate-500">Optional Broadcast Image</p>
                        <div className="mt-2 flex flex-wrap items-center gap-3">
                            <div className="h-14 w-14 overflow-hidden rounded-xl border border-slate-200 bg-white">
                                {broadcastForm.imageUrl ? (
                                    <img src={broadcastForm.imageUrl} alt="Broadcast preview" className="h-full w-full object-cover" />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-slate-400">No Image</div>
                                )}
                            </div>
                            <div className="relative inline-block">
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => onFileSelect(e, 'broadcastImage')}
                                    disabled={isUploadingBroadcastImage}
                                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                                />
                                <button
                                    type="button"
                                    disabled={isUploadingBroadcastImage}
                                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:border-blue-400 hover:text-blue-700 disabled:opacity-50"
                                >
                                    {isUploadingBroadcastImage ? 'Uploading...' : 'Upload + Crop Image'}
                                </button>
                            </div>
                            {broadcastForm.imageUrl ? (
                                <button
                                    type="button"
                                    onClick={() => setBroadcastForm((prev) => ({ ...prev, imageUrl: '' }))}
                                    className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700"
                                >
                                    Remove
                                </button>
                            ) : null}
                        </div>
                    </div>
                    <div className="mt-4 flex items-center gap-3">
                        <button
                            type="button"
                            onClick={handleCreateBroadcast}
                            disabled={isBroadcastSaving}
                            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-black text-white transition hover:opacity-90 disabled:opacity-50"
                        >
                            {isBroadcastSaving ? 'Posting...' : 'Post Global Notification'}
                        </button>
                    </div>

                    <div className="mt-6">
                        <p className="mb-3 text-xs font-black uppercase tracking-widest text-slate-500">Posted Notifications</p>
                        {isBroadcastLoading ? (
                            <div className="py-4"><Loader2 className="h-5 w-5 animate-spin text-blue-600" /></div>
                        ) : broadcastRows.length === 0 ? (
                            <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-semibold text-slate-500">No global notifications posted yet.</p>
                        ) : (
                            <div className="space-y-2">
                                {broadcastRows.slice(0, 20).map((row) => (
                                    <div key={row.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-blue-700">{row.type || 'update'}</span>
                                        <span className="min-w-[180px] flex-1 text-sm font-bold text-slate-800">{row.title || row.id}</span>
                                        <button type="button" onClick={() => handleToggleBroadcast(row)} className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${row.isActive === false ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-amber-300 bg-amber-50 text-amber-700'}`}>
                                            {row.isActive === false ? 'Enable' : 'Disable'}
                                        </button>
                                        <button type="button" onClick={() => handleDeleteBroadcast(row)} className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700">
                                            Delete
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </ProtectedLayout>
    );
};
