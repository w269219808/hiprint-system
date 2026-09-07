'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import HiprintDesigner from '@/HiprintDesigner';
import templatesData from '@/data/labelTemplate.json';
import Link from 'next/link';

export default function LabelDesignPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateId = searchParams.get('id');

  const [currentTemplate, setCurrentTemplate] = useState(templatesData);
  const [templateName, setTemplateName] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [key, setKey] = useState(0);
  const designerRef = useRef(null);

  useEffect(() => {
    if (templateId) {
      loadTemplate(templateId);
    } else {
      setCurrentTemplate(templatesData);
      setTemplateName('');
      setKey(prev => prev + 1);
    }
  }, [templateId]);

  const loadTemplate = async (id) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/templates?id=${id}`);
      const result = await res.json();

      if (result.success && result.data) {
        const template = result.data;
        setCurrentTemplate(template.data);
        setTemplateName(template.name);
        setKey(prev => prev + 1);
      } else {
        alert('加载模板失败');
      }
    } catch (error) {
      alert('加载模板失败：' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async (newJson) => {
    if (!templateName.trim()) {
      alert('请先输入模板名称！');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: templateId || undefined,
          name: templateName.trim(),
          data: newJson
        })
      });

      const result = await response.json();
      if (result.success) {
        alert('✅ 保存成功！');
        router.push('/templates');
      } else {
        alert('保存失败：' + result.error);
      }
    } catch (error) {
      alert('保存失败：' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // 顶部“保存”按钮：保存画布当前内容，而不是页面初始的默认模板
  const handleSaveCurrentDesign = () => {
    const latestJson = designerRef.current?.getDesignJson?.();
    if (!latestJson) {
      alert('设计器尚未就绪，请等画布加载完成后再保存！');
      return;
    }
    handleSaveTemplate(latestJson);
  };

  if (loading) {
    return <div className="p-4 text-center">加载中...</div>;
  }

  return (
    <main>
      <div className="flex items-center gap-4 p-2 bg-gray-50 rounded mb-2">
        <span className="font-bold">✏️ 设计器</span>
        <input
          type="text"
          value={templateName}
          onChange={(e) => setTemplateName(e.target.value)}
          placeholder="输入模板名称..."
          className="border rounded px-3 py-1 text-sm flex-1 max-w-xs"
        />
        <button
          onClick={handleSaveCurrentDesign}
          disabled={saving}
          className="px-4 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {saving ? '保存中...' : '💾 保存'}
        </button>
        <Link href="/templates" className="px-4 py-1 bg-gray-500 text-white rounded hover:bg-gray-600">
          📋 列表
        </Link>
      </div>

      <div className="p-2">
        <HiprintDesigner
          ref={designerRef}
          key={key}
          templateData={currentTemplate}
          onSave={handleSaveTemplate}
        />
      </div>

      <div className="flex justify-center pb-2">
        <Link href="/" className="text-sm text-blue-600 hover:text-blue-800">📋 首页</Link>
      </div>
    </main>
  );
}
