<template>
  <div v-if="visible" class="comment-modal" @click.self="closeDialog">
    <div class="comment-dialog">
      <h3>添加留言</h3>
      
      <div class="comment-form">
        <div class="form-group">
          <label>标题：</label>
          <input 
            type="text" 
            v-model="title"
            class="comment-input"
            placeholder="请输入留言标题"
            @keydown.enter="handleSubmit"
          />
        </div>
        
        <div class="form-group">
          <label>内容：</label>
          <textarea 
            v-model="content"
            class="comment-textarea"
            placeholder="请输入留言内容"
            rows="6"
          ></textarea>
        </div>
      </div>
      
      <div class="dialog-actions">
        <button class="btn btn-secondary" @click="closeDialog">
          取消
        </button>
        <button 
          class="btn btn-primary" 
          @click="handleSubmit"
          :disabled="!canSubmit"
        >
          确定
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios'

export default {
  name: 'CommentDialog',
  props: {
    visible: {
      type: Boolean,
      default: false
    },
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
      title: '',
      content: ''
    }
  },
  computed: {
    canSubmit() {
      return this.title.trim() && this.content.trim()
    }
  },
  watch: {
    visible(newVal) {
      if (!newVal) {
        // 对话框关闭时清空表单
        this.resetForm()
      }
    }
  },
  methods: {
    closeDialog() {
      this.$emit('close')
    },
    
    resetForm() {
      this.title = ''
      this.content = ''
    },
    
    async handleSubmit() {
      const trimmedTitle = this.title.trim()
      const trimmedContent = this.content.trim()
      
      if (!trimmedTitle || !trimmedContent) {
        alert('请输入标题和内容')
        return
      }
      
      // 添加日期时间到标题末尾
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const day = String(now.getDate()).padStart(2, '0')
      const hours = String(now.getHours()).padStart(2, '0')
      const minutes = String(now.getMinutes()).padStart(2, '0')
      const datetime = `${year}-${month}-${day} ${hours}:${minutes}`
      const titleWithDate = `${trimmedTitle} ${datetime}`
      
      try {
        await axios.post(
          `/api/tasks/${this.projectName}/${this.taskName}/comment`,
          { 
            title: titleWithDate, 
            content: trimmedContent 
          }
        )
        
        // 触发成功事件
        this.$emit('success')
        
        // 重置表单
        this.resetForm()
        
        // 关闭对话框
        this.closeDialog()
        
        alert('留言添加成功')
      } catch (error) {
        console.error('添加留言失败:', error)
        alert('添加留言失败：' + (error.response?.data?.error || error.message))
      }
    }
  }
}
</script>

<style scoped>
/* 留言对话框样式 */
.comment-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.comment-dialog {
  background: white;
  border-radius: 8px;
  padding: 2rem;
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
}

.comment-dialog h3 {
  color: #2c3e50;
  margin-bottom: 1.5rem;
}

.comment-form {
  margin: 1.5rem 0;
}

.form-group {
  margin-bottom: 1.25rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #495057;
}

.comment-input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.95rem;
}

.comment-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.comment-textarea {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.95rem;
  line-height: 1.5;
  resize: vertical;
  min-height: 100px;
}

.comment-textarea:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.dialog-actions {
  margin-top: 1.5rem;
  text-align: right;
  border-top: 1px solid #e5e5e5;
  padding-top: 1rem;
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.95rem;
  transition: background 0.2s;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #0056b3;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #5a6268;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
