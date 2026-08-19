# 打印功能使用说明

## 首次使用前必须配置

本系统使用 `print2` 方式打印，需要 Windows 打印机驱动里**预先创建好对应的纸张规格**，否则会打印空白纸。

### 配置步骤

1. 打开 Windows **"控制面板" → "设备和打印机"**
2. 右键点击您的打印机 → 选择 **"打印首选项"**
3. 找到 **"自定义纸张"** 或 **"纸张管理"** 选项卡
4. 点击 **"新建"**，根据您的标签模板创建纸张：

| 模板名称 | 纸张名称 | 宽度 | 高度 |
| -------- | -------- | ---- | ---- |
| 标准标签 | 60x30mm  | 60mm | 30mm |
| 大标签   | 80x40mm  | 80mm | 40mm |
| 宽标签   | 80x30mm  | 80mm | 30mm |

5. **纸张名称必须与模板名称完全一致**（如 `60x30mm`）
6. 保存并退出

### 验证

配置完成后，点击打印按钮即可正常打印。如果仍然空白，请检查：
- 纸张名称是否与模板名称一致（区分大小写）
- 纸张尺寸是否正确

---

**注意：** 每添加一个新的标签模板尺寸，都需要在打印机驱动里创建对应的纸张规格。





This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
