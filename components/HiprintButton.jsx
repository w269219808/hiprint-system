'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import PrinterConfigModal from './PrinterConfigModal';

// ===== 中转服务地址 =====
const TRANSIT_HOST = process.env.NEXT_PUBLIC_TRANSIT_HOST || 'http://192.168.110.107:17521';


export default function HiprintButton({
  templateData,
  printData,
  buttonText = '预览/导出标签',
  silent = false,
  printerName = '',
  onBeforePrint,
  labelType = '标签',
}) {
  const [hiprintObj, setHiprintObj] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [printerList, setPrinterList] = useState([]);
  const [selectedPrinter, setSelectedPrinter] = useState('');
  const [isClientReady, setIsClientReady] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // 默认开启 TSPL 模式（适用于佳博等热敏机）
  const [useTSPL, setUseTSPL] = useState(true);   // ✅ 修复：与注释一致

  const [showConfigModal, setShowConfigModal] = useState(false);
  const [printerConfigs, setPrinterConfigs] = useState({});
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);

  // ✅ 用户是否手动选择过打印机（避免自动匹配覆盖用户选择）
  const userSelectedRef = useRef(false);
  // ✅ 刷新按钮的兜底定时器
  const refreshTimerRef = useRef(null);

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  // ===== 3. 加载配置 =====
  useEffect(() => {
    const loadConfigs = async () => {
      try {
        const res = await fetch('/api/printer-configs');
        const data = await res.json();
        const configMap = {};
        data.forEach(item => {
          const key = item.paperSize || item.paper_size;
          const value = item.printerName || item.printer_name;
          if (key && value) {
            configMap[key] = value;
          }
        });
        setPrinterConfigs(configMap);
        setIsConfigLoaded(true);
        console.log('📋 加载打印机配置:', configMap);
      } catch (error) {
        console.warn('加载打印机配置失败:', error);
        setIsConfigLoaded(true);
      }
    };

    loadConfigs();
  }, []);


  // ✅ 自动匹配：仅当用户未手动选择时执行，避免覆盖用户选择
  useEffect(() => {
    if (!isConfigLoaded) return;
    if (!templateData) return;
    if (printerList.length === 0) return;
    if (userSelectedRef.current) return;   // 🛡️ 用户已手动选择 → 不再覆盖

    const panel = templateData?.panels?.[0] || {};
    const sizeKey = `${panel.width}x${panel.height}`;
    const matchedPrinter = printerConfigs[sizeKey];

    console.log('🔍 自动匹配检查:', { sizeKey, matchedPrinter });

    if (matchedPrinter) {
      const exists = printerList.some(p => p.name === matchedPrinter);
      if (exists && selectedPrinter !== matchedPrinter) {
        setSelectedPrinter(matchedPrinter);
        console.log(`✅ 自动匹配: ${sizeKey} → ${matchedPrinter}`);
      }
    }
  }, [isConfigLoaded, templateData, printerList, printerConfigs, selectedPrinter]);


  // ===== 4. 保存配置 =====
  const handleSaveConfigs = async (configs) => {
    try {
      const payload = Object.entries(configs).map(([paperSize, printerName]) => ({
        paperSize,
        printerName,
      }));

      await fetch('/api/printer-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      setPrinterConfigs(configs);
      alert('✅ 配置保存成功！');
    } catch (error) {
      alert('❌ 保存失败：' + error.message);
    }
  };

  // ===== 获取模板纸张尺寸 =====
  const getPaperSize = (template) => {
    const panel = template?.panels?.[0] || {};
    if (!panel.width || !panel.height) {
      console.warn('⚠️ 模板缺少纸张尺寸，使用默认 60x30mm');
    }
    return {
      width: panel.width || 60,
      height: panel.height || 30,
    };
  };

  // ===== 构建日志摘要 =====
  const buildLogSummary = (dataList) => {
    const list = Array.isArray(dataList) ? dataList : dataList ? [dataList] : [];
    const first = list[0] || {};
    const barcodes = [
      ...new Set(
        list
          .map((d) => d.barcode || d.labelText || d.sequence)
          .filter(Boolean)
      ),
    ];
    return {
      copies: list.length,
      model: first.model,
      color: first.color,
      capacity: first.capacity,
      lang: first.lang,
      customerCode: first.customerCode,
      productCode: first.productCode,
      barcodes: barcodes.length > 6 ? [barcodes[0], barcodes[barcodes.length - 1]] : barcodes,
    };
  };

  // ===== 上报打印日志 =====
  const sendPrintLog = async ({ dataList, status = 'SUCCESS', mode = '打印', errorMessage }) => {
    try {
      const summary = buildLogSummary(dataList);
      if (errorMessage) summary.error = errorMessage;
      await fetch('/api/print-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          printType: `${labelType} ${mode}`,
          contentSummary: summary,
          printerName: selectedPrinter || printerName || '',
          copies: summary.copies,
          status,
        }),
      });
    } catch (error) {
      console.error('写入打印日志失败:', error);
    }
  };

  // ===== 1. 初始化 Hiprint =====
  useEffect(() => {
    let isMounted = true;
    let socketRef = null;
    const handlers = {};

    import('vue-plugin-hiprint').then((module) => {
      if (!isMounted) return;

      const targetHiprint = module.hiprint || module.default?.hiprint || window.hiprint;
      if (!targetHiprint) return;

      try {
        const defaultProvider = function () {
          this.addElementTypes = function (context) {
            context.addPrintElementTypes('default', []);
          };
        };

        targetHiprint.init({
          host: TRANSIT_HOST,
          token: 'hiprint',
          providers: [new defaultProvider()],
        });
        console.log('✅ Hiprint 已连接到中转服务:', TRANSIT_HOST);

        const socket = targetHiprint.hiwebSocket?.socket;
        if (socket) {
          socketRef = socket;

          if (!socket.connected) {
            console.log('🔄 WebSocket 未连接，手动连接...');
            socket.connect();
          }

          handlers.connect = () => {
            if (!isMounted) return;
            console.log('✅ WebSocket 已连接');
            setIsLoading(true);
            socket.emit('getClients');
          };

          handlers.printerList = (list) => {
            if (!isMounted) return;
            if (list && list.length > 0) {
              setPrinterList(list);
              setIsClientReady(true);
              setIsLoading(false);
              clearRefreshTimer();   // ✅ 收到列表立即清除刷新兜底定时器

              // ✅ 只在用户未手动选择时才应用默认项
              if (!userSelectedRef.current) {
                const defaultPrinter = list.find((p) => p.isDefault);
                if (defaultPrinter) setSelectedPrinter(defaultPrinter.name);
                else setSelectedPrinter(list[0].name);
              }
            }
          };

          handlers.clients = (data) => {
            if (!isMounted) return;
            const allPrinters = [];
            for (const id in data) {
              if (data[id].printerList) {
                allPrinters.push(
                  ...data[id].printerList.map((printer) => ({
                    ...printer,
                    clientId: printer.clientId || id,
                  }))
                );
              }
            }
            if (allPrinters.length > 0) {
              setPrinterList(allPrinters);
              setIsClientReady(true);
              setIsLoading(false);
              clearRefreshTimer();   // ✅ 同上

              if (!userSelectedRef.current) {
                const defaultPrinter = allPrinters.find((p) => p.isDefault);
                if (defaultPrinter) setSelectedPrinter(defaultPrinter.name);
                else setSelectedPrinter(allPrinters[0].name);
              }
            }
          };

          handlers.disconnect = () => {
            if (!isMounted) return;
            console.warn('⚠️ WebSocket 断开连接');
            setIsClientReady(false);
            setIsLoading(false);
          };

          handlers.connect_error = (err) => {
            if (!isMounted) return;
            console.error('❌ WebSocket 连接错误:', err);
            setIsLoading(false);
          };

          socket.on('connect', handlers.connect);
          socket.on('printerList', handlers.printerList);
          socket.on('clients', handlers.clients);
          socket.on('disconnect', handlers.disconnect);
          socket.on('connect_error', handlers.connect_error);

          if (socket.connected) {
            console.log('✅ Socket 已连接，直接请求');
            socket.emit('getClients');
          }
        } else {
          console.warn('⚠️ 未找到 WebSocket 实例，使用轮询方式');
          let retryCount = 0;
          const maxRetries = 10;
          const pollInterval = setInterval(() => {
            if (!isMounted) { clearInterval(pollInterval); return; }
            try {
              const template = new targetHiprint.PrintTemplate({ template: { panels: [] } });
              const list = template.getPrinterList();
              if (list && list.length > 0) {
                setPrinterList(list);
                setIsClientReady(true);
                setIsLoading(false);
                const defaultPrinter = list.find((p) => p.isDefault);
                if (!userSelectedRef.current) {
                  if (defaultPrinter) setSelectedPrinter(defaultPrinter.name);
                  else setSelectedPrinter(list[0].name);
                }
                clearInterval(pollInterval);
              } else {
                retryCount++;
                if (retryCount >= maxRetries) {
                  clearInterval(pollInterval);
                  setIsLoading(false);
                  console.warn('⚠️ 轮询获取打印机列表超时');
                }
              }
            } catch (e) {
              retryCount++;
              if (retryCount >= maxRetries) {
                clearInterval(pollInterval);
                setIsLoading(false);
              }
            }
          }, 1000);
        }
      } catch (e) {
        console.warn('hiprint init bypassed:', e);
      }

      if (isMounted) {
        setHiprintObj(targetHiprint);
        setIsReady(true);
      }
    });

    return () => {
      isMounted = false;
      clearRefreshTimer();
      // ✅ 彻底清理 socket 监听，防止重复绑定与内存泄漏
      if (socketRef) {
        try {
          socketRef.off('connect', handlers.connect);
          socketRef.off('printerList', handlers.printerList);
          socketRef.off('clients', handlers.clients);
          socketRef.off('disconnect', handlers.disconnect);
          socketRef.off('connect_error', handlers.connect_error);
        } catch (e) {
          // ignore
        }
      }
    };
  }, [clearRefreshTimer]);

  // ===== 2. 刷新打印机列表 =====
  const refreshPrinterList = () => {
    if (!hiprintObj) {
      alert('⚠️ Hiprint 未初始化');
      return;
    }
    const socket = hiprintObj.hiwebSocket?.socket;
    if (socket && socket.connected) {
      setIsLoading(true);
      socket.emit('getClients');
      // ✅ 收到列表时会 clear；超时 5s 兜底
      clearRefreshTimer();
      refreshTimerRef.current = setTimeout(() => {
        setIsLoading(false);
        refreshTimerRef.current = null;
      }, 5000);
    } else {
      alert('⚠️ WebSocket 未连接，请检查中转服务');
    }
  };

  // ===== 3. 获取预览 HTML =====
  const getPreviewHtml = (dataList, template) => {
    if (!hiprintObj || !template) return null;
    const holder = document.getElementById('hiprint-hidden-holder');
    if (!holder) return null;
    holder.innerHTML = '';

    const customTemplate = new hiprintObj.PrintTemplate({ template });
    customTemplate.design('#hiprint-hidden-holder');

    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        setTimeout(() => {
          const hasMultiplePanels = template?.panels && template.panels.length > 1;
          const finalDataList = hasMultiplePanels ? [{}] : dataList;
          const $htmlElements = customTemplate.getHtml(finalDataList);
          let htmlContent = '';
          $htmlElements.each((index, element) => {
            htmlContent += element.outerHTML;
          });
          resolve(htmlContent);
        }, 50);
      });
    });
  };

  // ===== 抽取公共：调用 onBeforePrint（带异常保护） =====
  const prepareDataAndTemplate = async (isSilentFlag) => {
    let dataList = Array.isArray(printData) ? printData : [printData];
    let template = templateData;

    if (onBeforePrint) {
      try {
        const bundle = await onBeforePrint(isSilentFlag);
        if (bundle) {
          dataList = Array.isArray(bundle.printData) ? bundle.printData : [bundle.printData];
          template = bundle.template || templateData;
        }
      } catch (e) {
        console.error('❌ onBeforePrint 执行失败:', e);
        throw new Error('打印前数据处理失败：' + e.message);
      }
    }
    return { dataList, template };
  };

  // ===== 4. 普通预览 =====
  const handlePreview = async () => {
    if (!hiprintObj || !templateData || !printData) {
      return alert('打印组件未就绪或缺失模板/数据！');
    }

    let dataList, template;
    try {
      ({ dataList, template } = await prepareDataAndTemplate(false));
    } catch (e) {
      return alert(e.message);
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
      sendPrintLog({ dataList, mode: '预览' });
    } catch (error) {
      console.error('❌ 生成预览失败:', error);
      sendPrintLog({ dataList, status: 'FAILED', mode: '预览', errorMessage: error.message });
      alert('生成打印预览失败，请查看浏览器开发者工具控制台。');
    }
  };

  // ===== 5. 生成 TSPL 指令 =====
  const generateTSPL = (dataList, template) => {
    const { width: paperWidth, height: paperHeight } = getPaperSize(template);
    const dotPerMm = 11.8;
    const labelWidth = Math.round(paperWidth * dotPerMm);
    const labelHeight = Math.round(paperHeight * dotPerMm);
    const hasMultiplePanels = template?.panels && template.panels.length > 1;

    let tspl = '';
    tspl += `SIZE ${labelWidth} ${labelHeight}\r\n`;
    tspl += 'GAP 2 0\r\n';
    tspl += 'DIRECTION 1\r\n';
    tspl += 'REFERENCE 0 0\r\n';
    tspl += 'SET PEEL OFF\r\n';
    tspl += 'SET TEAR ON\r\n';

    const elements = template?.panels?.[0]?.printElements || [];

    // ✅ 多面板只需打印一次，避免重复出纸
    const printItems = hasMultiplePanels ? [dataList[0] || {}] : dataList;

    // 统一的转义
    const escapeText = (s) =>
      String(s)
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/[\r\n]+/g, ' ');

    if (elements.length === 0) {
      // ===== 兜底：无 elements 分支 =====
      printItems.forEach((data, index) => {
        tspl += 'CLS\r\n';   // ✅ 每张前清屏
        const barcode = data.barcode || `202608190${String(index + 1).padStart(2, '0')}`;
        const model = data.model || 'DL3500';
        const capacity = data.capacity || '14.8V - 3.5Ah-51.8Wh';
        const colorText = data.color || '黑色';
        const powerText = data.power || '常规版';

        tspl += `TEXT 20,10,"0",1,1,1,"${escapeText(model + '-' + capacity)}"\r\n`;
        tspl += `TEXT 20,45,"0",1,1,1,"${escapeText('颜色：' + colorText)}"\r\n`;
        tspl += `TEXT 250,45,"0",1,1,1,"${escapeText(powerText)}"\r\n`;
        tspl += `BARCODE 100,75,"128",50,1,0,1,2,"${escapeText(barcode)}"\r\n`;
        tspl += `TEXT 20,140,"0",1,1,1,"${escapeText('CN ' + barcode)}"\r\n`;
        tspl += 'PRINT 1,1\r\n';   // ✅ 修复：补上出纸指令
      });
    } else {
      printItems.forEach((data, index) => {
        tspl += 'CLS\r\n';

        const itemData = data;   // ✅ 已由 printItems 决定是否只取第一条
        elements.forEach((el) => {
          const type = el.printElementType?.type;
          const opts = el.options || {};

          let left = opts.left || 0;
          let top = opts.top || 0;
          let width = opts.width || 0;
          let height = opts.height || 0;

          const x = Math.round(left * dotPerMm);
          const y = Math.round(top * dotPerMm);
          const w = Math.round(width * dotPerMm);
          const h = Math.round(height * dotPerMm);

          if (type === 'text') {
            let title = opts.title || '';
            title = title.replace(/\{\{([^}]+)\}\}/g, (match, field) => {
              if (field === 'index') return String(index + 1);
              const value = itemData[field];
              return value !== undefined && value !== null ? String(value) : match;
            });

            const fontSize = opts.fontSize || 10;
            let xMulti = 1;
            let yMulti = 1;
            if (fontSize >= 15) {
              xMulti = 2;
              yMulti = 2;
            }

            if (opts.fontWeight === 'bold' || opts.fontWeight === 'bolder' || opts.fontWeight === '700') {
              xMulti = Math.min(xMulti + 1, 2);
            }

            const textAlign = opts.textAlign || 'left';
            let alignX = x;
            if (textAlign === 'center') {
              alignX = x + Math.round(w / 2);
            } else if (textAlign === 'right') {
              alignX = x + w;
            }

            tspl += `TEXT ${alignX},${y},"TSS24.BF2",0,${xMulti},${yMulti},"${escapeText(title)}"\r\n`;
          } else if (type === 'barcode') {
            let barcodeData = opts.testData || '';
            barcodeData = barcodeData.replace(/\{\{([^}]+)\}\}/g, (match, field) => {
              if (field === 'index') return String(index + 1);
              const value = itemData[field];
              return value !== undefined && value !== null ? String(value) : match;
            });

            const barcodeType = opts.barcodeType || 'code128';
            let tsplType = '128';
            if (barcodeType === 'code39') tsplType = '39';
            else if (barcodeType === 'code93') tsplType = '93';
            else if (barcodeType === 'code128') tsplType = '128';
            else if (barcodeType === 'ean13') tsplType = 'EAN13';
            else if (barcodeType === 'ean8') tsplType = 'EAN8';
            else if (barcodeType === 'upca') tsplType = 'UPCA';
            else if (barcodeType === 'upce') tsplType = 'UPCE';

            const barHeight = Math.max(Math.round((opts.height || 20) * dotPerMm / 4), 30);
            // ✅ 窄条/宽条宽度做范围收敛，避免超出打印机能力
            const narrowWidth = Math.min(Math.max(
              opts.barWidth ? Math.round(parseFloat(opts.barWidth) * 2) : 1, 1
            ), 10);
            const wideWidth = Math.min(Math.max(narrowWidth * 3, 2), 30);

            tspl += `BARCODE ${x},${y},"${tsplType}",${barHeight},1,0,${narrowWidth},${wideWidth},"${escapeText(barcodeData)}"\r\n`;
          } else if (type === 'hline') {
            const lineWidth = opts.borderWidth ? Math.round(parseFloat(opts.borderWidth) * dotPerMm / 2) : 1;
            tspl += `LINE ${x},${y},${x + w},${y},${Math.max(lineWidth, 1)}\r\n`;
          } else if (type === 'rect') {
            const lineWidth = opts.borderWidth ? Math.round(parseFloat(opts.borderWidth) * dotPerMm / 2) : 1;
            tspl += `BOX ${x},${y},${x + w},${y + h},${Math.max(lineWidth, 1)}\r\n`;
          }
        });

        tspl += 'PRINT 1,1\r\n';
      });
    }

    return tspl;
  };

  // ===== 6. 通过中转服务发送 TSPL =====
  const sendTSPL = async (printer, tsplData) => {
    try {
      const response = await fetch(`${TRANSIT_HOST}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          printer: printer,
          content: tsplData,
          contentType: 'text/plain',
          copies: 1,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`中转服务返回错误: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ TSPL 发送成功:', result);
      return true;
    } catch (error) {
      console.error('❌ 发送 TSPL 失败:', error);
      throw error;
    }
  };

  // ===== 7. 静默打印 =====
  const handleSilentPrint = async () => {
    if (!hiprintObj || !templateData || !printData) {
      return alert('打印组件未就绪或缺失模板/数据！');
    }

    if (!isClientReady || printerList.length === 0) {
      return alert(
        '⚠️ 未检测到打印机！\n\n请确保：\n' +
        '1. Windows 系统已安装打印机\n' +
        '2. electron-hiprint 客户端已启动并连接中转服务\n' +
        '3. 点击"刷新"按钮获取打印机列表'
      );
    }

    const printer = selectedPrinter || printerName;
    if (!printer) {
      return alert('⚠️ 请选择一台打印机！');
    }

    let dataList, template;
    try {
      ({ dataList, template } = await prepareDataAndTemplate(true));
    } catch (e) {
      return alert(e.message);
    }

    // 🔀 根据用户开关判断使用哪种模式
    if (!useTSPL) {
      try {
        console.log('🖨️ 尝试 print2 打印...');

        const { width: paperWidth, height: paperHeight } = getPaperSize(template);

        const customTemplate = new hiprintObj.PrintTemplate({ template });

        const hasMultiplePanels = template?.panels && template.panels.length > 1;
        const finalDataList = hasMultiplePanels ? [{}] : dataList;

        const selectedPrinterObj = printerList.find(p => p.name === (selectedPrinter || printerName));
        const clientId = selectedPrinterObj?.clientId || selectedPrinterObj?.server?.clientId || printerList[0]?.clientId;

        console.log('clientId:', clientId);

        const widthMicron = Math.round(paperWidth * 1000);
        const heightMicron = Math.round(paperHeight * 1000);

        customTemplate.print2(finalDataList, {
          ...(clientId && { client: clientId }),
          printer: printer,
          silent: true,
          copies: finalDataList.length,
          pageSize: {
            width: widthMicron,
            height: heightMicron,
          },
          ...(widthMicron > heightMicron && { landscape: true }),
        });

        // ⚠️ print2 是异步下发，无法在此刻确认客户端出纸结果
        // 这里延迟 800ms 记录一条"已下发"日志，避免误记为成功
        setTimeout(() => {
          sendPrintLog({ dataList, mode: '打印(已下发)' });
        }, 800);

      } catch (error) {
        alert('print2 打印失败：' + error.message);
        sendPrintLog({
          dataList,
          status: 'FAILED',
          mode: 'print2 模式',
          errorMessage: error.message,
        });
      }
    } else {
      // ===== TSPL 打印 =====
      try {
        const tsplData = generateTSPL(dataList, template);
        await sendTSPL(printer, tsplData);
        sendPrintLog({ dataList, mode: '打印（TSPL）' });
      } catch (tsplError) {
        console.error('❌ TSPL 打印失败:', tsplError);
        sendPrintLog({
          dataList,
          status: 'FAILED',
          mode: 'TSPL 模式',
          errorMessage: tsplError.message,
        });
        alert('TSPL 打印失败：' + tsplError.message);
      }
    }
  };

  // ===== 8. 主入口 =====
  const handlePrint = () => {
    if (silent) {
      setShowConfirm(true);
    } else {
      handlePreview();
    }
  };

  return (
    <>
      <div
        id="hiprint-hidden-holder"
        style={{
          position: 'absolute',
          left: '-9999px',
          top: '-9999px',
          visibility: 'hidden',
        }}
      />

      {silent ? (
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-xs text-gray-600 font-medium whitespace-nowrap">
            打印机:
          </label>
          <select
            value={selectedPrinter}
            onChange={(e) => {
              userSelectedRef.current = true;   // ✅ 标记为用户手动选择
              setSelectedPrinter(e.target.value);
            }}
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
            {isLoading ? '⏳ 获取中...' : '🔄 刷新'}
          </button>
          <span
            className={`text-xs ${isClientReady ? 'text-green-600' : 'text-red-500'} whitespace-nowrap`}
          >
            {isLoading ? '⏳ 获取中...' : isClientReady ? '✅ 已连接' : '❌ 未连接'}
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
            {!isReady ? '⏳ 加载中...' : isLoading ? '⏳ 获取中...' : !isClientReady ? '⚠️ 未连接' : buttonText}
          </button>
          <button
            onClick={() => setShowConfigModal(true)}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            title="打印机配置"
          >
            ⚙️
          </button>

          <div className="flex items-center gap-3 flex-wrap">
            <label
              className="flex items-center gap-1.5 text-xs cursor-pointer select-none text-gray-700 bg-gray-50 hover:bg-gray-100 px-2.5 py-1.5 rounded-md border border-gray-300 transition-colors"
              title="打勾使用佳博/热敏机TSPL指令（精准走纸），不打勾使用默认HTML渲染"
            >
              <input
                type="checkbox"
                checked={useTSPL}
                onChange={(e) => setUseTSPL(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-0 cursor-pointer"
              />
              <span className="font-medium">TSPL 模式</span>
            </label>
          </div>
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
      <PrinterConfigModal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        printerList={printerList}
        existingConfigs={printerConfigs}
        onSave={handleSaveConfigs}
      />

      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-2">🖨️ 确认打印</h3>
            <p className="text-sm text-gray-600 mb-4">
              即将打印{' '}
              <strong>{Array.isArray(printData) ? printData.length : 1}</strong> 张标签
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