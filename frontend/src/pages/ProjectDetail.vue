<template>
  <div class="project-detail">
    <div class="page-header">
      <h2>
        {{ projectName }}
        <span v-if="projectInfo" class="project-status-inline">
          <span :class="`status-badge status-${projectInfo.status}`" style="margin-left:0.6rem; font-size:0.9rem;">
            {{ projectInfo.status }}
          </span>
        </span>
      </h2>
      <div class="header-actions">
        <button class="btn btn-secondary" @click="showStatusManager = true">
          ⚙️ 状态管理
        </button>
        <button class="btn btn-secondary" @click="showTagManager = true">
          🏷️ 标签管理
        </button>
        <button class="btn btn-download" @click="showDownloadDialog = true">
          📦 按标签下载
        </button>
        
      </div>
    </div>

    <!-- 状态筛选器和视图切换 -->
    <div v-if="!loading" class="filter-toolbar">
      <div class="status-filter">
      <button 
        :class="['filter-btn', { active: selectedStatus === 'all' }]"
        @click="selectedStatus = 'all'"
      >
        全部 <span class="count">({{ allTasks.length }})</span>
      </button>
      <button 
        v-for="status in availableStatuses" 
        :key="status"
        :class="['filter-btn', `filter-${status}`, { active: selectedStatus === status }]"
        @click="selectedStatus = status"
      >
        {{ status }} <span class="count">({{ getStatusCount(status) }})</span>
      </button>
      </div>
      
      <!-- 视图切换按钮 -->
      <div class="view-switcher">
        <button 
          :class="['view-btn', { active: viewMode === 'grid' }]"
          @click="viewMode = 'grid'"
          title="卡片视图"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <rect x="2" y="2" width="7" height="7" rx="1"/>
            <rect x="11" y="2" width="7" height="7" rx="1"/>
            <rect x="2" y="11" width="7" height="7" rx="1"/>
            <rect x="11" y="11" width="7" height="7" rx="1"/>
          </svg>
        </button>
        <button 
          :class="['view-btn', { active: viewMode === 'list' }]"
          @click="viewMode = 'list'"
          title="列表视图"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <rect x="2" y="3" width="16" height="2" rx="1"/>
            <rect x="2" y="9" width="16" height="2" rx="1"/>
            <rect x="2" y="15" width="16" height="2" rx="1"/>
          </svg>
        </button>
      </div>
    </div>

    <div v-if="loading" class="loading">
      加载任务中...
    </div>

    <!-- 卡片视图 -->
    <div v-else-if="viewMode === 'grid'" class="tasks-grid">
      <div 
        v-for="task in filteredTasks" 
        :key="task.name"
        class="task-card"
        @click="goToTask(task.name)"
      >
        <div class="task-header">
          <h3>{{ task.name }}</h3>
          <span :class="`status-badge status-${task.status}`">
            {{ task.status }}
          </span>
        </div>
        
        <div class="task-stats">
          <div class="stat">
            <span class="stat-number">{{ task.psdFiles || 0 }}</span>
            <span class="stat-label">文件数</span>
          </div>
        </div>
        
        <div v-if="task.description" class="task-description">
          {{ task.description }}
        </div>
        
        <div v-if="task.prompt" class="task-prompt">
          <strong>AI提示词：</strong>
          <p>{{ task.prompt }}</p>
        </div>
        
        <div class="task-footer">
          <button class="btn btn-primary">进入任务</button>
        </div>
      </div>
      
      <div v-if="filteredTasks.length === 0" class="empty-state">
        <p v-if="allTasks.length === 0">暂无任务</p>
        <p v-else>该状态下暂无任务</p>
        <p class="empty-help" v-if="allTasks.length === 0">
          请在项目目录中创建任务文件夹
        </p>
      </div>
    </div>

    <!-- 列表视图 (表格样式) -->
    <div v-else-if="viewMode === 'list'" class="tasks-table">
      <div class="table-header">
        <div class="table-cell cell-name">任务名称</div>
        <div class="table-cell cell-status">状态</div>
        <div class="table-cell cell-files">文件数</div>
        <div class="table-cell cell-description">描述</div>
        <div class="table-cell cell-prompt">AI提示词</div>
        <div class="table-cell cell-action">操作</div>
      </div>
      
      <div 
        v-for="task in filteredTasks" 
        :key="task.name"
        class="table-row"
        @click="goToTask(task.name)"
      >
        <div class="table-cell cell-name">
          <strong>{{ task.name }}</strong>
        </div>
        <div class="table-cell cell-status">
          <span :class="`status-badge status-${task.status}`">
            {{ task.status }}
          </span>
        </div>
        <div class="table-cell cell-files">
          <span class="file-count">{{ task.psdFiles || 0 }}</span>
        </div>
        <div class="table-cell cell-description">
          <span class="text-truncate">{{ task.description || '-' }}</span>
        </div>
        <div class="table-cell cell-prompt">
          <span class="text-truncate">{{ task.prompt || '-' }}</span>
        </div>
        <div class="table-cell cell-action">
          <button class="btn btn-primary btn-sm" @click.stop="goToTask(task.name)">
            进入
          </button>
        </div>
      </div>
      
      <div v-if="filteredTasks.length === 0" class="table-empty">
        <p v-if="allTasks.length === 0">暂无任务</p>
        <p v-else>该状态下暂无任务</p>
        <p class="empty-help" v-if="allTasks.length === 0">
          请在项目目录中创建任务文件夹
        </p>
      </div>
    </div>

    <!-- 按标签下载对话框 -->
    <div v-if="showDownloadDialog" class="download-modal" @click.self="showDownloadDialog = false">
      <div class="download-dialog">
        <h3>按标签批量下载</h3>
        
        <div v-if="loadingTags" class="loading-tags">
          加载标签中...
        </div>
        
        <div v-else-if="availableTags.length === 0" class="no-tags">
          <p>项目中暂无标签</p>
          <p class="help-text">请先为文件添加标签</p>
        </div>
        
        <div v-else class="tags-list">
          <div 
            v-for="tag in availableTags" 
            :key="tag"
            class="tag-item"
            @click="selectTag(tag)"
          >
            <div class="tag-info">
              <span class="tag-label">🏷️ {{ tag }}</span>
              <span v-if="selectedTag === tag" class="tag-count">
                {{ tagFileCount }} 个文件
              </span>
            </div>
            <button 
              v-if="selectedTag === tag" 
              class="btn btn-primary btn-sm"
              @click.stop="downloadByTag(tag)"
              :disabled="downloading"
            >
              {{ downloading ? '下载中...' : '下载' }}
            </button>
          </div>
        </div>
        
        <div class="dialog-actions">
          <button class="btn btn-secondary" @click="showDownloadDialog = false">
            关闭
          </button>
        </div>
      </div>
    </div>

    <!-- 状态管理对话框 -->
    <div v-if="showStatusManager" class="status-manager-modal" @click.self="showStatusManager = false">
      <div class="status-manager-dialog">
        <h3>状态管理</h3>
        
        <div class="current-statuses">
          <h4>当前状态列表</h4>
          <div class="status-list">
            <div 
              v-for="(status, index) in allowedStatuses" 
              :key="index"
              class="status-item"
            >
              <input 
                v-model="allowedStatuses[index]"
                class="status-input"
                placeholder="状态名称"
              />
              <div class="status-preview">
                <span :class="`status-badge status-${status}`">{{ status }}</span>
              </div>
              <button 
                class="btn btn-danger btn-sm"
                @click="removeStatus(index)"
                :disabled="allowedStatuses.length <= 1"
              >
                删除
              </button>
            </div>
          </div>
          
          <button class="btn btn-secondary" @click="addNewStatus">
            ➕ 添加新状态
          </button>
        </div>
        
        <div class="status-tips">
          <p><strong>提示：</strong></p>
          <ul>
            <li>常用状态：pending（待处理）、active（进行中）、completed（已完成）、paused（暂停）</li>
            <li>状态名称会影响显示颜色</li>
            <li>至少需要保留一个状态</li>
          </ul>
        </div>
        
        <div class="dialog-actions">
          <button class="btn btn-secondary" @click="cancelStatusEdit">
            取消
          </button>
          <button class="btn btn-primary" @click="saveStatuses">
            保存
          </button>
        </div>
      </div>
    </div>

    <!-- 标签管理对话框 -->
    <div v-if="showTagManager" class="status-manager-modal" @click.self="showTagManager = false">
      <div class="status-manager-dialog">
        <h3>标签管理</h3>
        
        <div class="current-statuses">
          <h4>当前标签列表</h4>
          <div class="status-list">
            <div 
              v-for="(tag, index) in allowedTags" 
              :key="index"
              class="status-item"
            >
              <input 
                v-model="allowedTags[index]"
                class="status-input"
                placeholder="标签名称"
                maxlength="10"
              />
              <button 
                class="btn btn-danger btn-sm"
                @click="removeTag(index)"
                :disabled="allowedTags.length <= 1"
              >
                删除
              </button>
            </div>
          </div>
          
          <button class="btn btn-secondary" @click="addNewTag">
            ➕ 添加新标签
          </button>
        </div>
        
        <div class="status-tips">
          <p><strong>提示：</strong></p>
          <ul>
            <li>标签用于文件分类和批量下载</li>
            <li>常用标签：初稿、定稿、客户审核、最终版等</li>
            <li>标签名称最多10个字符</li>
            <li>至少需要保留一个标签</li>
          </ul>
        </div>
        
        <div class="dialog-actions">
          <button class="btn btn-secondary" @click="cancelTagEdit">
            取消
          </button>
          <button class="btn btn-primary" @click="saveTags">
            保存
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios'

