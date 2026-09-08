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


export async function POST(request) {
  try {
    const configs = await request.json();

    // ✅ 新增：必须是数组
    if (!Array.isArray(configs)) {
      return NextResponse.json({ error: '参数必须是数组' }, { status: 400 });
    }

    // ✅ 新增：限制最大数量
    if (configs.length > 200) {
      return NextResponse.json({ error: '单次最多保存200条配置' }, { status: 400 });
    }

    await db.delete(printerConfigs);

    if (configs.length > 0) {
      const insertData = configs
        .filter(c => (c.paperSize || c.paper_size) && (c.printerName || c.printer_name))
        .map(c => ({
          paperSize: String(c.paperSize || c.paper_size).trim().slice(0, 50),   // ✅ 限制长度
          printerName: String(c.printerName || c.printer_name).trim().slice(0, 100), // ✅ 限制长度
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