export const SECRET_SALT = "HAZEL_AGENT_POS_2026_SECRET";

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
  const cleanInput = inputKey.trim().toUpperCase();
  const expectedKey = generateActivationKey(deviceId);
  return cleanInput === expectedKey;
};
