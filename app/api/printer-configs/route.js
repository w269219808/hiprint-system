import { NextResponse } from 'next/server';
import { db } from '@/db';
import { printerConfigs } from '@/db/schema';


// GET - 获取所有配置
export async function GET() {
  try {
    const results = await db.select().from(printerConfigs).orderBy(printerConfigs.paperSize);
    return NextResponse.json(results);
  } catch (error) {
    console.error('获取打印机配置失败:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - 保存/更新配置
export async function POST(request) {
  try {
    const configs = await request.json();

    await db.delete(printerConfigs);

    if (configs.length > 0) {
      // ✅ 兼容两种字段名：驼峰 或 下划线
      const insertData = configs
        .filter(c => (c.paperSize || c.paper_size) && (c.printerName || c.printer_name))
        .map(c => ({
          paperSize: c.paperSize || c.paper_size,
          printerName: c.printerName || c.printer_name,
        }));
      
      if (insertData.length > 0) {
        await db.insert(printerConfigs).values(insertData);
      }
    }

    return NextResponse.json({ success: true, message: '配置保存成功' });
  } catch (error) {
    console.error('保存打印机配置失败:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}