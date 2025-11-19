// Web 版本的 dashboard.js（适配移动端）
document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('grid');
  const filters = document.getElementById('filters');
  const showAddModalBtn = document.getElementById('showAddModalBtn');
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

  // 确保 webAPI 已加载
  if (!window.webAPI) {
    console.error('webAPI 未加载');
    return;
  }

  // 加载数据
  async function loadItems() {
    allItems = await window.webAPI.getItems();
    const activeBtn = document.querySelector('.filter-btn.active');
    const filter = activeBtn ? activeBtn.dataset.filter : 'all';
    renderGrid(filter === 'all' ? allItems : allItems.filter(item => item.platform === filter));
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
        ${item.image ? `<div style="height: 140px; background-image: url('${item.image}'); background-size: cover; background-position: center;"></div>` : ''}
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
  }

  // 过滤事件
  filters.addEventListener('click', (e) => {
    if (e.target.classList.contains('filter-btn')) {
      document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
      e.target.classList.add('active');
      const filter = e.target.dataset.filter;
      renderGrid(filter === 'all' ? allItems : allItems.filter(item => item.platform === filter));
    }
  });

  // 显示添加弹窗
  showAddModalBtn.addEventListener('click', async () => {
    addModal.classList.add('show');
    currentImage = '';
    imagePreview.style.display = 'none';
    
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
    
    inputUrl.focus();
  });

  // 关闭弹窗
  cancelAddBtn.addEventListener('click', () => {
    addModal.classList.remove('show');
  });

  // URL 输入监听
  inputUrl.addEventListener('input', () => {
    const url = inputUrl.value.trim();
    if (!url) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => fetchMetadata(url), 500);
  });

  // 抓取元数据
  async function fetchMetadata(url) {
    if (!url.startsWith('http')) return;
    inputTitle.placeholder = '正在获取标题...';
    try {
      const data = await window.webAPI.fetchMetadata(url);
      if (data.title) inputTitle.value = data.title;
      if (data.image) {
        currentImage = data.image;
        imagePreview.style.display = 'block';
        imagePreview.querySelector('img').src = data.image;
      } else {
        imagePreview.style.display = 'none';
      }
    } catch (e) {
      console.error(e);
    } finally {
      inputTitle.placeholder = '输入标题...';
    }
  }

  // 确认添加
  confirmAddBtn.addEventListener('click', async () => {
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
    renderGrid(allItems);
    addModal.classList.remove('show');
    
    // 清空表单
    inputUrl.value = '';
    inputTitle.value = '';
    inputNote.value = '';
    imagePreview.style.display = 'none';
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
});

