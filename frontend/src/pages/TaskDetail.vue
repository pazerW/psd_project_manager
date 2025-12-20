<template>
  <div class="task-detail">
    <div class="page-header">
      <h2>{{ taskName }}</h2>
      <div class="task-actions">
        <button class="btn btn-primary" @click="showUpload = true">
          上传文件
        </button>
      </div>
    </div>

    <div v-if="loading" class="loading">
      加载任务详情中...
    </div>

    <div v-else class="task-content">
      <!-- README 内容区域 -->
      <div class="readme-section card">
        <h3>任务说明</h3>
        <div v-if="taskInfo.frontmatter" class="frontmatter">
          <div v-if="taskInfo.frontmatter.status" class="meta-item">
            <strong>状态：</strong>
            <span :class="`status-badge status-${taskInfo.frontmatter.status}`">
              {{ getStatusText(taskInfo.frontmatter.status) }}
            </span>
          </div>
          <div v-if="taskInfo.frontmatter.prompt" class="meta-item">
            <strong>AI提示词：</strong>
            <p class="prompt">{{ taskInfo.frontmatter.prompt }}</p>
          </div>
        </div>
        <div v-if="taskInfo.readmeContent" class="readme-content" v-html="renderedReadme"></div>
        <div v-else class="no-readme">
          <p>暂无任务说明</p>
          <p class="help-text">请在任务目录中创建 README.md 文件</p>
        </div>
      </div>

      <!-- PSD 文件区域 -->
      <div class="psd-section card">
        <h3>设计文件 ({{ psdFiles.length }})</h3>
        
        <div v-if="psdFiles.length === 0" class="empty-psd">
          <p>暂无文件</p>
          <button class="btn btn-primary" @click="showUpload = true">
            上传第一个文件
          </button>
        </div>
        
        <div v-else class="psd-grid">
          <div 
            v-for="file in psdFiles" 
            :key="file.name"
            class="psd-item"
          >
            <div class="psd-thumbnail">
              <img 
                :src="file.thumbnailUrl" 
                :alt="file.name"
                @error="handleImageError"
              />
            </div>
            <div class="psd-info">
              <h4>{{ file.name }}</h4>
              <p class="file-size">{{ formatFileSize(file.size) }}</p>
              <p class="file-date">{{ formatDate(file.modified) }}</p>
              
              <!-- 文件描述 -->
              <div class="psd-description">
                <div v-if="editingDescription !== file.name" class="description-display">
                  <p v-if="file.description" class="description-text">{{ file.description }}</p>
                  <p v-else class="description-placeholder">点击添加描述...</p>
                  <button 
                    class="btn-edit-desc" 
                    @click="startEditDescription(file.name, file.description || '')"
                    title="编辑描述"
                  >
                    ✏️
                  </button>
                </div>
                <div v-else class="description-edit">
                  <textarea 
                    v-model="editingDescriptionText"
                    class="description-input"
                    placeholder="输入文件描述..."
                    rows="3"
                    @keydown.ctrl.enter="saveDescription(file.name)"
                    @keydown.esc="cancelEditDescription"
                  ></textarea>
                  <div class="description-actions">
                    <button class="btn btn-sm btn-primary" @click="saveDescription(file.name)">
                      保存
                    </button>
                    <button class="btn btn-sm btn-secondary" @click="cancelEditDescription">
                      取消
                    </button>
                  </div>
                </div>
              </div>
              
              <div class="psd-actions">
                <a :href="file.downloadUrl" class="btn btn-secondary btn-sm" download>
                  下载
                </a>
                <button 
                  class="btn btn-danger btn-sm"
                  @click="deleteFile(file.name)"
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 上传对话框 -->
    <div v-if="showUpload" class="upload-modal" @click.self="showUpload = false">
      <div class="upload-dialog">
        <h3>上传设计文件</h3>
        
        <div class="upload-area" @drop.prevent="handleDrop" @dragover.prevent>
          <input 
            type="file" 
            ref="fileInput" 
            @change="handleFileSelect" 
            accept=".psd,.ai,.jpg,.jpeg,.png,.gif,.bmp,.webp,.svg,.tiff,.tif"
            style="display: none"
          />
          <div v-if="!selectedFile" class="upload-prompt" @click="$refs.fileInput.click()">
            <p>点击选择或拖拽设计文件到此处</p>
            <p class="upload-help">支持 PSD、AI、图片等文件类型的大文件分片上传</p>
          </div>
          
          <div v-else class="upload-progress">
            <h4>{{ selectedFile.name }}</h4>
            <p>文件大小: {{ formatFileSize(selectedFile.size) }}</p>
            
            <div v-if="uploading" class="progress-bar">
              <div class="progress-fill" :style="{ width: uploadProgress + '%' }"></div>
            </div>
            <p v-if="uploading" class="progress-text">
              上传中... {{ Math.round(uploadProgress) }}%
            </p>
            
            <div class="upload-actions">
              <button 
                v-if="uploading" 
                class="btn btn-secondary" 
                @click="cancelUpload"
              >
                取消上传
              </button>
              <button v-if="!uploading" class="btn btn-secondary" @click="resetUpload">
                重新选择
              </button>
            </div>
          </div>
        </div>
        
        <div class="dialog-actions">
          <button class="btn btn-secondary" @click="showUpload = false">
            关闭
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios'
import { marked } from 'marked'
import { formatDistance } from 'date-fns'
import { zhCN } from 'date-fns/locale'

