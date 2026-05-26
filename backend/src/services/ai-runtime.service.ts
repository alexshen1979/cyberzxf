import { config } from '../config';

export type AiProvider = 'deepseek' | 'bailian';

export const DEFAULT_AI_PROVIDER: AiProvider = 'deepseek';
export const DEFAULT_DEEPSEEK_MODEL = 'deepseek-chat';
export const DEFAULT_BAILIAN_MODEL = 'qwen3.7-max';
export const DEFAULT_BAILIAN_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';

const BAILIAN_TOKEN_PLAN_MODELS = new Set([
  'qwen3.7-max',
  'qwen3.6-plus',
  'qwen3.6-flash',
  'deepseek-v4-pro',
  'deepseek-v4-flash',
  'deepseek-v3.2',
  'kimi-k2.6',
  'kimi-k2.5',
  'glm-5.1',
  'glm-5',
  'minimax-m2.5',
]);

export interface AiRuntime {
  provider: AiProvider;
  providerName: string;
  model: string;
  apiKey: string;
  baseUrl: string;
  timeout: number;
}

export function normalizeAiProvider(value?: string | null): AiProvider {
  return String(value || '').trim().toLowerCase() === 'bailian' ? 'bailian' : 'deepseek';
}

export function isBailianModel(model?: string | null) {
  const normalized = String(model || '').trim().toLowerCase();
  return BAILIAN_TOKEN_PLAN_MODELS.has(normalized)
    || normalized.startsWith('qwen')
    || normalized.startsWith('kimi-')
    || normalized.startsWith('glm-')
    || normalized.startsWith('minimax-');
}

export function inferAiProvider(provider?: string | null, model?: string | null): AiProvider {
  const normalized = String(provider || '').trim().toLowerCase();
  if (normalized === 'bailian' || normalized === 'deepseek') return normalizeAiProvider(normalized);
  return isBailianModel(model) ? 'bailian' : 'deepseek';
}

export function resolveSkillModelOverride(skillModel?: string | null, aiConfig?: any) {
  const model = String(skillModel || '').trim();
  if (!model || model === 'global') return undefined;
  return model;
}

export function resolveScenarioModelOverride(type: 'normal' | 'deep', aiConfig?: any, skillModel?: string | null) {
  const skillOverride = resolveSkillModelOverride(skillModel, aiConfig);
  if (skillOverride) return skillOverride;
  const scenarioModel = String(type === 'deep' ? aiConfig?.deepModel || '' : aiConfig?.normalModel || '').trim();
  if (scenarioModel && scenarioModel !== 'global') return scenarioModel;
  return undefined;
}

export function resolveAiRuntime(aiConfig?: any, modelOverride?: string | null): AiRuntime {
  const override = String(modelOverride || '').trim();
  const provider = override
    ? inferAiProvider(undefined, override)
    : inferAiProvider(aiConfig?.provider, aiConfig?.model);

  if (provider === 'bailian') {
    const configuredModel = String(aiConfig?.bailianModel || '').trim();
    const legacyModel = isBailianModel(aiConfig?.model) ? String(aiConfig.model).trim() : '';
    return {
      provider,
      providerName: '阿里百炼',
      model: override || configuredModel || legacyModel || DEFAULT_BAILIAN_MODEL,
      apiKey: String(aiConfig?.bailianApiKey || config.bailian.apiKey || '').trim(),
      baseUrl: String(aiConfig?.bailianBaseUrl || config.bailian.baseUrl || DEFAULT_BAILIAN_BASE_URL).trim(),
      timeout: Number(aiConfig?.timeout || 30000),
    };
  }

  return {
    provider,
    providerName: 'DeepSeek',
    model: override || String(aiConfig?.model || '').trim() || DEFAULT_DEEPSEEK_MODEL,
    apiKey: String(aiConfig?.apiKey || config.deepseek.apiKey || '').trim(),
    baseUrl: String(aiConfig?.apiBaseUrl || config.deepseek.baseUrl).trim(),
    timeout: Number(aiConfig?.timeout || 30000),
  };
}

export function chatCompletionsUrl(baseUrl: string) {
  const clean = String(baseUrl || '').trim().replace(/\/+$/, '');
  if (!clean) return '/v1/chat/completions';
  if (clean.endsWith('/chat/completions')) return clean;
  return clean.endsWith('/v1') ? `${clean}/chat/completions` : `${clean}/v1/chat/completions`;
}
