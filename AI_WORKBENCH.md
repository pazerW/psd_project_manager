# AI工作台功能说明

## 概述

AI工作台是一个集成的AI模板处理页面，允许用户：
- 浏览和选择AI模板
- 使用任务README内容作为上下文
- 上传图片（包括PSD文件）
- 提交AI任务并记录日志

## 访问方式

在任务详情页面，点击右上角的"AI工作台"按钮即可进入。

## 功能特性

### 1. 模板管理
- 自动从 `http://192.168.3.150:3001/api/templates` 加载所有可用模板
- 展示模板名称、类型、模型和参数
- 支持 `text2img` 和 `img2img` 两种模板类型

### 2. 任务上下文
- 手动输入文本
- 从当前任务的README内容中选择文本
- 实时预览完整的提示词效果（模板 + 上下文）

### 3. 图片处理
- 对于 `img2img` 类型的模板，可以选择任务中的任何图片
- 支持PSD文件（自动使用缩略图转换为JPG）
- 可视化图片选择界面

### 4. 任务提交
- 点击"开始处理"按钮提交AI任务
- 自动调用 `/api/templates/{template_id}/apply` API
- 支持JSON和multipart/form-data两种提交方式

### 5. 日志记录
- 自动将任务信息保存到 `task_log.md` 文件
- 记录内容包括：
  - 时间戳
  - Job ID
  - 模板信息
  - 完整提示词
  - 使用的图片
  - 任务状态
- **自动状态更新**：页面刷新时自动检查 `processing` 状态的任务
- **智能轮询**：对进行中的任务调用状态查询API
- **实时更新**：任务完成后自动更新日志结果字段

### 日志格式示例

```markdown
### 2026-01-08 14:30

**job_id**: 123e4567-e89b-12d3-a456-426614174000

**template_id**: poster_template

**template_name**: 海报模板

**prompt**: 生成一只在桥上的猫的海报...

**image**: cat_design.psd

**status**: processing

---
```

## API接口

### 前端调用的后端API

所有AI相关请求都通过本地后端代理转发，避免CORS问题。

#### 获取模板列表
- **GET** `/api/ai/templates`
- 后端代理转发至：`http://192.168.3.150:3001/api/templates`
- 响应：模板列表

#### 应用模板
- **POST** `/api/ai/templates/:templateId/apply`
- 后端代理转发至：`http://192.168.3.150:3001/api/templates/:templateId/apply`
- Content-Type: `application/json` 或 `multipart/form-data`

#### 查询任务状态
- **GET** `/api/ai/jobs/:jobId`
- 后端代理转发至：`http://192.168.3.150:3001/api/templates/jobs/:jobId`
- 响应：任务状态信息

#### 保存AI日志
- **POST** `/api/tasks/:projectName/:taskName/ai-log`
- 请求体：日志数据对象
- 响应：`{ success: true, message: "日志保存成功" }`

#### 读取AI日志
- **GET** `/api/tasks/:projectName/:taskName/ai-log`
- 响应：`{ logs: [...] }`

### 后端代理到外部AI API

后端通过 `routes/ai-proxy.js` 代理所有AI API请求到 `http://192.168.3.150:3001`。

优势：
- 解决跨域CORS问题
- 统一的错误处理
- 可以添加认证、日志等中间件
- 前端无需关心外部API地址变更

## 技术实现

### 前端
- 组件：`AIWorkbench.vue`
- 路由：`/project/:projectName/task/:taskName/ai-workbench`
- 依赖：axios, marked, vue-router

### 后端
- 新增路由：`routes/tasks.js` 中的 AI 日志相关端点
- 新增代理：`routes/ai-proxy.js` - 代理所有AI API请求
- 文件操作：使用 fs-extra 读写 `task_log.md`
- 依赖：axios (用于转发请求), form-data (处理文件上传)

## 使用流程

1. 在任务详情页点击"AI工作台"按钮
2. 从左侧列表选择一个模板
3. 填写或选择任务上下文
4. （可选）如果是 img2img 模板，选择要处理的图片
5. 预览完整提示词
6. 点击"开始处理"提交任务
7. 查看任务历史记录

## 注意事项

- PSD文件会自动转换为JPG格式上传（使用缩略图）
- 任务日志会累积保存在 `task_log.md` 文件中
- AI API请求通过本地后端代理转发，避免CORS问题
- 外部AI API地址配置在 `backend/routes/ai-proxy.js` 中，默认为 `http://192.168.3.150:3001`
- 可通过环境变量 `AI_API_BASE` 修改AI API地址
