// app/api/trace/stats/route.js
import { db } from '@/db';
import { traceCodes, codeMappings } from '@/db/schema';
import { NextResponse } from 'next/server';
import { and, gte, lte } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

function toPrefix(dateStr) {
  return dateStr ? dateStr.replace(/-/g, '') : null;
}

export async function GET(request) {
  try {
    const { searchParams } = request.nextUrl;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const conditions = [];
    if (startDate) conditions.push(gte(traceCodes.datePrefix, toPrefix(startDate)));
    if (endDate) conditions.push(lte(traceCodes.datePrefix, toPrefix(endDate)));

    // 1. 并行查询：追溯码明细 + 字典表
    const [rows, mappings] = await Promise.all([
      db.select().from(traceCodes).where(conditions.length ? and(...conditions) : undefined),
      db.select().from(codeMappings),
    ]);

    // 2. 构建字典映射: category -> { code -> name }
    const dict = { model: {}, capacity: {}, color: {}, customer: {} };
    const dictReverse = { model: {}, capacity: {}, color: {}, customer: {} };
    
    for (const m of mappings) {
      if (!dict[m.category]) dict[m.category] = {};
      if (!dictReverse[m.category]) dictReverse[m.category] = {};
      
      dict[m.category][m.code] = m.name;
      dictReverse[m.category][m.name] = m.code; // 用于反查拼上编码
    }

    // 3. 翻译工具函数
    // 传入代码，返回 "名称 (编码)" 格式
    const translate = (category, code) => {
      if (code == null) return '未知';
      const d = dict[category] || {};
      const key = String(code).padStart(2, '0');
      const name = d[key] || d[String(code)];
      return name ? `${name} (${key})` : String(code); // 字典没配就只显示编码
    };

    // 把 customer 字段按 2 位切分成多个客户编码
    const splitCustomerCodes = (raw) => {
      if (raw == null) return [];
      const s = String(raw).trim();
      // 纯数字且长度为 2 的倍数，按 2 位切分
      if (/^\d+$/.test(s) && s.length % 2 === 0) {
        const arr = [];
        for (let i = 0; i < s.length; i += 2) arr.push(s.slice(i, i + 2));
        return arr;
      }
      return [s];
    };

    // 4. 初始化聚合 Map
    const dailyMap = new Map();
    const modelMap = new Map();
    const capacityMap = new Map();
    const colorMap = new Map();
    const customerMap = new Map();
    const modelColorMap = new Map();

    let todayCount = 0;
    let monthCount = 0;

    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const todayPrefix = `${y}${m}${d}`;
    const monthPrefix = `${y}${m}`;

    // 5. 遍历聚合
    for (const r of rows) {
      const prefix = r.datePrefix; // YYYYMMDD
      const dateStr = `${prefix.slice(0, 4)}-${prefix.slice(4, 6)}-${prefix.slice(6, 8)}`;

      // 每日
      const day = dailyMap.get(dateStr) || { date: dateStr, count: 0 };
      day.count++;
      dailyMap.set(dateStr, day);

      // 今日/本月
      if (prefix === todayPrefix) todayCount++;
      if (prefix.startsWith(monthPrefix)) monthCount++;

      // 型号
      const modelKey = translate('model', r.model);
      modelMap.set(modelKey, (modelMap.get(modelKey) || 0) + 1);

      // 容量 (如果原字段有 "-" 先切分保留，然后翻译)
      let capacityRaw = String(r.capacity || '').split('-').slice(1).join('-').trim() || r.capacity;
      const capacityKey = translate('capacity', capacityRaw);
      capacityMap.set(capacityKey, (capacityMap.get(capacityKey) || 0) + 1);

      // 颜色
      const colorKey = translate('color', r.color);
      colorMap.set(colorKey, (colorMap.get(colorKey) || 0) + 1);

      // 客户 (按 2 位切分)
      const customerCodes = splitCustomerCodes(r.customer);
      for (const code of customerCodes) {
        const customerKey = translate('customer', code);
        customerMap.set(customerKey, (customerMap.get(customerKey) || 0) + 1);
      }

      // 型号 × 颜色
      const comboKey = `${modelKey}|||${colorKey}`;
      modelColorMap.set(comboKey, (modelColorMap.get(comboKey) || 0) + 1);
    }

    // 6. 补全每日趋势空白天
    let daily = [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date));
    if (startDate && endDate) {
      const filled = [];
      const map = new Map(daily.map((x) => [x.date, x]));
      const cur = new Date(`${startDate}T00:00:00`);
      const end = new Date(`${endDate}T00:00:00`);
      while (cur <= end) {
        const yy = cur.getFullYear();
        const mm = String(cur.getMonth() + 1).padStart(2, '0');
        const dd = String(cur.getDate()).padStart(2, '0');
        const ds = `${yy}-${mm}-${dd}`;
        filled.push(map.get(ds) || { date: ds, count: 0 });
        cur.setDate(cur.getDate() + 1);
      }
      daily = filled;
    }

    // 7. 转换数组并排序
    const toStats = (map) =>
      [...map.entries()]
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    const modelStats = toStats(modelMap);
    const capacityStats = toStats(capacityMap);
    const colorStats = toStats(colorMap);
    const customerStats = toStats(customerMap);

    // 8. 构建型号 × 颜色 堆叠图数据（前 10 型号）
    const topModels = modelStats.slice(0, 10).map((x) => x.name);
    const allColors = [...colorMap.keys()];
    let stackedData = topModels.map((model) => {
      const row = { model };
      for (const color of allColors) {
        row[color] = modelColorMap.get(`${model}|||${color}`) || 0;
      }
      return row;
    });

    // 过滤掉颜色字段全为 0 的颜色
    const usedColors = allColors.filter((color) =>
      stackedData.some((row) => (row[color] || 0) > 0)
    );

    stackedData = stackedData.map((row) => {
      const filtered = { model: row.model };
      for (const color of usedColors) filtered[color] = row[color];
      return filtered;
    });

    // 9. 返回
    return NextResponse.json({
      success: true,
      data: {
        totalCount: rows.length,
        todayCount,
        monthCount,
        daily,
        modelStats,
        capacityStats,
        colorStats,
        customerStats,
        stackedData,
        stackedColors: usedColors,
      },
    });
  } catch (error) {
    console.error('追溯码统计查询失败:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}