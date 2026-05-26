<template>
  <div class="ai-config-page">
    <div class="page-header">
      <h2>AI 核心配置</h2>
      <p>先选择供应商，再配置该供应商自己的模型和 API 连接。</p>
    </div>

    <el-card class="config-card">
      <el-form :model="form" label-width="150px" @submit.prevent="save">
        <el-form-item label="当前供应商">
          <el-radio-group v-model="form.provider" class="provider-options">
            <el-radio-button value="deepseek">DeepSeek 官方</el-radio-button>
            <el-radio-button value="bailian">阿里百炼</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-alert
          v-if="form.provider === 'bailian'"
          class="provider-alert"
          type="info"
          :closable="false"
          show-icon
          title="阿里百炼 Token Plan 使用同一套百炼 API Key 和 Base URL，具体调用哪个模型由模型 ID 决定。"
        />

        <el-divider content-position="left">供应商模型设置</el-divider>

        <template v-if="form.provider === 'deepseek'">
          <el-form-item label="DeepSeek 模型">
            <el-select v-model="form.model" placeholder="请选择 DeepSeek 官方模型">
              <el-option label="DeepSeek v4" value="deepseek-chat" />
              <el-option label="DeepSeek Flash" value="deepseek-flash" />
            </el-select>
          </el-form-item>

          <el-form-item label="API Key">
            <el-input v-model="form.apiKey" type="password" show-password placeholder="留空使用环境变量 DEEPSEEK_API_KEY" />
          </el-form-item>

          <el-form-item label="API 地址">
            <el-input v-model="form.apiBaseUrl" placeholder="留空使用 https://api.deepseek.com" />
          </el-form-item>
        </template>

        <template v-else>
          <el-form-item label="百炼模型">
            <el-select v-model="bailianPreset" filterable allow-create default-first-option @change="applyBailianPreset">
              <el-option-group
                v-for="group in bailianModelGroups"
                :key="group.label"
                :label="group.label"
              >
                <el-option
                  v-for="item in group.models"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                  :disabled="item.disabled"
                >
                  <div class="model-option">
                    <span>{{ item.label }}</span>
                    <small>{{ item.ability }}</small>
                  </div>
                </el-option>
              </el-option-group>
            </el-select>
            <div class="form-tip">
              当前 AI 咨询只能选择文本生成/推理模型；图片生成模型已列出但不可选。
            </div>
          </el-form-item>

          <el-form-item label="当前模型 ID">
            <el-input v-model="form.bailianModel" placeholder="qwen3.7-max" @blur="normalizeBailianModel" />
          </el-form-item>

          <el-form-item label="百炼 API Key">
            <el-input v-model="form.bailianApiKey" type="password" show-password placeholder="DashScope / 百炼 API Key" />
          </el-form-item>

          <el-form-item label="百炼 API 地址">
            <el-input v-model="form.bailianBaseUrl" placeholder="留空使用 https://dashscope.aliyuncs.com/compatible-mode/v1" />
          </el-form-item>
        </template>

        <el-divider content-position="left">追问场景设置</el-divider>

        <el-row :gutter="18">
          <el-col :span="12">
            <el-form-item label="普通追问模型">
              <el-select v-model="form.normalModel" filterable allow-create default-first-option placeholder="跟随当前供应商模型">
                <el-option label="跟随当前供应商模型" value="global" />
                <el-option-group label="DeepSeek 官方">
                  <el-option label="DeepSeek v4" value="deepseek-chat" />
                  <el-option label="DeepSeek Flash" value="deepseek-flash" />
                </el-option-group>
                <el-option-group
                  v-for="group in bailianTextModelGroups"
                  :key="`normal-${group.label}`"
                  :label="`阿里百炼 · ${group.label}`"
                >
                  <el-option
                    v-for="item in group.models"
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
              <div class="form-tip">建议选 flash 类模型，优先保证首响速度。</div>
            </el-form-item>
            <el-form-item label="普通最大长度">
              <el-input-number v-model="form.normalMaxTokens" :min="100" :max="3000" :step="100" />
              <span class="inline-tip">建议 600-800</span>
            </el-form-item>
          </el-col>

          <el-col :span="12">
            <el-form-item label="深度追问模型">
              <el-select v-model="form.deepModel" filterable allow-create default-first-option placeholder="跟随当前供应商模型">
                <el-option label="跟随当前供应商模型" value="global" />
                <el-option-group label="DeepSeek 官方">
                  <el-option label="DeepSeek v4" value="deepseek-chat" />
                  <el-option label="DeepSeek Flash" value="deepseek-flash" />
                </el-option-group>
                <el-option-group
                  v-for="group in bailianTextModelGroups"
                  :key="`deep-${group.label}`"
                  :label="`阿里百炼 · ${group.label}`"
                >
                  <el-option
                    v-for="item in group.models"
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
              <div class="form-tip">深度追问可以选质量更高的模型。</div>
            </el-form-item>
            <el-form-item label="深度最大长度">
              <el-input-number v-model="form.deepMaxTokens" :min="500" :max="8000" :step="100" />
              <span class="inline-tip">建议 1800-2600</span>
            </el-form-item>
          </el-col>
        </el-row>

        <el-divider content-position="left">生成参数</el-divider>

        <el-form-item label="温度 (Temperature)">
          <el-slider v-model="form.temperature" :min="0" :max="2" :step="0.1" show-input />
        </el-form-item>

        <el-form-item label="全局兜底长度">
          <el-input-number v-model="form.maxTokens" :min="100" :max="8000" :step="100" />
          <span class="inline-tip">未配置场景长度时使用</span>
        </el-form-item>

        <el-form-item label="Top P">
          <el-slider v-model="form.topP" :min="0" :max="1" :step="0.05" show-input />
        </el-form-item>

        <el-form-item label="上下文轮数">
          <el-input-number v-model="form.contextWindow" :min="1" :max="20" />
        </el-form-item>

        <el-form-item label="请求超时 (ms)">
          <el-input-number v-model="form.timeout" :min="1000" :max="120000" :step="1000" />
        </el-form-item>

        <el-divider content-position="left">Skill 知识库</el-divider>

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
const bailianPreset = ref('qwen3.7-max');

