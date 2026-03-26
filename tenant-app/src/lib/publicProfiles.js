const baseProfiles = [
  {
    uid: 'demo_uid_001',
    displayName: 'Samy Admin',
    role: 'Admin',
    publicProfile: true,
    headline: 'Operations Lead',
    bio: 'Handles onboarding, settings, and quality checks.',
    selfIntro: 'I support smooth operations for ACIS teams.',
    socials: {
      linkedin: '',
      instagram: '',
      website: '',
    },
    education: 'BBA - Operations Management',
    workExperience: '8 years in operations and client service workflows.',
    emergencyContact: {
      name: '',
      relation: '',
      mobile: '',
    },
    medicalInfo: {
      bloodGroup: '',
      notes: '',
    },
    avatar: '/avatar.png',
  },
  {
    uid: 'demo_uid_002',
    displayName: 'Nora Staff',
    role: 'Staff',
    publicProfile: true,
    headline: 'Client Support',
    bio: 'Supports daily client-facing transactions.',
    selfIntro: '',
    socials: {
      linkedin: '',
      instagram: '',
      website: '',
    },
    education: '',
    workExperience: '',
    emergencyContact: {
      name: '',
      relation: '',
      mobile: '',
    },
    medicalInfo: {
      bloodGroup: '',
      notes: '',
    },
    avatar: '/avatar.png',
  },
  {
    uid: 'demo_uid_003',
    displayName: 'Imran Accountant',
    role: 'Accountant',
    publicProfile: false,
    headline: 'Finance Desk',
    bio: 'Maintains payment and reconciliation records.',
    selfIntro: '',
    socials: {
      linkedin: '',
      instagram: '',
      website: '',
    },
    education: '',
    workExperience: '',
    emergencyContact: {
      name: '',
      relation: '',
      mobile: '',
    },
    medicalInfo: {
      bloodGroup: '',
      notes: '',
    },
    avatar: '/avatar.png',
  },
];

const keyFor = (tenantId) => `acis_public_profiles_v1_${tenantId}`;

export const getPublicProfiles = (tenantId) => {
  if (typeof window === 'undefined') return baseProfiles;
  const raw = window.localStorage.getItem(keyFor(tenantId));
  if (!raw) return baseProfiles;

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return baseProfiles;
    return parsed;
  } catch {
    return baseProfiles;
  }
};

export const savePublicProfiles = (tenantId, profiles) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(keyFor(tenantId), JSON.stringify(profiles));
};

export const upsertPublicProfile = (tenantId, profile) => {
  const current = getPublicProfiles(tenantId);
  const index = current.findIndex((item) => item.uid === profile.uid);
  const next = [...current];

  if (index >= 0) {
    next[index] = { ...next[index], ...profile };
  } else {
    next.push(profile);
  }

  savePublicProfiles(tenantId, next);
  return next;
};
