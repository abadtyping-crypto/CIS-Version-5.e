import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageShell from '../components/layout/PageShell';
import { useAuth } from '../context/useAuth';
import { useTenant } from '../context/useTenant';
import {
  fetchTenantUsersMap,
  upsertTenantUserMap,
} from '../lib/backendStore';
import { replaceTenantAvatar } from '../lib/avatarStorage';
import { LayoutGrid, Maximize2, Minimize2, Monitor, Tablet } from 'lucide-react';
import ImageStudio from '../components/common/ImageStudio';
import { getCroppedImg } from '../lib/imageStudioUtils';
import useIsDesktopLayout from '../hooks/useIsDesktopLayout';
import useElectronLayoutMode, {
  LAYOUT_COMPACT,
  LAYOUT_MINI,
  LAYOUT_STANDARD,
  LAYOUT_WIDE,
} from '../hooks/useElectronLayoutMode';
import { useTheme } from '../context/useTheme';

const inputClass =
  'mt-1 h-14 w-full rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)] px-4 text-sm text-[var(--c-text)] outline-none transition focus:border-[var(--c-accent)] focus:ring-2 focus:ring-[var(--c-ring)]';
const textareaClass =
  'mt-1 min-h-[7rem] w-full rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)] px-4 py-3 text-sm text-[var(--c-text)] outline-none transition focus:border-[var(--c-accent)] focus:ring-2 focus:ring-[var(--c-ring)]';
const statusVisibleClass =
  'rounded-full bg-[var(--c-success-soft)] px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-[var(--c-success)] uppercase';
const statusHiddenClass =
  'rounded-full bg-[var(--c-panel)] px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-[var(--c-muted)] uppercase';
const statusEnabledButtonClass =
  'bg-[var(--c-success-soft)] text-[var(--c-success)]';
const statusDisabledButtonClass =
  'bg-[var(--c-panel)] text-[var(--c-muted)]';
const normalizeRoleLabel = (role) => {
  const normalized = String(role || '').trim().toLowerCase();
  if (normalized === 'superadmin' || normalized === 'super admin') return 'Owner';
  return role || 'Staff';
};
const AVATAR_OUTPUT_SIZE = 512;
const AVATAR_MAX_BYTES = 180 * 1024;
const avatarFilterMap = {
  natural: { label: 'Natural', css: 'none', canvas: 'none' },
  warm: { label: 'Warm', css: 'saturate(1.1) contrast(1.04)', canvas: 'saturate(110%) contrast(104%)' },
  cool: { label: 'Cool', css: 'saturate(0.95) contrast(1.05)', canvas: 'saturate(95%) contrast(105%) hue-rotate(6deg)' },
  mono: { label: 'Mono', css: 'grayscale(1) contrast(1.08)', canvas: 'grayscale(100%) contrast(108%)' },
  vivid: { label: 'Vivid', css: 'saturate(1.25) contrast(1.1)', canvas: 'saturate(125%) contrast(110%)' },
};

const desktopWallpaperPreviewMap = {
  aurora:
    'radial-gradient(130% 110% at -12% -10%, rgba(245, 158, 11, 0.52) 0%, transparent 56%), radial-gradient(130% 110% at 110% -4%, rgba(249, 115, 22, 0.42) 0%, transparent 58%), radial-gradient(140% 120% at 50% 120%, rgba(230, 176, 84, 0.28) 0%, transparent 66%), #3B1E0F',
  midnight:
    'radial-gradient(120% 120% at 10% 8%, rgba(124, 58, 237, 0.42) 0%, transparent 56%), radial-gradient(120% 120% at 90% 14%, rgba(192, 38, 211, 0.34) 0%, transparent 60%), radial-gradient(150% 120% at 50% 122%, rgba(59, 10, 69, 0.68) 0%, transparent 68%), #1E1021',
  ocean:
    'radial-gradient(130% 110% at -6% -10%, rgba(14, 165, 233, 0.48) 0%, transparent 58%), radial-gradient(120% 110% at 106% -8%, rgba(34, 211, 238, 0.4) 0%, transparent 58%), radial-gradient(140% 120% at 50% 120%, rgba(11, 58, 94, 0.62) 0%, transparent 68%), #071828',
  sunrise:
    'radial-gradient(130% 110% at -8% -10%, rgba(251, 191, 36, 0.56) 0%, transparent 56%), radial-gradient(130% 110% at 110% -8%, rgba(245, 158, 11, 0.46) 0%, transparent 58%), radial-gradient(150% 120% at 50% 120%, rgba(180, 120, 20, 0.38) 0%, transparent 66%), #2A1A04',
  ember:
    'radial-gradient(130% 110% at -8% -12%, rgba(244, 63, 94, 0.56) 0%, transparent 56%), radial-gradient(120% 110% at 108% -8%, rgba(220, 38, 38, 0.46) 0%, transparent 58%), radial-gradient(150% 120% at 50% 120%, rgba(109, 16, 40, 0.68) 0%, transparent 66%), #210910',
};

