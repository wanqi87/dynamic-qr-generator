const express = require('express');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;

// 信任反向代理（云部署必需，正确获取 https 协议和真实 host）
app.set('trust proxy', true);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ========== 环境变量配置 ==========

// 云部署公网地址（设置为云平台分配的 URL，如 https://my-app.onrender.com）
const BASE_URL = process.env.BASE_URL ? process.env.BASE_URL.replace(/\/+$/, '') : '';

// MongoDB Atlas Data API（可选，用于云平台无持久化存储时）
const MONGO_API_URL = process.env.MONGODB_DATA_API_URL || '';
const MONGO_API_KEY = process.env.MONGODB_DATA_API_KEY || '';
const MONGO_DATA_SOURCE = process.env.MONGODB_DATA_SOURCE || 'Cluster0';
const MONGO_DATABASE = process.env.MONGODB_DATABASE || 'qr_generator';
const MONGO_COLLECTION = process.env.MONGODB_COLLECTION || 'qrcodes';
const USE_MONGO = !!(MONGO_API_URL && MONGO_API_KEY);

// 本地文件存储（DATA_DIR 可选，用于云平台挂载持久化卷时指定独立目录，
// 避免卷挂载路径与应用代码目录重叠导致代码文件被卷内容覆盖）
const DATA_FILE = path.join(process.env.DATA_DIR || __dirname, 'data.json');

// ========== 文件存储（本地开发用） ==========
function loadData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return { codes: {}, config: {} };
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ========== MongoDB Atlas Data API ==========
async function mongoAction(action, body) {
  const res = await fetch(`${MONGO_API_URL}/action/${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': MONGO_API_KEY
    },
    body: JSON.stringify({
      dataSource: MONGO_DATA_SOURCE,
      database: MONGO_DATABASE,
      collection: MONGO_COLLECTION,
      ...body
    })
  });
  return res.json();
}

// ========== 统一存储接口 ==========

async function getQrCode(id) {
  if (USE_MONGO) {
    const result = await mongoAction('findOne', { filter: { id } });
    return result.document || null;
  }
  const data = loadData();
  if (!data.codes[id]) return null;
  return { id, ...data.codes[id] };
}

async function getAllQrCodes() {
  if (USE_MONGO) {
    const result = await mongoAction('find', { filter: {} });
    const docs = result.documents || [];
    docs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return docs;
  }
  const data = loadData();
  return Object.entries(data.codes)
    .map(([id, info]) => ({ id, ...info }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function createQrCode(id, url) {
  const now = new Date().toISOString();
  const doc = { id, url, createdAt: now, updatedAt: now };
  if (USE_MONGO) {
    await mongoAction('insertOne', { document: doc });
  } else {
    const data = loadData();
    data.codes[id] = { url, createdAt: now, updatedAt: now };
    saveData(data);
  }
  return doc;
}

async function updateQrCodeUrl(id, url) {
  const now = new Date().toISOString();
  if (USE_MONGO) {
    await mongoAction('updateOne', {
      filter: { id },
      update: { $set: { url, updatedAt: now } }
    });
  } else {
    const data = loadData();
    if (data.codes[id]) {
      data.codes[id].url = url;
      data.codes[id].updatedAt = now;
      saveData(data);
    }
  }
  return { url, updatedAt: now };
}

async function deleteQrCode(id) {
  if (USE_MONGO) {
    await mongoAction('deleteOne', { filter: { id } });
  } else {
    const data = loadData();
    delete data.codes[id];
    saveData(data);
  }
}

// ========== 配置缓存 ==========
let cachedConfig = null;

async function getStoredConfig() {
  if (cachedConfig !== null) return cachedConfig;
  if (USE_MONGO) {
    try {
      const result = await mongoAction('findOne', { filter: { _id: 'config' } });
      cachedConfig = (result.document && result.document.baseUrl) || '';
    } catch {
      cachedConfig = '';
    }
  } else {
    const data = loadData();
    cachedConfig = (data.config && data.config.baseUrl) || '';
  }
  return cachedConfig;
}

async function setStoredConfig(baseUrl) {
  cachedConfig = baseUrl;
  if (USE_MONGO) {
    await mongoAction('updateOne', {
      filter: { _id: 'config' },
      update: { $set: { baseUrl } },
      upsert: true
    });
  } else {
    const data = loadData();
    if (!data.config) data.config = {};
    data.config.baseUrl = baseUrl;
    saveData(data);
  }
}

// ========== 工具函数 ==========
function generateId() {
  return crypto.randomBytes(6).toString('base64url');
}

function getLanIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (!iface.internal && iface.family === 'IPv4') {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

// 获取基础 URL（优先级：BASE_URL 环境变量 > 用户配置 > 请求自动检测 > 局域网 IP）
async function getBaseUrl(req) {
  if (BASE_URL) return BASE_URL;
  const stored = await getStoredConfig();
  if (stored) return stored.replace(/\/+$/, '');
  if (req) {
    const proto = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.get('host');
    return `${proto}://${host}`;
  }
  return `http://${getLanIp()}:${PORT}`;
}

