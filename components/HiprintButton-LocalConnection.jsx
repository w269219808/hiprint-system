'use client';

import React, { useState, useEffect } from 'react';

export default function HiprintButton({
  templateData,
  printData,
  buttonText = "预览/导出标签",
  silent = false,
  printerName = '',
  onBeforePrint
}) {
  const [hiprintObj, setHiprintObj] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [printerList, setPrinterList] = useState([]);
  const [selectedPrinter, setSelectedPrinter] = useState('');
  const [isClientReady, setIsClientReady] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // ===== 1. 初始化 Hiprint =====
  useEffect(() => {
    import('vue-plugin-hiprint').then((module) => {
      const targetHiprint = module.hiprint || module.default?.hiprint || window.hiprint;

      if (targetHiprint) {
        try {
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

  // ===== 2. 获取打印机列表 =====
  useEffect(() => {
    if (!silent || !isReady || !hiprintObj) return;

    let retryCount = 0;
    const maxRetries = 5;
    let retryTimer = null;

    const fetchPrinters = () => {
      try {
        const template = new hiprintObj.PrintTemplate({ template: { panels: [] } });
        const list = template.getPrinterList();
        if (list && list.length > 0) {
          setPrinterList(list);
          setIsClientReady(true);
          setIsLoading(false);
          const defaultPrinter = list.find(p => p.isDefault);
          if (defaultPrinter) {
            setSelectedPrinter(defaultPrinter.name);
          } else if (printerName) {
            setSelectedPrinter(printerName);
          } else if (list.length > 0) {
            setSelectedPrinter(list[0].name);
          }
          console.log('🖨️ 打印机列表:', list);
          return true;
        } else {
          console.warn(`⚠️ 未获取到打印机列表 (尝试 ${retryCount + 1}/${maxRetries})`);
          return false;
        }
      } catch (error) {
        console.warn(`⚠️ 获取打印机列表失败 (尝试 ${retryCount + 1}/${maxRetries}):`, error.message);
        return false;
      }
    };

    const tryFetch = () => {
      setIsLoading(true);
      if (fetchPrinters()) {
        return;
      }

      retryCount++;
      if (retryCount < maxRetries) {
        retryTimer = setTimeout(tryFetch, 2000);
      } else {
        console.warn('⚠️ 获取打印机列表失败，已达到最大重试次数');
        setIsClientReady(false);
        setIsLoading(false);
      }
    };

    tryFetch();

    return () => {
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
    };
  }, [silent, isReady, hiprintObj, printerName]);

  // ===== 3. 获取预览 HTML =====
  const getPreviewHtml = (dataList, template) => {
    if (!hiprintObj || !template) return null;

    const holder = document.getElementById('hiprint-hidden-holder');
    if (!holder) return null;
    holder.innerHTML = '';

    const customTemplate = new hiprintObj.PrintTemplate({ template });
    customTemplate.design('#hiprint-hidden-holder');

    return new Promise((resolve) => {
      setTimeout(() => {
        // ===== 关键修复：如果模板已有多个 panel，只传 1 条数据 =====
        const hasMultiplePanels = template?.panels && template.panels.length > 1;
        const finalDataList = hasMultiplePanels ? [{}] : dataList;

        const $htmlElements = customTemplate.getHtml(finalDataList);
        let htmlContent = '';
        $htmlElements.each((index, element) => {
          htmlContent += element.outerHTML;
        });
        resolve(htmlContent);
      }, 100);
    });
  };

  // ===== 4. 普通预览 =====
  const handlePreview = async () => {
    if (!hiprintObj || !templateData || !printData) {
      return alert('打印组件未就绪或缺失模板/数据！');
    }

    let dataList = Array.isArray(printData) ? printData : [printData];
    let template = templateData;

    // ===== 打印前分配条形码序号 =====
    if (onBeforePrint) {
      const bundle = await onBeforePrint(false);
      if (bundle) {
        dataList = Array.isArray(bundle.printData) ? bundle.printData : [bundle.printData];
        template = bundle.template || templateData;
      }
    }

    try {
      const htmlContent = await getPreviewHtml(dataList, template);
      if (!htmlContent) return alert('生成预览失败！');

      const win = window.open('', '_blank');
      if (!win) return alert('打开预览失败，请允许浏览器弹出窗口！');

      win.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>标签打印预览</title>
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
              window.onload = function() {
                setTimeout(() => {
                  window.print();
                }, 300);
              };
            <\/script>
          </body>
        </html>
      `);

      win.document.close();
    } catch (error) {
      console.error('❌ 生成预览失败:', error);
      alert('生成打印预览失败，请查看浏览器开发者工具控制台。');
    }
  };

  // ===== 5. 静默打印 =====
  const handleSilentPrint = async () => {
    if (!hiprintObj || !templateData || !printData) {
      return alert('打印组件未就绪或缺失模板/数据！');
    }

    if (!isClientReady || printerList.length === 0) {
      return alert(
        '⚠️ 未检测到 electron-hiprint 客户端！\n\n' +
        '请确保：\n' +
        '1. electron-hiprint 客户端已启动\n' +
        '2. 客户端已安装并运行在 localhost:17521'
      );
    }

    const printer = selectedPrinter || printerName;
    if (!printer) {
      return alert('⚠️ 未选择打印机！请在列表中选择一台打印机。');
    }

    let dataList = Array.isArray(printData) ? printData : [printData];
    let template = templateData;

    // ===== 打印前分配条形码序号 =====
    if (onBeforePrint) {
      const bundle = await onBeforePrint(true);
      if (bundle) {
        dataList = Array.isArray(bundle.printData) ? bundle.printData : [bundle.printData];
        template = bundle.template || templateData;
      }
    }

    try {
      const customTemplate = new hiprintObj.PrintTemplate({ template });

      // ===== 关键修复：如果模板已有多个 panel，只传 1 条数据 =====
      const hasMultiplePanels = template?.panels && template.panels.length > 1;
      const finalDataList = hasMultiplePanels ? [{}] : dataList;

      console.log('🖨️ 静默打印参数:', {
        printer: printer,
        dataCount: finalDataList.length,
        hasMultiplePanels: hasMultiplePanels,
        panelCount: template?.panels?.length || 0
      });

      customTemplate.print2(finalDataList, {
        printer: printer,
        silent: true,
        copies: finalDataList.length
      });

      const totalLabels = hasMultiplePanels ? template.panels.length : dataList.length;
      alert(`✅ 打印任务已发送！共 ${totalLabels} 张标签`);
    } catch (error) {
      console.error('❌ 静默打印失败:', error);
      alert('静默打印失败：' + error.message);
    }
  };

  // ===== 6. 主入口 =====
  const handlePrint = () => {
    if (silent) {
      setShowConfirm(true);
    } else {
      handlePreview();
    }
  };

  // ===== 7. 刷新打印机列表 =====
  const refreshPrinterList = () => {
    if (!hiprintObj) return;
    try {
      const template = new hiprintObj.PrintTemplate({ template: { panels: [] } });
      const list = template.getPrinterList();
      if (list && list.length > 0) {
        setPrinterList(list);
        setIsClientReady(true);
        const defaultPrinter = list.find(p => p.isDefault);
        if (defaultPrinter) {
          setSelectedPrinter(defaultPrinter.name);
        }
        console.log('🔄 刷新打印机列表:', list);
      } else {
        alert('未获取到打印机列表，请确保 electron-hiprint 客户端已启动！');
      }
    } catch (error) {
      console.warn('刷新打印机列表失败:', error);
      alert('刷新失败：' + error.message);
    }
  };

  return (
    <>
      {/* 隐藏挂载节点 */}
      <div
        id="hiprint-hidden-holder"
        style={{ position: 'absolute', left: '-9999px', top: '-9999px', visibility: 'hidden' }}
      />

      {/* 静默打印模式：同一行 */}
      {silent ? (
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-xs text-gray-600 font-medium whitespace-nowrap">🖨️ 打印机:</label>
          <select
            value={selectedPrinter}
            onChange={(e) => setSelectedPrinter(e.target.value)}
            className="text-xs p-1.5 border border-gray-300 rounded-md bg-white min-w-[150px]"
            disabled={!isClientReady}
          >
            <option value="">请选择打印机</option>
            {printerList.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name} {p.isDefault ? '⭐' : ''}
              </option>
            ))}
          </select>
          <button
            onClick={refreshPrinterList}
            className="text-xs text-blue-600 hover:text-blue-800 underline whitespace-nowrap"
            disabled={!isReady || isLoading}
          >
            {isLoading ? '⏳ 连接中...' : '🔄 刷新'}
          </button>
          <span className={`text-xs ${isClientReady ? 'text-green-600' : 'text-red-500'} whitespace-nowrap`}>
            {isLoading ? '⏳ 正在连接...' :
             isClientReady ? '✅ 已连接' : '❌ 未连接'}
          </span>
          <button
            onClick={handlePrint}
            disabled={!isReady || !isClientReady}
            className={`px-4 py-2 rounded text-white text-sm font-medium transition-colors ${
              isReady && isClientReady
                ? 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
                : 'bg-gray-400 cursor-not-allowed'
            }`}
          >
            {!isReady ? '⏳ 加载中...' :
             isLoading ? '⏳ 连接中...' :
             !isClientReady ? '⚠️ 未连接' :
             buttonText}
          </button>
        </div>
      ) : (
        <button
          onClick={handlePrint}
          disabled={!isReady}
          className={`px-4 py-2 rounded text-white text-sm font-medium transition-colors ${
            isReady
              ? 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
              : 'bg-gray-400 cursor-not-allowed'
          }`}
        >
          {!isReady ? '⏳ 加载中...' : buttonText}
        </button>
      )}

      {/* 静默确认弹窗 */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-2">🖨️ 确认打印</h3>
            <p className="text-sm text-gray-600 mb-4">
              即将打印 <strong>{Array.isArray(printData) ? printData.length : 1}</strong> 张标签
              <br />
              打印机: <strong>{selectedPrinter || printerName || '未选择'}</strong>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowConfirm(false);
                  handleSilentPrint();
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                ✅ 确认打印
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
              >
                取消
              </button>
            </div>
            <button
              onClick={() => {
                setShowConfirm(false);
                handlePreview();
              }}
              className="mt-2 w-full text-xs text-blue-500 hover:text-blue-700 underline text-center"
            >
              👁️ 先预览再打印
            </button>
          </div>
        </div>
      )}
    </>
  );
}