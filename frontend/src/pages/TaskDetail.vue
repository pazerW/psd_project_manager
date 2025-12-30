<template>
  <div class="task-detail">
    <div class="page-header">
      <h2>{{ taskName }}</h2>

      <div class="header-status" v-if="taskInfo">
        <div v-if="canEditStatus" class="status-select">
          <select
            v-model="taskInfo.frontmatter.status"
            :disabled="savingStatus"
            class="status-select-input header-status-select"
            @change="changeStatus(taskInfo.frontmatter.status)"
          >
            <option value="" disabled>选择状态</option>
            <option v-for="status in projectStatuses" :key="status" :value="status">{{ status }}</option>
          </select>
        </div>
        <div v-else class="status-current-wrap">
          <span class="status-current">{{ taskInfo.frontmatter?.status || '未设置' }}</span>
        </div>
        <span v-if="!isStatusInAllowedList && taskInfo.frontmatter?.status" class="status-note" title="此状态未在项目README中定义，建议修改为允许的状态">⚠️ 自定义状态</span>
      </div>

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
          <img v-if="psdFiles && psdFiles[lightboxIndex]" :src="getDownloadUrl(psdFiles[lightboxIndex].thumbnailUrl)" :alt="psdFiles[lightboxIndex].name"
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
      <div class="readme-section">
        
        <div v-if="taskInfo.readmeContent" class="readme-wrapper">
          <h1 class="readme-title">README</h1>
          <hr class="readme-sep" />
          <div class="readme-content" v-html="renderedReadme"></div>
        </div>
        <div v-else class="no-readme">
          <p>暂无任务说明</p>
          <p class="help-text">请在任务目录中创建 README.md 文件</p>
        </div>
      </div>

      <!-- PSD 文件区域 -->
      <div class="psd-section card">
        <h3>设计文件 ({{ psdFiles.length }})</h3>

        <div class="psd-toolbar">
          <div class="toolbar-left">
            <div class="toolbar-mode">
              <button
                class="btn-sm btn-sm-toggle"
                :class="{ selected: sortBy === 'time' }"
                @click="setSortBy('time')"
                title="按时间排序"
              >按时间</button>
              <button
                class="btn-sm btn-sm-toggle"
                :class="{ selected: sortBy === 'tag' }"
                @click="setSortBy('tag')"
                title="按标签排序（分组）"
              >按标签</button>
            </div>

            <span class="toolbar-sep">排序：</span>
            <button
              class="btn-sm btn-sm-toggle"
              :class="{ selected: sortMode === 'desc' }"
              @click="setSortMode('desc')"
              title="按上传时间倒序（最新在前）"
            >倒序</button>
            <button
              class="btn-sm btn-sm-toggle"
              :class="{ selected: sortMode === 'asc' }"
              @click="setSortMode('asc')"
            >正序</button>
          </div>


        </div>

        <!-- 临时调试横幅已移除 -->

        <div v-if="psdFiles.length === 0" class="empty-psd">
          <p>暂无文件</p>
          <button class="btn btn-primary" @click="showUpload = true">
            上传第一个文件
          </button>
        </div>

        <div v-else>
          <div v-show="!groupByTag" class="psd-grid">
            <div 
              v-for="(file, idx) in sortedFiles" 
              :key="file.name"
              class="psd-item"
            >
              <div class="default-badge">
                <template v-if="(taskInfo.frontmatter && taskInfo.frontmatter.defaultFile) ? taskInfo.frontmatter.defaultFile === file.name : (taskInfo.defaultFile === file.name)">
                  <span class="default-label">默认</span>
                </template>
                <template v-else>
                  <button class="btn-set-default" @click.stop="setDefaultFile(file.name)">设置为默认</button>
                </template>
              </div>
              <div class="psd-thumbnail">
                  <img 
                    :src="getDownloadUrl(file.thumbnailUrl)" 
                :alt="file.name"
                @error="handleImageError($event, file.name)"
                @load="handleImageLoad($event, file.name)"
                @click="openLightboxByName(file.name)"
                :key="file.thumbnailUrl"
              />
              <div :class="['file-type-badge', isRedFile(file.name) ? 'badge-red' : 'psd-badge']">{{ getFileType(file.name) }}</div>
            </div>
            <div class="psd-info">
                    <h4>
                      <span :class="['inline-psd-badge', isRedFile(file.name) ? 'badge-red' : 'psd-badge']">{{ getFileType(file.name) }}</span>
                      {{ file.name }}
                    </h4>
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
                <a :href="getDownloadUrl(file.downloadUrl)" class="btn btn-secondary btn-sm" @click.prevent="downloadFile(file)">
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

        <div v-show="groupByTag" class="psd-groups">
          <div v-for="group in groupedFiles" :key="group.tag" class="psd-group">
            <div class="group-header">
              <h4>{{ group.tag }} ({{ group.files.length }})</h4>
              <div class="group-controls">
                <button class="btn-sm btn-sm-toggle" :class="{ selected: group.sortOrder === 'asc' }" @click="setGroupSort(group.tag, 'asc')">正序</button>
                <button class="btn-sm btn-sm-toggle" :class="{ selected: group.sortOrder === 'desc' }" @click="setGroupSort(group.tag, 'desc')">倒序</button>
              </div>
            </div>

            <div class="psd-grid">
              <div 
                v-for="(file, idx) in group.files" 
                :key="file.name"
                class="psd-item"
              >
                      <div class="default-badge">
                        <template v-if="(taskInfo.frontmatter && taskInfo.frontmatter.defaultFile) ? taskInfo.frontmatter.defaultFile === file.name : (taskInfo.defaultFile === file.name)">
                          <span class="default-label">默认</span>
                        </template>
                        <template v-else>
                          <button class="btn-set-default" @click.stop="setDefaultFile(file.name)">设置为默认</button>
                        </template>
                      </div>
                  <div class="psd-thumbnail">
                  <img 
                    :src="getDownloadUrl(file.thumbnailUrl)" 
                    :alt="file.name"
                    @error="handleImageError($event, file.name)"
                    @load="handleImageLoad($event, file.name)"
                    @click="openLightboxByName(file.name)"
                    :key="file.thumbnailUrl"
                  />
                  <div :class="['file-type-badge', isRedFile(file.name) ? 'badge-red' : 'psd-badge']">{{ getFileType(file.name) }}</div>
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
                      <a :href="getDownloadUrl(file.downloadUrl)" class="btn btn-secondary btn-sm" @click.prevent="downloadFile(file)">
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
        </div>
      </div>
    </div>

    <!-- 删除确认弹窗 -->
    <div v-if="deleteConfirmVisible" class="confirm-modal" @click.self="cancelDelete">
      <div class="confirm-dialog">
        <h3>确认删除</h3>
        <p>确定要删除文件 “{{ deleteTargetFile }}” 吗？此操作不可恢复。</p>
        <div class="dialog-actions">
          <button class="btn btn-secondary" @click="cancelDelete">取消</button>
          <button class="btn btn-danger" @click="performDeleteFile">确认删除</button>
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
import { renderMarkdown } from '../utils/markdown'
import { formatDistance } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import networkMode from '../utils/networkMode'

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
      editingStatus: false, // 是否正在编辑状态（保留兼容）
      editingStatusText: '', // 编辑中的状态文本（保留兼容）
      savingStatus: null, // 正在保存的状态值（用于防抖 / 禁用）
      projectStatuses: [], // 项目允许的状态列表
      projectTags: [], // 项目允许的标签列表

      // 排序与分组
      groupByTag: false,
      sortBy: 'time', // 'time' 或 'tag'，默认按时间排序
      sortMode: 'desc', // 'asc' 或 'desc'，默认倒序（最新在前）
      groupSortOrders: {} // 每个标签的排序方向覆盖
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
      ,
      // 删除确认
      deleteConfirmVisible: false,
      deleteTargetFile: ''
    }
  },
  computed: {
    renderedReadme() {
      return renderMarkdown(this.taskInfo.readmeContent || '')
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
    },

    // 按上传时间排序后的文件列表（应用全局排序）
    sortedFiles() {
      const arr = (this.psdFiles || []).slice()
      arr.sort((a, b) => {
        const aTime = new Date(a.modified).getTime() || 0
        const bTime = new Date(b.modified).getTime() || 0
        return this.sortMode === 'asc' ? aTime - bTime : bTime - aTime
      })
      return arr
    },

    // 按标签分组后的结构：[{ tag, files, sortOrder }]
    groupedFiles() {
      try {
        const groupsMap = {}
        const defaultTag = '未分类'
        ;(this.psdFiles || []).forEach(f => {
          const tag = f.tags || defaultTag
          if (!groupsMap[tag]) groupsMap[tag] = []
          groupsMap[tag].push(f)
        })

        // 只保留在文件中实际存在的标签（避免展示所有项目允许标签但无文件的空组）
        const presentTags = Object.keys(groupsMap)

        // 按项目中定义的标签顺序对存在的标签进行排序，其次是自定义标签，最后放未分类
        presentTags.sort((a, b) => {
          const ai = this.projectTags.indexOf(a)
          const bi = this.projectTags.indexOf(b)
          if (ai !== -1 && bi !== -1) return ai - bi
          if (ai !== -1) return -1
          if (bi !== -1) return 1
          if (a === defaultTag) return 1
          if (b === defaultTag) return -1
          return a.localeCompare(b)
        })

        const result = presentTags.map(tag => {
          const sortOrder = this.groupSortOrders[tag] || this.sortMode
          const files = (groupsMap[tag] || []).slice().sort((a, b) => {
            const aTime = new Date(a.modified).getTime() || 0
            const bTime = new Date(b.modified).getTime() || 0
            return sortOrder === 'asc' ? aTime - bTime : bTime - aTime
          })
          return { tag, files, sortOrder }
        })

        // debug output
        if (typeof window !== 'undefined' && console && console.debug) {
          console.debug('[groupedFiles]', result.map(g => ({ tag: g.tag, count: g.files.length, sortOrder: g.sortOrder })))
        }

        return result
      } catch (err) {
        if (typeof window !== 'undefined' && console && console.error) {
          console.error('[groupedFiles] error', err && err.stack ? err.stack : err)
        }
        return []
      }
    }
  },
  async mounted() {
    console.debug('[debug] TaskDetail mounted', this.projectName, this.taskName)
    await this.loadTaskDetail()

    // 监听 README 变更以保持状态同步
    if (typeof window !== 'undefined') {
      this._onDataChanged = (e) => {
        const detail = e.detail || {}
        const relPath = detail.path || ''
        const parts = relPath.split(/[\\/]/).filter(Boolean)
        // 如果变更影响当前任务或当前项目（project/README.md 或 project/task/README.md），重新加载任务详情
        if (parts[0] === this.projectName) {
          // 若有第二部分且匹配当前任务，或者只是项目 README 变更，都刷新
          if (!parts[1] || parts[1] === this.taskName) {
            // 立即更新状态以防止短暂不同步
            if (detail.status !== undefined) {
              const eventTime = detail.lastUpdated || (detail.frontmatter && detail.frontmatter.updatedAt) || detail.mtime || 0
              const currentTime = (this.taskInfo && (this.taskInfo.lastUpdated || (this.taskInfo.frontmatter && this.taskInfo.frontmatter.updatedAt))) || 0

              if (!eventTime || eventTime >= currentTime) {
                this.taskInfo = this.taskInfo || { frontmatter: {} }
                this.taskInfo.frontmatter = this.taskInfo.frontmatter || {}
                this.taskInfo.frontmatter.status = detail.status
                if (eventTime) this.taskInfo.lastUpdated = eventTime
                console.debug('[dataChanged] TaskDetail: immediate status update', detail.status, 'eventTime=', eventTime)
              } else {
                console.debug('[dataChanged] TaskDetail: ignored older event', detail.status, 'eventTime=', eventTime, 'currentTime=', currentTime)
              }
            }
            this.loadTaskDetail()
          }
        }
      }
      window.addEventListener('dataChanged', this._onDataChanged)
    }
  },
  beforeUnmount() {
    if (this._onDataChanged) {
      window.removeEventListener('dataChanged', this._onDataChanged)
    }
  },


  watch: {
    taskName: {
      handler: 'loadTaskDetail',
      immediate: false
    },

    // 当用户切换“按标签分类”时，确保分组排序信息被初始化，并同步 sortBy
    groupByTag(newVal) {
      if (newVal) {
        this.sortBy = 'tag'
        this.updateGroupSortOrders()
      } else {
        this.sortBy = 'time'
      }
    },

    // 当文件列表发生变化时，如果处于分组模式需要更新分组信息
    psdFiles() {
      if (this.groupByTag) {
        this.updateGroupSortOrders()
      }
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
    // 返回根据当前网络模式调整后的下载链接
    getDownloadUrl(rel) {
      return networkMode.getDownloadUrl(rel)
    },

    // 使用 fetch+Blob 强制下载，解析 Content-Disposition 获取文件名
    async downloadFile(file) {
      const url = this.getDownloadUrl(file.downloadUrl)
      // 如果是内网/同源，使用隐藏 iframe 发起请求以让浏览器原生处理 Content-Disposition 下载（避免 fetch 引起的 HTTP2 问题）
      try {
        const parsed = new URL(url, window.location.href)
        const isSameOrigin = parsed.origin === window.location.origin
        // 使用 networkMode 中的当前模式而不是裸露的全局变量
        const currentMode = (networkMode && networkMode.state && networkMode.state.mode) ? networkMode.state.mode : 'internal'
        if (currentMode === 'internal' || isSameOrigin) {
          const iframe = document.createElement('iframe')
          iframe.style.display = 'none'
          iframe.src = url
          document.body.appendChild(iframe)
          // 保留一段时间后移除
          setTimeout(() => { try { iframe.remove() } catch (e) {} }, 60 * 1000)
          return
        }

        const resp = await fetch(url, { credentials: 'include' })
        if (!resp.ok) {
          throw new Error(`Download request failed: ${resp.status}`)
        }
        const blob = await resp.blob()
        const cd = resp.headers.get('Content-Disposition') || ''
        let filename = file.name || 'download'
        const mStar = /filename\*=[^']*'[^']*'([^;\n\r]+)/i.exec(cd)
        if (mStar && mStar[1]) {
          try { filename = decodeURIComponent(mStar[1]) } catch (e) { filename = mStar[1] }
        } else {
          const m = /filename\s*=\s*"?([^";]+)"?/i.exec(cd)
          if (m && m[1]) filename = m[1]
        }

        const objectUrl = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = objectUrl
        a.download = filename
        document.body.appendChild(a)
        a.click()
        a.remove()
        setTimeout(() => URL.revokeObjectURL(objectUrl), 5000)
      } catch (err) {
        console.error('Download failed:', err)
        alert('下载失败：' + (err.message || err))
      }
    },
    
    async loadTaskDetail() {
      this.loading = true
      try {
        // 加载任务详情
        const taskResponse = await axios.get(`/api/tasks/${this.projectName}/${this.taskName}`, { headers: { 'Cache-Control': 'no-store' } })
        this.taskInfo = taskResponse.data
        
        // 加载PSD文件列表
        const filesResponse = await axios.get(`/api/tasks/${this.projectName}/${this.taskName}/files`)
        this.psdFiles = filesResponse.data
        // 初始化分组排序信息（如果需要）
        this.updateGroupSortOrders()
        
        // 加载项目中所有已使用的状态
        await this.loadProjectStatuses()
        
        // 加载项目中配置的标签
        await this.loadProjectTags()
        
        // 更新页面标题为：DPM - 项目名称 - 任务名称
        try {
          document.title = `DPM - ${this.projectName} - ${this.taskName}`
        } catch (e) {
          // 非浏览器环境安全忽略
        }
        
      } catch (error) {
        console.error('Failed to load task detail:', error)
      } finally {
        this.loading = false
      }
    },
    
    async loadProjectStatuses() {
      try {
        // 优先尝试从项目 README 中读取 allowedStatuses（保持与 ProjectDetail 行为一致）
        const projResp = await axios.get(`/api/projects/${this.projectName}`)
        const projData = projResp.data || {}
        if (projData.allowedStatuses && Array.isArray(projData.allowedStatuses) && projData.allowedStatuses.length > 0) {
          // 支持字符串或对象，统一为 label
          this.projectStatuses = projData.allowedStatuses.map(s => (typeof s === 'string' ? s : (s.label || s.value || ''))).filter(Boolean)
          return
        }

        // 回退到原有的 statuses 列表接口，但要去重并只保留非空字符串
        const response = await axios.get(`/api/tasks/${this.projectName}/statuses/list`)
        const arr = response.data || []
        const mapped = arr.map(s => (typeof s === 'string' ? s : (s.label || s.value || ''))).filter(Boolean)
        // 保持原顺序去重
        this.projectStatuses = [...new Set(mapped)]
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
      // 保持向后兼容：若调用此方法（例如通过键盘提交），使用 editingStatusText
      const status = (this.editingStatusText || '').trim()
      if (!status) {
        alert('请选择一个状态')
        return
      }
      await this.changeStatus(status)
      this.cancelEditStatus()
    },

    async changeStatus(status) {
      if (!status || this.savingStatus) return
      this.savingStatus = status

      try {
        const resp = await axios.put(
          `/api/tasks/${this.projectName}/${this.taskName}/status`,
          { status }
        )

        // 更新内存中的状态（立即生效），并尝试使用返回的 lastUpdated
        this.taskInfo.frontmatter = this.taskInfo.frontmatter || {}
        this.taskInfo.frontmatter.status = status
        if (resp.data && resp.data.lastUpdated) this.taskInfo.lastUpdated = resp.data.lastUpdated

        // 刷新相关数据：状态列表等
        await this.loadProjectStatuses()
      } catch (err) {
        console.error('更改状态失败:', err)
        alert('更改状态失败：' + (err.response?.data?.error || err.message))
      } finally {
        this.savingStatus = null
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
    
    // 弹出删除确认框（由 UI 按钮调用）
    deleteFile(fileName) {
      this.deleteTargetFile = fileName
      this.deleteConfirmVisible = true
    },

    // 用户在确认弹窗中点击确认后执行实际删除
    async performDeleteFile() {
      const fileName = this.deleteTargetFile
      this.deleteConfirmVisible = false
      this.deleteTargetFile = ''
      try {
        await axios.delete(`/api/files/${this.projectName}/${this.taskName}/${fileName}`)
        await this.loadTaskDetail() // 重新加载文件列表
      } catch (error) {
        console.error('Failed to delete file:', error)
        alert('删除文件失败：' + (error.response?.data?.error || error.message))
      }
    },

    cancelDelete() {
      this.deleteConfirmVisible = false
      this.deleteTargetFile = ''
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

    async saveTags(fileName, selectedTag) {
      const value = (typeof selectedTag === 'string' && selectedTag.trim()) ? selectedTag.trim() : (this.editingTagsText && this.editingTagsText.trim() ? this.editingTagsText.trim() : '')
      if (!value) {
        alert('请选择一个标签')
        return
      }

      try {
        const tags = value

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

    // 将某个文件设置为任务的默认文件
    async setDefaultFile(fileName) {
      try {
        const resp = await axios.post(`/api/tasks/${this.projectName}/${this.taskName}/default-file`, { fileName })
        if (resp.data && resp.data.success) {
          this.taskInfo.frontmatter = this.taskInfo.frontmatter || {}
          this.taskInfo.frontmatter.defaultFile = fileName
          // 广播变更事件，其他页面/组件可监听并更新
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('dataChanged', { detail: { path: `${this.projectName}/${this.taskName}/README.md`, frontmatter: this.taskInfo.frontmatter, lastUpdated: Date.now() } }))
          }
        }
      } catch (err) {
        console.error('设置默认文件失败', err)
        alert('设置默认文件失败：' + (err.response?.data?.error || err.message))
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
      if (ext === '.psd') return 'PSD'
      if (ext === '.ai') return 'AI'  
      if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.tif'].includes(ext)) return 'IMG'
      if (ext === '.svg') return 'sSVG'
      return 'Other'
    },

    // 是否使用红色徽章（PSD 或 AI）
    isRedFile(fileName) {
      const t = this.getFileType(fileName)
      return t === 'PSD' || t === 'AI'
    },

    // 排序与分组功能
    setSortMode(mode) {
      if (mode !== 'asc' && mode !== 'desc') return
      this.sortMode = mode
      // 如果未给某些标签显式设置，则保持同步为全局排序
      Object.keys(this.groupSortOrders).forEach(tag => {
        if (!this.groupSortOrders[tag]) this.groupSortOrders[tag] = mode
      })
    },

    setSortBy(mode) {
      if (mode !== 'time' && mode !== 'tag') return
      this.sortBy = mode
      // 切换到按标签排序时，打开分组并初始化分组排序
      if (mode === 'tag') {
        this.groupByTag = true
        this.updateGroupSortOrders()
      } else {
        this.groupByTag = false
      }
    },

    toggleGroupByTag() {
      // `groupByTag` is updated by v-model on the checkbox; 只在开启时初始化分组排序信息
      console.debug('[TaskDetail] toggleGroupByTag called, groupByTag=', this.groupByTag)
      if (this.groupByTag) {
        const tags = new Set()
        ;(this.psdFiles || []).forEach(f => {
          tags.add(f.tags || '未分类')
        })
        tags.forEach(t => {
          if (!this.groupSortOrders[t]) this.groupSortOrders[t] = this.sortMode
        })
      }
    },

    setGroupSort(tag, mode) {
      if (mode !== 'asc' && mode !== 'desc') return
      this.groupSortOrders[tag] = mode
    },

    // 初始化或更新 groupSortOrders
    updateGroupSortOrders() {
      if (!this.psdFiles) return
      const tags = new Set()
      ;(this.psdFiles || []).forEach(f => {
        tags.add(f.tags || '未分类')
      })
      tags.forEach(t => {
        if (!this.groupSortOrders[t]) this.groupSortOrders[t] = this.sortMode
      })
    },

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

    openLightboxByName(name) {
      const idx = (this.psdFiles || []).findIndex(f => f.name === name)
      if (idx !== -1) this.openLightbox(idx)
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
  justify-content: flex-start;
  align-items: center;
  gap: 0.75rem;
}

.page-header .task-actions {
  margin-left: auto;
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

.readme-section {
  margin-bottom: 2rem;
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
  padding: 1.25rem 1.5rem;
  line-height: 1.8;
  background: #ffffff;
  border: 1px solid #eef0f2;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(16,24,40,0.04);
  color: #333;
  margin-bottom: 5rem;
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
/* 改为“人物说明”卡片风格：左侧强调条 + 软色背景 */
.readme-wrapper {
  position: relative;
  margin-bottom: 1.25rem;
  padding: 0.75rem;
  background: linear-gradient(180deg,#fbfdff,#ffffff);
  border: 1px solid #e6eef6;
  border-radius: 10px;
  box-shadow: 0 6px 18px rgba(16,24,40,0.04);
  overflow: visible;
}

/* 左侧强调条已移除，恢复常规内边距 */
.readme-title {
  margin: 0 0 0.5rem 0;
  font-size: 1.05rem;
  color: #102a43;
  font-weight: 700;
  display: block;
  letter-spacing: 0.1px;
}

.readme-sep {
  border: none;
  height: 1px;
  background: transparent;
  margin: 0 0 0.6rem 0;
}

.readme-content h1,
.readme-content h2,
.readme-content h3,
.readme-content h4,
.readme-content h5,
.readme-content h6 {
  margin-top: 1.5em;
  margin-bottom: 0.8em;
  margin-bottom: 1rem;
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

/* 排序与分组工具栏 */
.psd-toolbar {
  margin: 0.75rem 0 1rem 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.psd-toolbar .btn-sm-toggle {
  padding: 0.35rem 0.65rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
}
.psd-toolbar .btn-sm-toggle.selected {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.toolbar-mode {
  display: inline-flex;
  gap: 0.5rem;
  margin-right: 0.75rem;
  align-items: center;
}

.toolbar-sep {
  margin-right: 0.5rem;
  color: #666;
  font-weight: 500;
}

/* 临时调试横幅 */
.debug-banner {
  background: #fff3cd;
  border: 1px solid #ffe08a;
  color: #6b3d00;
  padding: 0.6rem 0.8rem;
  border-radius: 6px;
  margin: 0.75rem 0 1rem 0;
  text-align: center;
  font-weight: 600;
}

.debug-banner em { font-style: normal; color: #9a6b00; font-weight: 400; }
.debug-banner .dbg-count,
.debug-banner .dbg-files { color: #6b3d00; font-weight: 700; }

      /* 调试 CSS 已移除 */

/* 分组视图 */
.psd-group {
  margin-bottom: 1rem;
  border: 1px solid #eef0f2;
  border-radius: 6px;
  overflow: hidden;
}
.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.6rem 0.9rem;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
}
.group-header h4 {
  margin: 0;
  font-size: 1rem;
}
.group-controls button {
  margin-left: 0.5rem;
}
.group-controls .btn-sm-toggle.selected {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.psd-item {
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  overflow: hidden;
  transition: box-shadow 0.2s;
  position: relative;
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
  position: relative;
}

.psd-thumbnail img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

/* PSD 文件角标 */
.file-type-badge {
  position: absolute;
  top: 8px;
  left: 8px;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0,0,0,0.25);
  pointer-events: none;
  z-index: 2;
}
.psd-badge {
  background: linear-gradient(135deg,#31a8ff 0%,#0078d4 100%);
  box-shadow: 0 2px 6px rgba(0,0,0,0.12);
}

/* 默认文件按钮/标签（右上角） */
.default-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 6px;
}
.default-label {
  background: #28a745;
  color: #fff;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.78rem;
  font-weight: 600;
}
.btn-set-default {
  background: rgba(0,0,0,0.55);
  color: #fff;
  border: none;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.78rem;
}
.btn-set-default:hover { background: rgba(0,0,0,0.75); }

/* 红色徽章用于 PSD / AI */
.badge-red {
  background: linear-gradient(135deg,#ff6b6b 0%,#d90429 100%);
  box-shadow: 0 2px 6px rgba(0,0,0,0.12);
}

/* 内联文件名前的 PSD badge */
.inline-psd-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 600;
  color: #ffffff;
  margin-right: 0.5rem;
  vertical-align: middle;
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

/* 页面头部状态显示 */
.header-status {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  margin-left: 1rem;
}
.header-status .status-current {
  font-size: 0.95rem;
  color: #2c3e50;
  background: #f1f5f9;
  padding: 0.4rem 0.6rem;
  border-radius: 6px;
}
.header-status .header-status-select {
  min-width: 180px;
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

/* 删除确认弹窗样式 */
.confirm-modal {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1600;
}
.confirm-dialog {
  background: #fff;
  border-radius: 8px;
  padding: 1.25rem 1.5rem;
  max-width: 480px;
  width: 92%;
  box-shadow: 0 8px 30px rgba(2,6,23,0.2);
}
.confirm-dialog h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.05rem;
  color: #222;
}
.confirm-dialog p { color: #444; margin: 0.25rem 0 0 0; }
.confirm-dialog .dialog-actions { display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1rem; }
</style>