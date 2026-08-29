import { db } from '@/db';
import { printLogs } from '@/db/schema';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    const { printType, contentSummary, status } = body;

    // 自动获取发起请求的电脑局域网 IP
    const clientIp = 
      request.headers.get('x-forwarded-for')?.split(',')[0] || 
      request.headers.get('x-real-ip') || 
      '局域网未知设备';

    const [newLog] = await db.insert(printLogs).values({
      printType: printType || '小印标签',
      contentSummary: typeof contentSummary === 'object' ? JSON.stringify(contentSummary) : contentSummary,
      ipAddress: clientIp, // 自动存入电脑 IP
      status: status || 'SUCCESS',
    }).returning();

    return NextResponse.json({ success: true, data: newLog });
  } catch (error) {
    console.error('打印日志写入失败:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}