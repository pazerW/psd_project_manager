<template>
  <div class="project-list">
    <div class="page-header">
      <h2>项目列表</h2>
      <p class="subtitle">管理您的设计项目和文件</p>
    </div>

    <!-- 状态筛选器 -->
    <div class="filter-section">
      <div class="filter-header">
        <h3 class="filter-title">按状态筛选：</h3>
        <button @click="showStatusManager = true" class="btn-manage-status">
          ⚙️ 管理状态
        </button>
      </div>
      <div class="status-filters">
        <label 
          v-for="status in availableStatuses" 
          :key="status.value"
          class="status-filter-item"
        >
          <input 
            type="checkbox" 
            :value="status.value" 
            v-model="selectedStatuses"
          />
          <span :class="`status-badge status-${status.value}`">
            {{ status.label }}
          </span>
        </label>
      </div>
    </div>

    <!-- 状态管理弹窗 -->
    <div v-if="showStatusManager" class="modal-overlay" @click="showStatusManager = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>管理项目状态</h3>
          <button @click="showStatusManager = false" class="btn-close">×</button>
        </div>
        
        <div class="modal-body">
          <div class="status-list">
            <div 
              v-for="(status, index) in availableStatuses" 
              :key="status.value"
              class="status-item"
            >
              <input 
                v-if="editingIndex === index"
                v-model="editingValue"
                @keyup.enter="saveStatusEdit(index)"
                @keyup.esc="cancelEdit"
                class="status-input"
                autofocus
              />
              <span v-else :class="`status-badge status-${status.value}`">
                {{ status.label }}
              </span>
              
              <div class="status-actions">
                <button 
                  v-if="editingIndex !== index"
                  @click="startEdit(index, status.label)"
                  class="btn-action btn-edit"
                  title="重命名"
                >
                  ✏️
                </button>
                <button 
                  v-if="editingIndex === index"
                  @click="saveStatusEdit(index)"
                  class="btn-action btn-save"
                  title="保存"
                >
                  ✓
                </button>
                <button 
                  v-if="editingIndex === index"
                  @click="cancelEdit"
                  class="btn-action btn-cancel"
                  title="取消"
                >
                  ✕
                </button>
                <button 
                  v-if="editingIndex !== index"
                  @click="deleteStatus(index)"
                  class="btn-action btn-delete"
                  title="删除"
                  :disabled="availableStatuses.length <= 1"
                >
                  🗑️
                </button>
              </div>
            </div>
          </div>
          
          <div class="add-status-section">
            <input 
              v-model="newStatusName"
              @keyup.enter="addStatus"
              placeholder="输入新状态名称"
              class="status-input"
            />
            <button @click="addStatus" class="btn btn-primary">
              + 添加状态
            </button>
          </div>
        </div>
        
        <div class="modal-footer">
          <button @click="showStatusManager = false" class="btn btn-secondary">
            关闭
          </button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="loading">
      加载项目中...
    </div>

    <div v-else>
      <!-- 按状态分组显示项目 -->
      <div 
        v-for="status in statusOrder" 
        :key="status.value"
        v-show="groupedProjects[status.value] && groupedProjects[status.value].length > 0"
        class="status-group"
      >
        <div class="status-group-header">
          <h3>
            <span :class="`status-badge status-${status.value}`">
              {{ status.label }}
            </span>
            <span class="project-count">{{ groupedProjects[status.value]?.length || 0 }} 个项目</span>
          </h3>
        </div>
        
        <div class="projects-grid">
          <div 
            v-for="project in groupedProjects[status.value]" 
            :key="project.name"
            class="project-card"
          >
            <div class="project-header">
              <h3 @click="goToProject(project.name)" style="cursor: pointer;">{{ project.name }}</h3>
              <div class="status-control">
                <select 
                  :value="project.status" 
                  @change="updateProjectStatus(project.name, $event.target.value)"
                  @click.stop
                  class="status-select"
                >
                  <option 
                    v-for="statusOption in availableStatuses" 
                    :key="statusOption.value"
                    :value="statusOption.value"
                  >
                    {{ statusOption.label }}
                  </option>
                </select>
              </div>
            </div>
            
            <div class="project-stats" @click="goToProject(project.name)">
              <div class="stat">
                <span class="stat-number">{{ project.taskCount }}</span>
                <span class="stat-label">任务</span>
              </div>
              <div class="stat">
                <span class="stat-number">{{ project.totalPsdFiles }}</span>
                <span class="stat-label">文件数</span>
              </div>
            </div>
            
            <div v-if="project.description" class="project-description" @click="goToProject(project.name)">
              {{ project.description }}
            </div>
            
            <div class="project-footer">
              <button class="btn btn-primary" @click="goToProject(project.name)">查看详情</button>
            </div>
          </div>
        </div>
      </div>
      
      <div v-if="filteredProjects.length === 0" class="empty-state">
        <p>暂无符合条件的项目</p>
        <p class="empty-help" v-if="selectedStatuses.length > 0">
          尝试调整筛选条件或查看所有项目
        </p>
        <p class="empty-help" v-else>
          请通过SMB在数据目录中创建项目文件夹
        </p>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios'

