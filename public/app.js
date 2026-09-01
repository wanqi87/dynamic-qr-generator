// ========== 状态管理 ==========
let currentQrId = null;

// ========== DOM 元素 ==========
const urlInput = document.getElementById('url-input');
const generateBtn = document.getElementById('generate-btn');
const generateHint = document.getElementById('generate-hint');
const qrResult = document.getElementById('qr-result');
const qrImage = document.getElementById('qr-image');
const qrIdBadge = document.getElementById('qr-id-badge');
const currentUrl = document.getElementById('current-url');
const redirectUrl = document.getElementById('redirect-url');
const createdAt = document.getElementById('created-at');
const updatedAt = document.getElementById('updated-at');
const downloadBtn = document.getElementById('download-btn');
const copyBtn = document.getElementById('copy-btn');
const updateSection = document.getElementById('update-section');
const updateUrlInput = document.getElementById('update-url-input');
const updateBtn = document.getElementById('update-btn');
const historyList = document.getElementById('history-list');
const historyCount = document.getElementById('history-count');
const toastContainer = document.getElementById('toast-container');
const configStatus = document.getElementById('config-status');
const detectedIp = document.getElementById('detected-ip');
const baseUrlInput = document.getElementById('base-url-input');
const saveConfigBtn = document.getElementById('save-config-btn');
const configSection = document.getElementById('config-section');
const configDivider = document.getElementById('config-divider');
const cloudBanner = document.getElementById('cloud-banner');
const cloudUrl = document.getElementById('cloud-url');

// ========== Toast 通知 ==========
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icons = {
    success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    error: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
  };

  toast.innerHTML = `${icons[type] || icons.info}<span>${message}</span>`;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ========== 按钮加载状态 ==========
function setLoading(btn, loading, originalHTML) {
  if (loading) {
    btn.disabled = true;
    btn.dataset.original = btn.innerHTML;
    btn.innerHTML = '<span class="loading-spinner"></span> 处理中...';
  } else {
    btn.disabled = false;
    btn.innerHTML = btn.dataset.original || originalHTML;
  }
}

// ========== 时间格式化 ==========
function formatTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// ========== 截断URL ==========
function truncateUrl(url, maxLen = 50) {
  if (url.length <= maxLen) return url;
  return url.substring(0, maxLen) + '...';
}

// ========== 生成二维码 ==========
generateBtn.addEventListener('click', async () => {
  const url = urlInput.value.trim();
  if (!url) {
    showToast('请输入 YouTube 链接', 'error');
    urlInput.focus();
    return;
  }

  setLoading(generateBtn, true);

  try {
    const res = await fetch('/api/qrcode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });

    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || '生成失败', 'error');
      return;
    }

    displayQrCode(data);
    showToast('二维码生成成功！', 'success');
    urlInput.value = '';
    loadHistory();
  } catch (err) {
    showToast('网络错误，请检查服务是否运行', 'error');
  } finally {
    setLoading(generateBtn, false);
  }
});

// ========== 显示二维码 ==========
function displayQrCode(data) {
  currentQrId = data.id;

  qrImage.src = data.qrCode;
  qrIdBadge.textContent = `ID: ${data.id}`;
  currentUrl.textContent = data.url;
  redirectUrl.textContent = data.redirectUrl;
  createdAt.textContent = formatTime(data.createdAt || data.updatedAt);
  updatedAt.textContent = formatTime(data.updatedAt || data.createdAt);

  qrResult.style.display = 'block';
  updateSection.style.display = 'block';

  // 重新触发动画
  qrResult.style.animation = 'none';
  void qrResult.offsetHeight;
  qrResult.style.animation = 'fadeUp 0.4s ease';

  // 滚动到结果区
  qrResult.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  // 清空更新输入框
  updateUrlInput.value = '';
}

