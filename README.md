# API Harbor

HAR 文件查看器 — 解析、浏览、检查从 Chrome DevTools 导出的 HTTP 请求。

## 功能

- **多文件支持** — 同时加载多个 HAR 文件，可按文件筛选
- **全宽请求表格** — Method、Status、Path、Initiator、Type、Time、Waterfall
- **排序** — 按开始时间或耗时排序
- **搜索** — 按 URL、Host、Method、Body 内容过滤
- **请求抽屉** — 点击任意请求查看详情
  - Headers、Query Params、请求/响应体
  - 自动推断 JSON 字段结构（Schema），支持嵌套对象和数组
  - 点击 Schema 字段可在 RAW JSON 中高亮对应节点
  - JSON 树支持折叠/展开，类型语法高亮
  - Timing 瀑布图

## 使用

```bash
npm install
npm run dev      # 开发模式，默认端口 5173
npm run build    # 生产构建
npm run preview  # 预览生产构建，端口 9000
```

从 Chrome DevTools Network 面板导出 `.har` 文件，拖入页面即可。

## 技术栈

- React 19 + TypeScript
- Tailwind CSS v4
- Vite 8