export default {
  name: 'ProjectList',
  data() {
    return {
      projects: [],
      loading: true,
      selectedStatuses: ['active', 'pending', 'in-progress', 'review', 'completed', 'cancelled', 'paused'],
      availableStatuses: [
        { value: 'active', label: 'active' },
        { value: 'pending', label: 'pending' },
        { value: 'in-progress', label: 'in-progress' },
        { value: 'review', label: 'review' },
        { value: 'completed', label: 'completed' },
        { value: 'cancelled', label: 'cancelled' },
        { value: 'paused', label: 'paused' }
      ],
      // 状态显示优先级顺序，active 最高
      statusOrder: [
        { value: 'active', label: 'active' },
        { value: 'in-progress', label: 'in-progress' },
        { value: 'review', label: 'review' },
        { value: 'pending', label: 'pending' },
        { value: 'paused', label: 'paused' },
        { value: 'completed', label: 'completed' },
        { value: 'cancelled', label: 'cancelled' }
      ],
      showStatusManager: false,
      newStatusName: '',
      editingIndex: -1,
      editingValue: ''
    }
  },
  computed: {
    // 根据选中的状态筛选项目
    filteredProjects() {
      if (this.selectedStatuses.length === 0) {
        return this.projects
      }
      return this.projects.filter(project => 
        this.selectedStatuses.includes(project.status)
      )
    },
    // 按状态分组
    groupedProjects() {
      const groups = {}
      this.filteredProjects.forEach(project => {
        const status = project.status || 'pending'
        if (!groups[status]) {
          groups[status] = []
        }
        groups[status].push(project)
      })
      return groups
    }
  },
  watch: {
    selectedStatuses: {
      handler(newVal) {
        // 保存选中的状态到 localStorage
        localStorage.setItem('selectedProjectStatuses', JSON.stringify(newVal))
      },
      deep: true
    }
  },
  async mounted() {
    await this.loadStatusConfig()
    await this.loadProjects()
  },
  methods: {
    async loadProjects() {
      try {
        const response = await axios.get('/api/projects')
        this.projects = response.data
      } catch (error) {
        console.error('Failed to load projects:', error)
      } finally {
        this.loading = false
      }
    },
    
    goToProject(projectName) {
      this.$router.push(`/project/${projectName}`)
    },
    
    async updateProjectStatus(projectName, newStatus) {
      try {
        await axios.put(`/api/projects/${projectName}/status`, {
          status: newStatus
        })
        
        // 更新本地状态
        const project = this.projects.find(p => p.name === projectName)
        if (project) {
          project.status = newStatus
        }
      } catch (error) {
        console.error('Failed to update project status:', error)
        alert('更新项目状态失败')
        // 重新加载项目列表
        await this.loadProjects()
      }
    },
    
    // 状态管理方法
    addStatus() {
      const name = this.newStatusName.trim()
      if (!name) {
        alert('请输入状态名称')
        return
      }
      
      // 检查是否已存在
      if (this.availableStatuses.some(s => s.value === name || s.label === name)) {
        alert('该状态已存在')
        return
      }
      
      this.availableStatuses.push({ value: name, label: name })
      this.statusOrder.push({ value: name, label: name })
      this.newStatusName = ''
      this.saveStatusConfig()
    },
    
    deleteStatus(index) {
      if (this.availableStatuses.length <= 1) {
        alert('至少需要保留一个状态')
        return
      }
      
      const status = this.availableStatuses[index]
      const confirmDelete = confirm(`确定要删除状态"${status.label}"吗？\n使用该状态的项目将不受影响。`)
      
      if (confirmDelete) {
        this.availableStatuses.splice(index, 1)
        const orderIndex = this.statusOrder.findIndex(s => s.value === status.value)
        if (orderIndex !== -1) {
          this.statusOrder.splice(orderIndex, 1)
        }
        // 从选中的状态中移除
        const selectedIndex = this.selectedStatuses.indexOf(status.value)
        if (selectedIndex !== -1) {
          this.selectedStatuses.splice(selectedIndex, 1)
        }
        this.saveStatusConfig()
      }
    },
    
    startEdit(index, currentValue) {
      this.editingIndex = index
      this.editingValue = currentValue
    },
    
    saveStatusEdit(index) {
      const newName = this.editingValue.trim()
      if (!newName) {
        alert('状态名称不能为空')
        return
      }
      
      // 检查是否与其他状态重名
      if (this.availableStatuses.some((s, i) => i !== index && (s.value === newName || s.label === newName))) {
        alert('该状态名称已存在')
        return
      }
      
      const oldValue = this.availableStatuses[index].value
      this.availableStatuses[index] = { value: newName, label: newName }
      
      // 更新 statusOrder
      const orderIndex = this.statusOrder.findIndex(s => s.value === oldValue)
      if (orderIndex !== -1) {
        this.statusOrder[orderIndex] = { value: newName, label: newName }
      }
      
      // 更新 selectedStatuses
      const selectedIndex = this.selectedStatuses.indexOf(oldValue)
      if (selectedIndex !== -1) {
        this.selectedStatuses[selectedIndex] = newName
      }
      
      this.cancelEdit()
      this.saveStatusConfig()
    },
    
    cancelEdit() {
      this.editingIndex = -1
      this.editingValue = ''
    },
    
    async saveStatusConfig() {
      try {
        await axios.put('/api/projects/config/statuses', {
          projectStatuses: this.availableStatuses,
          statusOrder: this.statusOrder
        })
      } catch (error) {
        console.error('Failed to save status config:', error)
        alert('保存状态配置失败')
      }
    },
    
    async loadStatusConfig() {
      try {
        const response = await axios.get('/api/projects/config/statuses')
        if (response.data.projectStatuses && response.data.projectStatuses.length > 0) {
          this.availableStatuses = response.data.projectStatuses
        }
        if (response.data.statusOrder && response.data.statusOrder.length > 0) {
          this.statusOrder = response.data.statusOrder
        }
        
        // 从 localStorage 恢复用户之前选择的状态
        const savedSelection = localStorage.getItem('selectedProjectStatuses')
        if (savedSelection) {
          try {
            const parsed = JSON.parse(savedSelection)
            // 只恢复仍然存在的状态
            this.selectedStatuses = parsed.filter(status =>
              this.availableStatuses.some(s => s.value === status)
            )
          } catch (e) {
            console.error('Failed to parse saved selection:', e)
          }
        } else {
          // 如果没有保存的选择，确保 selectedStatuses 只包含存在的状态
          this.selectedStatuses = this.selectedStatuses.filter(status =>
            this.availableStatuses.some(s => s.value === status)
          )
        }
        
        // 如果没有选中任何状态，默认选中所有
        if (this.selectedStatuses.length === 0) {
          this.selectedStatuses = this.availableStatuses.map(s => s.value)
        }
      } catch (error) {
        console.error('Failed to load status config:', error)
      }
    }
  }
}
</script>