export default {
  name: 'ProjectDetail',
  props: ['projectName'],
  data() {
    return {
      allTasks: [],
      projectInfo: null,
      loading: true,
      selectedStatus: 'all',
      viewMode: 'grid', // 'grid' 或 'list'
      showDownloadDialog: false,
      showStatusManager: false,
      showTagManager: false,
      allowedStatuses: ['pending', 'active', 'completed', 'paused'],
      originalStatuses: [],
      allowedTags: ['初稿', '定稿', '客户审核', '最终版'],
      originalTags: [],
      availableTags: [],
      loadingTags: false,
      selectedTag: null,
      tagFileCount: 0,
      downloading: false
    }
  },
  computed: {
    filteredTasks() {
      if (this.selectedStatus === 'all') {
        return this.allTasks
      }
      return this.allTasks.filter(task => task.status === this.selectedStatus)
    },
    availableStatuses() {
      // 合并允许的状态和任务中实际使用的状态
      const taskStatuses = [...new Set(this.allTasks.map(task => task.status || 'pending'))]
      const combined = [...new Set([...this.allowedStatuses, ...taskStatuses])]
      return combined.sort()
    }
  },
  async mounted() {
    await this.loadProject()
  },
  watch: {
    projectName: {
      handler: 'loadProject',
      immediate: false
    },
    showDownloadDialog(newVal) {
      if (newVal) {
        this.loadAvailableTags()
      } else {
        this.selectedTag = null
        this.tagFileCount = 0
      }
    }
  },
  methods: {
    async loadProject() {
      this.loading = true
      try {
        // 加载项目信息
        const projectResponse = await axios.get(`/api/projects/${this.projectName}`)
        this.projectInfo = projectResponse.data
        this.allTasks = projectResponse.data.tasks || []
        this.selectedStatus = 'all'
        // 更新页面标题为 DPM - [项目Name]
        try {
          document.title = `DPM - ${this.projectName}`
        } catch (e) {
          // 在非浏览器环境中安全忽略
        }
        
        // 从项目信息中读取allowedStatuses
        if (projectResponse.data.allowedStatuses && Array.isArray(projectResponse.data.allowedStatuses)) {
          this.allowedStatuses = projectResponse.data.allowedStatuses
          this.originalStatuses = [...this.allowedStatuses]
        }
        
        // 从项目信息中读取allowedTags
        if (projectResponse.data.allowedTags && Array.isArray(projectResponse.data.allowedTags)) {
          this.allowedTags = projectResponse.data.allowedTags
          this.originalTags = [...this.allowedTags]
        }
        
      } catch (error) {
        console.error('Failed to load project:', error)
        this.$router.push('/')
      } finally {
        this.loading = false
      }
    },
    
    goToTask(taskName) {
      this.$router.push(`/project/${this.projectName}/task/${taskName}`)
    },
    
    getStatusCount(status) {
      return this.allTasks.filter(task => task.status === status).length
    },
    
    async loadAvailableTags() {
      this.loadingTags = true
      try {
        const response = await axios.get(`/api/download/tags/${this.projectName}`)
        this.availableTags = response.data
      } catch (error) {
        console.error('加载标签失败:', error)
        alert('加载标签失败：' + (error.response?.data?.error || error.message))
      } finally {
        this.loadingTags = false
      }
    },
    
    async selectTag(tag) {
      this.selectedTag = tag
      try {
        const response = await axios.get(`/api/download/files-by-tag/${this.projectName}/${tag}`)
        this.tagFileCount = response.data.length
      } catch (error) {
        console.error('获取标签文件数失败:', error)
        this.tagFileCount = 0
      }
    },
    
    async downloadByTag(tag) {
      this.downloading = true
      try {
        const response = await axios.get(
          `/api/download/download-by-tag/${this.projectName}/${tag}`,
          { responseType: 'blob' }
        )
        
        // 创建下载链接
        const url = window.URL.createObjectURL(new Blob([response.data]))
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', `${this.projectName}_${tag}_${Date.now()}.zip`)
        document.body.appendChild(link)
        link.click()
        link.remove()
        window.URL.revokeObjectURL(url)
        
        // 下载成功后关闭对话框
        setTimeout(() => {
          this.showDownloadDialog = false
        }, 500)
      } catch (error) {
        console.error('下载失败:', error)
        alert('下载失败：' + (error.response?.data?.error || error.message))
      } finally {
        this.downloading = false
      }
    },
    
    addNewStatus() {
      this.allowedStatuses.push('new-status')
    },
    
    removeStatus(index) {
      if (this.allowedStatuses.length > 1) {
        this.allowedStatuses.splice(index, 1)
      }
    },
    
    cancelStatusEdit() {
      this.allowedStatuses = [...this.originalStatuses]
      this.showStatusManager = false
    },
    
    async saveStatuses() {
      // 过滤空状态
      this.allowedStatuses = this.allowedStatuses.filter(s => s && s.trim())
      
      // 确保至少有一个状态
      if (this.allowedStatuses.length === 0) {
        this.allowedStatuses = ['pending']
      }
      
      try {
        // 保存到服务器（更新README.md）
        await axios.put(`/api/projects/${this.projectName}/allowed-statuses`, {
          allowedStatuses: this.allowedStatuses
        })
        
        this.originalStatuses = [...this.allowedStatuses]
        this.showStatusManager = false
        
        // 可选：显示成功提示
        alert('状态配置已保存')
      } catch (error) {
        console.error('保存状态配置失败:', error)
        alert('保存失败：' + (error.response?.data?.error || error.message))
        // 恢复原状态
        this.allowedStatuses = [...this.originalStatuses]
      }
    },
    
    // 标签管理相关方法
    addNewTag() {
      this.allowedTags.push('新标签')
    },
    
    removeTag(index) {
      if (this.allowedTags.length > 1) {
        this.allowedTags.splice(index, 1)
      }
    },
    
    cancelTagEdit() {
      this.allowedTags = [...this.originalTags]
      this.showTagManager = false
    },
    
    async saveTags() {
      // 过滤空标签并去除前后空格
      this.allowedTags = this.allowedTags
        .map(t => t.trim())
        .filter(t => t.length > 0 && t.length <= 10)
      
      // 确保至少有一个标签
      if (this.allowedTags.length === 0) {
        this.allowedTags = ['初稿']
      }
      
      try {
        // 保存到服务器（更新README.md）
        await axios.put(`/api/projects/${this.projectName}/allowed-tags`, {
          allowedTags: this.allowedTags
        })
        
        this.originalTags = [...this.allowedTags]
        this.showTagManager = false
        
        // 可选：显示成功提示
        alert('标签配置已保存')
      } catch (error) {
        console.error('保存标签配置失败:', error)
        alert('保存失败：' + (error.response?.data?.error || error.message))
        // 恢复原标签
        this.allowedTags = [...this.originalTags]
      }
    },
    
    loadStatuses() {
      // 不再从localStorage加载，而是从项目README中加载（在loadProject中处理）
      // 这个方法现在可以删除，但保留作为占位符以防需要
    }
  }
}
</script>

