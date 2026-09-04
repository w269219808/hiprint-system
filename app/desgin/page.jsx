'use client';

import React, { useState } from 'react';
import HiprintDesigner from '@/HiprintDesigner';
import templatesData from '@/data/labelTemplate.json';// 引入你的标签模板 JSON
import Link from 'next/link';





export default function LabelDesignPage() {
  const [currentTemplate, setCurrentTemplate] = useState(templatesData);

  // 保存最新 JSON 的回调
  const handleSaveTemplate = (newJson) => {
    console.log('拿到最新的模板 JSON:', newJson);
    alert('导出成功，请在控制台复制新的 JSON 代码更新到配置文件！');
  };

  return (
    <main>
      <div className="p-2">
        <HiprintDesigner
          templateData={currentTemplate}
          onSave={handleSaveTemplate}
        />
      </div>
            <div className="flex justify-center pb-2">
        <Link
          href="/"
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          📋 首页
        </Link>
      </div>
    </main>
  );
}