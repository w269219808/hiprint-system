import { db } from '@/db';
import { printLogs } from '@/db/schema';
import { NextResponse } from 'next/server';
import { and, gte, ilike, lte } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = request.nextUrl;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const conditions = [
      ilike(printLogs.printType, '产品标签 打印(已下发)'),
    ];

    if (startDate) {
      conditions.push(gte(printLogs.createdAt, new Date(`${startDate}T00:00:00`)));
    }
    if (endDate) {
      conditions.push(lte(printLogs.createdAt, new Date(`${endDate}T23:59:59.999`)));
    }

    const logs = await db
      .select()
      .from(printLogs)
      .where(and(...conditions));

    // 在 JS 中聚合（contentSummary 是 text，无法直接 SQL JSON 查询）
    const dailyMap = new Map();
    const modelMap = new Map();
    const capacityMap = new Map();
    const colorMap = new Map();
    const modelColorMap = new Map();

    let todayCount = 0;
    let todayCopies = 0;
    let monthCount = 0;
    let monthCopies = 0;

    const now = new Date();
    const localOffset = now.getTimezoneOffset() * 60000;
    const localNow = new Date(now.getTime() - localOffset);
    const todayStr = localNow.toISOString().slice(0, 10);
    const monthPrefix = todayStr.slice(0, 7);

    for (const log of logs) {
      let summary = {};
      try {
        summary = JSON.parse(log.contentSummary || '{}');
      } catch {
        summary = {};
      }

      const copies = summary.copies || 1;
      const logLocal = new Date(new Date(log.createdAt).getTime() - localOffset);
      const dateStr = logLocal.toISOString().slice(0, 10);

      // 按天
      const d = dailyMap.get(dateStr) || { date: dateStr, count: 0, copies: 0 };
      d.count++;
      d.copies += copies;
      dailyMap.set(dateStr, d);

      // 今天
      if (dateStr === todayStr) {
        todayCount++;
        todayCopies += copies;
      }
      // 本月
      if (dateStr.startsWith(monthPrefix)) {
        monthCount++;
        monthCopies += copies;
      }

      // 型号
      const model = summary.model || '未知';
      modelMap.set(model, (modelMap.get(model) || 0) + copies);

      // 容量
      let capacity = summary.capacity || '未知';
      capacity = String(capacity).split('-').slice(1).join('-').trim() || '未知';
      capacityMap.set(capacity, (capacityMap.get(capacity) || 0) + copies);

      // 颜色
      const color = summary.color || '未知';
      colorMap.set(color, (colorMap.get(color) || 0) + copies);

      // 型号 × 颜色（堆叠用）
      const key = `${model}|||${color}`;
      modelColorMap.set(key, (modelColorMap.get(key) || 0) + copies);
    }

    // 每日趋势
    let daily = [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date));
    // 补全查询范围内没有打印记录的日期（值为 0）
    if (startDate && endDate) {
      const filled = [];
      const map = new Map(daily.map((d) => [d.date, d]));
      const cur = new Date(`${startDate}T00:00:00`);
      const end = new Date(`${endDate}T00:00:00`);
      while (cur <= end) {
        // 手动拼 YYYY-MM-DD，避免 toISOString 的时区偏移
        const y = cur.getFullYear();
        const m = String(cur.getMonth() + 1).padStart(2, '0');
        const d = String(cur.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;
        filled.push(map.get(dateStr) || { date: dateStr, count: 0, copies: 0 });
        cur.setDate(cur.getDate() + 1);
      }
      daily = filled;
    }

    // 型号排行
    const modelStats = [...modelMap.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // 容量分布
    const capacityStats = [...capacityMap.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // 颜色分布
    const colorStats = [...colorMap.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // 型号×颜色 堆叠图数据（取前 10 个型号）
    const topModels = modelStats.slice(0, 10).map((m) => m.name);
    const allColors = [...new Set([...colorMap.keys()])];

    // 先构建完整数据
    let stackedData = topModels.map((model) => {
      const row = { model };
      for (const color of allColors) {
        row[color] = modelColorMap.get(`${model}|||${color}`) || 0;
      }
      return row;
    });

    // 只保留「在前10型号里至少出现过一次」的颜色（总和>0）
    const usedColors = allColors.filter((color) =>
      stackedData.some((row) => (row[color] || 0) > 0)
    );

    // 重建数据，只留用到的颜色字段
    stackedData = stackedData.map((row) => {
      const filtered = { model: row.model };
      for (const color of usedColors) {
        filtered[color] = row[color];
      }
      return filtered;
    });

    return NextResponse.json({
      success: true,
      data: {
        daily,
        todayCount,
        todayCopies,
        monthCount,
        monthCopies,
        totalCount: logs.length,
        totalCopies: logs.reduce((sum, log) => {
          try {
            return sum + (JSON.parse(log.contentSummary || '{}').copies || 1);
          } catch {
            return sum + 1;
          }
        }, 0),
        modelStats,
        capacityStats,
        colorStats,
        stackedData,
        stackedColors: usedColors,
      },
    });
  } catch (error) {
    console.error('打印统计查询失败:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
