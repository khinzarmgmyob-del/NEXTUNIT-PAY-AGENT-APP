export const getTodayFormatted = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getCurrentTimeFormatted = (): string => {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

export const formatKs = (num: number): string => {
  return Number(num || 0).toLocaleString('en-US') + ' Ks';
};

export const formatLakh = (num: number): string => {
  const lakhs = (num || 0) / 100000;
  if (lakhs >= 100) {
    return `${lakhs.toFixed(1)} သိန်း`;
  }
  return `${lakhs.toFixed(2)} သိန်း`;
};
