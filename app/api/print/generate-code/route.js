import { NextResponse } from 'next/server';
import { db } from '@/db'; 
import { traceCodes, barcodeCounters } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm'; // 👈 引入 and

export async function POST(request) {
  try {
    const body = await request.json();
    // 🔑 1. 接收前端传过来的标签类型（默认为 trace），用来区分产品标签还是追溯码标签
    const { modelCode, capacityCode, colorCode, customerCode, printedBy, count = 1, labelType = 'trace' } = body;
    console.log('🔥 收到前端的打印请求，参数:', body);

    // 🔑 1. 根据标签类型进行不同的必填项校验
    if (labelType === 'trace') {
      // 追溯码依然要求全套参数
      if (!modelCode || !capacityCode || !colorCode || !customerCode) {
        return NextResponse.json({ success: false, message: '缺少必要的编码参数' }, { status: 400 });
      }
    } else {
      // 产品标签（product）或其它标签，只需要基础型号、容量、颜色即可，不需要 customerCode
      if (!modelCode) {
        return NextResponse.json({ success: false, message: '缺少必要的型号参数' }, { status: 400 });
      }
    }

    // 限制单次批量生成的最大数量，防止恶意请求
    const batchCount = Math.min(Math.max(1, Number(count) || 1), 100);

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const datePrefix = `${year}${month}${day}`; 
    const shortDate = `${String(year).slice(-2)}${month}${day}`; 

    // 2. 使用 Drizzle 事务 + 数据库原子锁
    const generatedResults = await db.transaction(async (tx) => {
      // 🔑 1. 使用原生 sql 精准查询当前日期 + 当前标签类型的计数器
      let existing = await tx.select().from(barcodeCounters).where(
        sql`${barcodeCounters.datePrefix} = ${datePrefix} AND ${barcodeCounters.labelType} = ${labelType}`
      );
      console.log(`👀 数据库里查到的当天 [${labelType}] 计数器记录:`, existing);

      let startCount = 1;

      if (existing.length > 0) {
        startCount = existing[0].count + 1;
        console.log(`📈 [${labelType}] 计数器累加，新的起始号:`, startCount);
        
        // 🔑 2. 使用原生 sql 原子更新
        await tx.update(barcodeCounters)
          .set({ 
            count: sql`${barcodeCounters.count} + ${batchCount}`, 
            updatedAt: new Date() 
          })
          .where(
            sql`${barcodeCounters.datePrefix} = ${datePrefix} AND ${barcodeCounters.labelType} = ${labelType}`
          );
      } else {
        console.log(`🌱 [${labelType}] 当天第一次生成，初始化计数器`);
        // 🔑 3. 插入时带上 labelType
        await tx.insert(barcodeCounters).values({
          datePrefix,
          labelType,
          count: batchCount,
        });
        startCount = 1;
      }

      // 后续的生成追溯码逻辑保持不变...
      const batchCodes = [];
      const insertValues = [];

      for (let i = 0; i < batchCount; i++) {
        const currentCount = startCount + i;
        const counterStr = String(currentCount).padStart(3, '0');
        const fullTraceCode = `${modelCode}${colorCode}${capacityCode}${customerCode}${shortDate}${counterStr}`;

        batchCodes.push({
          traceCode: fullTraceCode,
          counter: currentCount,
        });

        insertValues.push({
          code: fullTraceCode,
          model: modelCode,
          capacity: capacityCode,
          color: colorCode,
          customer: customerCode,
          counter: currentCount,
          datePrefix,
          printedBy: printedBy || 'operator',
        });
      }
      if (labelType === 'trace') {
        await tx.insert(traceCodes).values(insertValues);
      } else {
        console.log(`📦 当前为 [${labelType}] 标签，跳过写入 trace_codes 追溯码主表`);
      }

      return batchCodes;
    });

    return NextResponse.json({
      success: true,
      data: {
        codes: generatedResults, 
        traceCode: generatedResults[0]?.traceCode, 
      },
      message: `成功生成 ${batchCount} 个追溯码`,
    });

  } catch (error) {
    console.error('批量生成追溯码报错:', error);
    if (error.code === '23505') {
      return NextResponse.json({ success: false, message: '生成追溯码唯一键冲突，请重试' }, { status: 500 });
    }
    return NextResponse.json({ success: false, message: '服务器内部错误: ' + error.message }, { status: 500 });
  }
}