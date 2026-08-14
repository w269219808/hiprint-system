'use client';

// 当天日期前缀：YYYYMMDD（无横线）
export function getTodayPrefix() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

const STORAGE_PREFIX = 'hiprint:barcode-counter:';

function getStorageKey(datePrefix) {
  return `${STORAGE_PREFIX}${datePrefix}`;
}

// 当天已经打印的数量（读取，不消耗）
export function getPrintedCount(datePrefix = getTodayPrefix()) {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = window.localStorage.getItem(getStorageKey(datePrefix));
    const count = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(count) && count > 0 ? count : 0;
  } catch {
    return 0;
  }
}

// 下一条条形码（读取，不消耗）：YYYYMMDD + 序号
export function getNextBarcode() {
  const prefix = getTodayPrefix();
  return `${prefix}${getPrintedCount(prefix)}`;
}

// 生成 count 条预览条形码（不消耗序号）
export function getPreviewBarcodes(count) {
  const prefix = getTodayPrefix();
  const start = getPrintedCount(prefix);
  return Array.from({ length: count }, (_, i) => `${prefix}${start + i}`);
}

// 分配 count 条条形码并持久化计数，返回 { prefix, start, codes, next }
export function allocateBarcodes(count) {
  const prefix = getTodayPrefix();
  const start = getPrintedCount(prefix);
  const codes = Array.from({ length: count }, (_, i) => `${prefix}${start + i}`);
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(getStorageKey(prefix), String(start + count));
    }
  } catch {
    // 忽略存储失败（如隐私模式）
  }
  return { prefix, start, codes, next: `${prefix}${start + count}` };
}