const bailianModelGroups = [
  {
    label: '千问',
    models: [
      { label: 'qwen3.7-max', value: 'qwen3.7-max', ability: '推理模型、文本生成' },
      { label: 'qwen3.6-plus', value: 'qwen3.6-plus', ability: '推理模型、视觉理解、文本生成' },
      { label: 'qwen3.6-flash', value: 'qwen3.6-flash', ability: '推理模型、视觉理解、文本生成' },
      { label: 'qwen-image-2.0', value: 'qwen-image-2.0', ability: '图片生成', disabled: true },
      { label: 'qwen-image-2.0-pro', value: 'qwen-image-2.0-pro', ability: '图片生成', disabled: true },
    ],
  },
  {
    label: '万相',
    models: [
      { label: 'wan2.7-image', value: 'wan2.7-image', ability: '图片生成', disabled: true },
      { label: 'wan2.7-image-pro', value: 'wan2.7-image-pro', ability: '图片生成', disabled: true },
    ],
  },
  {
    label: 'DeepSeek',
    models: [
      { label: 'deepseek-v4-pro', value: 'deepseek-v4-pro', ability: '推理模型、文本生成' },
      { label: 'deepseek-v4-flash', value: 'deepseek-v4-flash', ability: '文本生成、推理模型' },
      { label: 'deepseek-v3.2', value: 'deepseek-v3.2', ability: '推理模型、文本生成' },
    ],
  },
  {
    label: '月之暗面',
    models: [
      { label: 'kimi-k2.6', value: 'kimi-k2.6', ability: '推理模型、视觉理解、文本生成' },
      { label: 'kimi-k2.5', value: 'kimi-k2.5', ability: '推理模型、视觉理解、文本生成' },
    ],
  },
  {
    label: '智谱AI',
    models: [
      { label: 'glm-5.1', value: 'glm-5.1', ability: '文本生成' },
      { label: 'glm-5', value: 'glm-5', ability: '文本生成' },
    ],
  },
  {
    label: 'MiniMax',
    models: [
      { label: 'MiniMax-M2.5', value: 'MiniMax-M2.5', ability: '推理模型、文本生成' },
    ],
  },
];

