'use client';

import React, { useState } from 'react';
import HiprintDesigner from '@/HiprintDesigner';
import templatesData from '@/data/templates.json'; // 引入你的标签模板 JSON





export default function LabelDesignPage() {
  const [currentTemplate, setCurrentTemplate] = useState(templatesData);

  // 保存最新 JSON 的回调
  const handleSaveTemplate = (newJson) => {
    console.log('拿到最新的模板 JSON:', newJson);
    alert('导出成功，请在控制台复制新的 JSON 代码更新到配置文件！');
  };

  return (
    <div className="p-6">
      <HiprintDesigner
        templateData={currentTemplate}
        onSave={handleSaveTemplate}
      />
    </div>
  );
}