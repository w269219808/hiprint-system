import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true, message: '已退出登录' });
  
  // 通过后端响应头强制抹除 HttpOnly Cookie
  response.cookies.set('print_session', '', {
    httpOnly: true,
    expires: new Date(0), // 立即过期
    path: '/',
  });

  return response;
}