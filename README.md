# 动态二维码生成工具

输入一个链接，生成一个**永久不变的二维码**——之后随时更换二维码背后指向的目标地址，无需重新打印或分发新的二维码图片。

默认面向 YouTube 链接场景，但接受任意合法 URL。

## 核心原理

- 生成二维码时，实际编码的不是用户输入的目标链接，而是一个稳定的重定向地址：`{BASE_URL}/r/{id}`
- 服务端维护 `id → 目标 URL` 的映射；扫码时先访问 `/r/{id}`，由服务端 302 重定向到当前绑定的目标链接
- 更新映射（`PUT /api/qrcode/:id`）只改变目标链接，`id` 和二维码图案本身保持不变

## 功能

- 输入链接一键生成二维码（400px 预览 + 高清 PNG 下载，200–2000px 可调）
- 更换目标链接而不改变已生成/已打印的二维码图案
- 历史记录列表：查看、重新加载、删除已生成的二维码
- 复制跳转链接、下载二维码图片
- 本地局域网模式 / 云端公网模式自动切换：
  - 本地运行：自动探测局域网 IP，也可在页面上手动填入自定义访问地址
  - 云端部署：通过 `BASE_URL` 环境变量固定公网地址，页面显示「云端部署模式」标识
- 存储后端二选一：
  - 本地 JSON 文件（`data.json`），零配置，适合本地开发
  - MongoDB Atlas Data API，适合没有持久化磁盘的免费云平台（如 Render 免费版）

## 技术栈

- 后端：Node.js + Express 4
- 二维码生成：[`qrcode`](https://www.npmjs.com/package/qrcode)
- 前端：原生 HTML / CSS / JavaScript（无构建步骤，无框架）
- 部署：Docker（`Dockerfile`），示例配置见 `render.yaml`

## 目录结构

```
.
├── server.js        # Express 服务：API 路由 + 存储抽象（本地文件 / MongoDB）
├── data.json         # 本地文件存储（.gitignore 忽略，运行时自动生成）
├── public/
│   ├── index.html    # 页面结构
│   ├── app.js         # 前端交互逻辑（生成/更新/删除/历史记录/配置）
│   └── style.css       # 样式
├── Dockerfile         # 生产镜像构建
├── render.yaml         # Render 平台部署配置示例
└── DEPLOY.md            # 详细部署指南（Railway / Render + MongoDB Atlas）
```

## 快速开始

```bash
npm install
npm start
```

访问 `http://localhost:3000`。本地运行时不设置任何环境变量即可使用，二维码会自动使用局域网 IP（`http://<局域网IP>:3000`），确保手机和电脑在同一 WiFi 下即可扫码访问。

## 环境变量

| 变量名 | 是否必填 | 说明 |
|---|---|---|
| `BASE_URL` | 云部署时必填 | 公网访问地址，如 `https://my-app.onrender.com`。设置后二维码将始终使用此地址生成，且无法通过页面修改 |
| `MONGODB_DATA_API_URL` | 使用 MongoDB 存储时必填 | MongoDB Atlas Data API 端点 URL |
| `MONGODB_DATA_API_KEY` | 使用 MongoDB 存储时必填 | MongoDB Atlas Data API 密钥 |
| `MONGODB_DATA_SOURCE` | 可选 | 集群名称，默认 `Cluster0` |
| `MONGODB_DATABASE` | 可选 | 数据库名称，默认 `qr_generator` |
| `MONGODB_COLLECTION` | 可选 | 集合名称，默认 `qrcodes` |
| `PORT` | 可选 | 监听端口，默认 `3000`（云平台通常会自动设置） |

未配置 `MONGODB_DATA_API_URL`/`KEY` 时，服务自动回退为本地 `data.json` 文件存储。

## API 概览

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/status` | 返回运行模式、存储方式、局域网 IP 等状态 |
| `GET` / `PUT` | `/api/config` | 查看 / 设置本地模式下的自定义访问地址（云部署模式下不可通过此接口修改） |
| `POST` | `/api/qrcode` | 创建二维码，请求体 `{ url }` |
| `GET` | `/api/qrcode/:id` | 获取指定二维码的信息 |
| `PUT` | `/api/qrcode/:id` | 更新目标链接（二维码图案不变），请求体 `{ url }` |
| `GET` | `/api/qrcode/:id/image?size=800` | 下载高清 PNG（`size` 范围 200–2000） |
| `GET` | `/api/qrcodes` | 获取全部历史记录 |
| `DELETE` | `/api/qrcode/:id` | 删除指定二维码 |
| `GET` | `/r/:id` | 扫码后的实际入口，302 重定向到当前绑定链接 |

## 部署到云端

本地运行时二维码只在同一局域网内可扫描。若需要公网任意设备可扫码访问，需部署到云平台并设置 `BASE_URL`。完整步骤（Railway 一键持久化存储方案 / Render + MongoDB Atlas 免费方案）见 [DEPLOY.md](DEPLOY.md)。

## ⚠️ 已知限制（部署前须知）

当前实现**没有任何身份验证或访问控制**：`/api/qrcodes` 等接口对外公开即可被任何人读取全部历史记录，任何人也能修改或删除任意 `id` 对应的二维码指向。部署到公网前，请自行加上访问控制（如反向代理层的 Basic Auth、API Key 校验等），不要在没有防护的情况下暴露公网地址。