function isValidUrl(str) {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

// ========== 状态 API ==========
app.get('/api/status', async (req, res) => {
  const baseUrl = await getBaseUrl(req);
  res.json({
    cloudMode: !!BASE_URL,
    baseUrl,
    storage: USE_MONGO ? 'mongodb' : 'file',
    lanIp: getLanIp(),
    port: PORT
  });
});

// ========== 配置 API ==========
app.get('/api/config', async (req, res) => {
  const lanIp = getLanIp();
  const stored = await getStoredConfig();
  const baseUrl = await getBaseUrl(req);
  res.json({
    cloudMode: !!BASE_URL,
    lanIp,
    port: PORT,
    detectedUrl: `http://${lanIp}:${PORT}`,
    baseUrl,
    configuredUrl: stored
  });
});

app.put('/api/config', async (req, res) => {
  if (BASE_URL) {
    return res.status(400).json({ error: '云部署模式下地址由环境变量 BASE_URL 控制，无法通过界面修改' });
  }
  const { baseUrl } = req.body;
  if (baseUrl && baseUrl.trim()) {
    const trimmed = baseUrl.trim().replace(/\/+$/, '');
    if (!isValidUrl(trimmed)) {
      return res.status(400).json({ error: '请输入有效的URL地址' });
    }
    await setStoredConfig(trimmed);
  } else {
    await setStoredConfig('');
  }
  res.json({
    cloudMode: false,
    lanIp: getLanIp(),
    port: PORT,
    baseUrl: await getBaseUrl(req),
    configuredUrl: await getStoredConfig()
  });
});

// ========== API 路由 ==========

// 创建新二维码
app.post('/api/qrcode', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || !url.trim()) {
      return res.status(400).json({ error: '请输入YouTube链接' });
    }
    if (!isValidUrl(url.trim())) {
      return res.status(400).json({ error: '请输入有效的URL地址' });
    }

    const id = generateId();
    const baseUrl = await getBaseUrl(req);
    const redirectUrl = `${baseUrl}/r/${id}`;
    const doc = await createQrCode(id, url.trim());

    const qrDataUrl = await QRCode.toDataURL(redirectUrl, {
      width: 400,
      margin: 2,
      errorCorrectionLevel: 'H',
      color: { dark: '#000000', light: '#ffffff' }
    });

    res.json({
      id,
      qrCode: qrDataUrl,
      redirectUrl,
      url: doc.url,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    });
  } catch (err) {
    console.error('生成二维码失败:', err);
    res.status(500).json({ error: '生成二维码失败，请重试' });
  }
});

// 获取二维码信息
app.get('/api/qrcode/:id', async (req, res) => {
  const { id } = req.params;
  const doc = await getQrCode(id);
  if (!doc) {
    return res.status(404).json({ error: '二维码不存在' });
  }
  const baseUrl = await getBaseUrl(req);
  res.json({
    id,
    url: doc.url,
    redirectUrl: `${baseUrl}/r/${id}`,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt
  });
});

// 更新链接（二维码不变）
app.put('/api/qrcode/:id', async (req, res) => {
  const { id } = req.params;
  const { url } = req.body;
  if (!url || !url.trim()) {
    return res.status(400).json({ error: '请输入YouTube链接' });
  }
  if (!isValidUrl(url.trim())) {
    return res.status(400).json({ error: '请输入有效的URL地址' });
  }

  const existing = await getQrCode(id);
  if (!existing) {
    return res.status(404).json({ error: '二维码不存在' });
  }

  const updated = await updateQrCodeUrl(id, url.trim());
  const baseUrl = await getBaseUrl(req);
  res.json({
    id,
    url: updated.url,
    redirectUrl: `${baseUrl}/r/${id}`,
    updatedAt: updated.updatedAt
  });
});

// 获取二维码图片（高清 PNG，用于下载）
app.get('/api/qrcode/:id/image', async (req, res) => {
  const { id } = req.params;
  const size = Math.min(Math.max(parseInt(req.query.size) || 800, 200), 2000);
  const doc = await getQrCode(id);
  if (!doc) {
    return res.status(404).json({ error: '二维码不存在' });
  }
  const baseUrl = await getBaseUrl(req);
  const redirectUrl = `${baseUrl}/r/${id}`;
  try {
    const pngBuffer = await QRCode.toBuffer(redirectUrl, {
      width: size,
      margin: 2,
      errorCorrectionLevel: 'H',
      color: { dark: '#000000', light: '#ffffff' }
    });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="qr-code-${id}.png"`);
    res.send(pngBuffer);
  } catch (err) {
    console.error('生成图片失败:', err);
    res.status(500).json({ error: '生成二维码图片失败' });
  }
});

// 获取所有二维码列表
app.get('/api/qrcodes', async (req, res) => {
  const docs = await getAllQrCodes();
  const baseUrl = await getBaseUrl(req);
  const codes = docs.map(doc => ({
    id: doc.id,
    url: doc.url,
    redirectUrl: `${baseUrl}/r/${doc.id}`,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt
  }));
  res.json(codes);
});

// 删除二维码
app.delete('/api/qrcode/:id', async (req, res) => {
  const { id } = req.params;
  const existing = await getQrCode(id);
  if (!existing) {
    return res.status(404).json({ error: '二维码不存在' });
  }
  await deleteQrCode(id);
  res.json({ success: true });
});

// 重定向端点 - 扫码后跳转到当前绑定的链接
app.get('/r/:id', async (req, res) => {
  const { id } = req.params;
  const doc = await getQrCode(id);
  if (!doc) {
    return res.status(404).send('二维码不存在或已被删除');
  }
  res.redirect(doc.url);
});

app.listen(PORT, () => {
  const lanIp = getLanIp();
  console.log(`\n========================================`);
  console.log(`  动态二维码生成工具已启动！`);
  if (BASE_URL) {
    console.log(`  云部署模式: ${BASE_URL}`);
  } else {
    console.log(`  本机访问:   http://localhost:${PORT}`);
    console.log(`  局域网访问: http://${lanIp}:${PORT}`);
  }
  console.log(`  存储方式:   ${USE_MONGO ? 'MongoDB Atlas' : '本地文件'}`);
  console.log(`========================================\n`);
});
