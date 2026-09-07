'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import HiprintButton from '@/components/HiprintButton';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  // 加载模板列表
  const loadTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/templates');
      const result = await res.json();
      if (result.success) {
        setTemplates(result.data);
      }
    } catch (error) {
      alert('加载失败：' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  // 删除模板
  const deleteTemplate = async (id, name) => {
    if (!confirm(`删除 "${name}" ？`)) return;
    
    try {
      const res = await fetch(`/api/templates?id=${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        alert('删除成功！');
        loadTemplates();
      }
    } catch (error) {
      alert('删除失败：' + error.message);
    }
  };

  return (
    <div className="p-4 max-w-6xl mx-auto">
      {/* 标题 */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">📋 模板列表</h1>
        <Link
          href="/desgin"
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          ✨ 新建模板
        </Link>
      </div>

      {/* 加载中 */}
      {loading && (
        <div className="text-center py-8">加载中...</div>
      )}

      {/* 没有模板 */}
      {!loading && templates.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded">
          <p className="text-gray-500">还没有模板，去创建一个吧！</p>
          <Link
            href="/desgin"
            className="mt-4 inline-block px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            创建模板 →
          </Link>
        </div>
      )}

      {/* 模板列表 */}
      {!loading && templates.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <div key={template.id} className="border rounded p-4 hover:shadow">
              <h3 className="font-semibold text-lg">{template.name}</h3>
              <p className="text-xs text-gray-400 mt-1">
                {new Date(template.createdAt).toLocaleString()}
              </p>
              
              <div className="flex gap-2 mt-3">
                {/* 打印当前自定义模板：空数据 [{}] 适合纯静态模板 */}
                <HiprintButton
                  templateData={template.data}
                  printData={[{}]}
                  buttonText="🖨️ 打印"
                  labelType={template.name || '自定义模板'}
                />
                
                <Link
                  href={`/desgin?id=${template.id}`}
                  className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                >
                  ✏️ 编辑
                </Link>
                
                <button
                  onClick={() => deleteTemplate(template.id, template.name)}
                  className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                >
                  🗑️ 删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 底部 */}
      <div className="text-center mt-6">
        <Link href="/" className="text-sm text-blue-600 hover:text-blue-800">
          🏠 首页
        </Link>
      </div>
    </div>
  );
}