<style scoped>
.page-header {
  margin-bottom: 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.page-header h2 {
  color: #2c3e50;
  margin: 0;
}

.project-meta {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.loading {
  text-align: center;
  color: #666;
  padding: 2rem;
}

.tasks-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1.5rem;
}

.task-card {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid #e5e5e5;
}

.task-card:hover {
  box-shadow: 0 4px 8px rgba(0,0,0,0.15);
  transform: translateY(-2px);
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.task-header h3 {
  color: #2c3e50;
  font-size: 1.1rem;
  margin: 0;
}

.task-stats {
  margin-bottom: 1rem;
}

.stat {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.stat-number {
  font-size: 1.2rem;
  font-weight: 600;
  color: #007bff;
}

.stat-label {
  font-size: 0.9rem;
  color: #666;
}

.task-description {
  color: #666;
  font-size: 0.9rem;
  line-height: 1.4;
  margin-bottom: 1rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.task-prompt {
  background: #f8f9fa;
  padding: 0.75rem;
  border-radius: 4px;
  margin-bottom: 1rem;
  font-size: 0.85rem;
}

.task-prompt strong {
  color: #495057;
  display: block;
  margin-bottom: 0.25rem;
}

.task-prompt p {
  margin: 0;
  color: #666;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.task-footer {
  border-top: 1px solid #f0f0f0;
  padding-top: 1rem;
  display: flex;
  justify-content: flex-end;
}

.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: 3rem;
  color: #666;
}

.empty-help {
  font-size: 0.9rem;
  margin-top: 0.5rem;
  opacity: 0.8;
}

/* 状态筛选器样式 */
.filter-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  gap: 1rem;
}

.status-filter {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  flex: 1;
}

.filter-btn {
  padding: 0.5rem 1rem;
  border: 2px solid #e5e5e5;
  background: white;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.filter-btn:hover {
  border-color: #007bff;
  background: #f8f9fa;
}

.filter-btn.active {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.filter-btn .count {
  font-size: 0.85rem;
  opacity: 0.8;
}

.filter-btn.active .count {
  opacity: 1;
  font-weight: 600;
}

/* 状态特定颜色 */
.filter-active.active {
  background: #28a745;
  border-color: #28a745;
}

.filter-pending.active {
  background: #ffc107;
  border-color: #ffc107;
  color: #333;
}

.filter-completed.active {
  background: #6c757d;
  border-color: #6c757d;
}

.filter-paused.active {
  background: #dc3545;
  border-color: #dc3545;
}

/* 视图切换按钮样式 */
.view-switcher {
  display: flex;
  gap: 0.5rem;
  border: 2px solid #e5e5e5;
  border-radius: 6px;
  padding: 0.25rem;
  background: white;
}

.view-btn {
  padding: 0.5rem;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 4px;
  color: #666;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.view-btn:hover {
  background: #f8f9fa;
  color: #007bff;
}

.view-btn.active {
  background: #007bff;
  color: white;
}

.view-btn svg {
  display: block;
}

/* 表格视图样式 */
.tasks-table {
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  border: 1px solid #e5e5e5;
}

.table-header,
.table-row {
  display: grid;
  grid-template-columns: 2fr 1fr 0.8fr 2.5fr 2.5fr 0.8fr;
  align-items: stretch;
}

.table-header {
  background: #f8f9fa;
  border-bottom: 2px solid #dee2e6;
  font-weight: 600;
  color: #495057;
}

.table-row {
  border-bottom: 1px solid #e5e5e5;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.table-row:hover {
  background: #f8f9fa;
}

.table-row:last-child {
  border-bottom: none;
}

.table-cell {
  padding: 1rem;
  display: flex;
  align-items: center;
  font-size: 0.9rem;
  border-right: 1px solid #e5e5e5;
  overflow: hidden;
  min-width: 0;
}

.table-cell:last-child {
  border-right: none;
}

.table-header .table-cell {
  padding: 0.875rem 1rem;
  font-size: 0.875rem;
  font-weight: 600;
}

.cell-name {
  color: #2c3e50;
}

.cell-name strong {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.cell-status {
  justify-content: center;
}

.cell-files {
  justify-content: center;
}

.cell-description,
.cell-prompt {
  color: #666;
  min-width: 0;
}

.cell-action {
  justify-content: center;
}

.file-count {
  font-size: 1.1rem;
  font-weight: 600;
  color: #007bff;
}

.text-truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
  display: block;
  min-width: 0;
}

.table-empty {
  padding: 3rem;
  text-align: center;
  color: #666;
}

.table-empty .empty-help {
  font-size: 0.9rem;
  margin-top: 0.5rem;
  opacity: 0.8;
}

/* 头部操作按钮 */
.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.btn-secondary {
  padding: 0.5rem 1rem;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-secondary:hover {
  background: #5a6268;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

.btn-download {
  padding: 0.5rem 1rem;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-download:hover {
  background: #218838;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

/* 下载对话框样式 */
.download-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.download-dialog {
  background: white;
  border-radius: 8px;
  padding: 2rem;
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
}

.download-dialog h3 {
  margin: 0 0 1.5rem 0;
  color: #2c3e50;
}

.loading-tags {
  text-align: center;
  padding: 2rem;
  color: #666;
}

.no-tags {
  text-align: center;
  padding: 2rem;
  color: #666;
}

.no-tags .help-text {
  font-size: 0.9rem;
  margin-top: 0.5rem;
  opacity: 0.8;
}

.tags-list {
  margin-bottom: 1.5rem;
}

.tag-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  margin-bottom: 0.75rem;
  border: 2px solid #e5e5e5;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.tag-item:hover {
  border-color: #007bff;
  background: #f8f9fa;
}

.tag-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.tag-label {
  font-size: 1rem;
  font-weight: 500;
  color: #2c3e50;
}

.tag-count {
  font-size: 0.85rem;
  color: #666;
}

.btn-sm {
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
}

.dialog-actions {
  border-top: 1px solid #e5e5e5;
  padding-top: 1rem;
  text-align: right;
}

/* 状态管理对话框样式 */
.status-manager-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.status-manager-dialog {
  background: white;
  border-radius: 8px;
  padding: 2rem;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
}

.status-manager-dialog h3 {
  margin: 0 0 1.5rem 0;
  color: #2c3e50;
}

.status-manager-dialog h4 {
  margin: 0 0 1rem 0;
  color: #495057;
  font-size: 1rem;
}

.current-statuses {
  margin-bottom: 1.5rem;
}

.status-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  background: #f8f9fa;
  border-radius: 6px;
}

.status-input {
  flex: 1;
  padding: 0.5rem 0.75rem;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  font-size: 0.9rem;
}

.status-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0,123,255,0.1);
}

.status-preview {
  min-width: 100px;
  display: flex;
  justify-content: center;
}

.btn-danger {
  background: #dc3545;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #c82333;
}

.btn-danger:disabled {
  background: #e5e5e5;
  color: #999;
  cursor: not-allowed;
}

.status-tips {
  background: #e7f3ff;
  padding: 1rem;
  border-radius: 6px;
  margin-bottom: 1.5rem;
  font-size: 0.9rem;
  color: #495057;
}

.status-tips p {
  margin: 0 0 0.5rem 0;
}

.status-tips ul {
  margin: 0;
  padding-left: 1.5rem;
}

.status-tips li {
  margin-bottom: 0.25rem;
}
</style>