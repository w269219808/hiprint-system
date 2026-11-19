import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { asc, eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';   // 👈 补这行


// 1. 获取所有用户列表 (GET)
export async function GET(request) {
  try {
    const list = await db.select({
      id: users.id,
      username: users.username,
      role: users.role,
      createdAt: users.createdAt,
    }).from(users).orderBy(asc(users.id));

    return NextResponse.json({ success: true, data: list });
  } catch (error) {
    console.error('获取用户列表报错:', error);
    return NextResponse.json({ success: false, message: '获取用户列表失败: ' + error.message }, { status: 500 });
  }
}

// 2. 创建新用户 (POST)
export async function POST(request) {
  try {
    const body = await request.json();
    console.log('【后端收到创建用户数据】:', body); // 可以在终端观察

    const username = body.username;
    const password = body.password || '123456'; // 强制给个保底密码，防止未定义
    const role = body.role || 'operator';

    if (!username) {
      return NextResponse.json({ success: false, message: '用户名不能为空' }, { status: 400 });
    }

    // 检查用户名是否已存在
    const existing = await db.select().from(users).where(eq(users.username, username.trim()));
    if (existing.length > 0) {
      return NextResponse.json({ success: false, message: '该用户名已存在' }, { status: 400 });
    }

    const rawPassword = String(password).trim();
    const hash = bcrypt.hashSync(rawPassword, 10);   // 或 await bcrypt.hash(rawPassword, 10)


    // 🛡️ 强制写入数据库
    await db.insert(users).values({
      username: username.trim(),
      passwordHash: hash,   // ✅ 存哈希
      role: role,
    });

    return NextResponse.json({ success: true, message: '用户创建成功' });
  } catch (error) {
    console.error('创建用户报错详情:', error);
    return NextResponse.json({ success: false, message: '创建用户失败: ' + error.message }, { status: 500 });
  }
}