export const SECRET_SALT = "HAZEL_AGENT_POS_2026_SECRET";

// 3 Days Trial in milliseconds (3 days = 72 hours)
export const TRIAL_DURATION_MS = 3 * 24 * 60 * 60 * 1000;

export const getDeviceId = (): string => {
  let deviceId = localStorage.getItem('app_device_id');
  if (!deviceId) {
    const rawData = `${typeof navigator !== 'undefined' ? navigator.userAgent : 'default-agent'}-${typeof screen !== 'undefined' ? screen.width + 'x' + screen.height : '1920x1080'}-${typeof navigator !== 'undefined' ? navigator.language : 'my'}`;
    let hash = 0;
    for (let i = 0; i < rawData.length; i++) {
      hash = ((hash << 5) - hash) + rawData.charCodeAt(i);
      hash |= 0;
    }
    deviceId = 'DEV-' + Math.abs(hash).toString(36).toUpperCase().padStart(6, '0');
    localStorage.setItem('app_device_id', deviceId);
  }
  return deviceId;
};

export const generateActivationKey = (deviceId: string): string => {
  const combined = deviceId + SECRET_SALT;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) - hash) + combined.charCodeAt(i);
    hash |= 0;
  }
  const rawKey = Math.abs(hash).toString(36).toUpperCase().padStart(8, '0');
  return `${rawKey.slice(0, 4)}-${rawKey.slice(4, 8)}`;
};

export const verifyActivationKey = (deviceId: string, inputKey: string): boolean => {
  if (!inputKey) return false;
  const cleanInput = inputKey.trim().toUpperCase();
  const expectedKey = generateActivationKey(deviceId);
  return cleanInput === expectedKey;
};

export interface LicenseStatus {
  isPermanent: boolean;
  isTrial: boolean;
  isExpired: boolean;
  canAccessApp: boolean;
  trialStartDate: number;
  trialEndDate: number;
  remainingMs: number;
  remainingDays: number;
  remainingHours: number;
  remainingMinutes: number;
  formattedRemaining: string;
  deviceId: string;
}

/**
 * Check Full License and 3-Day Free Trial status
 */
export const getAppLicenseStatus = (): LicenseStatus => {
  const deviceId = getDeviceId();
  const savedKey = localStorage.getItem('app_activation_key');
  const isPermanent = !!savedKey && verifyActivationKey(deviceId, savedKey);

  // If permanent license is activated
  if (isPermanent) {
    return {
      isPermanent: true,
      isTrial: false,
      isExpired: false,
      canAccessApp: true,
      trialStartDate: 0,
      trialEndDate: 0,
      remainingMs: 0,
      remainingDays: 0,
      remainingHours: 0,
      remainingMinutes: 0,
      formattedRemaining: 'အမြဲတမ်း လိုင်စင် (Lifetime)',
      deviceId,
    };
  }

  // Handle 3-Day Free Trial
  let firstInstallTimeStr = localStorage.getItem('app_trial_start_time');
  let trialStartTime: number;

  if (!firstInstallTimeStr) {
    trialStartTime = Date.now();
    localStorage.setItem('app_trial_start_time', trialStartTime.toString());
  } else {
    trialStartTime = parseInt(firstInstallTimeStr, 10);
    if (isNaN(trialStartTime)) {
      trialStartTime = Date.now();
      localStorage.setItem('app_trial_start_time', trialStartTime.toString());
    }
  }

  const trialEndTime = trialStartTime + TRIAL_DURATION_MS;
  const now = Date.now();
  const remainingMs = Math.max(0, trialEndTime - now);
  const isExpired = remainingMs <= 0;

  const totalMinutes = Math.floor(remainingMs / (1000 * 60));
  const remainingDays = Math.floor(totalMinutes / (60 * 24));
  const remainingHours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const remainingMinutes = totalMinutes % 60;

  let formattedRemaining = '';
  if (isExpired) {
    formattedRemaining = 'အစမ်းကာလ ကုန်ဆုံးသွားပါပြီ';
  } else if (remainingDays > 0) {
    formattedRemaining = `${remainingDays} ရက် ${remainingHours} နာရီ ကျန်ရှိ`;
  } else if (remainingHours > 0) {
    formattedRemaining = `${remainingHours} နာရီ ${remainingMinutes} မိနစ် ကျန်ရှိ`;
  } else {
    formattedRemaining = `${remainingMinutes} မိနစ် ကျန်ရှိ`;
  }

  return {
    isPermanent: false,
    isTrial: !isExpired,
    isExpired,
    canAccessApp: !isExpired,
    trialStartDate: trialStartTime,
    trialEndDate: trialEndTime,
    remainingMs,
    remainingDays,
    remainingHours,
    remainingMinutes,
    formattedRemaining,
    deviceId,
  };
};

/**
 * Activate Permanent License
 */
export const activateLicense = (key: string): boolean => {
  const deviceId = getDeviceId();
  if (verifyActivationKey(deviceId, key)) {
    localStorage.setItem('app_activation_key', key.trim().toUpperCase());
    return true;
  }
  return false;
};
