'use client';

// 当天日期前缀：YYYYMMDD（无横线）
export function getTodayPrefix() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

// 从服务器获取当天已打印数量
export async function getPrintedCount(datePrefix = getTodayPrefix()) {
  try {
    const res = await fetch(`/api/barcode-counter?date=${datePrefix}`, {
      cache: 'no-store',
    });
    const data = await res.json();
    return data.success ? data.count : 0;
  } catch (error) {
    console.error('获取条形码计数失败:', error);
    return 0;
  }
}

// 获取下一条条形码（预览，不消耗）
export async function getNextBarcode() {
  const prefix = getTodayPrefix();
  const count = await getPrintedCount(prefix);
  return `${prefix}${count}`;
}

// 生成 count 条预览条形码（不消耗序号）
export async function getPreviewBarcodes(count) {
  const prefix = getTodayPrefix();
  const start = await getPrintedCount(prefix);
  return Array.from({ length: count }, (_, i) => `${prefix}${start + i}`);
}

// 分配 count 条条形码（消耗序号，原子操作）
export async function allocateBarcodes(count) {
  try {
    const res = await fetch('/api/barcode-counter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count }),
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || '分配失败');
    }
    return data;
  } catch (error) {
    console.error('分配条形码序号失败:', error);
    // 降级：返回空数组，避免打印流程中断
    const prefix = getTodayPrefix();
    return { prefix, start: 0, codes: [], next: `${prefix}0` };
  }
}
