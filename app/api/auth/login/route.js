import { NextResponse } from 'next/server';
import { db } from '@/db'; // 指向你的数据库实例
import { users } from '@/db/schema'; // 刚才加的用户表
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

export async function POST(request) {
  try {
    const { username, password } = await request.json();
    
    // 1. 查用户
    const [user] = await db.select().from(users).where(eq(users.username, username));
    if (!user) {
      return NextResponse.json({ success: false, message: '用户不存在' }, { status: 400 });
    }

    // 2. 校验密码
    const isPasswordValid = bcrypt.compareSync(password, user.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json({ success: false, message: '密码错误' }, { status: 400 });
    }

    // 3. 登录成功，种下 Cookie（有效期 7 天）
    const response = NextResponse.json({ success: true, role: user.role });
    response.cookies.set({
      name: 'print_session',
      value: JSON.stringify({ userId: user.id, role: user.role ,username: user.username}),
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === 'true', // 不设就是 false，http 能用
      sameSite: 'lax',                               // 建议从 strict 改成 lax
      maxAge: 60 * 60 * 24 * 7, 
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 });
  }
}