// ========== 更新链接 ==========
updateBtn.addEventListener('click', async () => {
  if (!currentQrId) {
    showToast('请先生成二维码', 'error');
    return;
  }

  const url = updateUrlInput.value.trim();
  if (!url) {
    showToast('请输入新的 YouTube 链接', 'error');
    updateUrlInput.focus();
    return;
  }

  setLoading(updateBtn, true);

  try {
    const res = await fetch(`/api/qrcode/${currentQrId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });

    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || '更新失败', 'error');
      return;
    }

    // 更新显示（二维码图片不变）
    currentUrl.textContent = data.url;
    updatedAt.textContent = formatTime(data.updatedAt);

    showToast('链接已更新！二维码保持不变', 'success');
    updateUrlInput.value = '';
    loadHistory();
  } catch (err) {
    showToast('网络错误，请重试', 'error');
  } finally {
    setLoading(updateBtn, false);
  }
});

// ========== 下载 PNG ==========
downloadBtn.addEventListener('click', async () => {
  if (!currentQrId) return;

  setLoading(downloadBtn, true);

  try {
    const res = await fetch(`/api/qrcode/${currentQrId}/image?size=1024`);

    if (!res.ok) {
      showToast('下载失败，请重试', 'error');
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qr-code-${currentQrId}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('PNG 图片已下载', 'success');
  } catch (err) {
    showToast('下载失败，请重试', 'error');
  } finally {
    setLoading(downloadBtn, false);
  }
});

// ========== 复制跳转链接 ==========
copyBtn.addEventListener('click', async () => {
  if (!currentQrId) return;

  const text = redirectUrl.textContent;

  try {
    await navigator.clipboard.writeText(text);
    showToast('跳转链接已复制到剪贴板', 'success');
  } catch {
    // 降级方案
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showToast('跳转链接已复制', 'success');
  }
});

// ========== 历史记录 ==========
async function loadHistory() {
  try {
    const res = await fetch('/api/qrcodes');
    const codes = await res.json();

    historyCount.textContent = codes.length;

    if (codes.length === 0) {
      historyList.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.3">
            <rect x="3" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/>
            <path d="M14 14h3v3h-3z M17 17h4 M14 21h3 M21 14v3 M21 21v-0.01"/>
          </svg>
          <p>暂无历史记录</p>
          <span>生成第一个二维码吧！</span>
        </div>
      `;
      return;
    }

    historyList.innerHTML = codes.map(code => `
      <div class="history-item ${code.id === currentQrId ? 'active' : ''}" data-id="${code.id}">
        <div class="history-qr-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/>
            <path d="M14 14h3v3h-3z M17 17h4 M14 21h3 M21 14v3 M21 21v-0.01"/>
          </svg>
        </div>
        <div class="history-info">
          <div class="history-url">${escapeHtml(truncateUrl(code.url, 55))}</div>
          <div class="history-meta">${formatTime(code.createdAt)} ${code.updatedAt !== code.createdAt ? '· 已更新' : ''}</div>
        </div>
        <button class="history-delete" data-id="${code.id}" title="删除">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
    `).join('');

    // 绑定点击事件 - 加载历史二维码
    historyList.querySelectorAll('.history-item').forEach(item => {
      item.addEventListener('click', async (e) => {
        if (e.target.closest('.history-delete')) return;

        const id = item.dataset.id;
        await loadQrCode(id);
      });
    });

    // 绑定删除事件
    historyList.querySelectorAll('.history-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        await deleteQrCode(id);
      });
    });

  } catch (err) {
    console.error('加载历史失败:', err);
  }
}

// ========== 加载历史二维码 ==========
async function loadQrCode(id) {
  try {
    const res = await fetch(`/api/qrcode/${id}`);
    if (!res.ok) return;

    const info = await res.json();

    // 获取二维码图片
    const qrRes = await fetch(`/api/qrcode/${id}/image?size=400`);
    if (!qrRes.ok) return;

    const blob = await qrRes.blob();
    const reader = new FileReader();

    reader.onloadend = () => {
      displayQrCode({
        id: info.id,
        qrCode: reader.result,
        redirectUrl: info.redirectUrl,
        url: info.url,
        createdAt: info.createdAt,
        updatedAt: info.updatedAt
      });
      showToast('已加载历史二维码', 'info');
    };

    reader.readAsDataURL(blob);
  } catch (err) {
    showToast('加载失败', 'error');
  }
}

// ========== 删除二维码 ==========
async function deleteQrCode(id) {
  try {
    const res = await fetch(`/api/qrcode/${id}`, { method: 'DELETE' });
    if (!res.ok) return;

    showToast('已删除', 'success');

    if (id === currentQrId) {
      currentQrId = null;
      qrResult.style.display = 'none';
      updateSection.style.display = 'none';
    }

    loadHistory();
  } catch (err) {
    showToast('删除失败', 'error');
  }
}

// ========== HTML 转义 ==========
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ========== 配置加载 ==========
async function loadConfig() {
  try {
    const res = await fetch('/api/config');
    const config = await res.json();

    if (config.cloudMode) {
      // 云部署模式 - 隐藏局域网配置，显示云端地址
      configSection.style.display = 'none';
      configDivider.style.display = 'none';
      cloudBanner.style.display = 'flex';
      cloudUrl.textContent = config.baseUrl;
    } else {
      // 本地模式 - 显示局域网配置
      configSection.style.display = '';
      configDivider.style.display = '';
      cloudBanner.style.display = 'none';

      detectedIp.textContent = config.lanIp;

      if (config.configuredUrl) {
        baseUrlInput.value = config.configuredUrl;
        configStatus.textContent = '已自定义';
        configStatus.className = 'config-status custom';
      } else {
        baseUrlInput.value = '';
        configStatus.textContent = `使用 ${config.lanIp}:${config.port}`;
        configStatus.className = 'config-status auto';
      }
    }
  } catch (err) {
    configStatus.textContent = '获取失败';
    configStatus.className = 'config-status error';
  }
}

// ========== 保存配置 ==========
saveConfigBtn.addEventListener('click', async () => {
  const baseUrl = baseUrlInput.value.trim();

  try {
    const res = await fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseUrl })
    });

    const config = await res.json();

    if (!res.ok) {
      showToast(config.error || '保存失败', 'error');
      return;
    }

    if (config.configuredUrl) {
      configStatus.textContent = '已自定义';
      configStatus.className = 'config-status custom';
    } else {
      configStatus.textContent = `使用 ${config.lanIp}:${config.port}`;
      configStatus.className = 'config-status auto';
    }

    showToast('地址已保存，新生成的二维码将使用此地址', 'success');

    // 如果当前有二维码，提示用户需重新生成
    if (currentQrId) {
      showToast('提示：已生成的二维码需重新生成才能使用新地址', 'info');
    }
  } catch (err) {
    showToast('网络错误', 'error');
  }
});

// ========== 回车键支持 ==========
urlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') generateBtn.click();
});

updateUrlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') updateBtn.click();
});

baseUrlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveConfigBtn.click();
});

// ========== 初始化 ==========
loadConfig();
loadHistory();
