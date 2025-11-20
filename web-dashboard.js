// Web 版本的 dashboard.js（适配移动端）
document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('grid');
  const filters = document.getElementById('filters');
  const showAddModalBtn = document.getElementById('showAddModalBtn');
  const importDesktopBtn = document.getElementById('importDesktopBtn');
  const exportBtn = document.getElementById('exportBtn');
  const importBtn = document.getElementById('importBtn');
  const importFile = document.getElementById('importFile');
  const addModal = document.getElementById('addModal');
  const cancelAddBtn = document.getElementById('cancelAddBtn');
  const confirmAddBtn = document.getElementById('confirmAddBtn');

  const inputUrl = document.getElementById('inputUrl');
  const inputTitle = document.getElementById('inputTitle');
  const inputCategory = document.getElementById('inputCategory');
  const inputNote = document.getElementById('inputNote');
  const imagePreview = document.getElementById('imagePreview');

  let allItems = [];
  let currentImage = '';
  let debounceTimer;
  let sortableInstance;

  // 确保 webAPI 已加载
  if (!window.webAPI) {
    console.error('webAPI 未加载');
    return;
  }

  function getActiveFilter() {
    const activeBtn = document.querySelector('.filter-btn.active');
    return activeBtn ? activeBtn.dataset.filter : 'all';
  }

  function getFilteredItems(items = allItems) {
    const filter = getActiveFilter();
    return filter === 'all' ? items : items.filter(item => item.platform === filter);
  }

  // 加载数据
  async function loadItems() {
    allItems = await window.webAPI.getItems();
    renderGrid(getFilteredItems(allItems));
  }

  // 渲染网格
  function renderGrid(items) {
    grid.innerHTML = '';

    if (items.length === 0) {
      grid.innerHTML = '<div class="empty-state">暂无内容，点击右上角"添加"按钮开始收藏</div>';
      return;
    }

    items.forEach(item => {
      const card = document.createElement('div');
      card.className = `card ${item.pinned ? 'pinned' : ''}`;
      card.dataset.id = item.id;

      card.innerHTML = `
        <div class="pin-icon" title="${item.pinned ? '取消置顶' : '置顶'}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="17" x2="12" y2="22"></line>
            <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path>
          </svg>
        </div>
        ${item.image ? `<div style="height: 140px; background-image: url('${item.image}'); background-size: contain; background-repeat: no-repeat; background-position: center; background-color: #f3f4f6;"></div>` : ''}
        <div class="card-content">
          <div class="card-meta">
            <span class="platform-tag platform-${item.platform}">${item.platform}</span>
            <span class="category-tag">${getCategoryName(item.category)}</span>
          </div>
          <h3 class="card-title">
            <a href="${item.url}" target="_blank">${escapeHtml(item.title)}</a>
          </h3>
          ${item.note ? `<div class="card-note">${escapeHtml(item.note)}</div>` : ''}
        </div>
        <div class="card-footer">
          <span class="date">${new Date(item.createdAt).toLocaleDateString()}</span>
          <button class="delete-btn" data-id="${item.id}">删除</button>
        </div>
      `;

      card.querySelector('.pin-icon').addEventListener('click', async (e) => {
        e.stopPropagation();
        allItems = await window.webAPI.togglePin(item.id);
        loadItems();
      });

      grid.appendChild(card);
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        if (confirm('确定要删除吗？')) {
          allItems = await window.webAPI.deleteItem(id);
          loadItems();
        }
      });
    });

    initSortable();
  }

  function initSortable() {
    if (!window.Sortable || !grid) return;

    if (sortableInstance) {
      sortableInstance.destroy();
    }

    const cards = grid.querySelectorAll('.card');
    if (!cards.length) return;

    sortableInstance = new Sortable(grid, {
      animation: 150,
      ghostClass: 'sortable-ghost',
      dragClass: 'sortable-drag',
      draggable: '.card',
      delay: 80,
      filter: '.delete-btn, .pin-icon, a',
      preventOnFilter: false,
      onEnd: async () => {
        const orderedIds = Array.from(grid.querySelectorAll('.card')).map(card => card.dataset.id);
        if (!orderedIds.length) return;

        const activeFilter = getActiveFilter();
        const orderedIdSet = new Set(orderedIds);
        const reorderedVisible = orderedIds
          .map(id => allItems.find(item => item.id === id))
          .filter(Boolean);

        let nextAllItems;
        if (activeFilter === 'all') {
          const missingItems = allItems.filter(item => !orderedIdSet.has(item.id));
          nextAllItems = [...reorderedVisible, ...missingItems];
        } else {
          const visibleQueue = [...reorderedVisible];
          nextAllItems = allItems.map(item => {
            if (orderedIdSet.has(item.id)) {
              const nextItem = visibleQueue.shift();
              return nextItem || item;
            }
            return item;
          });
        }

        allItems = nextAllItems;

        if (activeFilter !== 'all') {
          renderGrid(getFilteredItems(allItems));
        }

        try {
          await window.webAPI.updateItems(allItems);
        } catch (err) {
          console.error('更新排序失败', err);
        }
      }
    });
  }

  // 过滤事件
  filters.addEventListener('click', (e) => {
    if (e.target.classList.contains('filter-btn')) {
      document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
      e.target.classList.add('active');
      renderGrid(getFilteredItems(allItems));
    }
  });

  // 导入桌面端数据
  const importDesktopModal = document.getElementById('importDesktopModal');
  const desktopIpInput = document.getElementById('desktopIpInput');
  const cancelImportBtn = document.getElementById('cancelImportBtn');
  const confirmImportBtn = document.getElementById('confirmImportBtn');
  
  if (importDesktopBtn) {
    importDesktopBtn.addEventListener('click', () => {
      if (importDesktopModal) {
        importDesktopModal.style.display = 'flex';
        desktopIpInput.value = '';
        desktopIpInput.focus();
      }
    });
  }
  
  if (cancelImportBtn) {
    cancelImportBtn.addEventListener('click', () => {
      if (importDesktopModal) {
        importDesktopModal.style.display = 'none';
      }
    });
  }
  
  if (confirmImportBtn) {
    confirmImportBtn.addEventListener('click', async () => {
      if (!window.webAPI || !window.webAPI.tryImportFromDesktop) {
        alert('此功能需要桌面端应用运行在本地服务器（端口 3000）\n\n请确保：\n1. 桌面端应用正在运行\n2. 手机和电脑在同一 WiFi 网络');
        return;
      }
      
      const customIp = desktopIpInput.value.trim();
      confirmImportBtn.disabled = true;
      confirmImportBtn.textContent = '正在导入...';
      
      try {
        const result = await window.webAPI.tryImportFromDesktop(customIp || null);
        if (result.success) {
          alert(`✅ 成功导入 ${result.count} 条数据！`);
          // 重新加载数据
          await loadItems();
          if (importDesktopModal) {
            importDesktopModal.style.display = 'none';
          }
        } else {
          alert('❌ 无法连接到桌面端\n\n请确保：\n1. 桌面端应用正在运行\n2. 手机和电脑在同一 WiFi 网络\n3. 输入正确的电脑 IP 地址\n\n如何获取电脑 IP：\n- Mac: 系统设置 → 网络\n- Windows: ipconfig');
        }
      } catch (e) {
        console.error('Import error:', e);
        alert('导入失败：' + e.message);
      } finally {
        confirmImportBtn.disabled = false;
        confirmImportBtn.textContent = '开始导入';
      }
    });
  }
  
  // 点击背景关闭弹窗
  if (importDesktopModal) {
    importDesktopModal.addEventListener('click', (e) => {
      if (e.target === importDesktopModal) {
        importDesktopModal.style.display = 'none';
      }
    });
  }

  // 显示添加弹窗
  showAddModalBtn.addEventListener('click', async () => {
    addModal.classList.add('show');
    currentImage = '';
    imagePreview.style.display = 'none';
    
    // 重置表单
    inputUrl.value = '';
    inputTitle.value = '';
    inputNote.value = '';
    inputTitle.placeholder = '输入标题...';

    // 尝试读取剪贴板
    try {
      const text = await window.webAPI.readClipboard();
      if (text && (text.startsWith('http') || text.startsWith('www'))) {
        inputUrl.value = text;
        fetchMetadata(text);
      }
    } catch (e) {
      console.log('无法读取剪贴板，请手动粘贴');
    }

    // 聚焦并选中 URL 输入框（方便直接替换）
    inputUrl.focus();
    inputUrl.select();
  });

  // 关闭弹窗
  cancelAddBtn.addEventListener('click', () => {
    addModal.classList.remove('show');
    // 重置表单
    inputUrl.value = '';
    inputTitle.value = '';
    inputNote.value = '';
    imagePreview.style.display = 'none';
    currentImage = '';
    inputTitle.placeholder = '输入标题...';
  });

  // 导出功能 (仅在有此按钮时绑定)
  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      const items = await window.webAPI.getItems();
      const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `info-filter-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  // 导入功能
  if (importBtn && importFile) {
    importBtn.addEventListener('click', () => {
      importFile.click();
    });
  }

  if (importFile) {
    importFile.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const importedItems = JSON.parse(e.target.result);
          if (!Array.isArray(importedItems)) {
            alert('文件格式错误：必须是 JSON 数组');
            return;
          }

          if (confirm(`准备导入 ${importedItems.length} 条数据。是否合并到现有数据中？\n(点击"取消"将放弃导入)`)) {
            const currentItems = await window.webAPI.getItems();
            // 合并策略：ID 去重，保留导入的数据优先
            const map = new Map();

            importedItems.forEach(item => map.set(item.id, item));
            currentItems.forEach(item => {
              if (!map.has(item.id)) {
                map.set(item.id, item);
              }
            });

            const mergedItems = Array.from(map.values()).sort((a, b) => {
              if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
              return new Date(b.createdAt) - new Date(a.createdAt);
            });

            await window.webAPI.updateItems(mergedItems);
            loadItems();
            alert('导入成功！');
          }
        } catch (err) {
          console.error(err);
          alert('导入失败：无法解析文件');
        }
        importFile.value = '';
      };
      reader.readAsText(file);
    });
  }

  // URL 输入监听（自动抓取元数据）
  if (inputUrl) {
    inputUrl.addEventListener('input', () => {
      const url = inputUrl.value.trim();
      if (!url) {
        imagePreview.style.display = 'none';
        return;
      }
      
      // 防抖处理，与桌面端一致（500ms）
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (url.startsWith('http') || url.startsWith('www')) {
          fetchMetadata(url);
        }
      }, 500);
    });
  }

  // 抓取元数据（与桌面端功能一致）
  async function fetchMetadata(url) {
    if (!url.startsWith('http') && !url.startsWith('www')) return;
    
    // 显示加载状态
    inputTitle.placeholder = '正在获取信息...';
    
    try {
      const data = await window.webAPI.fetchMetadata(url);
      if (data.title) {
        inputTitle.value = data.title;
      }
      if (data.image) {
        currentImage = data.image;
        imagePreview.style.display = 'block';
        imagePreview.querySelector('img').src = data.image;
      } else {
        imagePreview.style.display = 'none';
      }
      // 成功提示（可选，可以通过 placeholder 显示）
      inputTitle.placeholder = '输入标题...';
    } catch (e) {
      console.error('获取元数据失败:', e);
      inputTitle.placeholder = '输入标题...';
      imagePreview.style.display = 'none';
    }
  }

  // 保存并关闭弹窗
  async function saveAndClose() {
    if (!inputUrl.value) return;

    const newItem = {
      id: Date.now().toString(),
      url: inputUrl.value,
      title: inputTitle.value || inputUrl.value,
      category: inputCategory.value,
      note: inputNote.value,
      image: currentImage,
      platform: getPlatform(inputUrl.value),
      createdAt: new Date().toISOString(),
      pinned: false
    };

    allItems = await window.webAPI.saveItem(newItem);
    renderGrid(getFilteredItems(allItems));
    addModal.classList.remove('show');

    // 清空表单
    inputUrl.value = '';
    inputTitle.value = '';
    inputNote.value = '';
    imagePreview.style.display = 'none';
    currentImage = '';
  }

  // 确认添加
  confirmAddBtn.addEventListener('click', saveAndClose);

  // 键盘事件处理（与桌面端一致）
  document.addEventListener('keydown', async (e) => {
    // 只在弹窗显示时处理
    if (!addModal.classList.contains('show')) return;

    // Cmd+Enter 或 Ctrl+Enter 在备注框中换行
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      if (document.activeElement === inputNote) {
        // 允许换行，不阻止默认行为
        return;
      }
    }

    // Enter 键保存
    if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      saveAndClose();
    }

    // Escape 键关闭弹窗
    if (e.key === 'Escape') {
      addModal.classList.remove('show');
    }
  });

  function getPlatform(url) {
    if (!url) return 'Web';
    if (url.includes('twitter.com') || url.includes('x.com')) return 'Twitter';
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'YouTube';
    return 'Web';
  }

  function getCategoryName(key) {
    const map = { 'read_later': '稍后阅读', 'learning': '学习资料', 'inspiration': '灵感', 'entertainment': '娱乐' };
    return map[key] || key;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // 初始化
  loadItems();

  // 初始化 API
  // web-api.js 会自动检测环境并设置 window.webAPI
  // 我们只需要调用 subscribe 来监听数据更新
  if (window.webAPI && window.webAPI.subscribe) {
    window.webAPI.subscribe((items) => {
      console.log('Received items update:', items);
      if (items && Array.isArray(items)) {
        allItems = items;
        renderGrid(getFilteredItems(items));
      }
    });
  }

  // 主动获取一次数据（确保页面加载时显示数据，即使没有连接也能工作）
  setTimeout(async () => {
    if (window.webAPI && window.webAPI.getItems) {
      try {
        const items = await window.webAPI.getItems();
        if (items && Array.isArray(items) && items.length > 0) {
          allItems = items;
          renderGrid(getFilteredItems(items));
        } else {
          // 如果没有数据，显示导入提示
          showImportHint();
        }
      } catch (e) {
        console.error('Failed to load items:', e);
        showImportHint();
      }
    } else {
      showImportHint();
    }
  }, 100);
  
  // 显示导入提示
  function showImportHint() {
    // 检查是否已经显示过提示
    if (localStorage.getItem('import-hint-shown')) return;
    
    const hintDiv = document.createElement('div');
    hintDiv.style.cssText = 'position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: #10b981; color: white; padding: 12px 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 1000; display: flex; align-items: center; gap: 12px; max-width: 90%;';
    hintDiv.innerHTML = `
      <span>💡 点击"📥 导入桌面数据"按钮，从桌面端导入数据</span>
      <button id="closeHintBtn" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 4px 8px; border-radius: 4px; cursor: pointer;">✕</button>
    `;
    document.body.appendChild(hintDiv);
    
    const closeBtn = hintDiv.querySelector('#closeHintBtn');
    closeBtn.addEventListener('click', () => {
      hintDiv.remove();
      localStorage.setItem('import-hint-shown', 'true');
    });
    
    // 5秒后自动消失
    setTimeout(() => {
      if (hintDiv.parentNode) {
        hintDiv.remove();
        localStorage.setItem('import-hint-shown', 'true');
      }
    }, 5000);
  }

  // 检查网络连接状态（仅在非 Electron 环境下）
  if (!window.electron) {
    const statusDiv = document.createElement('div');
    statusDiv.style.cssText = 'position: fixed; bottom: 10px; right: 10px; padding: 4px 8px; border-radius: 4px; font-size: 12px; color: white; pointer-events: none; z-index: 1000;';
    document.body.appendChild(statusDiv);

    if (window.webAPI.baseUrl) {
      statusDiv.textContent = '已连接电脑';
      statusDiv.style.background = 'rgba(16, 185, 129, 0.8)';
    } else {
      statusDiv.textContent = '本地模式';
      statusDiv.style.background = 'rgba(107, 114, 128, 0.8)';
    }
  }
});
