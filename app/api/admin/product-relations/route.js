import { NextResponse } from 'next/server';
import { db } from '@/db';
import { productRelations } from '@/db/schema';
import { eq } from 'drizzle-orm';

// 1. 获取所有型号的绑定关系
export async function GET() {
  try {
    const list = await db.select().from(productRelations);
    return NextResponse.json({ success: true, data: list });
  } catch (error) {
    return NextResponse.json({ success: false, message: '获取映射关系失败' }, { status: 500 });
  }
}

// 2. 新增或更新某个型号的绑定关系 (Upsert)
export async function POST(request) {
  try {
    const { modelCode, capacityCodes = [], colorCodes = [] } = await request.json();

    if (!modelCode) {
      return NextResponse.json({ success: false, message: '缺少型号编码' }, { status: 400 });
    }

    const capacityStr = Array.isArray(capacityCodes) ? capacityCodes.join(',') : capacityCodes;
    const colorStr = Array.isArray(colorCodes) ? colorCodes.join(',') : colorCodes;

    // 检查是否已有配置
    const existing = await db.select().from(productRelations).where(eq(productRelations.modelCode, modelCode));

    if (existing.length > 0) {
      // 更新
      await db.update(productRelations)
        .set({
          capacityCodes: capacityStr,
          colorCodes: colorStr,
          updatedAt: new Date(),
        })
        .where(eq(productRelations.modelCode, modelCode));
    } else {
      // 插入
      await db.insert(productRelations).values({
        modelCode,
        capacityCodes: capacityStr,
        colorCodes: colorStr,
      });
    }

    return NextResponse.json({ success: true, message: '关系保存成功' });
  } catch (error) {
    console.error('保存绑定关系失败:', error);
    return NextResponse.json({ success: false, message: '保存失败: ' + error.message }, { status: 500 });
  }
}