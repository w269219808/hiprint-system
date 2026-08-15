'use client';

// 每个客户独立的打印序号计数器（localStorage 持久化，按客户累计递增）

const STORAGE_PREFIX = 'hiprint:customer-seq:';

function getStorageKey(customerCode) {
  return `${STORAGE_PREFIX}${customerCode}`;
}

// 序号至少两位：01、02 ... 99、100
const padSequence = (n) => String(n).padStart(2, '0');

// 该客户已经打印过的数量（读取，不消耗）
export function getPrintedCount(customerCode) {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = window.localStorage.getItem(getStorageKey(customerCode));
    const count = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(count) && count > 0 ? count : 0;
  } catch {
    return 0;
  }
}

// 下一条打印序号（读取，不消耗）：01、02 ...
export function getNextSequence(customerCode) {
  return padSequence(getPrintedCount(customerCode) + 1);
}

// 生成 count 条预览序号（不消耗序号）
export function getPreviewSequences(customerCode, count) {
  const start = getPrintedCount(customerCode);
  return Array.from({ length: count }, (_, i) => padSequence(start + i + 1));
}

// 分配 count 条序号并持久化计数，返回 { start, codes, next }
export function allocateSequences(customerCode, count) {
  const start = getPrintedCount(customerCode);
  const codes = Array.from({ length: count }, (_, i) => padSequence(start + i + 1));
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(getStorageKey(customerCode), String(start + count));
    }
  } catch {
    // 忽略存储失败（如隐私模式）
  }
  return { start, codes, next: padSequence(start + count + 1) };
}
