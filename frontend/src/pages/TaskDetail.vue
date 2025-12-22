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
    <!-- Lightbox 弹窗 -->
    <div v-if="lightboxVisible" class="lightbox-overlay" @click.self="closeLightbox">
      <div class="lightbox-content">
        <button class="lightbox-close" @click="closeLightbox">✕</button>
        <button class="lightbox-prev" @click="prevImage">‹</button>
        <div class="lightbox-image-wrap"
          @wheel="handleLightboxWheel"
          @mousedown.prevent="onPanStart"
          @mousemove="onPanMove"
          @mouseup="onPanEnd"
          @mouseleave="onPanEnd"
          @touchstart.prevent="onPanStart"
          @touchmove.prevent="onPanMove"
          @touchend="onPanEnd"
        >
          <img :src="encodeURI(psdFiles[lightboxIndex].thumbnailUrl)" :alt="psdFiles[lightboxIndex].name"
            :style="{ transform: `translate(${translateX}px, ${translateY}px) scale(${zoomScale})`, transformOrigin: originX !== null ? `${originX}px ${originY}px` : '50% 50%' }"/>
        </div>
        <button class="lightbox-next" @click="nextImage">›</button>
        <div class="lightbox-controls">
          <button @click="zoomOut">-</button>
          <button @click="resetZoom">重置</button>
          <button @click="zoomIn">+</button>
        </div>
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
          <div class="meta-item">
            <strong>状态：</strong>
            <div v-if="!editingStatus" class="status-display">
              <span 
                :class="`status-badge status-${taskInfo.frontmatter.status || 'pending'}`"
              >
                {{ taskInfo.frontmatter.status || '待处理' }}
              </span>
              <button 
                v-if="canEditStatus"
                class="btn btn-change-status" 
                @click="startEditStatus"
              >
                <span class="btn-icon">✏️</span>
                <span class="btn-text">更改状态</span>
              </button>
              <span 
                v-if="!isStatusInAllowedList && taskInfo.frontmatter.status" 
                class="status-note"
                title="此状态未在项目README中定义，建议修改为允许的状态"
              >
                ⚠️ 自定义状态
              </span>
            </div>
            <div v-else class="status-edit">
              <div class="status-options">
                <button
                  v-for="status in projectStatuses"
                  :key="status"
                  :class="['status-option-btn', editingStatusText === status ? 'selected' : '']"
                  @click="editingStatusText = status; saveStatus()"
                >
                  {{ status }}
                </button>
              </div>
              <div class="status-actions">
                <button class="btn btn-cancel" @click="cancelEditStatus">
                  取消
                </button>
              </div>
            </div>
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
            v-for="(file, idx) in psdFiles" 
            :key="file.name"
            class="psd-item"
          >
            <div class="psd-thumbnail">
              <img 
                :src="encodeURI(file.thumbnailUrl)" 
                :alt="file.name"
                @error="handleImageError($event, file.name)"
                @load="handleImageLoad($event, file.name)"
                @click="openLightbox(idx)"
                :key="file.thumbnailUrl"
              />
            </div>
            <div class="psd-info">
              <h4>{{ file.name }}</h4>
              <p class="file-size">{{ formatFileSize(file.size) }}</p>
              <p class="file-date">{{ formatDate(file.modified) }}</p>
              
              <!-- 文件标签 -->
              <div class="psd-tags">
                <div v-if="editingTags !== file.name" class="tags-display">
                  <span v-if="file.tags" class="tags-badge">🏷️ {{ file.tags }}</span>
                  <span v-else class="tags-placeholder" @click="projectTags.length > 0 && startEditTags(file.name, file.tags || '')">
                    {{ projectTags.length > 0 ? '点击选择标签...' : '请先在项目中配置标签' }}
                  </span>
                  <button 
                    v-if="projectTags.length > 0"
                    class="btn-edit-tags" 
                    @click="startEditTags(file.name, file.tags || '')"
                    title="编辑标签"
                  >
                    ✏️
                  </button>
                  <span 
                    v-if="file.tags && !isTagInAllowedList(file.tags)" 
                    class="status-note"
                    title="此标签未在项目中定义，建议修改为允许的标签"
                  >
                    ⚠️ 自定义标签
                  </span>
                </div>
                <div v-else class="tags-edit">
                  <select 
                    v-model="editingTagsText"
                    class="tags-select"
                    @change="saveTags(file.name)"
                    ref="tagsSelect"
                  >
                    <option value="" disabled>请选择标签</option>
                    <option 
                      v-for="tag in projectTags" 
                      :key="tag"
                      :value="tag"
                    >
                      {{ tag }}
                    </option>
                  </select>
                  <div class="tags-actions">
                    <button class="btn btn-sm btn-secondary" @click="cancelEditTags">
                      取消
                    </button>
                  </div>
                </div>
              </div>
              
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
            
            <div class="upload-tags-input" v-if="projectTags.length > 0">
              <label>标签（可选）：</label>
              <select 
                v-model="uploadTags"
                class="tags-select-upload"
                :disabled="uploading"
              >
                <option value="">不选择标签</option>
                <option 
                  v-for="tag in projectTags" 
                  :key="tag"
                  :value="tag"
                >
                  {{ tag }}
                </option>
              </select>
            </div>
            <div v-else class="upload-tags-warning">
              <p class="help-text">⚠️ 项目未配置标签，请先在项目详情页配置标签</p>
            </div>
            
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
      uploadTags: '', // 上传时的标签
      editingDescription: null, // 正在编辑描述的文件名
      editingDescriptionText: '', // 编辑中的描述文本
      editingTags: null, // 正在编辑标签的文件名
      editingTagsText: '', // 编辑中的标签文本
      editingStatus: false, // 是否正在编辑状态
      editingStatusText: '', // 编辑中的状态文本
      projectStatuses: [], // 项目允许的状态列表
      projectTags: [] // 项目允许的标签列表
      ,
      // Lightbox
      lightboxVisible: false,
      lightboxIndex: 0,
      zoomScale: 1,
      minZoom: 0.5,
      maxZoom: 5
      ,
      // Pan/zoom state
      translateX: 0,
      translateY: 0,
      isPanning: false,
      panStartX: 0,
      panStartY: 0,
      lastTranslateX: 0,
      lastTranslateY: 0,
      originX: null,
      originY: null
    }
  },
  computed: {
    renderedReadme() {
      return marked(this.taskInfo.readmeContent || '')
    },
    // 检查当前状态是否可以编辑
    canEditStatus() {
      // 只要项目定义了状态列表，就允许编辑（即使当前状态不在列表中）
      return this.projectStatuses && this.projectStatuses.length > 0
    },
    // 检查当前状态是否在允许列表中
    isStatusInAllowedList() {
      const currentStatus = this.taskInfo.frontmatter?.status
      if (!currentStatus) {
        return true
      }
      return this.projectStatuses.includes(currentStatus)
    }
  },
  async mounted() {
    await this.loadTaskDetail()
  },
  beforeUnmount() {
  },
  watch: {
    taskName: {
      handler: 'loadTaskDetail',
      immediate: false
    }
  },
  methods: {
    // 检查标签是否在允许列表中
    isTagInAllowedList(tag) {
      if (!tag || this.projectTags.length === 0) {
        return true
      }
      return this.projectTags.includes(tag)
    },
    
    async loadTaskDetail() {
      this.loading = true
      try {
        // 加载任务详情
        const taskResponse = await axios.get(`/api/tasks/${this.projectName}/${this.taskName}`)
        this.taskInfo = taskResponse.data
        
        // 加载PSD文件列表
        const filesResponse = await axios.get(`/api/tasks/${this.projectName}/${this.taskName}/files`)
        this.psdFiles = filesResponse.data
        
        // 加载项目中所有已使用的状态
        await this.loadProjectStatuses()
        
        // 加载项目中配置的标签
        await this.loadProjectTags()
        
      } catch (error) {
        console.error('Failed to load task detail:', error)
      } finally {
        this.loading = false
      }
    },
    
    async loadProjectStatuses() {
      try {
        const response = await axios.get(`/api/tasks/${this.projectName}/statuses/list`)
        this.projectStatuses = response.data
      } catch (error) {
        console.error('Failed to load project statuses:', error)
        this.projectStatuses = []
      }
    },
    
    async loadProjectTags() {
      try {
        const response = await axios.get(`/api/projects/${this.projectName}`)
        if (response.data.allowedTags && Array.isArray(response.data.allowedTags)) {
          this.projectTags = response.data.allowedTags
        }
      } catch (error) {
        console.error('Failed to load project tags:', error)
        this.projectTags = []
      }
    },
    
    startEditStatus() {
      if (!this.canEditStatus) {
        return
      }
      this.editingStatus = true
      this.editingStatusText = this.taskInfo.frontmatter?.status || ''
      // 等待DOM更新后聚焦选择框
      this.$nextTick(() => {
        if (this.$refs.statusSelect) {
          this.$refs.statusSelect.focus()
        }
      })
    },
    
    cancelEditStatus() {
      this.editingStatus = false
      this.editingStatusText = ''
    },
    
    async saveStatus() {
      if (!this.editingStatusText.trim()) {
        alert('请选择一个状态')
        return
      }
      
      try {
        await axios.put(
          `/api/tasks/${this.projectName}/${this.taskName}/status`,
          { status: this.editingStatusText.trim() }
        )
        
        // 重新加载任务详情以确保状态同步
        await this.loadTaskDetail()
        
        this.cancelEditStatus()
      } catch (error) {
        console.error('保存状态失败:', error)
        alert('保存状态失败：' + (error.response?.data?.error || error.message))
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
        
        // 添加标签信息
        if (this.uploadTags.trim()) {
          formData.append('tags', this.uploadTags.trim())
        }
        
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
      this.uploadTags = ''
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
    
    handleImageError(event, fileName) {
      console.error('Failed to load thumbnail for:', fileName);
      console.error('Thumbnail URL:', event.target.src);
      // 使用更明显的占位符图片
      event.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHJlY3QgeD0iMzAwIiB5PSIyMDAiIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjZGRkIiByeD0iMTAiLz48dGV4dCB4PSI0MDAiIHk9IjI4MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzk5OSIgZm9udC1zaXplPSI0OCIgZm9udC1mYW1pbHk9IkFyaWFsIj7wn5OMPC90ZXh0Pjx0ZXh0IHg9IjQwMCIgeT0iMzYwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNjY2IiBmb250LXNpemU9IjE4IiBmb250LWZhbWlseT0iQXJpYWwiPue8qeeVpeWbvuWKoOi9veWksei0pTwvdGV4dD48dGV4dCB4PSI0MDAiIHk9IjM5MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzk5OSIgZm9udC1zaXplPSIxNCIgZm9udC1mYW1pbHk9IkFyaWFsIj7or7fkuIvovb3ljp/lp4vmlofku7Y8L3RleHQ+PC9zdmc+'
      event.target.onerror = null; // 防止无限循环
    },

    handleImageLoad(event, fileName) {
      console.log('Thumbnail loaded for:', fileName);
      console.log('Thumbnail URL (loaded):', event.target.src);
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

    // 标签验证
    validateTags() {
      // 移除非法字符（保留中文、英文、数字、空格、常用标点）
      this.uploadTags = this.uploadTags.replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s，。、！？—]+/g, '')
    },

    // 标签编辑相关方法
    startEditTags(fileName, currentTags) {
      if (this.projectTags.length === 0) {
        alert('项目未配置标签，请先在项目详情页配置标签')
        return
      }
      this.editingTags = fileName
      this.editingTagsText = currentTags
      // 等待DOM更新后聚焦选择框
      this.$nextTick(() => {
        if (this.$refs.tagsSelect) {
          this.$refs.tagsSelect.focus()
        }
      })
    },

    cancelEditTags() {
      this.editingTags = null
      this.editingTagsText = ''
    },

    async saveTags(fileName) {
      if (!this.editingTagsText || !this.editingTagsText.trim()) {
        alert('请选择一个标签')
        return
      }
      
      try {
        const tags = this.editingTagsText.trim()
        
        await axios.put(
          `/api/tasks/${this.projectName}/${this.taskName}/files/${fileName}/tags`,
          { tags }
        )
        
        // 更新本地数据
        const fileIndex = this.psdFiles.findIndex(f => f.name === fileName)
        if (fileIndex !== -1) {
          this.psdFiles[fileIndex].tags = tags
        }
        
        this.cancelEditTags()
      } catch (error) {
        console.error('保存标签失败:', error)
        alert('保存标签失败：' + (error.response?.data?.error || error.message))
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

    ,

    // Lightbox methods
    openLightbox(idx) {
      this.lightboxIndex = idx
      this.lightboxVisible = true
      this.zoomScale = 1
      this.translateX = 0
      this.translateY = 0
      this.lastTranslateX = 0
      this.lastTranslateY = 0
      this.originX = null
      this.originY = null
      document.addEventListener('keydown', this._onKeydown)
      document.body.style.overflow = 'hidden'
    },

    closeLightbox() {
      this.lightboxVisible = false
      this.zoomScale = 1
      document.removeEventListener('keydown', this._onKeydown)
      document.body.style.overflow = ''
    },

    nextImage() {
      if (!this.psdFiles || this.psdFiles.length === 0) return
      this.lightboxIndex = (this.lightboxIndex + 1) % this.psdFiles.length
      this.zoomScale = 1
    },

    prevImage() {
      if (!this.psdFiles || this.psdFiles.length === 0) return
      this.lightboxIndex = (this.lightboxIndex - 1 + this.psdFiles.length) % this.psdFiles.length
      this.zoomScale = 1
    },

    zoomIn() {
      this.zoomScale = Math.min(this.maxZoom, this.zoomScale * 1.25)
    },

    zoomOut() {
      this.zoomScale = Math.max(this.minZoom, this.zoomScale / 1.25)
    },

    resetZoom() {
      this.zoomScale = 1
    },

    handleLightboxWheel(e) {
      if (e.deltaY === 0) return
      e.preventDefault()
      const wrap = e.currentTarget
      const rect = wrap.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      // set origin to pointer so scale focuses there
      this.originX = cx
      this.originY = cy

      const oldScale = this.zoomScale
      const delta = e.deltaY > 0 ? -0.12 : 0.12
      const newScale = Math.min(this.maxZoom, Math.max(this.minZoom, oldScale + delta))
      this.zoomScale = newScale
    },

    onPanStart(e) {
      this.isPanning = true
      const clientX = e.touches ? e.touches[0].clientX : e.clientX
      const clientY = e.touches ? e.touches[0].clientY : e.clientY
      this.panStartX = clientX
      this.panStartY = clientY
    },

    onPanMove(e) {
      if (!this.isPanning) return
      const clientX = e.touches ? e.touches[0].clientX : e.clientX
      const clientY = e.touches ? e.touches[0].clientY : e.clientY
      const dx = clientX - this.panStartX
      const dy = clientY - this.panStartY
      this.translateX = this.lastTranslateX + dx
      this.translateY = this.lastTranslateY + dy
    },

    onPanEnd() {
      if (!this.isPanning) return
      this.isPanning = false
      this.lastTranslateX = this.translateX
      this.lastTranslateY = this.translateY
    },

    _onKeydown(e) {
      if (!this.lightboxVisible) return
      if (e.key === 'Escape') this.closeLightbox()
      if (e.key === 'ArrowRight') this.nextImage()
      if (e.key === 'ArrowLeft') this.prevImage()
      if (e.key === '+') this.zoomIn()
      if (e.key === '-') this.zoomOut()
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
  padding: 0 2rem;
  line-height: 1.8;
}

.readme-content p {
  margin: 1.2em 0;
  line-height: 1.8;
}

.readme-content h1,
.readme-content h2,
.readme-content h3,
.readme-content h4,
.readme-content h5,
.readme-content h6 {
  margin-top: 1.5em;
  margin-bottom: 0.8em;
  line-height: 1.4;
}

.readme-content ul,
.readme-content ol {
  margin: 1.2em 0;
  padding-left: 2rem;
}

.readme-content li {
  margin: 0.5em 0;
  line-height: 1.8;
}

.readme-content blockquote {
  margin: 1.5em 0;
  padding-left: 1rem;
  border-left: 4px solid #e5e5e5;
}

.readme-content pre,
.readme-content code {
  margin: 1.2em 0;
}

.readme-content hr {
  margin: 2em 0;
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

/* PSD文件标签样式 */
.psd-tags {
  margin: 0.5rem 0;
}

.tags-display {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.tags-badge {
  padding: 0.25rem 0.5rem;
  background: #e7f3ff;
  color: #0066cc;
  border-radius: 4px;
  font-size: 0.85rem;
  display: inline-block;
}

.tags-placeholder {
  padding: 0.25rem 0.5rem;
  color: #6c757d;
  font-size: 0.85rem;
  font-style: italic;
  cursor: pointer;
}

.tags-placeholder:hover {
  color: #007bff;
}

.btn-edit-tags {
  background: none;
  border: none;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s;
  font-size: 0.8rem;
  padding: 0.25rem;
}

.tags-display:hover .btn-edit-tags {
  opacity: 1;
}

.tags-edit {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.tags-input-edit,
.tags-select {
  padding: 0.375rem 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.875rem;
  width: 100%;
  background: white;
}

.tags-input-edit:focus,
.tags-select:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.tags-actions {
  display: flex;
  gap: 0.5rem;
}

.upload-tags-input {
  margin: 1rem 0;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 4px;
}

.upload-tags-input label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #495057;
}

.tags-select-upload {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.9rem;
  background: white;
}

.tags-select-upload:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.tags-select-upload:disabled {
  background: #e9ecef;
  cursor: not-allowed;
}

.upload-tags-warning {
  margin: 1rem 0;
  padding: 1rem;
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 4px;
}

.upload-tags-warning .help-text {
  margin: 0;
  color: #856404;
}

.tags-input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.9rem;
}

.tags-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.tags-input:disabled {
  background: #e9ecef;
  cursor: not-allowed;
}

.tags-help {
  margin: 0.25rem 0 0 0;
  font-size: 0.8rem;
  color: #6c757d;
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

/* 状态编辑样式 */
.status-display {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.status-badge {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 500;
  display: inline-block;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
}

.status-pending {
  background: #ffc107;
  color: #856404;
}

.status-in-progress,
.status-进行中 {
  background: #17a2b8;
  color: white;
}

.status-completed,
.status-已完成 {
  background: #28a745;
  color: white;
}

.status-review,
.status-审核中 {
  background: #6f42c1;
  color: white;
}

.status-blocked,
.status-已阻塞 {
  background: #dc3545;
  color: white;
}

.status-cancelled {
  background: #6c757d;
  color: white;
}

.status-note {
  font-size: 0.85rem;
  color: #dc3545;
  font-style: italic;
}

/* 更改状态按钮 - 适配触摸屏 */
.btn-change-status {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s, transform 0.1s;
  min-height: 44px;
  min-width: 120px;
}

.btn-change-status:hover {
  background: #0056b3;
}

.btn-change-status:active {
  transform: scale(0.98);
}

.btn-icon {
  font-size: 1.1rem;
}

.btn-text {
  font-size: 1rem;
}

/* 状态编辑区域 */
.status-edit {
  display: block;
  width: 100%;
  max-width: 600px;
}

/* 状态选项按钮组 */
.status-options {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.status-option-btn {
  padding: 0.75rem 1.5rem;
  border: 2px solid #ddd;
  border-radius: 6px;
  background: white;
  color: #333;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  min-height: 44px;
  min-width: 100px;
}

.status-option-btn:hover {
  border-color: #007bff;
  background: #f0f8ff;
}

.status-option-btn:active {
  transform: scale(0.98);
}

.status-option-btn.selected {
  border-color: #007bff;
  background: #007bff;
  color: white;
  box-shadow: 0 2px 8px rgba(0, 123, 255, 0.3);
}

.status-actions {
  display: flex;
  gap: 0.75rem;
}

.btn-cancel {
  padding: 0.75rem 1.5rem;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.2s;
  min-height: 44px;
  min-width: 100px;
}

.btn-cancel:hover {
  background: #5a6268;
}

.btn-cancel:active {
  transform: scale(0.98);
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

/* Lightbox */
.lightbox-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}
.lightbox-content {
  position: relative;
  display: flex;
  align-items: center;
  gap: 1rem;
  /* 占满整个视口，使 image-wrap 可在全屏范围内拖拽/缩放 */
  width: 100vw;
  height: 100vh;
}
.lightbox-image-wrap {
  /* 占满父容器（整个视口），便于在全屏范围内平移 */
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.lightbox-image-wrap img {
  /* 取消 max 限制，让 transform 控制缩放和平移；保证在初始缩放下仍能自适应 */
  max-width: none;
  max-height: none;
  width: auto;
  height: auto;
  transition: transform 0.15s ease;
  will-change: transform;
  display: block;
  margin: 0 auto;
}
.lightbox-close, .lightbox-prev, .lightbox-next {
  position: absolute;
  background: rgba(0,0,0,0.6);
  color: white;
  border: none;
  padding: 0.5rem 0.8rem;
  font-size: 1.25rem;
  border-radius: 4px;
  cursor: pointer;
}
.lightbox-close { top: 10px; right: 10px; }
.lightbox-prev { left: 10px; top: 50%; transform: translateY(-50%); }
.lightbox-next { right: 10px; top: 50%; transform: translateY(-50%); }
.lightbox-controls {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 0.5rem;
}
.lightbox-controls button {
  padding: 0.4rem 0.7rem;
  border-radius: 4px;
  border: none;
  background: rgba(255,255,255,0.9);
  cursor: pointer;
}
</style>