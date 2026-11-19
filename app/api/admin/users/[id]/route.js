import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

// 删除用户 (DELETE)
export async function DELETE(request, { params }) {
  try {
    // 💡 关键修复：在 Next.js 新版本中，params 是一个 Promise，必须先 await！
    const resolvedParams = await params;
    const { id } = resolvedParams;
    const userId = parseInt(id, 10);

    if (isNaN(userId)) {
      return NextResponse.json({ success: false, message: '无效的用户ID' }, { status: 400 });
    }

    // 防止把管理员删掉
    const targetUser = await db.select().from(users).where(eq(users.id, userId));
    if (targetUser.length > 0 && targetUser[0].username === 'admin') {
      return NextResponse.json({ success: false, message: '不能删除默认的超级管理员账号' }, { status: 400 });
    }

    // 执行删除
    await db.delete(users).where(eq(users.id, userId));

    return NextResponse.json({ success: true, message: '用户已成功删除' });
  } catch (error) {
    console.error('删除用户报错:', error);
    return NextResponse.json({ success: false, message: '删除失败: ' + error.message }, { status: 500 });
  }
}