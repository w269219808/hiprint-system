import { db } from '@/db';
import { barcodeCounters } from '@/db/schema';
import { NextResponse } from 'next/server';
import { eq, and, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// 获取当天日期前缀 YYYYMMDD
function getTodayPrefix() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

// GET：查询当天已支持指定 labelType 的已打印数量
export async function GET(request) {
  try {
    const { searchParams } = request.nextUrl;
    const datePrefix = searchParams.get('date') || getTodayPrefix();
    const labelType = searchParams.get('labelType') || 'trace'; // 👈 接收前端传过来的类型，默认 'trace'

    // 🔑 查询时按 date_prefix + label_type 双条件过滤
    const [row] = await db
      .select()
      .from(barcodeCounters)
      .where(
        and(
          eq(barcodeCounters.datePrefix, datePrefix),
          eq(barcodeCounters.labelType, labelType)
        )
      )
      .limit(1);

    const count = row ? row.count : 0;

    return NextResponse.json({
      success: true,
      datePrefix,
      labelType,
      count,
      next: `${datePrefix}${String(count + 1).padStart(3, '0')}`,
    });
  } catch (error) {
    console.error('查询条形码计数器失败:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST：分配 count 条条形码序号（原子操作，带 labelType 隔离）
export async function POST(request) {
  try {
    const body = await request.json();
    const count = Math.max(1, Math.min(9999, parseInt(body.count, 10) || 1));
    const datePrefix = body.date || getTodayPrefix();
    const labelType = body.labelType || 'trace'; // 👈 接收前端传过来的类型，默认 'trace'

    // 使用复合唯一键原子递增。start 表示本次分配的第一个流水号，不能包含已打印的旧号。
    const result = await db.execute(sql`
      WITH counter AS (
        INSERT INTO barcode_counters (date_prefix, label_type, count)
        VALUES (${datePrefix}, ${labelType}, ${count})
        ON CONFLICT (date_prefix, label_type) DO UPDATE
        SET count = barcode_counters.count + EXCLUDED.count,
            updated_at = now()
        RETURNING count
      )
      SELECT (count - ${count} + 1) AS start_count
      FROM counter
    `);

    const start = Number(result[0].start_count);

    // 产品标签使用“日期 + 3位流水号”
    const codes = Array.from(
      { length: count },
      (_, i) => `${datePrefix}${String(start + i).padStart(3, '0')}`
    );

    return NextResponse.json({
      success: true,
      prefix: datePrefix,
      labelType,
      start,
      codes,
      next: `${datePrefix}${String(start + count).padStart(3, '0')}`,
    });
  } catch (error) {
    console.error('分配条形码序号失败:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
