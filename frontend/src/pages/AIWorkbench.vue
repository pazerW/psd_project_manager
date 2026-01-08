<template>
  <div class="ai-workbench">
    <div class="page-header">
      <h2>AI工作台</h2>
      <button class="btn btn-secondary" @click="goBack">返回任务</button>
    </div>

    <div v-if="loading" class="loading">加载中...</div>

    <div v-else class="workbench-container">
      <!-- 模板下拉（替代左侧固定面板） -->
      <div class="templates-dropdown">
        <button class="templates-btn" @click="toggleTemplatesDropdown">
          模板: {{ selectedTemplate ? selectedTemplate.name : '未选择' }} ▾
          <span class="template-count">({{ templateCount }})</span>
        </button>
        <div v-if="templatesOpen" class="templates-menu">
          <div
            v-for="(template, id) in templates"
            :key="id"
            class="templates-menu-item"
            :class="{ active: selectedTemplateId === id }"
            @click="selectTemplate(id)">
            <div class="menu-name">{{ template.name }}</div>
            <div class="menu-type">{{ template.type }}</div>
          </div>
        </div>
      </div>

      <!-- 右侧：模板详情和操作 -->
      <div class="template-detail">
        <div v-if="!selectedTemplateId" class="no-selection">
          <p>请从选择一个模板</p>
        </div>

        <div v-else class="template-content">
          <h3>{{ selectedTemplate.name }}</h3>
          
          <div class="detail-container">
            <div class="detail-section">
              <label>类型</label>
              <div>{{ selectedTemplate.type }}</div>
            </div>

            <div class="detail-section">
              <label>模型</label>
              <div>{{ selectedTemplate.model }}</div>
            </div>
          </div>
          <!-- Task Context 输入 -->
          <div class="detail-section">
            <label>任务上下文 (task_context)</label>
            <textarea
              v-model="taskContext"
              ref="taskContextInput"
              @input="onTaskContextInput"
              class="task-context-input"
              placeholder="在此输入或从README内容中选择..."
              rows="4"
            ></textarea>
            <button class="btn btn-sm btn-secondary" @click="showReadmeSelector = !showReadmeSelector">
              {{ showReadmeSelector ? '隐藏' : '从README选择' }}
            </button>
          </div>

          <!-- README选择器：按 ### 分区，点击分区填充任务上下文 -->
          <div v-if="showReadmeSelector" class="readme-selector">
            <div class="readme-help">提示: 点击某个小节可将该小节所有文字填充到任务上下文；也可选中文本后使用下方按钮。</div>

            <div class="readme-sections">
              <div
                v-for="(sec, idx) in readmeSections"
                :key="idx"
                class="readme-section"
                @click="fillSection(sec)">
                <div class="readme-section-title" v-html="sec.titleHtml"></div>
                <div class="readme-section-body" v-html="sec.html"></div>
              </div>
            </div>

            <button
              v-if="selectedText"
              class="btn btn-sm btn-primary"
              @click="fillSelectedText"
              style="margin-top: 0.5rem;"
            >
              使用选中文本: "{{ selectedText.substring(0, 30) }}{{ selectedText.length > 30 ? '...' : '' }}"
            </button>
          </div>

          <!-- 预览完整Prompt -->
          <div class="detail-section">
            <label>完整提示词预览</label>
            <div class="prompt-preview">{{ fullPrompt }}</div>
          </div>

          <!-- 图片上传（仅当type为img2img时） -->
          <div v-if="selectedTemplate.uploads" class="detail-section">
            <label>选择图片</label>
            <div class="image-selector">
              <div
                v-for="(file, index) in availableImages"
                :key="index"
                class="image-item"
                :class="{ selected: selectedImageIndex === index }"
                @click="selectImage(index)"
              >
                <img :src="getImageThumbnail(file)" :alt="file.name" />
                <div class="image-name">{{ file.name }}</div>
              </div>
            </div>
            <div v-if="selectedImageIndex !== null" class="selected-image-info">
              已选择: {{ availableImages[selectedImageIndex].name }}
              <span v-if="availableImages[selectedImageIndex].name.toLowerCase().endsWith('.psd')">
                (将转换为JPG上传)
              </span>
            </div>
          </div>

          <!-- 提交按钮 -->
          <div class="action-section">
            <button 
              class="btn btn-primary btn-large" 
              @click="submitTemplate"
              :disabled="submitting"
            >
              {{ submitting ? '处理中...' : '开始处理' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 任务历史（独立区域，显示在下方） -->
    <div v-if="taskLogs.length > 0" class="task-history-section">
      <div class="history-header">
        <h3>任务历史 ({{ taskLogs.length }})</h3>
        <button 
          class="btn btn-sm btn-secondary" 
          @click="checkPendingJobs"
          :disabled="submitting"
        >
          🔄 刷新状态
        </button>
      </div>
            <div v-for="(log, index) in taskLogs" :key="index" class="task-log-item" :class="[ 'status-' + log.status, { collapsed: !isExpanded(index) } ]">
              <div class="log-header" @click="toggleLog(index)">
                <div class="log-time">
                  <span class="time-icon">🕒</span>
                  {{ log.time }}
                </div>
                <div class="log-title">
                  <strong class="template-name">{{ log.template_name || '—' }}</strong>
                  <span class="template-id">{{ log.template_id ? ('#' + log.template_id) : '' }}</span>
                </div>
                <span class="status-badge" :class="'status-' + log.status">
                  {{ getStatusText(log.status) }}
                </span>
                <button
                  v-if="log.status === 'failed'"
                  class="btn btn-sm btn-warning retry-btn"
                  @click.stop.prevent="retryLog(log, index)"
                  :disabled="submitting"
                >
                  重试
                </button>
              </div>

              <div class="log-info" v-show="isExpanded(index)">
                <div class="info-row">
                  <strong>Job ID:</strong>
                  <code class="job-id">{{ log.job_id }}</code>
                </div>

                <div class="info-row">
                  <strong>模板:</strong>
                  <span class="template-name">{{ log.template_name }}</span>
                  <code class="template-id">{{ log.template_id }}</code>
                </div>

                <div v-if="log.prompt" class="info-row prompt-row">
                  <strong>提示词:</strong>
                  <div class="prompt-text">{{ log.prompt }}</div>
                </div>

                <div v-if="log.image" class="info-row">
                  <strong>使用图片:</strong>
                  <span class="image-name">{{ log.image }}</span>
                </div>

                <strong>结果摘要</strong>

                <div class="result-content">
                  <div v-if="isResultJson(log.result)" class="result-json">

                    <div v-if="getResultData(log.result).images && getResultData(log.result).images.length" class="result-images">
                      <div class="result-section-title">Images ({{ getResultData(log.result).images.length }})</div>
                      <div class="image-grid">
                          <div v-for="(img, idx) in getResultData(log.result).images" :key="idx" class="result-image-item">
                            <img :src="getAIImageUrl(img.url)" @click.prevent="openPreview(getAIImageUrl(img.url))" />
                            <div class="image-filename" :title="img.filename">{{ img.filename }}</div>
                            <button class="btn btn-sm btn-success" @click.stop.prevent="saveImage(log, img)" :disabled="savingImageMap[getAIImageUrl(img.url)]">
                              {{ savingImageMap[getAIImageUrl(img.url)] ? '保存中...' : '保存到任务' }}
                            </button>
                          </div>
                      </div>
                    </div>

                    <div v-if="getResultData(log.result).texts && getResultData(log.result).texts.length" class="result-texts">
                      <div class="result-section-title">Texts</div>
                      <div v-for="(text, tIdx) in getResultData(log.result).texts" :key="tIdx" class="text-item">
                        {{ text }}
                      </div>
                    </div>

                    <div v-if="Object.keys(getResultData(log.result)).filter(k => !['images','texts'].includes(k)).length" class="result-other">
                      <div class="result-section-title">Details</div>
                      <pre style="font-size: 0.75rem; color: #666;">{{ filterExtraData(getResultData(log.result)) }}</pre>
                    </div>

                  </div>

                  <pre v-else class="result-text-raw">{{ log.result }}</pre>
                </div>
              </div>
            </div>
          </div>
        </div>

    <!-- 图片预览模态 -->
    <div v-if="previewImageUrl" class="preview-overlay" @click.self="closePreview">
      <button class="preview-close" @click="closePreview">✕</button>
      <img :src="previewImageUrl" class="preview-image" />
    </div>

</template>

<script>
import axios from 'axios'
import { marked } from 'marked'
import networkMode from '../utils/networkMode.js'

export default {
  name: 'AIWorkbench',
  props: {
    projectName: {
      type: String,
      required: true
    },
    taskName: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      loading: true,
      templates: {},
      templateCount: 0,
      selectedTemplateId: null,
      templatesOpen: false,
      taskContext: '',
      showReadmeSelector: false,
      readmeContent: '',
      availableImages: [],
      selectedImageIndex: null,
      submitting: false,
      taskLogs: [],
      expandedLogIds: [],
      selectedText: '',
      previewImageUrl: null,
      savingImageMap: {},
      savingImages: {},
      workbenchRefreshTimer: null
    }
  },
  computed: {
    selectedTemplate() {
      return this.selectedTemplateId ? this.templates[this.selectedTemplateId] : null
    },
    fullPrompt() {
      if (!this.selectedTemplate) return ''
      return this.selectedTemplate.prompt.replace(/\{\{task_context\}\}/g, this.taskContext || '[未设置]')
    },
    readmeHtml() {
      if (!this.readmeContent) return ''
      try {
        return marked.parse(this.readmeContent)
      } catch (e) {
        return this.readmeContent
      }
    }
    ,
    // 将 README 按 ### 标题分区，返回每个分区的 HTML 和纯文本
    readmeSections() {
      const src = this.readmeContent || ''
      if (!src.trim()) return []

      // 将内容按行处理，分割出以 ### 开头的段落
      const lines = src.split(/\r?\n/)
      const sections = []
      let cur = { title: '', bodyLines: [] }

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const m = line.match(/^###\s*(.*)$/)
        if (m) {
          // 新分区
          if (cur.title || cur.bodyLines.length) {
            sections.push(Object.assign({}, cur))
          }
          cur = { title: m[1] || '小节', bodyLines: [] }
        } else {
          cur.bodyLines.push(line)
        }
      }
      if (cur.title || cur.bodyLines.length) sections.push(cur)

      // 转换每个分区为 HTML 和纯文本（用于填充）
      return sections.map(s => {
        const rawMarkdown = (s.title ? `### ${s.title}\n\n` : '') + s.bodyLines.join('\n')
        let html = ''
        try { html = marked.parse(rawMarkdown) } catch (e) { html = rawMarkdown }
        // 获取纯文本：通过临时 DOM 元素
        let plain = ''
        try {
          const div = document.createElement('div')
          div.innerHTML = html
          plain = div.textContent || div.innerText || ''
          plain = plain.trim()
        } catch (e) {
          plain = rawMarkdown.replace(/#{1,6}\s*/g, '').trim()
        }
        return { title: s.title || '', titleHtml: `<strong>${s.title || ''}</strong>`, html, plainText: plain }
      })
    }
  },
  async mounted() {
    await this.loadTemplates()
    await this.loadTaskInfo()
    await this.loadTaskLogs()
    await this.checkPendingJobs()
    this.loading = false
    document.addEventListener('keydown', this.onKeydown)
    // 定期刷新：每3秒刷新任务信息与日志
    this.workbenchRefreshTimer = setInterval(async () => {
      try {
        await Promise.all([this.loadTaskInfo(), this.loadTaskLogs(), this.checkPendingJobs()])
      } catch (e) {
        console.warn('workbench periodic refresh error', e)
      }
    }, 3000)
    // 调整任务上下文高度以适配内容
    this.$nextTick(() => this.adjustTaskContextHeight())
  },
  beforeUnmount() {
    document.removeEventListener('keydown', this.onKeydown)
    if (this.workbenchRefreshTimer) {
      clearInterval(this.workbenchRefreshTimer)
      this.workbenchRefreshTimer = null
    }
  },
  methods: {
    goBack() {
      this.$router.push(`/project/${this.projectName}/task/${this.taskName}`)
    },
    async retryLog(log, index) {
      if (!log || !log.job_id) return

      this.submitting = true
      try {
        const templateId = log.template_id
        let response

        if (log.image) {
          const found = this.availableImages.find(f => f.name === log.image)
          if (!found) {
            alert('未找到原始图片文件，无法重试（请确保图片已保存到任务文件中）。')
            return
          }

          const fileUrl = networkMode.getDownloadUrl(found.downloadUrl)
          const fileBlob = await this.downloadFileAsBlob(fileUrl)

          const formData = new FormData()
          formData.append('task_context', log.prompt || '')
          formData.append('custom_data', JSON.stringify({ projectName: this.projectName, taskName: this.taskName }))
          formData.append('metadata', JSON.stringify({}))
          formData.append('project', this.projectName)
          formData.append('task', this.taskName)
          formData.append('image', fileBlob, found.name)

          response = await axios.post(
            `/api/ai/templates/${templateId}/apply`,
            formData,
            { headers: { 'Content-Type': 'multipart/form-data' } }
          )
        } else {
          const payload = {
            task_context: log.prompt || '',
            custom_data: { projectName: this.projectName, taskName: this.taskName },
            metadata: {},
            project: this.projectName,
            task: this.taskName
          }
          response = await axios.post(
            `/api/ai/templates/${templateId}/apply`,
            payload,
            { headers: { 'Content-Type': 'application/json' } }
          )
        }

        const jobData = response.data
        await this.saveTaskLog(jobData, null)

        // 删除原失败记录
        try {
          await axios.delete(`/api/tasks/${this.projectName}/${this.taskName}/ai-log/${log.job_id}`)
        } catch (delErr) {
          console.warn('删除旧日志失败:', delErr.message || delErr)
        }

        await this.loadTaskLogs()
      } catch (e) {
        console.error('retryLog error', e)
        alert('重试失败: ' + (e.response?.data?.error || e.message || e))
      } finally {
        this.submitting = false
      }
    },
    async loadTemplates() {
      try {
        const response = await axios.get('/api/ai/templates')
        this.templates = response.data.templates || {}
        this.templateCount = response.data.count || 0
      } catch (error) {
        console.error('Failed to load templates:', error)
        alert('加载模板失败: ' + (error.message || error))
      }
    },
    async loadTaskInfo() {
      try {
        // 加载任务详情获取README内容
        const taskResponse = await axios.get(`/api/tasks/${this.projectName}/${this.taskName}`)
        this.readmeContent = taskResponse.data.readmeContent || ''
        
        // 加载任务文件列表
        const filesResponse = await axios.get(`/api/tasks/${this.projectName}/${this.taskName}/files`)
        this.availableImages = filesResponse.data || []
      } catch (error) {
        console.error('Failed to load task info:', error)
      }
    },
    selectTemplate(templateId) {
      this.selectedTemplateId = templateId
      this.taskContext = ''
      this.selectedImageIndex = null
      // 选择后关闭下拉菜单
      this.templatesOpen = false
    },

    toggleTemplatesDropdown() {
      this.templatesOpen = !this.templatesOpen
    },
    selectImage(index) {
      this.selectedImageIndex = index
    },
    handleTextSelection() {
      const selection = window.getSelection()
      const text = selection.toString().trim()
      if (text) {
        this.selectedText = text
      }
    },
    fillSection(sec) {
      if (!sec) return
      const toAdd = (sec.plainText || '').trim()
      if (!toAdd) return
      if (this.taskContext && this.taskContext.trim()) {
        this.taskContext = this.taskContext + '\n\n' + toAdd
      } else {
        this.taskContext = toAdd
      }
      // 保持 README 选择器打开，便于连续选择；追加后调整高度
      this.$nextTick(() => this.adjustTaskContextHeight())
    },
    fillSelectedText() {
      if (this.selectedText) {
        const toAdd = this.selectedText.trim()
        if (toAdd) {
          if (this.taskContext && this.taskContext.trim()) this.taskContext = this.taskContext + '\n\n' + toAdd
          else this.taskContext = toAdd
        }
        this.selectedText = ''
        // 保持 README 选择器打开，便于连续选择；追加后调整高度
        this.$nextTick(() => this.adjustTaskContextHeight())
      }
    },

    onTaskContextInput() {
      // 当用户输入时自动调整高度
      this.adjustTaskContextHeight()
    },

    adjustTaskContextHeight() {
      this.$nextTick(() => {
        const el = this.$refs.taskContextInput
        if (!el) return
        try {
          el.style.height = 'auto'
          // 使用 scrollHeight 来设置合适高度，避免出现滚动条
          el.style.height = (el.scrollHeight) + 'px'
        } catch (e) {
          // 忽略调整错误
        }
      })
    },
    getImageThumbnail(file) {
      const url = file.thumbnailUrl || file.downloadUrl
      return networkMode.getDownloadUrl(url)
    },
    async submitTemplate() {
      if (!this.selectedTemplateId) {
        alert('请选择模板')
        return
      }

      if (this.selectedTemplate.uploads && this.selectedImageIndex === null) {
        alert('请选择图片')
        return
      }

      this.submitting = true

      try {
        let response
        const selectedFile = this.selectedImageIndex !== null ? this.availableImages[this.selectedImageIndex] : null

        if (this.selectedTemplate.uploads && selectedFile) {
          // 需要上传图片
          const formData = new FormData()
          formData.append('task_context', this.taskContext)
          // 新增空的 custom_data 与 metadata，以及所属 project/task 信息
          formData.append('custom_data', JSON.stringify({ projectName: this.projectName, taskName: this.taskName }))
          formData.append('metadata', JSON.stringify({}))
          formData.append('project', this.projectName)
          formData.append('task', this.taskName)
          
          // 下载文件并转换
          const fileUrl = networkMode.getDownloadUrl(selectedFile.downloadUrl)
          const fileBlob = await this.downloadFileAsBlob(fileUrl)
          
          // 如果是PSD，需要转换为JPG（这里简化处理，实际可能需要后端支持）
          let uploadBlob = fileBlob
          let fileName = selectedFile.name
          
          if (selectedFile.name.toLowerCase().endsWith('.psd')) {
            // 使用缩略图代替（因为前端无法转换PSD）
            const thumbUrl = networkMode.getDownloadUrl(selectedFile.thumbnailUrl)
            uploadBlob = await this.downloadFileAsBlob(thumbUrl)
            fileName = selectedFile.name.replace(/\.psd$/i, '.jpg')
          }
          
          formData.append('image', uploadBlob, fileName)

          // 为了便于调试，打印将要发送的 custom_data / metadata / project / task
          const multipartSummary = {
            task_context: this.taskContext,
            custom_data: { projectName: this.projectName, taskName: this.taskName },
            metadata: {},
            project: this.projectName,
            task: this.taskName,
            image: fileName
          }
          console.log('Sending multipart payload summary:', multipartSummary)
          // 打印 FormData 中的键值（Blob 会显示为 Blob 对象）
          for (const pair of formData.entries()) {
            console.log('FormData entry:', pair[0], pair[1])
          }

          response = await axios.post(
            `/api/ai/templates/${this.selectedTemplateId}/apply`,
            formData,
            {
              headers: {
                'Content-Type': 'multipart/form-data'
              }
            }
          )
        } else {
          // 纯文本模式
          const jsonPayload = {
            task_context: this.taskContext,
            custom_data: { projectName: this.projectName, taskName: this.taskName },
            metadata: {},
            project: this.projectName,
            task: this.taskName
          }
          console.log('Sending JSON payload:', jsonPayload)

          response = await axios.post(
            `/api/ai/templates/${this.selectedTemplateId}/apply`,
            jsonPayload,
            {
              headers: {
                'Content-Type': 'application/json'
              }
            }
          )
        }

        const jobData = response.data
        
        // 保存任务日志
        await this.saveTaskLog(jobData, selectedFile)
        
        alert(`任务已提交！Job ID: ${jobData.job_id}`)
        
        // 重新加载任务日志
        await this.loadTaskLogs()
        
      } catch (error) {
        console.error('Failed to submit template:', error)
        alert('提交失败: ' + (error.response?.data?.error || error.message || error))
      } finally {
        this.submitting = false
      }
    },
    async downloadFileAsBlob(url) {
      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to download file')
      return await response.blob()
    },
    async saveTaskLog(jobData, imageFile) {
      try {
        const logEntry = {
          time: new Date().toISOString().replace('T', ' ').substring(0, 16),
          job_id: jobData.job_id,
          template_id: jobData.template_id,
          template_name: jobData.template_name,
          prompt: this.fullPrompt,
          image: imageFile ? imageFile.name : null,
          status: jobData.status,
          custom_data: jobData.custom_data,
          metadata: jobData.metadata
        }

        await axios.post(
          `/api/tasks/${this.projectName}/${this.taskName}/ai-log`,
          logEntry
        )
      } catch (error) {
        console.error('Failed to save task log:', error)
      }
    },
    async loadTaskLogs() {
      try {
        const response = await axios.get(
          `/api/tasks/${this.projectName}/${this.taskName}/ai-log`
        )
        this.taskLogs = response.data.logs || []
        console.log('Loaded task logs:', this.taskLogs.length, this.taskLogs)
      } catch (error) {
        console.error('Failed to load task logs:', error)
        this.taskLogs = []
      }
    },
    async checkPendingJobs() {
      // 检查所有处理中的任务
      const pendingJobs = this.taskLogs.filter(log => 
        log.status === 'processing' && log.job_id
      )
      
      if (pendingJobs.length === 0) return
      
      console.log(`Found ${pendingJobs.length} pending job(s), checking status...`)
      
      for (const job of pendingJobs) {
        try {
          const response = await axios.get(`/api/ai/jobs/${job.job_id}`)
          const jobStatus = response.data
          
          if (jobStatus.status === 'completed') {
            // 任务已完成，更新日志
            await this.updateTaskLog(job.job_id, 'completed', jobStatus.result)
            console.log(`Job ${job.job_id} completed, log updated`)
          } else if (jobStatus.status === 'failed') {
            // 任务失败
            await this.updateTaskLog(job.job_id, 'failed', { error: jobStatus.error || '任务失败' })
            console.log(`Job ${job.job_id} failed`)
          } else {
            console.log(`Job ${job.job_id} still processing...`)
          }
        } catch (error) {
          console.error(`Failed to check job ${job.job_id}:`, error)
        }
      }
      
      // 重新加载日志显示更新
      await this.loadTaskLogs()
    },
    toggleLog(index) {
      const id = this.taskLogs[index]?.job_id ?? String(index)
      const pos = this.expandedLogIds.indexOf(id)
      if (pos === -1) this.expandedLogIds.push(id)
      else this.expandedLogIds.splice(pos, 1)
    },
    openPreview(url) {
      if (!url) return
      this.previewImageUrl = url
    },
    closePreview() {
      this.previewImageUrl = null
    },
    onKeydown(e) {
      if (e.key === 'Escape' && this.previewImageUrl) this.closePreview()
    },
    async saveImage(log, img) {
      try {
        const url = this.getAIImageUrl(img.url)
        if (!url) return
        this.savingImageMap = Object.assign({}, this.savingImageMap, { [url]: true })
        const resp = await axios.post(`/api/tasks/${this.projectName}/${this.taskName}/save-image`, { url })
        if (resp.data && resp.data.success) {
          alert(`已保存为 ${resp.data.filename}`)
          // 刷新任务文件列表以显示新文件
          await this.loadTaskInfo()
        } else {
          alert('保存失败')
        }
      } catch (e) {
        console.error('保存图片失败', e)
        alert('保存图片失败: ' + (e.response?.data?.error || e.message || e))
      } finally {
        const url = this.getAIImageUrl(img.url)
        const m = Object.assign({}, this.savingImageMap)
        delete m[url]
        this.savingImageMap = m
      }
    },
    async saveResultImage(log, img) {
      try {
        const key = `${log.job_id}::${img.filename}`
        this.$set(this.savingImages, key, true)
        const url = this.getAIImageUrl(img.url)
        const resp = await axios.post(`/api/tasks/${this.projectName}/${this.taskName}/save-image`, { url, filename: img.filename })
        if (resp.data && resp.data.success) {
          alert(`图片已保存为 ${resp.data.filename}`)
          // 重新加载任务文件列表（以便可在可用图片中看到）
          await this.loadTaskInfo()
        } else {
          alert('保存失败: ' + (resp.data?.error || '未知错误'))
        }
      } catch (e) {
        console.error('saveResultImage error', e)
        alert('保存失败: ' + (e.response?.data?.error || e.message || e))
      } finally {
        const key = `${log.job_id}::${img.filename}`
        this.$delete(this.savingImages, key)
      }
    },
    isExpanded(index) {
      const id = this.taskLogs[index]?.job_id ?? String(index)
      return this.expandedLogIds.indexOf(id) !== -1
    },
    async updateTaskLog(jobId, status, result) {
      try {
        await axios.put(
          `/api/tasks/${this.projectName}/${this.taskName}/ai-log/${jobId}`,
          { status, result }
        )
      } catch (error) {
        console.error('Failed to update task log:', error)
      }
    },
    getStatusText(status) {
      const statusMap = {
        'processing': '处理中',
        'completed': '已完成',
        'failed': '失败',
        'pending': '等待中'
      }
      return statusMap[status] || status
    },
    isResultJson(result) {
      if (!result) return false
      try {
        const cleaned = result.replace(/```json\n?|```/g, '').trim()
        return cleaned.startsWith('{') || cleaned.startsWith('[')
      } catch (e) {
        return false
      }
    },
    getResultData(result) {
      try {
        const cleaned = result.replace(/```json\n?|```/g, '').trim()
        return JSON.parse(cleaned)
      } catch (e) {
        return {}
      }
    },
    getAIImageUrl(url) {
      // 如果是相对路径，转换为绝对路径
      if (url && url.startsWith('/api/')) {
        return `http://192.168.3.150:3001${url}`
      }
      return url
    },
    filterExtraData(data) {
      if (!data || typeof data !== 'object') return ''
      const extra = {}
      Object.keys(data).forEach(k => {
        if (!['images', 'texts'].includes(k)) extra[k] = data[k]
      })
      try {
        return JSON.stringify(extra, null, 2)
      } catch (e) {
        return String(extra)
      }
    },
    formatResult(result) {
      if (!result) return ''
      try {
        // 如果result是JSON字符串，尝试格式化
        if (result.startsWith('{') || result.startsWith('[')) {
          const parsed = JSON.parse(result.replace(/```json\n?|```/g, '').trim())
          return JSON.stringify(parsed, null, 2)
        }
        return result
      } catch (e) {
        return result
      }
    }
  }
}
</script>

<style scoped>
.ai-workbench {
  padding: 0.75rem; /* 减少页面边距 */
  max-width: 100%;  /* 利用全部宽度 */
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #e9ecef;
}

.page-header h2 {
  margin: 0;
  font-size: 1.75rem;
  color: #212529;
}

.loading {
  text-align: center;
  padding: 3rem;
  color: #6c757d;
}

.workbench-container {
  display: flex; /* 改为 flex 布局更易控制 */
  flex-direction: column;
  gap: 0.4rem;    /* 极小间距 */
  min-height: auto; /* 取消初始的高高度限制 */
}

/* 模板列表 */

.templates-dropdown {
  position: relative;
  margin-bottom: 0rem;
  width: fit-content; /* 宽度随内容变化，不占满全行 */
}

.templates-btn {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
}

.template-count {
  margin-left: 0.5rem;
  font-weight: 400;
  color: #6c757d;
}

.templates-menu {
  position: absolute;
  z-index: 60;
  background: white;
  border: 1px solid #e6e6e6;
  box-shadow: 0 8px 24px rgba(0,0,0,0.06);
  border-radius: 6px;
  margin-top: 6px;
  width: 320px;
  max-height: 420px;
  overflow: auto;
}

.templates-menu-item {
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid #f1f1f1;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.templates-menu-item:hover { background: #f8f9fa }

.templates-menu-item.active { background: #e7f3ff; color: #007bff }

.menu-name { font-weight: 600 }
.menu-type { font-size: 0.85rem; color: #6c757d }

.templates-sidebar h3 {
  margin: 0 0 1rem 0;
  font-size: 1.1rem;
  color: #495057;
}

.template-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.template-item {
  padding: 0.75rem;
  background: white;
  border: 2px solid #dee2e6;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.template-item:hover {
  border-color: #007bff;
  background: #f0f8ff;
}

.template-item.active {
  border-color: #007bff;
  background: #007bff;
  color: white;
}

.template-name {
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.template-type {
  font-size: 0.85rem;
  opacity: 0.8;
}

/* 模板详情 */
.template-detail {
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 1rem;
  /* 展开显示全部内容，不在内部滚动 */
  overflow: visible;
  max-height: none;
}

/* 修改 CSS 样式 */
.no-selection {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  color: #adb5bd;
  background: #fdfdfd;
  border: 2px dashed #dee2e6; /* 虚线框引导感更强 */
  border-radius: 8px;
  min-height: 400px; /* 关键：固定初始高度，防止塌陷 */
  margin: 10px 0;
}

.no-selection p {
  margin-top: 1rem;
  font-size: 1.1rem;
}

/* 模拟一个简单的引导图标 */
.no-selection::before {
  content: '💡';
  font-size: 3rem;
  margin-bottom: 1rem;
}

.template-content h3 {
  margin: 0 0 1rem 0;
  font-size: 1.3rem;
  color: #212529;
}

.detail-container {
  display: flex;       /* 开启弹性布局 */
  gap: 12px;           /* 设置“类型”和“模型”之间的间距 */
}

.detail-section {
  margin-bottom: 1.5rem;
}

.detail-section label {
  display: block;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: #495057;
}

.detail-section pre {
  background: #f8f9fa;
  padding: 0.75rem;
  border-radius: 4px;
  overflow-x: auto;
  font-size: 0.9rem;
}

.template-prompt,
.prompt-preview {
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 4px;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.6;
}

.prompt-preview {
  background: #e7f3ff;
  border: 1px solid #007bff;
}

.task-context-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-family: inherit;
  font-size: 0.95rem;
  resize: vertical;
  /* 自动高度并隐藏内部滚动条，使用 JS 调整高度 */
  overflow: hidden;
  height: auto;
  max-height: none;
  margin-bottom: 0.5rem;
}

.task-context-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
}

.readme-selector {
  margin-top: 1rem;
  padding: 1rem;
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  /* 展开显示全部 README 内容，不出现滚动条 */
  max-height: none;
  overflow: visible;
}

.readme-sections { display: flex; flex-direction: column; gap: 0.5rem }
.readme-section { padding: 0.6rem; border-radius: 6px; cursor: pointer; border: 1px solid transparent }
.readme-section:hover { background: #fff; border-color: #e6e6e6 }
.readme-section-title { font-weight: 700; margin-bottom: 0.25rem }
.readme-section-body { color: #444; font-size: 0.95rem }

.readme-help {
  font-size: 0.85rem;
  color: #6c757d;
  margin-bottom: 0.75rem;
  padding: 0.5rem;
  background: #fff3cd;
  border-left: 3px solid #ffc107;
  border-radius: 3px;
}

.readme-content-display {
  font-size: 0.9rem;
  line-height: 1.6;
  cursor: text;
  user-select: text;
}

.readme-content-display::selection {
  background: #b3d7ff;
}

.readme-content-display:deep(h1),
.readme-content-display:deep(h2),
.readme-content-display:deep(h3) {
  margin-top: 1rem;
  margin-bottom: 0.5rem;
}

.readme-content-display:deep(p) {
  margin: 0.5rem 0;
}

/* 图片选择器 */
.image-selector {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 1rem;
  margin-top: 0.5rem;
}

.image-item {
  cursor: pointer;
  border: 2px solid #dee2e6;
  border-radius: 6px;
  padding: 0.5rem;
  transition: all 0.2s;
  text-align: center;
}

.image-item:hover {
  border-color: #007bff;
  background: #f0f8ff;
}

.image-item.selected {
  border-color: #007bff;
  background: #e7f3ff;
}

.image-item img {
  width: 100%;
  height: 100px;
  object-fit: cover;
  border-radius: 4px;
  margin-bottom: 0.5rem;
}

.image-name {
  font-size: 0.8rem;
  color: #495057;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selected-image-info {
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: #d4edda;
  border: 1px solid #c3e6cb;
  border-radius: 4px;
  font-size: 0.9rem;
  color: #155724;
}

/* 操作按钮 */
.action-section {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid #dee2e6;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #0056b3;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #5a6268;
}

.btn-success {
  background: #28a745;
  color: white;
}

.btn-success:hover {
  background: #218838;
}

.btn-sm {
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
}

.btn-large {
  padding: 0.75rem 2rem;
  font-size: 1.1rem;
}

/* 任务历史区域（独立显示在下方） */
.task-history-section {
  margin-top: 2rem;
  padding: 1.5rem;
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 8px;
}

.task-history-section .history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #e9ecef;
}

.task-history-section h3 {
  margin: 0;
  font-size: 1.5rem;
  color: #212529;
  font-weight: 600;
}

.task-log-item {
  background: #f8f9fa;
  border: 2px solid #dee2e6;
  border-radius: 8px;
  padding: 1.25rem;
  margin-bottom: 1.25rem;
  transition: all 0.2s;
}

.task-log-item:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transform: translateY(-1px);
}

.task-log-item.collapsed {
  padding: 0.65rem 1rem;
}

.task-log-item.collapsed .log-info {
  display: none;
}

.log-header {
  cursor: pointer;
}

.log-title {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: 1rem;
}

/* 预览模态 */
.preview-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.7);
  z-index: 9999;
}
.preview-image {
  max-width: 90vw;
  max-height: 85vh;
  border-radius: 6px;
  box-shadow: 0 8px 30px rgba(0,0,0,0.6);
}
.preview-close {
  position: absolute;
  top: 20px;
  right: 24px;
  background: rgba(255,255,255,0.9);
  border: none;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 1rem;
  cursor: pointer;
  z-index: 10000;
}

.task-log-item.status-completed {
  border-left: 5px solid #28a745;
  background: #f8fff9;
}

.task-log-item.status-processing {
  border-left: 5px solid #ffc107;
  background: #fffef8;
}

.task-log-item.status-failed {
  border-left: 5px solid #dc3545;
  background: #fff8f8;
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid #e9ecef;
}

.log-time {
  font-size: 0.95rem;
  color: #495057;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.time-icon {
  font-size: 1rem;
}

.log-info {
  font-size: 0.95rem;
}

.info-row {
  margin: 0.75rem 0;
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}

.info-row strong {
  min-width: 80px;
  color: #495057;
}

.job-id, .template-id {
  background: #f8f9fa;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.85rem;
  color: #6c757d;
  font-family: 'Courier New', monospace;
}

.template-name {
  color: #007bff;
  font-weight: 500;
  margin-right: 0.5rem;
}

.image-name {
  color: #6c757d;
  font-style: italic;
}

.prompt-row {
  flex-direction: column;
  align-items: flex-start;
}

.prompt-text {
  background: #f8f9fa;
  padding: 0.75rem;
  border-radius: 4px;
  border-left: 3px solid #007bff;
  margin-top: 0.5rem;
  width: 100%;
  line-height: 1.6;
  color: #333;
}

.status-badge {
  display: inline-block;
  padding: 0.35rem 0.85rem;
  border-radius: 16px;
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.status-processing {
  background: #fff3cd;
  color: #856404;
  animation: pulse 2s ease-in-out infinite;
}

.status-completed {
  background: #d4edda;
  color: #155724;
}

.status-failed {
  background: #f8d7da;
  color: #721c24;
}

.status-pending {
  background: #d1ecf1;
  color: #0c5460;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}
/* 容器精简 */
.log-result {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid #eee;
}

.log-result > strong {
  font-size: 0.875rem;
  color: #666;
  margin-bottom: 0.5rem;
}

/* 结果卡片扁平化 */
.result-json {
  background: #fafafa;
  padding: 0.5rem; /* 缩小内边距 */
  border-radius: 4px;
  border: 1px solid #f0f0f0;
}

.result-section-title {
  font-weight: bold;
  font-size: 0.8rem;
  text-transform: uppercase; /* 增加辨识度 */
  color: #999;
  margin: 0.5rem 0;
}

/* 图片网格优化：使用更小的尺寸，容纳更多内容 */
.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); /* 缩小最小宽度 */
  gap: 0.5rem;
}

.result-image-item {
  background: #fff;
  border: 1px solid #eee;
  padding: 4px;
  border-radius: 4px;
}

.result-image-item img {
  height: 100px; /* 降低高度，增加单屏显示数量 */
  object-fit: cover;
  border-radius: 2px;
}

.image-filename {
  font-size: 0.75rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis; /* 长文件名不换行，保持整齐 */
}

/* 文本内容优化 */
.text-item {
  font-size: 0.9rem;
  line-height: 1.4;
  padding: 0.4rem;
  background: #fff;
  border-left: 3px solid #007bff;
  margin-bottom: 0.25rem;
}

.image-filename {
  font-size: 0.85rem;
  color: #6c757d;
  margin-bottom: 0.5rem;
  word-break: break-all;
}

.download-btn {
  width: 100%;
  margin-top: 0.5rem;
}

.result-texts {
  margin-bottom: 1rem;
}

.text-item {
  background: white;
  padding: 0.75rem;
  border-radius: 4px;
  border-left: 3px solid #28a745;
  margin-bottom: 0.5rem;
  line-height: 1.6;
}

.raw-json {
  margin-top: 1rem;
}

.raw-json summary {
  cursor: pointer;
  padding: 0.5rem;
  background: #e9ecef;
  border-radius: 4px;
  font-weight: 500;
  color: #495057;
  user-select: none;
}

.raw-json summary:hover {
  background: #dee2e6;
}

.raw-json pre {
  background: white;
  padding: 0.75rem;
  border-radius: 4px;
  overflow-x: auto;
  font-size: 0.85rem;
  margin-top: 0.5rem;
  max-height: 300px;
  border: 1px solid #dee2e6;
}

.result-text {
  background: white;
  padding: 0.75rem;
  border-radius: 4px;
  overflow-x: auto;
  font-size: 0.9rem;
  max-height: 300px;
  border: 1px solid #dee2e6;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
