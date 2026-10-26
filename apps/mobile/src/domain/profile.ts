export interface GuestProfile {
  readonly id: string;
  readonly displayName: string;
  readonly notificationsEnabled: boolean;
  readonly language: 'ru';
  readonly theme: 'light';
  readonly isDemo: true;
}

export interface ProfileChanges {
  readonly displayName?: string;
  readonly notificationsEnabled?: boolean;
}

export const MAX_PROFILE_NAME_LENGTH = 60;

export function createGuestProfile(): GuestProfile {
  return {
    id: '0247',
    displayName: 'Гость SBG',
    notificationsEnabled: true,
    language: 'ru',
    theme: 'light',
    isDemo: true,
  };
}

export function normalizeProfileName(value: string): string {
  if (typeof value !== 'string') throw new Error('Укажите имя.');
  const name = value.trim().replace(/\s+/g, ' ');
  if (!name || name.length > MAX_PROFILE_NAME_LENGTH) {
    throw new Error(`Имя должно содержать от 1 до ${MAX_PROFILE_NAME_LENGTH} символов.`);
  }
  return name;
}

export function updateGuestProfile(profile: GuestProfile, changes: ProfileChanges): GuestProfile {
  if (
    changes.notificationsEnabled !== undefined &&
    typeof changes.notificationsEnabled !== 'boolean'
  ) {
    throw new Error('Не удалось сохранить настройку уведомлений.');
  }
  return {
    ...profile,
    displayName:
      changes.displayName === undefined
        ? profile.displayName
        : normalizeProfileName(changes.displayName),
    notificationsEnabled: changes.notificationsEnabled ?? profile.notificationsEnabled,
  };
}

export function parseStoredProfile(value: unknown): GuestProfile {
  try {
    const profile = value as GuestProfile;
    if (
      !profile ||
      profile.id !== '0247' ||
      profile.language !== 'ru' ||
      profile.theme !== 'light' ||
      profile.isDemo !== true ||
      typeof profile.notificationsEnabled !== 'boolean'
    ) {
      return createGuestProfile();
    }
    return {
      ...createGuestProfile(),
      displayName: normalizeProfileName(profile.displayName),
      notificationsEnabled: profile.notificationsEnabled,
    };
  } catch {
    return createGuestProfile();
  }
}
