'use client';

import React, { useState, useEffect } from 'react';

export default function HiprintButton({ templateData, printData, buttonText = "预览/导出标签" }) {
  const [hiprintObj, setHiprintObj] = useState(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // 动态引入 vue-plugin-hiprint，避免 Next.js SSR 报错
    import('vue-plugin-hiprint').then((module) => {
      const targetHiprint = module.hiprint || module.default?.hiprint || window.hiprint;

      if (targetHiprint) {
        try {
          // 初始化默认 provider，规避部分组件未初始化的报错
          const defaultProvider = function () {
            this.addElementTypes = function (context) {
              context.addPrintElementTypes('default', []);
            };
          };
          targetHiprint.init({
            providers: [new defaultProvider()]
          });
        } catch (e) {
          console.warn('hiprint init bypassed:', e);
        }

        setHiprintObj(targetHiprint);
        setIsReady(true);
      }
    });
  }, []);

  const handlePreviewPdf = () => {
    if (!hiprintObj || !templateData || !printData) {
      return alert('打印组件未就绪或缺失模板/数据！');
    }

    // 格式化传入的数据，统一转为数组格式
    const dataList = Array.isArray(printData) ? printData : [printData];

    try {
      // 1. 获取后台隐形计算容器
      const holder = document.getElementById('hiprint-hidden-holder');
      if (!holder) return alert('未找到打印挂载容器！');
      holder.innerHTML = ''; // 清空上一轮残留内容

      // 2. 实例化模板并强制挂载到隐藏画布，让底层计算出绝对定位和真实的元素宽高
      const customTemplate = new hiprintObj.PrintTemplate({ template: templateData });
      customTemplate.design('#hiprint-hidden-holder');

      // 3. 延迟 100ms 确保 DOM 坐标与计算全部完成后提取标准 HTML
      setTimeout(() => {
        const $htmlElements = customTemplate.getHtml(dataList);
        let htmlContent = '';

        $htmlElements.each((index, element) => {
          htmlContent += element.outerHTML;
        });

        // 4. 打开弹窗进行打印预览
        const win = window.open('', '_blank');
        if (!win) return alert('打开预览失败，请允许浏览器弹出窗口！');

        win.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8" />
              <title>标签打印预览</title>
              <!-- 引入 public 目录下的 print-lock.css -->
              <link rel="stylesheet" type="text/css" href="/print-lock.css" />
              <style>
                body {
                  background-color: #525659;
                  margin: 0;
                  padding: 20px;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                }
                .hiprint-printPaper {
                  background: #ffffff !important;
                  margin-bottom: 20px !important;
                  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                }
                /* 真实调用打印机时的样式适配 */
                @media print {
                  body {
                    background: none !important;
                    padding: 0 !important;
                    display: block !important;
                  }
                  .hiprint-printPaper {
                    box-shadow: none !important;
                    margin: 0 !important;
                  }
                }
              </style>
            </head>
            <body>
              ${htmlContent}
              <script>
                // 确保图片/二维码加载完成后自动调起打印面板
                window.onload = function() {
                  setTimeout(() => {
                    window.print();
                  }, 300);
                };
              </script>
            </body>
          </html>
        `);

        win.document.close();
      }, 100);
    } catch (error) {
      console.error('❌ 生成预览失败:', error);
      alert('生成打印预览失败，请查看浏览器开发者工具控制台。');
    }
  };

  return (
    <>
      {/* 隐藏的挂载节点：专门用于 hiprint 隐形计算坐标和元素排版 */}
      <div
        id="hiprint-hidden-holder"
        style={{ position: 'absolute', left: '-9999px', top: '-9999px', visibility: 'hidden' }}
      />

      <button
        onClick={handlePreviewPdf}
        disabled={!isReady}
        className={`px-4 py-2 rounded text-white text-sm font-medium transition-colors ${
          isReady
            ? 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
            : 'bg-gray-400 cursor-not-allowed'
        }`}
      >
        {isReady ? buttonText : "打印组件加载中..."}
      </button>
    </>
  );
}