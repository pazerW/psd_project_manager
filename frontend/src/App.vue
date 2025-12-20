<template>
  <div id="app">
    <header class="app-header">
      <div class="container">
        <h1>
          <router-link to="/" class="logo">
            Design Project Management
          </router-link>
        </h1>
        <nav class="breadcrumb">
          <router-link to="/" class="breadcrumb-item">项目列表</router-link>
          <span v-if="$route.params.projectName" class="breadcrumb-separator">›</span>
          <router-link 
            v-if="$route.params.projectName"
            :to="`/project/${$route.params.projectName}`"
            class="breadcrumb-item"
          >
            {{ $route.params.projectName }}
          </router-link>
          <span v-if="$route.params.taskName" class="breadcrumb-separator">›</span>
          <span v-if="$route.params.taskName" class="breadcrumb-item current">
            {{ $route.params.taskName }}
          </span>
        </nav>
      </div>
    </header>
    
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<script>
export default {
  name: 'App'
}
</script>

<style>
.app-header {
  background: white;
  border-bottom: 1px solid #e5e5e5;
  padding: 1rem 0;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo {
  color: #2c3e50;
  text-decoration: none;
  font-size: 1.5rem;
  font-weight: 600;
}

.breadcrumb {
  display: flex;
  align-items: center;
  font-size: 0.9rem;
  color: #666;
}

.breadcrumb-item {
  color: #007bff;
  text-decoration: none;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.breadcrumb-item:hover {
  background-color: #f8f9fa;
}

.breadcrumb-item.current {
  color: #666;
  background: none;
}

.breadcrumb-separator {
  margin: 0 0.5rem;
  color: #ccc;
}

.main-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
  min-height: calc(100vh - 120px);
}

/* 通用样式 */
.card {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  margin-bottom: 1rem;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  text-decoration: none;
  display: inline-block;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-primary:hover {
  background: #0056b3;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #545b62;
}

.status-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  display: inline-block;
}

.status-active { background: #d4edda; color: #155724; }
.status-pending { background: #fff3cd; color: #856404; }
.status-completed { background: #d1ecf1; color: #0c5460; }
.status-paused { background: #f8d7da; color: #721c24; }
</style>