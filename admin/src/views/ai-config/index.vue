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

        <el-divider content-position="left">DeepSeek API 连接</el-divider>

        <el-form-item label="API Key">
          <el-input v-model="form.apiKey" type="password" show-password placeholder="留空使用环境变量 DEEPSEEK_API_KEY" />
        </el-form-item>

        <el-form-item label="API 地址">
          <el-input v-model="form.apiBaseUrl" placeholder="留空使用环境变量 DEEPSEEK_BASE_URL" />
        </el-form-item>

        <el-form-item label="请求超时 (ms)">
          <el-input-number v-model="form.timeout" :min="1000" :max="120000" :step="1000" />
        </el-form-item>

        <el-divider />

        <el-form-item label="Skill 知识库">
          <el-switch v-model="form.skillEnabled" />
        </el-form-item>

        <el-form-item label="知识库权重">
          <el-slider v-model="form.skillWeight" :min="0.1" :max="1" :step="0.1" show-input :disabled="!form.skillEnabled" />
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
  apiKey: '',
  apiBaseUrl: '',
  timeout: 30000,
});

onMounted(async () => {
  const res = await api.aiConfig.get() as any;
  if (res.data) {
    const allowedFields = Object.keys(form) as Array<keyof typeof form>;
    allowedFields.forEach((key) => {
      if (res.data[key] !== undefined) {
        (form as any)[key] = res.data[key];
      }
    });
  }
});

async function save() {
  saving.value = true;
  try {
    const payload = {
      model: form.model,
      temperature: form.temperature,
      maxTokens: form.maxTokens,
      topP: form.topP,
      contextWindow: form.contextWindow,
      skillEnabled: form.skillEnabled,
      skillWeight: form.skillWeight,
      apiKey: form.apiKey,
      apiBaseUrl: form.apiBaseUrl,
      timeout: form.timeout,
    };
    await api.aiConfig.update(payload);
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
}
h2 { margin-bottom: 20px; }
</style>
