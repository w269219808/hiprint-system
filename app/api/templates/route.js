import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const TEMPLATES_DIR = path.join(process.cwd(), 'data', 'custom_templates');

async function ensureDir() {
  try {
    await fs.access(TEMPLATES_DIR);
  } catch {
    await fs.mkdir(TEMPLATES_DIR, { recursive: true });
  }
}

// ===== GET：获取所有模板 或 单个模板 =====
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  
  await ensureDir();
    let files = [];
    try {
      files = await fs.readdir(TEMPLATES_DIR);
    } catch (err) {
      files = [];
    }
  const templates = [];
  
  for (const file of files) {
    if (file.endsWith('.json')) {
      const content = await fs.readFile(path.join(TEMPLATES_DIR, file), 'utf-8');
      templates.push(JSON.parse(content));
    }
  }
  
  if (id) {
    const template = templates.find(t => t.id === id);
    if (!template) {
      return NextResponse.json({ success: false, error: '模板不存在' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: template });
  }
  return NextResponse.json({ success: true, data: templates });
}

// ===== POST：保存模板 =====
export async function POST(request) {
  const body = await request.json();
  const { name, data, id } = body;
  
  if (!name || !data) {
    return NextResponse.json({ success: false, error: '名称和数据不能为空' });
  }

  if (typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 100) {
    return NextResponse.json({ success: false, error: '名称长度需在1-100之间' }, { status: 400 });
  }

  if (typeof data !== 'object' || data === null) {
    return NextResponse.json({ success: false, error: 'data 必须是有效的模板数据' }, { status: 400 });
  }
  
  await ensureDir();

  const now = new Date().toISOString();
  let template;

  // 带 id 表示更新已有模板；不带 id 表示新建模板
  if (id) {
    if (!/^\d+$/.test(String(id))) {
      return NextResponse.json({ success: false, error: '模板ID不合法' });
    }

    const filePath = path.join(TEMPLATES_DIR, `${id}.json`);
    try {
      const existing = JSON.parse(await fs.readFile(filePath, 'utf-8'));
      template = {
        ...existing,
        id: String(id),
        name: name.trim(),
        data,
        updatedAt: now,
      };
      if (!template.createdAt) template.createdAt = now;
    } catch {
      return NextResponse.json(
        { success: false, error: '要更新的模板不存在' },
        { status: 404 }
      );
    }
  } else {
    template = {
      id: Date.now().toString(),
      name: name.trim(),
      data,
      createdAt: now,
      updatedAt: now
    };
  }
  
  await fs.writeFile(
    path.join(TEMPLATES_DIR, `${template.id}.json`),
    JSON.stringify(template, null, 2)
  );
  
  return NextResponse.json({ success: true, data: template });
}


export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ success: false, error: '缺少ID' });
  }

  // ✅ 新增：只允许纯数字 ID，防止路径穿越
  if (!/^\d+$/.test(String(id))) {
    return NextResponse.json({ success: false, error: '模板ID不合法' }, { status: 400 });
  }

  const filePath = path.join(TEMPLATES_DIR, `${id}.json`);

  // ✅ 新增：二次校验，确保解析后的路径仍在模板目录内
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(TEMPLATES_DIR)) {
    return NextResponse.json({ success: false, error: '非法路径' }, { status: 403 });
  }

  try {
    await fs.unlink(filePath);
  } catch {
    return NextResponse.json({ success: false, error: '模板不存在' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}