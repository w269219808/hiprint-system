import { NextResponse } from 'next/server';
import { db } from '@/db';
import { codeMappings, traceCodes } from '@/db/schema';
import { desc, eq, like, and, or, inArray, sql } from 'drizzle-orm';

// GET: 搜索历史追溯码供补打
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const datePrefix = searchParams.get('datePrefix')?.trim() || ''; // 例如 20261110
    const keyword = searchParams.get('keyword')?.trim() || '';       // 模糊搜索追溯码或型号
    const page = Math.max(1, Number.parseInt(searchParams.get('page'), 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, Number.parseInt(searchParams.get('pageSize'), 10) || 20)
    );

    const conditions = [];

    if (datePrefix) {
      if (!/^\d{8}$/.test(datePrefix)) {
        return NextResponse.json(
          { success: false, message: '日期格式应为 YYYYMMDD' },
          { status: 400 }
        );
      }
      conditions.push(eq(traceCodes.datePrefix, datePrefix));
    }

    if (keyword) {
      const pattern = `%${keyword}%`;
      const keywordConditions = [like(traceCodes.code, pattern)];

      // 历史表保存的是两位编码，先把用户输入的型号/容量/颜色名称转换为编码。
      const matchedMappings = await db
        .select({
          category: codeMappings.category,
          code: codeMappings.code,
        })
        .from(codeMappings)
        .where(like(codeMappings.name, pattern));

      const codesByCategory = matchedMappings.reduce((result, item) => {
        if (!result[item.category]) result[item.category] = [];
        result[item.category].push(item.code);
        return result;
      }, {});

      if (codesByCategory.model?.length) {
        keywordConditions.push(inArray(traceCodes.model, codesByCategory.model));
      }
      if (codesByCategory.capacity?.length) {
        keywordConditions.push(inArray(traceCodes.capacity, codesByCategory.capacity));
      }
      if (codesByCategory.color?.length) {
        keywordConditions.push(inArray(traceCodes.color, codesByCategory.color));
      }
      if (codesByCategory.customer?.length) {
        keywordConditions.push(inArray(traceCodes.customer, codesByCategory.customer));
      }

      conditions.push(
        keywordConditions.length === 1 ? keywordConditions[0] : or(...keywordConditions)
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    let rowsQuery = db.select().from(traceCodes);
    let totalQuery = db
      .select({ total: sql`count(*)`.mapWith(Number) })
      .from(traceCodes);

    if (whereClause) {
      rowsQuery = rowsQuery.where(whereClause);
      totalQuery = totalQuery.where(whereClause);
    }

    const [rows, totalRows, mappings] = await Promise.all([
      rowsQuery
        .orderBy(desc(traceCodes.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      totalQuery,
      db
        .select({
          category: codeMappings.category,
          code: codeMappings.code,
          name: codeMappings.name,
        })
        .from(codeMappings),
    ]);

    const nameByCategoryAndCode = new Map(
      mappings.map((item) => [`${item.category}:${item.code}`, item.name])
    );

    // 表格展示名称，同时保留原始编码，便于核对历史记录。
    const list = rows.map((row) => ({
      ...row,
      modelCode: row.model,
      capacityCode: row.capacity,
      colorCode: row.color,
      customerCode: row.customer,
      model: nameByCategoryAndCode.get(`model:${row.model}`) || row.model,
      capacity: nameByCategoryAndCode.get(`capacity:${row.capacity}`) || row.capacity,
      color: nameByCategoryAndCode.get(`color:${row.color}`) || row.color,
      customer: nameByCategoryAndCode.get(`customer:${row.customer}`) || row.customer,
    }));

    return NextResponse.json({
      success: true,
      data: {
        list,
        total: totalRows[0]?.total || 0,
        page,
        pageSize,
      },
    });
  } catch (error) {
    console.error('查询历史追溯码失败:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
