# 动态二维码生成工具 - 部署指南

## 为什么需要部署到云平台？

二维码编码的地址必须是**公网可访问的 URL**。本地运行时二维码使用局域网 IP（如 `http://10.x.x.x:3000`），只有同一 WiFi 下的设备才能访问。部署到云平台后，二维码将使用公网 HTTPS 地址，全球任意设备扫码均可访问。

---

## 方案一：Railway 部署（推荐 - 自带持久化存储）

Railway 提供持久化存储卷，数据重启不丢失，部署最简单。

### 步骤

1. **注册 Railway 账号**
   - 访问 https://railway.app
   - 用 GitHub 或邮箱注册

2. **推送代码到 GitHub**
   ```bash
   cd dynamic-qr-generator
   git init
   git add .
   git commit -m "动态二维码生成工具"
   ```
   - 在 GitHub 创建一个新仓库，然后推送代码

3. **在 Railway 创建项目**
   - 点击 "New Project" → "Deploy from GitHub repo"
   - 选择你刚推送的仓库
   - Railway 会自动检测 Dockerfile 并构建

4. **添加持久化存储卷**
   - 在服务设置中点击 "Volumes" → "Add Volume"
   - 挂载路径填 `/app`（或只挂 `/app/data.json`）

5. **设置环境变量**
   - 在 "Variables" 中添加：
   ```
   BASE_URL=https://你的应用名.up.railway.app
   ```
   - Railway 会分配一个 `*.up.railway.app` 域名，填入即可

6. **部署完成**
   - 访问 Railway 分配的 URL 即可使用
   - 生成的二维码将使用该公网地址，全球可扫码

---

## 方案二：Render + MongoDB Atlas（完全免费）

Render 免费版无持久化磁盘（重启后文件丢失），需搭配 MongoDB Atlas 做数据存储。

### 第一步：创建 MongoDB Atlas 数据库

1. **注册 MongoDB Atlas**
   - 访问 https://www.mongodb.com/cloud/atlas/register
   - 选择免费的 M0 共享集群

2. **创建集群**
   - 选择云服务商和区域（推荐 AWS / 美国区域，离美国客户更近）
   - 等待集群创建完成（约 2-3 分钟）

3. **设置数据库访问**
   - Database Access → Add New Database User
   - 创建用户名和密码（记下来）
   - Network Access → Add IP Address → 选择 "Allow Access from Anywhere"（`0.0.0.0/0`）

4. **启用 Data API**
   - 在集群页面点击 "..." → "Data API"
   - 开启 Data API
   - 复制 **API URL** 和 **API Key**（后面要用）

### 第二步：部署到 Render

1. **注册 Render 账号**
   - 访问 https://render.com
   - 用 GitHub 注册

2. **推送代码到 GitHub**（同方案一第 2 步）

3. **创建 Web Service**
   - New → Web Service → 连接你的 GitHub 仓库
   - 选择 "Docker" 作为运行环境
   - 选择免费计划（Free）

4. **设置环境变量**
   在 Environment 中添加以下变量：
   ```
   BASE_URL=https://你的应用名.onrender.com
   MONGODB_DATA_API_URL=https://data.mongodb-api.com/app/xxxx/endpoint/data/v1
   MONGODB_DATA_API_KEY=你的API Key
   MONGODB_DATA_SOURCE=Cluster0
   MONGODB_DATABASE=qr_generator
   MONGODB_COLLECTION=qrcodes
   ```
   - `BASE_URL`：Render 分配的域名（部署后可获得，先填占位符，部署后再修改）
   - `MONGODB_DATA_API_URL`：MongoDB Atlas Data API 的 URL
   - `MONGODB_DATA_API_KEY`：MongoDB Atlas Data API 的 Key
   - `MONGODB_DATA_SOURCE`：集群名称（默认 Cluster0）

5. **部署并修改 BASE_URL**
   - 部署完成后，Render 会分配一个 `*.onrender.com` 域名
   - 将该域名填回 `BASE_URL` 环境变量
   - 触发重新部署即可

---

## 环境变量说明

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `BASE_URL` | 云部署必填 | 公网访问地址，如 `https://my-app.onrender.com`。二维码将使用此地址生成 |
| `MONGODB_DATA_API_URL` | Render 免费版必填 | MongoDB Atlas Data API 端点 URL |
| `MONGODB_DATA_API_KEY` | Render 免费版必填 | MongoDB Atlas Data API 密钥 |
| `MONGODB_DATA_SOURCE` | 可选 | MongoDB 集群名称，默认 `Cluster0` |
| `MONGODB_DATABASE` | 可选 | 数据库名称，默认 `qr_generator` |
| `MONGODB_COLLECTION` | 可选 | 集合名称，默认 `qrcodes` |
| `PORT` | 可选 | 监听端口，默认 `3000`（云平台自动设置） |

---

## 验证部署

部署完成后，访问你的应用 URL，页面顶部应显示 **「云端部署模式」** 标识。

生成一个二维码后检查跳转地址：
- 正确：`https://你的域名/r/xxxx`
- 错误：`http://10.x.x.x:3000/r/xxxx`（说明 BASE_URL 未设置）

用手机扫码（不需要连同一 WiFi），应能正常跳转到 YouTube 视频。

---

## 本地开发

不设置任何环境变量即可本地运行：
```bash
npm install
npm start
```
访问 http://localhost:3000，此时为局域网模式，二维码使用局域网 IP。
