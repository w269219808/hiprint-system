'use client';

import { useState, useEffect } from 'react';

export default function HiprintButton({ templateData, printData, label = '静默打印' }) {
  const [hiprintObj, setHiprintObj] = useState(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // 动态引入 vue-plugin-hiprint
    import('vue-plugin-hiprint').then((module) => {
      console.log('✅ hiprint 模块加载成功');

      // 提取核心 hiprint 对象
      const targetHiprint = module.hiprint || module.default?.hiprint || window.hiprint || module.default || module;
      console.log('✅ 提取到的 hiprint 对象:', targetHiprint);

      // 初始化连接本地客户端 (WebSocket 端口号 17521)
      if (targetHiprint && targetHiprint.hiSocket) {
        targetHiprint.hiSocket.start({
          host: 'ws://127.0.0.1:17521',
        });
        console.log('🔗 正在连接 electron-hiprint 客户端...');
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
    if (!hiprintObj) {
      alert('打印模块未就绪');
      return;
    }

    if (!printData || printData.length === 0) {
      alert('没有可打印的数据');
      return;
    }

    try {
      // 构建 hiprint 模板对象
      const customTemplate = new hiprintObj.PrintTemplate({
        template: templateData,
      });

      // 调用本地客户端执行静默打印
      customTemplate.print2(printData, {
        printer: '', // 留空使用默认打印机
        title: '打印任务',
      });

      console.log('🚀 打印指令已发送！');
    } catch (error) {
      console.error('❌ 打印失败:', error);
      alert('打印失败，请查看控制台报错');
    }
  };

  // 🖨️ 新增：直接打印PDF文件的方法
  const handlePrintPDF = (pdfPath) => {
    if (!hiprintObj) {
      alert('打印模块未就绪');
      return;
    }

    if (!pdfPath) {
      alert('请提供PDF文件路径');
      return;
    }

    try {
      // 使用 print2 的 url_pdf 类型直接打印PDF
      hiprintObj.print2({
        type: 'url_pdf',
        pdf_path: pdfPath,
        printer: '', // 留空使用默认打印机
        title: 'PDF打印任务',
      });

      console.log('🚀 PDF打印指令已发送！');
    } catch (error) {
      console.error('❌ PDF打印失败:', error);
      alert('PDF打印失败，请查看控制台报错');
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={handlePrint}
        disabled={!isReady}
        className={`w-full py-3 rounded-lg text-white font-semibold text-lg transition-all ${
          isReady
            ? 'bg-blue-600 hover:bg-blue-700 shadow-md'
            : 'bg-gray-400 cursor-not-allowed'
        }`}
      >
        {isReady ? label : '⏳ 加载中...'}
      </button>

      {/* 可选：添加PDF打印按钮 */}
    </div>
  );
}