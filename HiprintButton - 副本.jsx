'use client';

import { useState, useEffect } from 'react';

export default function HiprintButton({ templateData, printData }) {
  console.log('🔵 1. 组件函数被调用了');
  const [hiprintObj, setHiprintObj] = useState(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // 1. 自动注入 hiprint 必需的 print-lock.css 样式文件（解决 Next.js 报错）
    if (!document.querySelector('link[media="print"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.media = 'print';
      link.href = 'https://unpkg.com/vue-plugin-hiprint/dist/print-lock.css';
      document.head.appendChild(link);
    }

    // 2. 动态加载 vue-plugin-hiprint
    import('vue-plugin-hiprint').then((module) => {
      console.log('✅ 完整 module 对象:', module);

      const targetHiprint = module.hiprint || module.default?.hiprint || window.hiprint || module.default || module;

      // 3. 连接本地客户端 (WebSocket 端口 17521)
      if (targetHiprint && targetHiprint.hiSocket) {
        targetHiprint.hiSocket.start({
          host: 'ws://127.0.0.1:17521',
        });
      }

      setHiprintObj(targetHiprint);
      setIsReady(true);
    }).catch((err) => {
      console.error('❌ hiprint 加载失败:', err);
    });
  }, []);

  const handlePrint = () => {
    if (!hiprintObj) return alert('打印模块未就绪');

    try {
      const customTemplate = new hiprintObj.PrintTemplate({
        template: templateData,
      });

      const printData = [{ name: '全实木多层板', sku: 'WOOD-2026-001' }];

      customTemplate.print2(printData, {
        printer: '',
        title: '开源打印任务',
      });

      console.log('🚀 打印指令已发送！');
    } catch (error) {
      console.error('❌ 构建打印模板或发送任务失败:', error);
      alert('打印失败，请查看控制台报错');
    }
  };

  return (
    <button
      onClick={handlePrint}
      disabled={!isReady}
      className={`px-5 py-2.5 rounded-lg text-white font-medium transition-all ${
        isReady
          ? 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer shadow-md'
          : 'bg-gray-400 cursor-not-allowed opacity-70'
      }`}
    >
      {isReady ? '点击静默打印标签 (开源方案)' : '正在连接开源打印服务...'}
    </button>
  );
}