export default {
  name: 'TaskDetail',
  props: ['projectName', 'taskName'],
  data() {
    return {
      taskInfo: {},
      psdFiles: [],
      loading: true,
      showUpload: false,
      selectedFile: null,
      uploading: false,
      uploadProgress: 0,
      uploadId: null,
      editingDescription: null, // 正在编辑描述的文件名
      editingDescriptionText: '' // 编辑中的描述文本
    }
  },
  computed: {
    renderedReadme() {
      return marked(this.taskInfo.readmeContent || '')
    }
  },
  async mounted() {
    await this.loadTaskDetail()
  },
  watch: {
    taskName: {
      handler: 'loadTaskDetail',
      immediate: false
    }
  },
  methods: {
    async loadTaskDetail() {
      this.loading = true
      try {
        // 加载任务详情
        const taskResponse = await axios.get(`/api/tasks/${this.projectName}/${this.taskName}`)
        this.taskInfo = taskResponse.data
        
        // 加载PSD文件列表
        const filesResponse = await axios.get(`/api/tasks/${this.projectName}/${this.taskName}/files`)
        this.psdFiles = filesResponse.data
        
      } catch (error) {
        console.error('Failed to load task detail:', error)
      } finally {
        this.loading = false
      }
    },
    
    async handleDrop(event) {
      const files = Array.from(event.dataTransfer.files)
      const designFile = files.find(file => this.isValidFileType(file.name))
      if (designFile) {
        this.selectedFile = designFile
        // 立即开始上传
        await this.startUpload()
      }
    },
    
    async handleFileSelect(event) {
      const file = event.target.files[0]
      if (file && this.isValidFileType(file.name)) {
        this.selectedFile = file
        // 立即开始上传
        await this.startUpload()
      }
    },
    
    async startUpload() {
      if (!this.selectedFile) return
      
      this.uploading = true
      this.uploadProgress = 0
      this.uploadId = Date.now().toString()
      
      try {
        await this.uploadInChunks()
        await this.loadTaskDetail() // 重新加载文件列表
        this.resetUpload()
      } catch (error) {
        console.error('Upload failed:', error)
        let errorMessage = '文件上传失败'
        
        if (error.response) {
          // 服务器返回的错误
          errorMessage += `：${error.response.data?.error || error.response.statusText}`
        } else if (error.request) {
          // 网络错误
          errorMessage += '：网络连接失败，请检查服务器是否正常运行'
        } else {
          // 其他错误
          errorMessage += `：${error.message}`
        }
        
      } finally {
        this.uploading = false
      }
    },
    
    async uploadInChunks() {
      const chunkSize = 5 * 1024 * 1024 // 5MB per chunk
      const totalChunks = Math.ceil(this.selectedFile.size / chunkSize)
      
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * chunkSize
        const end = Math.min(start + chunkSize, this.selectedFile.size)
        const chunk = this.selectedFile.slice(start, end)
        
        const formData = new FormData()
        formData.append('chunk', chunk)
        formData.append('uploadId', this.uploadId)
        formData.append('chunkIndex', chunkIndex.toString())
        formData.append('totalChunks', totalChunks.toString())
        formData.append('fileName', this.selectedFile.name)
        formData.append('fileSize', this.selectedFile.size.toString())
        
        await axios.post(
          `/api/upload/chunk/${this.projectName}/${this.taskName}`,
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          }
        )
        
        this.uploadProgress = ((chunkIndex + 1) / totalChunks) * 100
      }
    },
    
    async cancelUpload() {
      if (this.uploadId) {
        try {
          await axios.delete(`/api/upload/cancel/${this.uploadId}`)
        } catch (error) {
          console.error('Failed to cancel upload:', error)
        }
      }
      this.uploading = false
      this.uploadProgress = 0
    },
    
    resetUpload() {
      this.selectedFile = null
      this.uploading = false
      this.uploadProgress = 0
      this.uploadId = null
      this.showUpload = false
    },
    
    async deleteFile(fileName) {
      try {
        await axios.delete(`/api/files/${this.projectName}/${this.taskName}/${fileName}`)
        await this.loadTaskDetail() // 重新加载文件列表
      } catch (error) {
        console.error('Failed to delete file:', error)
      }
    },
    
    handleImageError(event) {
      event.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiM2NjYiIGZvbnQtc2l6ZT0iMTQiPuePreeVpeS4jeWPr+eUqDwvdGV4dD48L3N2Zz4='
    },
    
    formatFileSize(bytes) {
      if (bytes === 0) return '0 B'
      const k = 1024
      const sizes = ['B', 'KB', 'MB', 'GB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    },
    
    formatDate(date) {
      return formatDistance(new Date(date), new Date(), { 
        addSuffix: true,
        locale: zhCN 
      })
    },
    
    getStatusText(status) {
      const statusMap = {
        active: '进行中',
        pending: '待开始',
        completed: '已完成',
        paused: '已暂停'
      }
      return statusMap[status] || '未知'
    },

    // PSD文件描述编辑相关方法
    startEditDescription(fileName, currentDescription) {
      this.editingDescription = fileName
      this.editingDescriptionText = currentDescription
    },

    cancelEditDescription() {
      this.editingDescription = null
      this.editingDescriptionText = ''
    },

    async saveDescription(fileName) {
      try {
        await axios.put(
          `/api/tasks/${this.projectName}/${this.taskName}/files/${fileName}/description`,
          { description: this.editingDescriptionText }
        )
        
        // 更新本地数据
        const fileIndex = this.psdFiles.findIndex(f => f.name === fileName)
        if (fileIndex !== -1) {
          this.psdFiles[fileIndex].description = this.editingDescriptionText
        }
        
        this.cancelEditDescription()
      } catch (error) {
        console.error('保存描述失败:', error)
      }
    },

    // 文件类型验证
    isValidFileType(fileName) {
      const validExtensions = [
        '.psd',           // Photoshop
        '.ai',            // Illustrator  
        '.jpg', '.jpeg',  // 图片格式
        '.png', '.gif', '.bmp', 
        '.webp', '.svg',
        '.tiff', '.tif'
      ]
      const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'))
      return validExtensions.includes(ext)
    },

    // 获取文件类型
    getFileType(fileName) {
      const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'))
      if (ext === '.psd') return 'psd'
      if (ext === '.ai') return 'ai'  
      if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.tif'].includes(ext)) return 'image'
      if (ext === '.svg') return 'svg'
      return 'other'
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

.loading {
  text-align: center;
  color: #666;
  padding: 2rem;
}

.task-content {
  display: grid;
  gap: 2rem;
}

.readme-section h3,
.psd-section h3 {
  color: #2c3e50;
  margin-bottom: 1rem;
  border-bottom: 2px solid #e5e5e5;
  padding-bottom: 0.5rem;
}

.frontmatter {
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 4px;
  margin-bottom: 1rem;
}

.meta-item {
  margin-bottom: 0.5rem;
}

.meta-item:last-child {
  margin-bottom: 0;
}

.prompt {
  background: white;
  padding: 0.75rem;
  border-radius: 4px;
  margin-top: 0.5rem;
  line-height: 1.4;
  color: #495057;
}

.readme-content {
  line-height: 1.6;
}

.no-readme {
  text-align: center;
  color: #666;
  padding: 2rem;
}

.help-text {
  font-size: 0.9rem;
  opacity: 0.8;
  margin-top: 0.5rem;
}

.empty-psd {
  text-align: center;
  padding: 2rem;
  color: #666;
}

.psd-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}

.psd-item {
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  overflow: hidden;
  transition: box-shadow 0.2s;
}

.psd-item:hover {
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
}

.psd-thumbnail {
  height: 200px;
  overflow: hidden;
  background: #f8f9fa;
  display: flex;
  align-items: center;
  justify-content: center;
}

.psd-thumbnail img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.psd-info {
  padding: 1rem;
}

.psd-info h4 {
  margin: 0 0 0.5rem 0;
  color: #2c3e50;
  font-size: 1rem;
  word-break: break-all;
}

.file-size,
.file-date {
  margin: 0;
  font-size: 0.85rem;
  color: #666;
}

.psd-actions {
  margin-top: 1rem;
  display: flex;
  gap: 0.5rem;
}

/* PSD文件描述样式 */
.psd-description {
  margin: 0.75rem 0;
}

.description-display {
  position: relative;
  cursor: pointer;
}

.description-display:hover .btn-edit-desc {
  opacity: 1;
}

.description-text {
  margin: 0;
  padding: 0.5rem;
  background: #f8f9fa;
  border-radius: 4px;
  font-size: 0.9rem;
  line-height: 1.4;
  color: #495057;
  white-space: pre-wrap;
  word-break: break-word;
}

.description-placeholder {
  margin: 0;
  padding: 0.5rem;
  background: #f8f9fa;
  border-radius: 4px;
  font-size: 0.9rem;
  color: #6c757d;
  font-style: italic;
}

.btn-edit-desc {
  position: absolute;
  top: 0.25rem;
  right: 0.25rem;
  background: none;
  border: none;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s;
  font-size: 0.8rem;
}

.btn-edit-desc:hover {
  opacity: 1 !important;
}

.description-edit {
  margin-top: 0.5rem;
}

.description-input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.9rem;
  line-height: 1.4;
  resize: vertical;
  min-height: 60px;
}

.description-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.description-actions {
  margin-top: 0.5rem;
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.btn-sm {
  padding: 0.375rem 0.75rem;
  font-size: 0.8rem;
}

.btn-danger {
  background: #dc3545;
  color: white;
}

.btn-danger:hover {
  background: #c82333;
}

/* 上传对话框样式 */
.upload-modal {
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

.upload-dialog {
  background: white;
  border-radius: 8px;
  padding: 2rem;
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
}

.upload-area {
  border: 2px dashed #ccc;
  border-radius: 8px;
  padding: 2rem;
  text-align: center;
  margin: 1rem 0;
  transition: border-color 0.2s;
}

.upload-area:hover {
  border-color: #007bff;
}

.upload-prompt {
  cursor: pointer;
  color: #666;
}

.upload-help {
  font-size: 0.9rem;
  margin-top: 0.5rem;
  opacity: 0.8;
}

.upload-progress h4 {
  color: #2c3e50;
  margin-bottom: 0.5rem;
}

.progress-bar {
  background: #e9ecef;
  border-radius: 4px;
  height: 8px;
  margin: 1rem 0;
  overflow: hidden;
}

.progress-fill {
  background: #007bff;
  height: 100%;
  transition: width 0.3s;
}

.progress-text {
  color: #666;
  font-size: 0.9rem;
  margin: 0.5rem 0;
}

.upload-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  margin-top: 1rem;
}

.dialog-actions {
  margin-top: 1.5rem;
  text-align: right;
  border-top: 1px solid #e5e5e5;
  padding-top: 1rem;
}
</style>