const disabledBailianModels = new Set(
  bailianModelGroups.flatMap(group => group.models.filter(item => item.disabled).map(item => item.value)),
);

const bailianTextModelGroups = bailianModelGroups
  .map(group => ({
    label: group.label,
    models: group.models.filter(item => !item.disabled),
  }))
  .filter(group => group.models.length > 0);

const form = reactive({
  provider: 'bailian',
  model: 'deepseek-chat',
  bailianModel: 'qwen3.7-max',
  normalModel: 'deepseek-v4-flash',
  deepModel: 'qwen3.7-max',
  normalMaxTokens: 700,
  deepMaxTokens: 2600,
  temperature: 0.7,
  maxTokens: 2000,
  topP: 0.9,
  contextWindow: 10,
  skillEnabled: true,
  skillWeight: 0.6,
  apiKey: '',
  apiBaseUrl: '',
  bailianApiKey: '',
  bailianBaseUrl: '',
  timeout: 30000,
});

onMounted(async () => {
  const res = await api.aiConfig.get() as any;
  if (res.data) {
    const allowedFields = Object.keys(form) as Array<keyof typeof form>;
    allowedFields.forEach((key) => {
      if (res.data[key] !== undefined && res.data[key] !== null) {
        (form as any)[key] = res.data[key];
      }
    });
    if (!form.provider) form.provider = 'bailian';
    if (!form.model || !['deepseek-chat', 'deepseek-flash'].includes(form.model)) {
      form.model = 'deepseek-chat';
    }
    normalizeBailianModel();
  }
});

function applyBailianPreset(value: string) {
  form.bailianModel = String(value || '').trim() || 'qwen3.7-max';
}

function normalizeBailianModel() {
  form.bailianModel = String(form.bailianModel || '').trim() || 'qwen3.7-max';
  if (disabledBailianModels.has(form.bailianModel)) {
    form.bailianModel = 'qwen3.6-flash';
    ElMessage.warning('图片生成模型不能用于 AI 咨询，已切换为 qwen3.6-flash');
  }
  bailianPreset.value = form.bailianModel;
}

async function save() {
  saving.value = true;
  try {
    normalizeBailianModel();
    const payload = {
      provider: form.provider,
      model: form.model,
      bailianModel: form.bailianModel,
      normalModel: form.normalModel,
      deepModel: form.deepModel,
      normalMaxTokens: form.normalMaxTokens,
      deepMaxTokens: form.deepMaxTokens,
      temperature: form.temperature,
      maxTokens: form.maxTokens,
      topP: form.topP,
      contextWindow: form.contextWindow,
      skillEnabled: form.skillEnabled,
      skillWeight: form.skillWeight,
      apiKey: form.apiKey,
      apiBaseUrl: form.apiBaseUrl,
      bailianApiKey: form.bailianApiKey,
      bailianBaseUrl: form.bailianBaseUrl,
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
  max-width: 920px;
}

.page-header {
  margin-bottom: 16px;

  h2 {
    margin: 0 0 6px;
  }

  p {
    margin: 0;
    color: var(--el-text-color-secondary);
  }
}

.provider-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.provider-alert {
  margin: 0 0 18px;
}

.form-tip {
  margin-top: 6px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.inline-tip {
  margin-left: 10px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
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
