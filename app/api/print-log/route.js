import { db } from '@/db';
import { printLogs } from '@/db/schema';
import { NextResponse } from 'next/server';
import { and, desc, eq, gte, ilike, lt, or } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// 自动获取发起请求的电脑局域网 IP
function getClientIp(request) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '局域网未知设备'
  );
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { printType, contentSummary, status, printerName, copies } = body;
        // ✅ 新增：字段校验
    if (printType && (typeof printType !== 'string' || printType.length > 50)) {
      return NextResponse.json({ success: false, error: 'printType 不合法' }, { status: 400 });
    }
    const validStatuses = ['SUCCESS', 'FAILED', 'PENDING', 'CANCELLED'];
    if (status && !validStatuses.includes(String(status).toUpperCase())) {
      return NextResponse.json({ success: false, error: 'status 值不合法' }, { status: 400 });
    }
    if (copies != null && (!Number.isInteger(copies) || copies < 1 || copies > 9999)) {
      return NextResponse.json({ success: false, error: 'copies 需在1-9999之间' }, { status: 400 });
    }

    // contentSummary 支持对象，自动转成 JSON 字符串
    let summary = contentSummary;
    if (summary && typeof summary === 'object') {
      summary = { ...summary };
      if (printerName) summary.printerName = printerName;
      if (copies != null) summary.copies = copies;
      summary = JSON.stringify(summary);
    } else {
      summary = summary ? String(summary) : '';
      const extra = [
        printerName ? `打印机:${printerName}` : '',
        copies != null ? `数量:${copies}` : '',
      ]
        .filter(Boolean)
        .join(' | ');
      if (extra) summary = summary ? `${summary}（${extra}）` : extra;
    }

    const [newLog] = await db
      .insert(printLogs)
      .values({
        printType: printType || '标签打印',
        contentSummary: summary,
        ipAddress: getClientIp(request), // 自动存入电脑 IP
        status: (status || 'SUCCESS').toUpperCase(),
      })
      .returning();

    return NextResponse.json({ success: true, data: newLog });
  } catch (error) {
    console.error('打印日志写入失败:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  try {
    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10) || 20)
    );
    const printType = searchParams.get('printType') || '';
    const status = searchParams.get('status') || '';
    // const keyword = searchParams.get('keyword') || '';
    const keyword = (searchParams.get('keyword') || '').slice(0, 100); 
    const date = searchParams.get('date') || '';

    // 组装筛选条件
    const conditions = [];
    if (printType) conditions.push(eq(printLogs.printType, printType));
    if (status) conditions.push(eq(printLogs.status, status.toUpperCase()));
    if (keyword) {
      conditions.push(
        or(
          ilike(printLogs.contentSummary, `%${keyword}%`),
          ilike(printLogs.ipAddress, `%${keyword}%`)
        )
      );
    }
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      conditions.push(
        and(
          gte(printLogs.createdAt, new Date(`${date}T00:00:00`)),
          lt(printLogs.createdAt, new Date(`${date}T23:59:59.999`))
        )
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;

    const [logs, total, printTypes] = await Promise.all([
      db
        .select()
        .from(printLogs)
        .where(where)
        .orderBy(desc(printLogs.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.$count(printLogs, where),
      db
        .selectDistinct({ printType: printLogs.printType })
        .from(printLogs)
        .orderBy(printLogs.printType),
    ]);

    return NextResponse.json({
      success: true,
      data: logs,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      printTypes: printTypes.map((row) => row.printType),
    });
  } catch (error) {
    console.error('打印日志查询失败:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
