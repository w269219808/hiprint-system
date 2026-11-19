import { NextResponse } from 'next/server';
import { db } from '@/db';
import { codeMappings } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';

// 1. 获取所有映射字典（包含按分类查）
export async function GET(request) {
  try {
    const list = await db.select().from(codeMappings).orderBy(asc(codeMappings.category), asc(codeMappings.code));
    return NextResponse.json({ success: true, data: list });
  } catch (error) {
    return NextResponse.json({ success: false, message: '获取数据失败' }, { status: 500 });
  }
}

// 2. 新增一个映射规则
export async function POST(request) {
  try {
    const { category, name, code } = await request.json();

    if (!category || !name || !code) {
      return NextResponse.json({ success: false, message: '请完整填写分类、名称和编码' }, { status: 400 });
    }

    // 自动补齐为两位数（比如输入 "1" 自动变成 "01"）
    const formattedCode = String(code).trim().padStart(2, '0');
    if (formattedCode.length !== 2) {
      return NextResponse.json({ success: false, message: '编码必须为 2 位数字' }, { status: 400 });
    }

    await db.insert(codeMappings).values({
      category,
      name: name.trim(),
      code: formattedCode,
    });

    return NextResponse.json({ success: true, message: '添加成功' });
  } catch (error) {
    // 唯一性冲突报错提示
    if (error.code === '23505') {
      return NextResponse.json({ success: false, message: '该分类下的名称或 2 位编码已存在，不能重复' }, { status: 400 });
    }
    return NextResponse.json({ success: false, message: '保存失败' }, { status: 500 });
  }
}

// 3. 删除某一条配置
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ success: false, message: '缺少 ID' }, { status: 400 });

    await db.delete(codeMappings).where(eq(codeMappings.id, Number(id)));
    return NextResponse.json({ success: true, message: '删除成功' });
  } catch (error) {
    return NextResponse.json({ success: false, message: '删除失败' }, { status: 500 });
  }
}