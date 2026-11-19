import { NextResponse } from 'next/server';

export function proxy(request) {
  const path = request.nextUrl.pathname;

  // 1. 放行登录页、静态文件和 Next.js 内部资源
  if (
    path.startsWith('/login') ||
    path.startsWith('/_next') ||
    path.startsWith('/api/') || // 👈 关键：必须放行所有的 API 请求，否则前台组件拿不到数据！
    path.startsWith('/favicon.ico') ||
    path.includes('.') // 匹配带后缀的静态文件，如 .js, .css, .png 等
  ) {
    return NextResponse.next();
  }

  // 2. 检查其余所有页面和 API 的登录态 (print_session)
  const sessionCookie = request.cookies.get('print_session');
  
  if (!sessionCookie) {
    if (path.startsWith('/api/')) {
      return NextResponse.json({ success: false, message: '未登录，请先登录' }, { status: 401 });
    }
    // 如果是页面，未登录一律重定向到 /login
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    const session = JSON.parse(sessionCookie.value);

    // 🛡️ 严格拦截：如果路径包含 admin 或 designer，但角色不是 admin
    if ((path.includes('/admin') || path.includes('designer')) && session.role !== 'admin') {
      // 如果是 API 请求返回 403，如果是页面直接重定向回打印主页或提示
      if (path.startsWith('/api/')) {
        return NextResponse.json({ success: false, message: '权限不足，仅限管理员操作' }, { status: 403 });
      }
      // 普通用户访问后台页面，直接重定向回前台打印主页（例如根路径 /）
      return NextResponse.redirect(new URL('/', request.url));
    }
  } catch {
    if (path.startsWith('/api/')) {
      return NextResponse.json({ success: false, message: '登录态失效' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

// 3. 扩大拦截 matcher，覆盖整站页面与核心 API
export const config = {
  matcher: [
    '/((?!api/auth|_next/static|_next/image|favicon.ico).*)',
  ],
};