<template>
  <div class="skills-page">
    <div class="page-header">
      <h2>Skill 管理</h2>
      <el-button type="primary" @click="openDialog()">添加 Skill</el-button>
    </div>
    <el-table :data="skills" style="width: 100%">
      <el-table-column prop="name" label="名称" min-width="150" />
      <el-table-column prop="model" label="模型" width="140" />
      <el-table-column prop="status" label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="row.status === 'enabled' ? 'success' : 'info'" size="small">
            {{ row.status === 'enabled' ? '启用' : '禁用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="isDefault" label="默认" width="80">
        <template #default="{ row }">
          <el-tag v-if="row.isDefault" type="warning" size="small">默认</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="sortOrder" label="排序" width="70" />
      <el-table-column label="操作" width="310">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDialog(row)">编辑</el-button>
          <el-button link type="warning" @click="syncFromGithub(row.id)">同步</el-button>
          <el-button link type="success" @click="downloadSkillMd(row)">下载</el-button>
          <el-button link type="danger" @click="remove(row.id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑 Skill' : '添加 Skill'" width="900px" destroy-on-close>
      <el-form :model="form" label-width="100px">
        <el-form-item label="名称" required>
          <el-input v-model="form.name" placeholder="如：升学规划助手" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="2" placeholder="简短描述该 Skill 的用途" />
        </el-form-item>
        <el-form-item label="System Prompt" required>
          <el-input v-model="form.systemPrompt" type="textarea" :rows="15" placeholder="AI 人设和回答规则指令（支持 Markdown）" />
        </el-form-item>
        <el-form-item label="模型">
          <el-select v-model="form.model" filterable placeholder="请选择模型">
            <el-option-group label="通用">
              <el-option label="跟随全局配置" value="global" />
            </el-option-group>
            <el-option-group label="DeepSeek 官方">
              <el-option label="DeepSeek v4" value="deepseek-chat" />
              <el-option label="DeepSeek Flash" value="deepseek-flash" />
            </el-option-group>
            <el-option-group label="阿里百炼 Token Plan">
              <el-option
                v-for="item in bailianTextModels"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              >
                <div class="model-option">
                  <span>{{ item.label }}</span>
                  <small>{{ item.ability }}</small>
                </div>
              </el-option>
            </el-option-group>
          </el-select>
          <div class="form-tip">单个 Skill 可覆盖全局模型；百炼模型会走管理后台 AI 配置里的百炼 API Key。</div>
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="温度">
              <el-input-number v-model="form.temperature" :min="0" :max="2" :step="0.1" placeholder="留空用全局" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="最大Token">
              <el-input-number v-model="form.maxTokens" :min="100" :max="8000" :step="100" placeholder="留空用全局" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="Top P">
              <el-input-number v-model="form.topP" :min="0" :max="1" :step="0.05" placeholder="留空用全局" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="关键词">
          <el-input v-model="keywordsStr" type="textarea" :rows="2" placeholder="逗号分隔，如：高考,志愿,考研。用于 RAG 知识库检索" />
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="状态">
              <el-radio-group v-model="form.status">
                <el-radio value="enabled">启用</el-radio>
                <el-radio value="disabled">禁用</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="设为首选">
              <el-switch v-model="form.isDefault" />
              <span style="margin-left: 8px; font-size: 12px; color: var(--el-text-color-secondary)">咨询时默认使用</span>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="排序">
              <el-input-number v-model="form.sortOrder" :min="0" />
            </el-form-item>
          </el-col>
        </el-row>
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

const skills = ref([]);
const dialogVisible = ref(false);
const editingId = ref('');
const keywordsStr = ref('');

const bailianTextModels = [
  { label: 'qwen3.7-max', value: 'qwen3.7-max', ability: '推理模型、文本生成' },
  { label: 'qwen3.6-plus', value: 'qwen3.6-plus', ability: '推理模型、视觉理解、文本生成' },
  { label: 'qwen3.6-flash', value: 'qwen3.6-flash', ability: '推理模型、视觉理解、文本生成' },
  { label: 'deepseek-v4-pro', value: 'deepseek-v4-pro', ability: '推理模型、文本生成' },
  { label: 'deepseek-v4-flash', value: 'deepseek-v4-flash', ability: '文本生成、推理模型' },
  { label: 'deepseek-v3.2', value: 'deepseek-v3.2', ability: '推理模型、文本生成' },
  { label: 'kimi-k2.6', value: 'kimi-k2.6', ability: '推理模型、视觉理解、文本生成' },
  { label: 'kimi-k2.5', value: 'kimi-k2.5', ability: '推理模型、视觉理解、文本生成' },
  { label: 'glm-5.1', value: 'glm-5.1', ability: '文本生成' },
  { label: 'glm-5', value: 'glm-5', ability: '文本生成' },
  { label: 'MiniMax-M2.5', value: 'MiniMax-M2.5', ability: '推理模型、文本生成' },
];

const form = reactive({
  name: '',
  description: '',
  systemPrompt: '',
  model: 'global',
  temperature: null as number | null,
  maxTokens: null as number | null,
  topP: null as number | null,
  keywords: '[]',
  status: 'enabled',
  isDefault: false,
  sortOrder: 0,
});

async function load() {
  const res = await api.skills.list() as any;
  skills.value = res.data;
}

function openDialog(row?: any) {
  if (row) {
    editingId.value = row.id;
    Object.assign(form, {
      name: row.name,
      description: row.description || '',
      systemPrompt: row.systemPrompt,
      model: row.model,
      temperature: row.temperature,
      maxTokens: row.maxTokens,
      topP: row.topP,
      keywords: row.keywords,
      status: row.status,
      isDefault: row.isDefault,
      sortOrder: row.sortOrder,
    });
    try {
      const arr = JSON.parse(row.keywords || '[]');
      keywordsStr.value = Array.isArray(arr) ? arr.join(', ') : '';
    } catch { keywordsStr.value = ''; }
  } else {
    editingId.value = '';
    Object.assign(form, {
      name: '',
      description: '',
      systemPrompt: '',
      model: 'global',
      temperature: null,
      maxTokens: null,
      topP: null,
      keywords: '[]',
      status: 'enabled',
      isDefault: false,
      sortOrder: 0,
    });
    keywordsStr.value = '';
  }
  dialogVisible.value = true;
}

async function save() {
  try {
    const kwArr = keywordsStr.value
      .split(/[,，]/)
      .map(s => s.trim())
      .filter(Boolean);
    const payload = { ...form, keywords: kwArr };

    if (editingId.value) await api.skills.update(editingId.value, payload);
    else await api.skills.create(payload);

    ElMessage.success('保存成功');
    dialogVisible.value = false;
    load();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || e.message || '保存失败');
  }
}

function downloadSkillMd(row: any) {
  const blob = new Blob([row.systemPrompt], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${row.name.replace(/[/\\?%*:|"<>]/g, '_')}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  ElMessage.success('下载成功');
}

async function remove(id: string) {
  await ElMessageBox.confirm('确定删除该 Skill？', '提示', { type: 'warning' });
  await api.skills.delete(id);
  ElMessage.success('删除成功');
  load();
}

async function syncFromGithub(skillId: string) {
  await ElMessageBox.confirm(
    '将从 GitHub 拉取最新 SKILL.md 并覆盖当前 Skill 的 System Prompt。确定继续？',
    '同步确认',
    { type: 'warning' },
  );
  try {
    const res = await api.skills.syncGithub(skillId) as any;
    ElMessage.success(res.message || '同步成功');
    load();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || e.message || '同步失败');
  }
}

onMounted(load);
</script>

<style lang="scss" scoped>
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
h2 { margin: 0; }

.form-tip {
  margin-top: 6px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.model-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;

  small {
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }
}
</style>
