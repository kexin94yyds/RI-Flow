// Web 版本的存储适配器（使用 localStorage）
const webStorage = {
  get: async (key) => {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  },
  set: async (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }
};

// Web 版本的 API 适配器
const webAPI = {
  // 获取所有收藏
  getItems: async () => {
    return await webStorage.get('items') || [];
  },
  
  // 保存新收藏
  saveItem: async (item) => {
    const items = await webAPI.getItems();
    items.unshift(item);
    await webStorage.set('items', items);
    return items;
  },
  
  // 删除收藏
  deleteItem: async (id) => {
    const items = await webAPI.getItems();
    const newItems = items.filter(i => i.id !== id);
    await webStorage.set('items', newItems);
    return newItems;
  },
  
  // 更新所有收藏（用于排序）
  updateItems: async (newItems) => {
    await webStorage.set('items', newItems);
    return newItems;
  },
  
  // 切换置顶
  togglePin: async (id) => {
    const items = await webAPI.getItems();
    const index = items.findIndex(i => i.id === id);
    if (index !== -1) {
      items[index].pinned = !items[index].pinned;
      items.sort((a, b) => {
        if (a.pinned === b.pinned) return 0;
        return a.pinned ? -1 : 1;
      });
      await webStorage.set('items', items);
    }
    return items;
  },
  
  // 读取剪贴板（Web API）
  readClipboard: async () => {
    try {
      const text = await navigator.clipboard.readText();
      return text;
    } catch (e) {
      // 降级方案：提示用户手动粘贴
      return '';
    }
  },
  
  // 抓取元数据（需要后端 API）
  fetchMetadata: async (url) => {
    try {
      // 使用 CORS 代理或后端 API
      // 这里先用一个简单的代理服务
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
      const response = await fetch(proxyUrl);
      const data = await response.json();
      const html = data.contents;
      
      // 使用 DOMParser 解析 HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      const title = doc.querySelector('meta[property="og:title"]')?.content ||
                   doc.querySelector('meta[name="twitter:title"]')?.content ||
                   doc.querySelector('title')?.textContent || '';
      
      const image = doc.querySelector('meta[property="og:image"]')?.content ||
                   doc.querySelector('meta[name="twitter:image"]')?.content || '';
      
      return { title: title.trim(), image };
    } catch (error) {
      console.error('Fetch metadata error:', error);
      return { title: '', image: '' };
    }
  }
};

// 检测运行环境
let isElectron = false;
try {
  if (typeof require !== 'undefined') {
    const electron = require('electron');
    isElectron = !!electron;
  }
} catch (e) {
  isElectron = false;
}

// 导出适配的 API
if (isElectron) {
  // Electron 环境，使用原有 IPC
  try {
    const { ipcRenderer } = require('electron');
    window.webAPI = {
      getItems: () => ipcRenderer.invoke('get-items'),
      saveItem: (item) => ipcRenderer.invoke('save-item', item),
      deleteItem: (id) => ipcRenderer.invoke('delete-item', id),
      updateItems: (items) => ipcRenderer.invoke('update-items', items),
      togglePin: (id) => ipcRenderer.invoke('toggle-pin', id),
      readClipboard: () => ipcRenderer.invoke('read-clipboard'),
      fetchMetadata: (url) => ipcRenderer.invoke('fetch-metadata', url)
    };
  } catch (e) {
    // 降级到 Web API
    window.webAPI = webAPI;
  }
} else {
  // Web 环境
  window.webAPI = webAPI;
}

