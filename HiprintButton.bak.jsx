'use client';

import { useState, useEffect } from 'react';

export default function HiprintButton({ templateData }) {
  console.log('🔵 1. 组件函数被调用了');
  const [hiprintObj, setHiprintObj] = useState(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // 1. 动态引入 vue-plugin-hiprint
    import('vue-plugin-hiprint').then((module) => {
      console.log('✅ 完整 module 对象:', module);

      // 提取核心 hiprint 对象 (兼容多种导出格式)
      const targetHiprint = module.hiprint || module.default?.hiprint || window.hiprint || module.default || module;
      console.log('✅ 提取到的 hiprint 对象:', targetHiprint);

      // 2. 初始化连接本地客户端 (WebSocket 端口号 17521)
      if (targetHiprint && targetHiprint.hiSocket) {
        targetHiprint.hiSocket.start({
          host: 'ws://127.0.0.1:17521',
        });
      } else {
        console.warn('⚠️ 未检测到 hiSocket，请检查 electron-hiprint 是否运行');
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
      // 3. 构建 hiprint 模板对象 (使用正确提取的对象)
      const customTemplate = new hiprintObj.PrintTemplate({
        template: templateData,
      });

      // 4. 打印数据填充
      const printData = [{ name: '全实木多层板', sku: 'WOOD-2026-001' }];

      // 5. 调用本地客户端执行静默打印
      customTemplate.print2(printData, {
        printer: '', // 留空使用默认打印机
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