const desktopLayoutOptions = [
  { id: null, label: 'Auto', description: 'Responsive to the current Electron window width.' },
  { id: LAYOUT_WIDE, label: 'Wide', description: 'Full desktop layout with room for larger screens.' },
  { id: LAYOUT_STANDARD, label: 'Standard', description: 'Balanced desktop layout for everyday use.' },
  { id: LAYOUT_COMPACT, label: 'Compact', description: 'Tighter layout for reduced window width.' },
  { id: LAYOUT_MINI, label: 'Mini', description: 'Small-window mode for narrow screens.' },
];

const toWorkspaceDraft = (appearance, overrideMode) => ({
  glassEnabled: appearance?.glassEnabled !== false,
  fontFamily: appearance?.fontFamily || 'jakarta',
  fontScale: appearance?.fontScale || 'standard',
  wallpaper: appearance?.wallpaper || 'aurora',
  windowMode: overrideMode ?? null,
});

const toPublicProfile = (item) => ({
  uid: item.uid,
  displayName: item.displayName || 'User',
  role: item.role || 'Staff',
  publicProfile: item.publicProfile === true,
  headline: item.headline || '',
  bio: item.bio || '',
  selfIntro: item.selfIntro || '',
  socials: {
    linkedin: item.socials?.linkedin || '',
    instagram: item.socials?.instagram || '',
    website: item.socials?.website || '',
  },
  education: item.education || '',
  workExperience: item.workExperience || '',
  emergencyContact: {
    name: item.emergencyContact?.name || '',
    relation: item.emergencyContact?.relation || '',
    mobile: item.emergencyContact?.mobile || '',
  },
  medicalInfo: {
    bloodGroup: item.medicalInfo?.bloodGroup || '',
    notes: item.medicalInfo?.notes || '',
  },
  avatar: item.photoURL || item.avatar || '/avatar.png',
});