<style scoped>
.page-header {
  margin-bottom: 2rem;
}

.page-header h2 {
  color: #2c3e50;
  margin-bottom: 0.5rem;
}

.subtitle {
  color: #666;
  font-size: 1rem;
}

.loading {
  text-align: center;
  color: #666;
  padding: 2rem;
}

.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}

.project-card {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  cursor: pointer;
  transition: all 0.2s ease;
  flex: 1;
}

.status-control {
  position: relative;
}

.status-select {
  padding: 0.35rem 0.75rem;
  border: 2px solid #e5e5e5;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  background: white;
  transition: all 0.2s ease;
  min-width: 120px;
}

.status-select:hover {
  border-color: #007bff;
}

.status-select:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}

.status-select option {
  padding: 0.5rem;
  border: 1px solid #e5e5e5;
}

.project-card:hover {
  box-shadow: 0 4px 8px rgba(0,0,0,0.15);
  transform: translateY(-2px);
}

.project-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.project-header h3 {
  color: #2c3e50;
  font-size: 1.25rem;
  margin: 0;
}

.project-stats {
  display: flex;
  gap: 2rem;
  margin-bottom: 1rem;
}

.filter-section {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.filter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.filter-title {
  color: #2c3e50;
  font-size: 1rem;
  margin: 0;
  font-weight: 600;
}

.btn-manage-status {
  padding: 0.5rem 1rem;
  border: 1px solid #007bff;
  background: white;
  color: #007bff;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s ease;
}

.btn-manage-status:hover {
  background: #007bff;
  color: white;
}

.status-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.status-filter-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  user-select: none;
}

