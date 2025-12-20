<template>
  <div class="project-list">
    <div class="page-header">
      <h2>项目列表</h2>
      <p class="subtitle">管理您的设计项目和文件</p>
    </div>

    <div v-if="loading" class="loading">
      加载项目中...
    </div>

    <div v-else class="projects-grid">
      <div 
        v-for="project in projects" 
        :key="project.name"
        class="project-card"
        @click="goToProject(project.name)"
      >
        <div class="project-header">
          <h3>{{ project.name }}</h3>
          <span :class="`status-badge status-${project.status}`">
            {{ project.status }}
          </span>
        </div>
        
        <div class="project-stats">
          <div class="stat">
            <span class="stat-number">{{ project.taskCount }}</span>
            <span class="stat-label">任务</span>
          </div>
          <div class="stat">
            <span class="stat-number">{{ project.totalPsdFiles }}</span>
            <span class="stat-label">文件数</span>
          </div>
        </div>
        
        <div v-if="project.description" class="project-description">
          {{ project.description }}
        </div>
        
        <div class="project-footer">
          <button class="btn btn-primary">查看详情</button>
        </div>
      </div>
      
      <div v-if="projects.length === 0" class="empty-state">
        <p>暂无项目</p>
        <p class="empty-help">
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
      loading: true
    }
  },
  async mounted() {
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

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
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
</style>