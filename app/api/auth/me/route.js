import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const sessionCookie = request.cookies.get('print_session');
    if (!sessionCookie) {
      return NextResponse.json({ success: false, message: '未登录' }, { status: 401 });
    }

    const sessionData = JSON.parse(decodeURIComponent(sessionCookie.value));    
    const username = sessionData.username || sessionData.account || (sessionData.role === 'admin' ? '管理员' : `用户${sessionData.userId}`);

    return NextResponse.json({
      success: true,
      data: {
        ...sessionData,
        username,
      },
    });
  } catch (err) {
    return NextResponse.json({ success: false, message: '解析登录态失败' }, { status: 401 });
  }
}