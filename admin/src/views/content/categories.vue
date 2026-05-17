<template>
  <div class="categories-page">
    <div class="page-header">
      <h2>分类管理</h2>
      <el-button type="primary" @click="openDialog()">新建分类</el-button>
    </div>
    <el-table :data="categories" style="width: 100%" v-loading="loading">
      <el-table-column label="图标" width="70">
        <template #default="{ row }">
          <el-icon v-if="row.icon && iconMap[row.icon]" :size="20">
            <component :is="iconMap[row.icon]" />
          </el-icon>
          <span v-else>{{ row.icon }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="key" label="Key" width="120" />
      <el-table-column prop="label" label="显示名称" width="140" />
      <el-table-column prop="sortOrder" label="排序" width="70" />
      <el-table-column prop="status" label="状态" width="80">
        <template #default="{ row }">
          <el-tag :type="row.status === 'enabled' ? 'success' : 'info'" size="small">
            {{ row.status === 'enabled' ? '启用' : '禁用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="默认" width="70">
        <template #default="{ row }">
          <el-tag v-if="row.isDefault" type="warning" size="small" effect="dark">默认</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="240">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="openDialog(row)">编辑</el-button>
          <el-button v-if="!row.isDefault" link type="warning" size="small" @click="setAsDefault(row.id)">设为默认</el-button>
          <el-button link type="danger" size="small" @click="remove(row.id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑分类' : '新建分类'" width="550px" destroy-on-close>
      <el-form :model="form" label-width="80px">
        <el-form-item label="Key" required>
          <el-input v-model="form.key" placeholder="如：gaokao" :disabled="!!editingId" />
        </el-form-item>
        <el-form-item label="显示名称" required>
          <el-input v-model="form.label" placeholder="如：智能选校" />
        </el-form-item>
        <el-form-item label="图标">
          <div class="icon-picker">
            <span
              v-for="name in iconNames"
              :key="name"
              class="icon-option"
              :class="{ active: form.icon === name }"
              @click="form.icon = form.icon === name ? '' : name"
            >
              <el-icon :size="20">
                <component :is="iconMap[name]" />
              </el-icon>
            </span>
          </div>
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sortOrder" :min="0" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio value="enabled">启用</el-radio>
            <el-radio value="disabled">禁用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { api } from '@/api';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  School, Reading, Briefcase, View, OfficeBuilding,
  EditPen, Sunny, Star, Aim, DataLine, Monitor,
  Connection, Trophy, TrendCharts, Notebook,
  FolderOpened, Compass, Medal, Clock, MagicStick,
} from '@element-plus/icons-vue';

const iconMap: Record<string, any> = {
  School, Reading, Briefcase, View, OfficeBuilding,
  EditPen, Sunny, Star, Aim, DataLine, Monitor,
  Connection, Trophy, TrendCharts, Notebook,
  FolderOpened, Compass, Medal, Clock, MagicStick,
};

const iconNames = Object.keys(iconMap);

const categories = ref<any[]>([]);
const loading = ref(false);
const dialogVisible = ref(false);
const editingId = ref('');

const form = reactive({
  key: '',
  label: '',
  icon: '',
  sortOrder: 0,
  status: 'enabled',
});

async function load() {
  loading.value = true;
  try {
    const res: any = await api.categories.list();
    categories.value = res.data;
  } finally {
    loading.value = false;
  }
}

function openDialog(row?: any) {
  if (row) {
    editingId.value = row.id;
    Object.assign(form, {
      key: row.key,
      label: row.label,
      icon: row.icon || '',
      sortOrder: row.sortOrder,
      status: row.status,
    });
  } else {
    editingId.value = '';
    Object.assign(form, { key: '', label: '', icon: iconNames[0], sortOrder: 0, status: 'enabled' });
  }
  dialogVisible.value = true;
}

async function save() {
  try {
    if (editingId.value) {
      await api.categories.update(editingId.value, form);
    } else {
      await api.categories.create(form);
    }
    ElMessage.success('保存成功');
    dialogVisible.value = false;
    load();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || e.message || '保存失败');
  }
}

async function setAsDefault(id: string) {
  try {
    await api.categories.setDefault(id);
    ElMessage.success('已设为默认');
    load();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || e.message || '操作失败');
  }
}

async function remove(id: string) {
  await ElMessageBox.confirm('确定删除该分类？', '提示', { type: 'warning' });
  await api.categories.delete(id);
  ElMessage.success('删除成功');
  load();
}

onMounted(load);
</script>

<style lang="scss" scoped>
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
h2 { margin: 0; }

.icon-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.icon-option {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--el-border-color);
  border-radius: 8px;
  cursor: pointer;
  color: var(--el-text-color-secondary);
  transition: all 0.15s;

  &:hover {
    border-color: var(--el-color-primary);
    color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
  }

  &.active {
    border-color: var(--el-color-primary);
    color: var(--el-color-primary);
    background: var(--el-color-primary-light-8);
    box-shadow: 0 0 0 1px var(--el-color-primary) inset;
  }
}
</style>
