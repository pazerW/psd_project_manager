<template>
  <div class="project-detail">
    <div class="page-header">
      <h2>{{ projectName }}</h2>
      <div v-if="projectInfo" class="project-meta">
        <span :class="`status-badge status-${projectInfo.status}`">
          {{ projectInfo.status }}
        </span>
      </div>
    </div>

    <!-- 状态筛选器 -->
    <div v-if="!loading" class="status-filter">
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

    <div v-if="loading" class="loading">
      加载任务中...
    </div>

    <div v-else class="tasks-grid">
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
      selectedStatus: 'all'
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
      const statuses = [...new Set(this.allTasks.map(task => task.status || 'pending'))]
      return statuses.sort()
    }
  },
  async mounted() {
    await this.loadProject()
  },
  watch: {
    projectName: {
      handler: 'loadProject',
      immediate: false
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
.status-filter {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
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
</style>