const ProfilePage = () => {
  const [searchParams] = useSearchParams();
  const { tenantId } = useTenant();
  const { user, patchSessionUser } = useAuth();
  const isDesktopLayout = useIsDesktopLayout();
  const { setMode: setWindowMode, overrideMode, autoMode } = useElectronLayoutMode();
  const isElectronDesktop = typeof window !== 'undefined' && Boolean(window.electron?.windowControls);
  const [profiles, setProfiles] = useState([]);
  const [saveMessage, setSaveMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [originalForm, setOriginalForm] = useState(null);
  const [avatarRawUrl, setAvatarRawUrl] = useState('');
  const [avatarSourceUrl, setAvatarSourceUrl] = useState(user?.photoURL || '/avatar.png');
  const [avatarZoom, setAvatarZoom] = useState(1);
  const [avatarRotation, setAvatarRotation] = useState(0);
  const [avatarFilter, setAvatarFilter] = useState('natural');
  const [avatarDirty, setAvatarDirty] = useState(false);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const { appearance, updateAppearance, DESKTOP_WALLPAPERS, DESKTOP_FONT_FAMILIES, DESKTOP_FONT_SCALES } = useTheme();
  const [workspaceDraft, setWorkspaceDraft] = useState(() => toWorkspaceDraft(appearance, overrideMode));
  const [workspaceStatus, setWorkspaceStatus] = useState('');

  const currentWorkspace = useMemo(
    () => toWorkspaceDraft(appearance, overrideMode),
    [appearance, overrideMode],
  );

  const isWorkspaceDirty = useMemo(
    () => (
      workspaceDraft.glassEnabled !== currentWorkspace.glassEnabled
      || workspaceDraft.fontFamily !== currentWorkspace.fontFamily
      || workspaceDraft.fontScale !== currentWorkspace.fontScale
      || workspaceDraft.wallpaper !== currentWorkspace.wallpaper
      || (workspaceDraft.windowMode ?? null) !== (currentWorkspace.windowMode ?? null)
    ),
    [workspaceDraft, currentWorkspace],
  );

  useEffect(() => {
    setWorkspaceDraft(currentWorkspace);
  }, [currentWorkspace]);

  const saveWorkspaceDraft = useCallback(() => {
    updateAppearance({
      glassEnabled: workspaceDraft.glassEnabled,
      fontFamily: workspaceDraft.fontFamily,
      fontScale: workspaceDraft.fontScale,
      wallpaper: workspaceDraft.wallpaper,
    });
    if (isElectronDesktop) {
      setWindowMode(workspaceDraft.windowMode);
    }
    setWorkspaceStatus('Workspace settings saved.');
  }, [isElectronDesktop, setWindowMode, updateAppearance, workspaceDraft]);

  const resetWorkspaceDraft = useCallback(() => {
    setWorkspaceDraft(currentWorkspace);
    setWorkspaceStatus('Workspace changes canceled.');
  }, [currentWorkspace]);

  const activeWindowModeLabel = useMemo(() => {
    if (overrideMode) {
      return desktopLayoutOptions.find((item) => item.id === overrideMode)?.label || 'Standard';
    }
    return desktopLayoutOptions.find((item) => item.id === autoMode)?.label || 'Auto';
  }, [autoMode, overrideMode]);

  const activeWindowModeIcon = useMemo(() => {
    const mode = overrideMode || autoMode;
    if (overrideMode == null) return Monitor;
    if (mode === LAYOUT_WIDE) return Maximize2;
    if (mode === LAYOUT_STANDARD) return LayoutGrid;
    if (mode === LAYOUT_COMPACT) return Tablet;
    if (mode === LAYOUT_MINI) return Minimize2;
    return LayoutGrid;
  }, [autoMode, overrideMode]);

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
    setAvatarDirty(true);
  }, []);

  const setRotationWrapper = (val) => {
    setAvatarRotation(val);
    setAvatarDirty(true);
  };
  const [form, setForm] = useState({
    displayName: user?.displayName || 'User',
    headline: '',
    bio: '',
    selfIntro: '',
    linkedin: '',
    instagram: '',
    website: '',
    education: '',
    workExperience: '',
    emergencyContactName: '',
    emergencyContactRelation: '',
    emergencyContactMobile: '',
    bloodGroup: '',
    medicalNotes: '',
    publicProfile: true,
  });

  useEffect(() => {
    if (!avatarRawUrl || !avatarRawUrl.startsWith('blob:')) return () => { };
    return () => {
      URL.revokeObjectURL(avatarRawUrl);
    };
  }, [avatarRawUrl]);

  useEffect(() => {
    if (!user?.uid) return;
    let active = true;
    fetchTenantUsersMap(tenantId).then(
      (usersResult) => {
        if (!active) return;

        const nextProfiles = usersResult.ok
          ? usersResult.rows.map((item) => toPublicProfile(item))
          : [];
        setProfiles(nextProfiles);

        const mine = nextProfiles.find((item) => item.uid === user.uid);

        if (mine) {
          const profileAvatar = mine.avatar || user.photoURL || '/avatar.png';
          setAvatarSourceUrl(profileAvatar);
          setAvatarRawUrl('');
          setAvatarZoom(1);
          setAvatarRotation(0);
          setAvatarFilter('natural');
          setAvatarDirty(false);
          setCroppedAreaPixels(null);
          const initialForm = {
            displayName: mine.displayName || user.displayName,
            headline: mine.headline || '',
            bio: mine.bio || '',
            selfIntro: mine.selfIntro || '',
            linkedin: mine.socials?.linkedin || '',
            instagram: mine.socials?.instagram || '',
            website: mine.socials?.website || '',
            education: mine.education || '',
            workExperience: mine.workExperience || '',
            emergencyContactName: mine.emergencyContact?.name || '',
            emergencyContactRelation: mine.emergencyContact?.relation || '',
            emergencyContactMobile: mine.emergencyContact?.mobile || '',
            bloodGroup: mine.medicalInfo?.bloodGroup || '',
            medicalNotes: mine.medicalNotes || mine.medicalInfo?.notes || '',
            publicProfile: mine.publicProfile === true,
          };
          setForm(initialForm);
          setOriginalForm(initialForm);
          if (mine.displayName && mine.displayName !== user.displayName) {
            patchSessionUser({ displayName: mine.displayName });
          }
          if (profileAvatar && profileAvatar !== user.photoURL) {
            patchSessionUser({ photoURL: profileAvatar });
          }
          return;
        }

        setAvatarSourceUrl(user.photoURL || '/avatar.png');
        setAvatarRawUrl('');
        setAvatarZoom(1);
        setAvatarRotation(0);
        setAvatarFilter('natural');
        setAvatarDirty(false);
        setCroppedAreaPixels(null);
      },
    );

    return () => {
      active = false;
    };
  }, [tenantId, user?.uid, user?.displayName, user?.photoURL, patchSessionUser]);

  const publicProfiles = useMemo(
    () => profiles.filter((item) => item.publicProfile === true),
    [profiles],
  );
  const focusedProfileUid = String(searchParams.get('uid') || '').trim();

  useEffect(() => {
    if (!focusedProfileUid) return;
    const hasTarget = publicProfiles.some((item) => item.uid === focusedProfileUid);
    if (!hasTarget) return;
    const selector = `[data-profile-uid="${focusedProfileUid}"]`;
    const timer = window.setTimeout(() => {
      const node = document.querySelector(selector);
      if (node) node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);
    return () => {
      window.clearTimeout(timer);
    };
  }, [focusedProfileUid, publicProfiles]);

  const onAvatarFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setSaveMessage('Select a valid image file.');
      return;
    }

    try {
      const nextUrl = URL.createObjectURL(file);
      setAvatarRawUrl(nextUrl);
      setAvatarSourceUrl(nextUrl);
      setAvatarZoom(1);
      setAvatarRotation(0);
      setAvatarFilter('natural');
      setAvatarDirty(true);
      setCroppedAreaPixels(null);
      setSaveMessage('Avatar ready. Click Save Profile to upload.');
    } catch {
      setSaveMessage('Unable to read image file.');
    }
  };

  const onAvatarReset = () => {
    setAvatarRawUrl('');
    setAvatarSourceUrl(user.photoURL || '/avatar.png');
    setAvatarZoom(1);
    setAvatarRotation(0);
    setAvatarFilter('natural');
    setAvatarDirty(false);
    setCroppedAreaPixels(null);
    setSaveMessage('Avatar edit cleared.');
  };

  const onSave = async () => {
    if (isSaving) return;
    setIsSaving(true);

    let photoURL = user.photoURL || '/avatar.png';
    if (avatarDirty && avatarRawUrl && croppedAreaPixels) {
      try {
        const blob = await getCroppedImg(
          avatarRawUrl,
          croppedAreaPixels,
          avatarRotation,
          avatarFilter,
          AVATAR_OUTPUT_SIZE,
          AVATAR_MAX_BYTES
        );
        const avatarResult = await replaceTenantAvatar({
          tenantId,
          uid: user.uid,
          oldPhotoUrl: user.photoURL || '',
          fileBlob: blob,
        });
        if (!avatarResult.ok) {
          setSaveMessage(avatarResult.error || 'Avatar upload failed.');
          setIsSaving(false);
          return;
        }
        photoURL = avatarResult.photoURL;
        setAvatarSourceUrl(photoURL);
        setAvatarRawUrl('');
        setAvatarDirty(false);
        setCroppedAreaPixels(null);
      } catch (error) {
        setSaveMessage(error?.message || 'Avatar processing failed.');
        setIsSaving(false);
        return;
      }
    }

    const payload = {
      uid: user.uid,
      displayName: form.displayName.trim() || user.displayName,
      role: user.role,
      publicProfile: form.publicProfile,
      headline: form.headline.trim(),
      bio: form.bio.trim(),
      selfIntro: form.selfIntro.trim(),
      socials: {
        linkedin: form.linkedin.trim(),
        instagram: form.instagram.trim(),
        website: form.website.trim(),
      },
      education: form.education.trim(),
      workExperience: form.workExperience.trim(),
      emergencyContact: {
        name: form.emergencyContactName.trim(),
        relation: form.emergencyContactRelation.trim(),
        mobile: form.emergencyContactMobile.trim(),
      },
      medicalInfo: {
        bloodGroup: form.bloodGroup.trim(),
        notes: form.medicalNotes.trim(),
      },
      photoURL,
      email: user.email || '',
      status: user.status || 'Active',
    };

    const profileResult = await upsertTenantUserMap(tenantId, user.uid, payload);
    if (!profileResult.ok) {
      setSaveMessage(profileResult.error || 'Failed to save profile.');
      setIsSaving(false);
      return;
    }

    const usersResult = await fetchTenantUsersMap(tenantId);
    if (usersResult.ok) {
      setProfiles(usersResult.rows.map((item) => toPublicProfile(item)));
    }

    patchSessionUser({
      displayName: payload.displayName,
      photoURL: payload.photoURL,
    });

    setOriginalForm({ ...form });
    setIsEditing(false);
    setSaveMessage('Profile updated.');
    setIsSaving(false);
  };

  const onCancel = () => {
    if (originalForm) {
      setForm(originalForm);
    }
    setIsEditing(false);
    onAvatarReset();
  };

  if (!user) return null;

  return (
    <>
      <PageShell
        title="Profile"
        subtitle="Customize your own public profile. Portal users can view only profiles marked public."
        iconKey="profile"
      >
        {/* Desktop Workspace layout options were moved to TitleBar View Menu */}

        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <section className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-title text-xl text-[var(--c-text)]">My Public Profile</h2>
                <p className="mt-1 text-sm text-[var(--c-muted)]">This controls what others can see inside the portal.</p>
              </div>
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="h-14 rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)] px-5 text-sm font-semibold text-[var(--c-text)] transition hover:bg-[var(--c-surface)]"
                >
                  Edit Profile
                </button>
              )}
            </div>

            <div className="mt-6">
              {!isEditing ? (
                <div className="space-y-6">
                  <div className="flex flex-col items-center gap-4 sm:flex-row">
                    <div className="h-32 w-32 overflow-hidden rounded-full border-4 border-[var(--c-surface)] bg-[var(--c-surface)] shadow-sm">
                      <img
                        src={avatarSourceUrl || '/avatar.png'}
                        alt="Avatar"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="text-center sm:text-left">
                      <h3 className="text-lg font-bold text-[var(--c-text)]">{form.displayName}</h3>
                      {form.headline || normalizeRoleLabel(user.role) ? (
                        <p className="text-sm text-[var(--c-accent)]">{form.headline || normalizeRoleLabel(user.role)}</p>
                      ) : null}
                      <div className="mt-2 flex items-center justify-center gap-2 sm:justify-start">
                        {form.publicProfile ? (
                          <span className={statusVisibleClass}>
                            Public
                          </span>
                        ) : (
                          <span className={statusHiddenClass}>
                            Private
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-6 sm:grid-cols-2">
                    {form.selfIntro ? (
                      <div className="space-y-1">
                        <p className="text-xs font-bold tracking-wider text-[var(--c-muted)] uppercase">Self Intro</p>
                        <p className="text-sm text-[var(--c-text)] leading-relaxed">{form.selfIntro}</p>
                      </div>
                    ) : null}
                    {form.bio ? (
                      <div className="space-y-1">
                        <p className="text-xs font-bold tracking-wider text-[var(--c-muted)] uppercase">Bio / Summary</p>
                        <p className="text-sm text-[var(--c-text)] leading-relaxed">{form.bio}</p>
                      </div>
                    ) : null}
                    {form.education ? (
                      <div className="space-y-1">
                        <p className="text-xs font-bold tracking-wider text-[var(--c-muted)] uppercase">Education</p>
                        <p className="text-sm text-[var(--c-text)] whitespace-pre-wrap">{form.education}</p>
                      </div>
                    ) : null}
                    {form.workExperience ? (
                      <div className="space-y-1">
                        <p className="text-xs font-bold tracking-wider text-[var(--c-muted)] uppercase">Work Experience</p>
                        <p className="text-sm text-[var(--c-text)] whitespace-pre-wrap">{form.workExperience}</p>
                      </div>
                    ) : null}
                  </div>

                  {(form.linkedin || form.instagram || form.website) ? (
                    <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] p-4">
                      <h4 className="text-xs font-bold tracking-wider text-[var(--c-muted)] uppercase">Social & Links</h4>
                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        {form.linkedin ? (
                          <div className="flex items-center gap-2 text-sm text-[var(--c-text)]">
                            <span className="text-xs text-[var(--c-muted)]">LI:</span>
                            <span className="truncate">{form.linkedin}</span>
                          </div>
                        ) : null}
                        {form.instagram ? (
                          <div className="flex items-center gap-2 text-sm text-[var(--c-text)]">
                            <span className="text-xs text-[var(--c-muted)]">IG:</span>
                            <span className="truncate">{form.instagram}</span>
                          </div>
                        ) : null}
                        {form.website ? (
                          <div className="flex items-center gap-2 text-sm text-[var(--c-text)]">
                            <span className="text-xs text-[var(--c-muted)]">WS:</span>
                            <span className="truncate">{form.website}</span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="grid gap-5">
                  <ImageStudio
                    sourceUrl={avatarSourceUrl}
                    onReset={onAvatarReset}
                    zoom={avatarZoom}
                    setZoom={setAvatarZoom}
                    rotation={avatarRotation}
                    setRotation={setRotationWrapper}
                    filter={avatarFilter}
                    setFilter={setAvatarFilter}
                    filterMap={avatarFilterMap}
                    onFileChange={onAvatarFileChange}
                    onCropComplete={onCropComplete}
                    title="Smart Avatar Studio"
                    cropShape="round"
                    workspaceHeightClass="h-[260px] sm:h-[300px] lg:h-[340px]"
                    tip="Tip: Use direct interaction to zoom and pan. Changes are saved with the profile."
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="text-sm text-[var(--c-muted)]">
                      Display Name
                      <input
                        className={inputClass}
                        value={form.displayName}
                        onChange={(event) => setForm((prev) => ({ ...prev, displayName: event.target.value }))}
                        placeholder="Your display name"
                      />
                    </label>

                    <label className="text-sm text-[var(--c-muted)]">
                      Headline
                      <input
                        className={inputClass}
                        value={form.headline}
                        onChange={(event) => setForm((prev) => ({ ...prev, headline: event.target.value }))}
                        placeholder="Role headline shown in portal"
                      />
                    </label>
                  </div>

                  <label className="text-sm text-[var(--c-muted)]">
                    Self Intro
                    <textarea
                      className={textareaClass}
                      value={form.selfIntro}
                      rows={2}
                      onChange={(event) => setForm((prev) => ({ ...prev, selfIntro: event.target.value }))}
                      placeholder="Short self introduction"
                    />
                  </label>

                  <label className="text-sm text-[var(--c-muted)]">
                    Bio / Summary
                    <textarea
                      className={textareaClass}
                      value={form.bio}
                      rows={3}
                      onChange={(event) => setForm((prev) => ({ ...prev, bio: event.target.value }))}
                      placeholder="Short profile summary"
                    />
                  </label>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="text-sm text-[var(--c-muted)]">
                      LinkedIn
                      <input
                        className={inputClass}
                        value={form.linkedin}
                        onChange={(event) => setForm((prev) => ({ ...prev, linkedin: event.target.value }))}
                        placeholder="LinkedIn URL"
                      />
                    </label>
                    <label className="text-sm text-[var(--c-muted)]">
                      Instagram
                      <input
                        className={inputClass}
                        value={form.instagram}
                        onChange={(event) => setForm((prev) => ({ ...prev, instagram: event.target.value }))}
                        placeholder="Instagram URL"
                      />
                    </label>
                    <label className="text-sm text-[var(--c-muted)]">
                      Website
                      <input
                        className={inputClass}
                        value={form.website}
                        onChange={(event) => setForm((prev) => ({ ...prev, website: event.target.value }))}
                        placeholder="Website URL"
                      />
                    </label>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="text-sm text-[var(--c-muted)]">
                      Education
                      <textarea
                        className={textareaClass}
                        value={form.education}
                        rows={2}
                        onChange={(event) => setForm((prev) => ({ ...prev, education: event.target.value }))}
                        placeholder="Degrees, certifications..."
                      />
                    </label>
                    <label className="text-sm text-[var(--c-muted)]">
                      Work Experience
                      <textarea
                        className={textareaClass}
                        value={form.workExperience}
                        rows={2}
                        onChange={(event) => setForm((prev) => ({ ...prev, workExperience: event.target.value }))}
                        placeholder="Years and relevant experience..."
                      />
                    </label>
                  </div>

                  <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] p-4">
                    <p className="text-sm font-bold text-[var(--c-text)]">Emergency & Medical</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <label className="text-[10px] font-bold text-[var(--c-muted)] uppercase">
                        Contact Name
                        <input
                          className={inputClass}
                          value={form.emergencyContactName}
                          onChange={(event) => setForm((prev) => ({ ...prev, emergencyContactName: event.target.value }))}
                          placeholder="Name"
                        />
                      </label>
                      <label className="text-[10px] font-bold text-[var(--c-muted)] uppercase">
                        Relation
                        <input
                          className={inputClass}
                          value={form.emergencyContactRelation}
                          onChange={(event) => setForm((prev) => ({ ...prev, emergencyContactRelation: event.target.value }))}
                          placeholder="Relation"
                        />
                      </label>
                      <label className="text-[10px] font-bold text-[var(--c-muted)] uppercase">
                        Mobile
                        <input
                          className={inputClass}
                          value={form.emergencyContactMobile}
                          onChange={(event) => setForm((prev) => ({ ...prev, emergencyContactMobile: event.target.value }))}
                          placeholder="Mobile"
                        />
                      </label>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_2fr]">
                      <label className="text-[10px] font-bold text-[var(--c-muted)] uppercase">
                        Blood Group
                        <input
                          className={inputClass}
                          value={form.bloodGroup}
                          onChange={(event) => setForm((prev) => ({ ...prev, bloodGroup: event.target.value }))}
                          placeholder="A+, O-..."
                        />
                      </label>
                      <label className="text-[10px] font-bold text-[var(--c-muted)] uppercase">
                        Medical Notes
                        <input
                          className={inputClass}
                          value={form.medicalNotes}
                          onChange={(event) => setForm((prev) => ({ ...prev, medicalNotes: event.target.value }))}
                          placeholder="Allergies, conditions..."
                        />
                      </label>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`h-2.5 w-2.5 rounded-full ${form.publicProfile ? 'bg-[var(--c-success)] shadow-[0_0_8px_var(--c-success)]' : 'bg-[var(--c-toggle-off)]'}`} />
                      <p className="text-sm font-bold text-[var(--c-text)]">Public Profile Visibility</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, publicProfile: !prev.publicProfile }))}
                      className={`h-14 rounded-2xl px-5 text-xs font-bold transition ${form.publicProfile
                        ? statusEnabledButtonClass
                        : statusDisabledButtonClass
                        }`}
                    >
                      {form.publicProfile ? 'VISIBLE' : 'HIDDEN'}
                    </button>
                  </div>

                  <div className="flex items-center gap-3 border-t border-[var(--c-border)] pt-5">
                    <button
                      type="button"
                      onClick={onSave}
                      disabled={isSaving}
                      className="h-14 rounded-2xl bg-[var(--c-accent)] px-6 text-sm font-bold text-white shadow-lg shadow-[var(--c-accent)]/20 transition hover:opacity-90 disabled:opacity-60"
                    >
                      {isSaving ? 'Processing...' : 'Save Changes'}
                    </button>
                    <button
                      type="button"
                      onClick={onCancel}
                      disabled={isSaving}
                      className="h-14 rounded-2xl border border-[var(--c-border)] bg-transparent px-6 text-sm font-bold text-[var(--c-text)] transition hover:bg-[var(--c-panel)]"
                    >
                      Cancel
                    </button>
                    {saveMessage ? <p className="text-xs font-medium text-[var(--c-accent)] animate-pulse">{saveMessage}</p> : null}
                  </div>
                </div>
              )}
            </div>
          </section>
          <section className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4 sm:p-5">
            <h2 className="font-title text-xl text-[var(--c-text)]">Portal Public Profiles</h2>
            <p className="mt-1 text-sm text-[var(--c-muted)]">Other users can view these profiles inside portal.</p>

            <div className="mt-4 space-y-2">
              {publicProfiles.map((item) => (
                <article
                  key={item.uid}
                  data-profile-uid={item.uid}
                  className={`rounded-xl border bg-[var(--c-panel)] p-3 transition ${focusedProfileUid === item.uid
                    ? 'border-[var(--c-accent)] ring-2 ring-[var(--c-accent)]/25'
                    : 'border-[var(--c-border)]'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={item.avatar || '/avatar.png'}
                      alt={item.displayName}
                      className="h-10 w-10 rounded-full border border-[var(--c-border)] object-cover"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--c-text)]">{item.displayName}</p>
                      <p className="text-xs text-[var(--c-muted)]">{item.headline || item.role}</p>
                    </div>
                  </div>
                  {item.bio ? <p className="mt-2 text-sm text-[var(--c-muted)]">{item.bio}</p> : null}
                  {item.selfIntro ? (
                    <p className="mt-2 text-sm text-[var(--c-muted)]">
                      <span className="font-semibold text-[var(--c-text)]">Intro: </span>
                      {item.selfIntro}
                    </p>
                  ) : null}
                  {item.education ? (
                    <p className="mt-2 text-sm text-[var(--c-muted)]">
                      <span className="font-semibold text-[var(--c-text)]">Education: </span>
                      {item.education}
                    </p>
                  ) : null}
                  {item.workExperience ? (
                    <p className="mt-2 text-sm text-[var(--c-muted)]">
                      <span className="font-semibold text-[var(--c-text)]">Work Experience: </span>
                      {item.workExperience}
                    </p>
                  ) : null}
                  {item.socials?.linkedin || item.socials?.instagram || item.socials?.website ? (
                    <div className="mt-2 text-sm text-[var(--c-muted)]">
                      <p className="font-semibold text-[var(--c-text)]">Social Media</p>
                      {item.socials?.linkedin ? <p>LinkedIn: {item.socials.linkedin}</p> : null}
                      {item.socials?.instagram ? <p>Instagram: {item.socials.instagram}</p> : null}
                      {item.socials?.website ? <p>Website: {item.socials.website}</p> : null}
                    </div>
                  ) : null}
                  {item.emergencyContact?.name || item.emergencyContact?.mobile ? (
                    <div className="mt-2 text-sm text-[var(--c-muted)]">
                      <p className="font-semibold text-[var(--c-text)]">Emergency Contact</p>
                      {item.emergencyContact?.name ? <p>Name: {item.emergencyContact.name}</p> : null}
                      {item.emergencyContact?.relation ? <p>Relation: {item.emergencyContact.relation}</p> : null}
                      {item.emergencyContact?.mobile ? <p>Mobile: {item.emergencyContact.mobile}</p> : null}
                    </div>
                  ) : null}
                  {item.medicalInfo?.bloodGroup || item.medicalInfo?.notes ? (
                    <div className="mt-2 text-sm text-[var(--c-muted)]">
                      <p className="font-semibold text-[var(--c-text)]">Medical Info</p>
                      {item.medicalInfo?.bloodGroup ? <p>Blood Group: {item.medicalInfo.bloodGroup}</p> : null}
                      {item.medicalInfo?.notes ? <p>Notes: {item.medicalInfo.notes}</p> : null}
                    </div>
                  ) : null}
                </article>
              ))}
              {publicProfiles.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[var(--c-border)] bg-[var(--c-panel)] p-3 text-sm text-[var(--c-muted)]">
                  No public profiles available.
                </p>
              ) : null}
            </div>
          </section>
        </div>
      </PageShell>
    </>
  );
};

export default ProfilePage;