.status-filter-item input[type="checkbox"] {
  cursor: pointer;
  width: 18px;
  height: 18px;
}

.status-filter-item:hover .status-badge {
  opacity: 0.8;
}

/* 状态分组样式 */
.status-group {
  margin-bottom: 2.5rem;
}

.status-group-header {
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 2px solid #f0f0f0;
}

.status-group-header h3 {
  color: #2c3e50;
  font-size: 1.1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  margin: 0;
}

.project-count {
  color: #666;
  font-size: 0.9rem;
  font-weight: 400;
}

/* 为不同状态添加更多样式 */
.status-in-progress { 
  background: #cfe2ff; 
  color: #084298; 
}

.status-review { 
  background: #e7d5f7; 
  color: #6f42c1; 
}

.status-cancelled { 
  background: #f8d7da; 
  color: #842029; 
}

.stat-number {
  font-size: 1.5rem;
  font-weight: 600;
  color: #007bff;
}

.stat-label {
  font-size: 0.8rem;
  color: #666;
  margin-top: 0.25rem;
}

.project-description {
  color: #666;
  font-size: 0.9rem;
  line-height: 1.4;
  margin-bottom: 1rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.project-footer {
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

/* 状态管理弹窗 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e5e5e5;
}

.modal-header h3 {
  margin: 0;
  color: #2c3e50;
  font-size: 1.25rem;
}

.btn-close {
  background: none;
  border: none;
  font-size: 2rem;
  color: #999;
  cursor: pointer;
  padding: 0;
  width: 36px;
  height: 36px;
  line-height: 1;
  transition: color 0.2s;
}

.btn-close:hover {
  color: #333;
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

.status-list {
  margin-bottom: 1.5rem;
}

.status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  border: 1px solid #e5e5e5;
  border-radius: 6px;
  margin-bottom: 0.75rem;
  transition: background 0.2s;
}

.status-item:hover {
  background: #f8f9fa;
}

.status-input {
  padding: 0.5rem 0.75rem;
  border: 2px solid #007bff;
  border-radius: 6px;
  font-size: 0.9rem;
  flex: 1;
  outline: none;
}

.status-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-action {
  background: none;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  width: 32px;
  height: 32px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 1rem;
}

.btn-action:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.btn-edit:hover:not(:disabled) {
  background: #ffc107;
  border-color: #ffc107;
}

.btn-save:hover {
  background: #28a745;
  border-color: #28a745;
  color: white;
}

.btn-cancel:hover {
  background: #6c757d;
  border-color: #6c757d;
  color: white;
}

.btn-delete:hover:not(:disabled) {
  background: #dc3545;
  border-color: #dc3545;
}

.add-status-section {
  display: flex;
  gap: 0.75rem;
  padding-top: 1rem;
  border-top: 1px solid #e5e5e5;
}

.add-status-section .status-input {
  flex: 1;
}

.modal-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid #e5e5e5;
  display: flex;
  justify-content: flex-end;
}
</style>