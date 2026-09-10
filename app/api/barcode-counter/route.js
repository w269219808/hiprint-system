import { db } from '@/db';
import { barcodeCounters } from '@/db/schema';
import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// 获取当天日期前缀 YYYYMMDD
function getTodayPrefix() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

// GET：查询当天已打印数量
export async function GET(request) {
  try {
    const { searchParams } = request.nextUrl;
    const datePrefix = searchParams.get('date') || getTodayPrefix();

    const [row] = await db
      .select()
      .from(barcodeCounters)
      .where(eq(barcodeCounters.datePrefix, datePrefix))
      .limit(1);

    const count = row ? row.count : 0;

    return NextResponse.json({
      success: true,
      datePrefix,
      count,
      next: `${datePrefix}${count}`,
    });
  } catch (error) {
    console.error('查询条形码计数器失败:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST：分配 count 条条形码序号（原子操作，防并发冲突）
export async function POST(request) {
  try {
    const body = await request.json();
    const count = Math.max(1, Math.min(9999, parseInt(body.count, 10) || 1));
    const datePrefix = body.date || getTodayPrefix();

    // 原子操作：INSERT ... ON CONFLICT DO UPDATE ... RETURNING
    // 即使多台电脑同时请求，PostgreSQL 保证 count = count + N 是原子的
    // 不会重复、不会跳号
    const result = await db.execute(sql`
      INSERT INTO barcode_counters (date_prefix, count)
      VALUES (${datePrefix}, ${count})
      ON CONFLICT (date_prefix) DO UPDATE 
      SET count = barcode_counters.count + ${count}, updated_at = now()
      RETURNING (barcode_counters.count - ${count}) as start_count
    `);

    const start = result[0].start_count;

    // 生成条形码列表
    const codes = Array.from(
      { length: count },
      (_, i) => `${datePrefix}${start + i}`
    );

    return NextResponse.json({
      success: true,
      prefix: datePrefix,
      start,
      codes,
      next: `${datePrefix}${start + count}`,
    });
  } catch (error) {
    console.error('分配条形码序号失败:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
