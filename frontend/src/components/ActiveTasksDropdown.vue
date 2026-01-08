<template>
  <div class="active-tasks-dropdown">
    <button class="tasks-btn" @click="toggleOpen">
      正在进行 ({{ count }})
    </button>

    <div v-if="open" class="dropdown-panel" @click.stop>
      <div v-if="loading" class="panel-empty">加载中...</div>
      <div v-else-if="!tasks || tasks.length === 0" class="panel-empty">当前没有正在进行的任务</div>
      <ul v-else class="tasks-list">
        <li v-for="task in tasks" :key="task.task_id" class="task-item" @click="openTask(task)">
          <div class="task-title">{{ task.custom_data?.projectName || '—' }} / {{ task.custom_data?.taskName || '—' }}</div>
          <div class="task-meta">{{ task.template_name || task.type }} · {{ task.status }}</div>
        </li>
      </ul>
    </div>
  </div>
</template>

<script>
import axios from 'axios'

export default {
  name: 'ActiveTasksDropdown',
  data() {
    return {
      open: false,
      loading: false,
      count: 0,
      tasks: [],
      timer: null,
    }
  },
  methods: {
    toggleOpen() {
      this.open = !this.open
      if (this.open) {
        // 打开下拉时停止后台轮询，避免干扰下拉内容
        this.stopPolling()
        this.fetchRecent()
      } else {
        // 关闭后恢复轮询
        this.startPolling()
      }
    },

    // 获取正在进行的任务（用于顶部数字统计，后台轮询）
    // 注意：此方法不改变下拉的 `loading` 或 `tasks`，以免干扰已打开的下拉面板显示
    async fetch() {
      try {
        const url = '/api/tasks/active'
        const resp = await axios.get(url)
        if (resp && resp.data) {
          this.count = resp.data.count || 0
        }
      } catch (e) {
        console.warn('fetch active tasks failed', e)
      }
    },

    // 点击下拉时获取最近任务并显示
    async fetchRecent() {
      this.loading = true
      try {
        const url = '/api/tasks/recent'
        const resp = await axios.get(url)
        console.log('recent tasks response', resp)
        if (resp && resp.data) {
          // 不覆盖顶部的正在进行计数，只更新任务列表
          this.tasks = resp.data.tasks || []
        }
      } catch (e) {
        console.warn('fetch recent tasks failed', e)
        this.tasks = []
      } finally {
        this.loading = false
      }
    },
    openTask(task) {
      const p = task.custom_data?.projectName
      const t = task.custom_data?.taskName
      if (p && t) {
        this.$router.push(`/project/${encodeURIComponent(p)}/task/${encodeURIComponent(t)}/ai-workbench`)
        this.open = false
      }
    },
    startPolling() {
      this.stopPolling()
      this.timer = setInterval(() => {
        // 仅在下拉未打开时执行轮询，防止刷新下拉面板
        if (!this.open) this.fetch()
      }, 3000)
    },
    stopPolling() {
      if (this.timer) {
        clearInterval(this.timer)
        this.timer = null
      }
    }
  },
  mounted() {
    this.fetch()
    this.startPolling()
  },
  beforeUnmount() {
    this.stopPolling()
  }
}
</script>

<style scoped>
.active-tasks-dropdown { position: relative; display: inline-block; margin-right: 1rem; }
.tasks-btn { padding: 0.35rem 0.6rem; border-radius: 4px; border: 1px solid #ddd; background: #fff; cursor: pointer; }
.dropdown-panel { position: absolute; right: 0; top: 2.6rem; width: 320px; background: #fff; border: 1px solid #e5e5e5; box-shadow: 0 6px 18px rgba(0,0,0,0.08); border-radius: 6px; z-index: 50; padding: 0.5rem; }
.panel-empty { padding: 0.6rem; color: #666; font-size: 0.9rem; }
.tasks-list { list-style: none; margin: 0; padding: 0; max-height: 320px; overflow: auto; }
.task-item { padding: 0.5rem; border-radius: 4px; cursor: pointer; display: flex; flex-direction: column; }
.task-item:hover { background: #f8f9fa; }
.task-title { font-weight: 600; color: #333; font-size: 0.95rem; }
.task-meta { font-size: 0.8rem; color: #888; margin-top: 4px; }
</style>
