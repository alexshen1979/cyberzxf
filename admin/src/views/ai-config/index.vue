<template>
  <div class="ai-config-page">
    <h2>AI 核心配置</h2>
    <el-card class="config-card">
      <el-form :model="form" label-width="140px" @submit.prevent="save">
        <el-form-item label="模型选择">
          <el-radio-group v-model="form.model">
            <el-radio value="deepseek-chat">DeepSeek V4 Pro（高质量）</el-radio>
            <el-radio value="deepseek-flash">DeepSeek Flash（快速响应）</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="温度 (Temperature)">
          <el-slider v-model="form.temperature" :min="0" :max="2" :step="0.1" show-input />
        </el-form-item>

        <el-form-item label="最大回复长度">
          <el-input-number v-model="form.maxTokens" :min="100" :max="8000" :step="100" />
        </el-form-item>

        <el-form-item label="Top P">
          <el-slider v-model="form.topP" :min="0" :max="1" :step="0.05" show-input />
        </el-form-item>

        <el-form-item label="上下文轮数">
          <el-input-number v-model="form.contextWindow" :min="1" :max="20" />
        </el-form-item>

        <el-divider />

        <el-form-item label="Skill 知识库">
          <el-switch v-model="form.skillEnabled" />
        </el-form-item>

        <el-form-item label="知识库权重">
          <el-slider v-model="form.skillWeight" :min="0.1" :max="1" :step="0.1" show-input :disabled="!form.skillEnabled" />
        </el-form-item>

        <el-divider />

        <el-form-item label="普通问答扣点">
          <el-input-number v-model="form.pointsPerQuery" :min="1" :max="50" />
        </el-form-item>

        <el-form-item label="深度分析扣点">
          <el-input-number v-model="form.pointsPerDeep" :min="1" :max="100" />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" size="large" native-type="submit" :loading="saving">
            保存配置
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { api } from '@/api';
import { ElMessage } from 'element-plus';

const saving = ref(false);
const form = reactive({
  model: 'deepseek-chat',
  temperature: 0.7,
  maxTokens: 2000,
  topP: 0.9,
  contextWindow: 10,
  skillEnabled: true,
  skillWeight: 0.6,
  pointsPerQuery: 5,
  pointsPerDeep: 18,
});

onMounted(async () => {
  const res = await api.aiConfig.get() as any;
  if (res.data) Object.assign(form, res.data);
});

async function save() {
  saving.value = true;
  try {
    await api.aiConfig.update(form);
    ElMessage.success('配置已保存，立即生效');
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '保存失败');
  } finally {
    saving.value = false;
  }
}
</script>

<style lang="scss" scoped>
.ai-config-page {
  max-width: 800px;
}
.config-card {
  background: #1a1f4a;
  border-color: #1e2550;
}
h2 { color: #e8eaf0; margin-bottom: 20px; }
.el-divider { border-color: #1e2550; }
</style>
