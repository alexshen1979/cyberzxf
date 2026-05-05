<template>
  <div class="kn-page">
    <!-- 错误显示 -->
    <div v-if="errorMsg" style="background:#ff4444;color:#fff;padding:12px;margin-bottom:16px;border-radius:4px;">
      <strong>页面错误:</strong> {{ errorMsg }}
    </div>
    <div class="page-header">
      <h2>知识库管理</h2>
      <div class="header-actions">
        <el-button type="success" @click="openWebScrapeDialog">全网搜索智能入库</el-button>
        <el-button type="primary" @click="openDialog()">新建条目</el-button>
      </div>
    </div>

    <!-- 筛选栏 -->
    <div class="filter-bar">
      <el-select v-model="filterCategory" placeholder="全部分类" clearable style="width: 160px" @change="load">
        <el-option v-for="c in categoryOptions" :key="c" :label="c" :value="c" />
      </el-select>
      <el-select v-model="filterStatus" placeholder="全部状态" clearable style="width: 120px; margin-left: 12px" @change="load">
        <el-option label="已发布" value="published" />
        <el-option label="草稿" value="draft" />
      </el-select>
    </div>

    <el-table :data="entries" style="width: 100%" v-loading="loading">
      <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
      <el-table-column prop="category" label="分类" width="110">
        <template #default="{ row }">
          <el-tag size="small">{{ row.category }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="tags" label="标签" width="200">
        <template #default="{ row }">
          <el-tag v-for="t in row.tags" :key="t" size="small" type="info" style="margin: 1px 2px">{{ t }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="sourceName" label="来源" width="130" show-overflow-tooltip />
      <el-table-column prop="status" label="状态" width="80">
        <template #default="{ row }">
          <el-tag :type="row.status === 'published' ? 'success' : 'info'" size="small">
            {{ row.status === 'published' ? '已发布' : '草稿' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="viewCount" label="浏览" width="70" />
      <el-table-column prop="updatedAt" label="更新时间" width="170">
        <template #default="{ row }">{{ formatDate(row.updatedAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="openDialog(row)">编辑</el-button>
          <el-button link type="danger" size="small" @click="remove(row.id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination-wrap" v-if="total > pageSize">
      <el-pagination
        v-model:current-page="page"
        :page-size="pageSize"
        :total="total"
        layout="total, prev, pager, next"
        @current-change="load"
      />
    </div>

    <!-- 全网搜索智能添加弹窗 -->
    <el-dialog v-model="webScrapeVisible" title="全网搜索智能入库——自动搜索网页资料，AI整理后存入知识库" width="92%" top="2vh" destroy-on-close :close-on-click-modal="false">
      <el-tabs v-model="scrapeMode" type="border-card" class="scrape-tabs">
        <el-tab-pane label="🔍 关键词搜索" name="search">
          <div class="search-input-row">
            <el-input
              v-model="searchKeyword"
              placeholder="输入关键词，如：2026年北京大学招生简章"
              @keyup.enter="doWebSearch"
              clearable
              size="large"
            />
            <el-button type="primary" size="large" @click="doWebSearch" :loading="searching">
              {{ searching ? '搜索中...' : '全网搜索' }}
            </el-button>
          </div>

          <div class="scrape-layout" v-if="searchResults.length > 0 || scrapedData">
            <div class="search-list-panel" :class="{ collapsed: !!scrapedData }">
              <div class="results-header">
                <span>找到 {{ searchResults.length }} 条结果</span>
                <div class="results-header-actions">
                  <el-button link size="small" @click="toggleSelectAll">
                    {{ allSelected ? '取消全选' : '全选' }}
                  </el-button>
                  <el-button
                    v-if="selectedCount > 0"
                    type="primary"
                    size="small"
                    @click="batchImport"
                    :loading="batchImporting"
                  >
                    选中入库 ({{ selectedCount }})
                  </el-button>
                  <el-button v-if="scrapedData" link type="primary" size="small" @click="goBackToSearch">← 返回列表</el-button>
                </div>
              </div>
              <div class="search-results">
                <div
                  v-for="(r, i) in searchResults"
                  :key="i"
                  class="search-result-item"
                  :class="{ active: scrapedData?.sourceUrl === r.url, error: r._error }"
                >
                  <div class="result-top-row">
                    <el-checkbox
                      :model-value="r._selected"
                      @change="(val: boolean) => toggleResult(i, val)"
                      @click.stop
                      :disabled="r._loading"
                      class="result-checkbox"
                    />
                    <div class="result-content" @click="scrapeFromSearch(r, i)">
                      <div class="result-title">
                        <el-icon v-if="r._loading" class="is-loading"><Loading /></el-icon>
                        <span v-if="r._error" class="error-icon">⚠️</span>
                        {{ r.title }}
                      </div>
                      <div class="result-snippet">{{ r.snippet }}</div>
                      <div class="result-url">{{ r.displayUrl }}</div>
                      <div v-if="r._error" class="result-error-msg">{{ r._error }}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="edit-panel" v-if="scrapedData">
              <div class="edit-toolbar">
                <div class="toolbar-left">
                  <span class="source-badge">{{ scrapedData.sourceName }}</span>
                  <span class="char-count">{{ scrapedData.content?.length || 0 }} 字符</span>
                </div>
                <div class="toolbar-right">
                  <el-button type="warning" @click="doPolish" :loading="polishing" :icon="MagicStick">
                    {{ polishing ? 'AI 润色中...' : 'AI 润色 (DeepSeek)' }}
                  </el-button>
                </div>
              </div>

              <el-form :model="scrapedData" label-width="70px" size="default">
                <el-form-item label="标题">
                  <el-input v-model="scrapedData.title" />
                </el-form-item>
                <el-row :gutter="16">
                  <el-col :span="12">
                    <el-form-item label="分类">
                      <el-select v-model="scrapedData.category" style="width: 100%">
                        <el-option v-for="c in categoryOptions" :key="c" :label="c" :value="c" />
                      </el-select>
                    </el-form-item>
                  </el-col>
                  <el-col :span="12">
                    <el-form-item label="来源">
                      <el-input v-model="scrapedData.sourceName" />
                    </el-form-item>
                  </el-col>
                </el-row>
                <el-form-item label="标签">
                  <el-input v-model="scrapedData.tagsInput" placeholder="多个标签用逗号分隔" />
                </el-form-item>
              </el-form>

              <div class="editor-wrap">
                <MdEditor v-model="scrapedData.content" :theme="'dark'" :toolbars="toolbars" style="height: 52vh" />
              </div>
            </div>
          </div>

          <div v-if="searchResults.length === 0 && searchDone && !searching" class="no-results">
            未找到相关结果，换个关键词试试
          </div>
        </el-tab-pane>

        <el-tab-pane label="🔗 粘贴链接" name="url">
          <div class="url-input-row">
            <el-input
              v-model="scrapeUrl"
              placeholder="粘贴网页链接 https://..."
              @keyup.enter="doWebScrape"
              clearable
              size="large"
            />
            <el-button type="primary" size="large" @click="doWebScrape" :loading="scraping">
              {{ scraping ? '抓取中...' : '智能抓取' }}
            </el-button>
          </div>

          <div v-if="scrapedData" class="url-result-area">
            <div class="edit-toolbar">
              <div class="toolbar-left">
                <span class="source-badge">{{ scrapedData.sourceName }}</span>
                <span class="char-count">{{ scrapedData.content?.length || 0 }} 字符</span>
              </div>
              <div class="toolbar-right">
                <el-button type="warning" @click="doPolish" :loading="polishing" :icon="MagicStick">
                  {{ polishing ? 'AI 润色中...' : 'AI 润色 (DeepSeek)' }}
                </el-button>
              </div>
            </div>

            <el-form :model="scrapedData" label-width="70px" size="default">
              <el-form-item label="标题">
                <el-input v-model="scrapedData.title" />
              </el-form-item>
              <el-row :gutter="16">
                <el-col :span="12">
                  <el-form-item label="分类">
                    <el-select v-model="scrapedData.category" style="width: 100%">
                      <el-option v-for="c in categoryOptions" :key="c" :label="c" :value="c" />
                    </el-select>
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="来源">
                    <el-input v-model="scrapedData.sourceName" />
                  </el-form-item>
                </el-col>
              </el-row>
              <el-form-item label="标签">
                <el-input v-model="scrapedData.tagsInput" placeholder="多个标签用逗号分隔" />
              </el-form-item>
            </el-form>

            <div class="editor-wrap">
              <MdEditor v-model="scrapedData.content" :theme="'dark'" :toolbars="toolbars" style="height: 52vh" />
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>

      <template #footer>
        <el-button @click="closeWebScrape">取消</el-button>
        <el-button type="primary" size="large" @click="importScraped" :disabled="!scrapedData">
          导入当前条目
        </el-button>
      </template>
    </el-dialog>

    <!-- 编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑知识条目' : '新建知识条目'" width="900px" destroy-on-close>
      <el-form :model="form" label-width="80px">
        <el-form-item label="标题" required>
          <el-input v-model="form.title" placeholder="条目标题" />
        </el-form-item>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="分类">
              <el-select v-model="form.category" style="width: 100%">
                <el-option v-for="c in categoryOptions" :key="c" :label="c" :value="c" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="状态">
              <el-radio-group v-model="form.status">
                <el-radio value="published">已发布</el-radio>
                <el-radio value="draft">草稿</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="标签">
          <el-input v-model="tagsInput" placeholder="多个标签用逗号分隔，如：北京大学,2026,招生简章" />
        </el-form-item>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="来源名称">
              <el-input v-model="form.sourceName" placeholder="如：北京大学招生网" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="来源日期">
              <el-input v-model="form.sourceDate" placeholder="如：2026-04" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="来源URL">
          <el-input v-model="form.sourceUrl" placeholder="https://..." />
        </el-form-item>
        <el-form-item label="内容" required>
          <MdEditor v-model="form.content" :theme="'dark'" :toolbars="toolbars" style="height: 400px" />
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
import { ref, reactive, computed, onMounted, onErrorCaptured } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Loading, MagicStick } from '@element-plus/icons-vue';
import { MdEditor } from 'md-editor-v3';
import 'md-editor-v3/lib/style.css';
import { api } from '@/api';

const errorMsg = ref('');

onErrorCaptured((err: any) => {
  errorMsg.value = err?.message || String(err);
  console.error('knowledge.vue error:', err);
  return false; // 阻止错误继续向上传播
});

const entries = ref<any[]>([]);
const loading = ref(false);
const dialogVisible = ref(false);
const editingId = ref('');
const page = ref(1);
const pageSize = 20;
const total = ref(0);
const filterCategory = ref('');
const filterStatus = ref('');

const tagsInput = ref('');

const form = reactive({
  title: '',
  category: '招生简章',
  tags: [] as string[],
  sourceName: '',
  sourceUrl: '',
  sourceDate: '',
  content: '',
  status: 'published' as string,
});

const categoryOptions = ['招生简章', '专业解读', '院校信息', '政策法规', '分数线'];

const toolbars: any[] = [
  'bold', 'italic', 'strikethrough', '|',
  'unorderedList', 'orderedList', '|',
  'link', 'table', '|',
  'preview', 'fullscreen',
];

function formatDate(d: string) {
  if (!d) return '';
  return new Date(d).toLocaleString('zh-CN');
}

async function load() {
  loading.value = true;
  try {
    const res: any = await api.knowledge.list({
      page: page.value,
      pageSize,
      category: filterCategory.value || undefined,
      status: filterStatus.value || undefined,
    });
    entries.value = res.data.list;
    total.value = res.data.total;
  } finally {
    loading.value = false;
  }
}

function openDialog(row?: any) {
  if (row) {
    editingId.value = row.id;
    Object.assign(form, { ...row });
    tagsInput.value = (row.tags || []).join(', ');
  } else {
    editingId.value = '';
    form.title = '';
    form.category = '招生简章';
    form.tags = [];
    form.sourceName = '';
    form.sourceUrl = '';
    form.sourceDate = '';
    form.content = '';
    form.status = 'published';
    tagsInput.value = '';
  }
  dialogVisible.value = true;
}

async function save() {
  const tags = tagsInput.value
    .split(/[,，]/)
    .map(t => t.trim())
    .filter(Boolean);
  const data = { ...form, tags };

  try {
    if (editingId.value) {
      await api.knowledge.update(editingId.value, data);
      ElMessage.success('保存成功');
    } else {
      await api.knowledge.create(data);
      ElMessage.success('创建成功');
    }
    dialogVisible.value = false;
    load();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || e?.message || '操作失败');
  }
}

async function remove(id: string) {
  try {
    await ElMessageBox.confirm('确定删除该知识条目？', '确认删除', { type: 'warning' });
    await api.knowledge.delete(id);
    ElMessage.success('删除成功');
    load();
  } catch { /* cancelled */ }
}

// ─── 全网搜索智能添加 ─────────────────────────────────
const webScrapeVisible = ref(false);
const scrapeMode = ref('search');
const scrapeUrl = ref('');
const scraping = ref(false);
const scrapedData = ref<any>(null);

const searchKeyword = ref('');
const searching = ref(false);
const searchDone = ref(false);
const searchResults = ref<any[]>([]);

const polishing = ref(false);
const batchImporting = ref(false);

const knowledgeCategoryMap: Record<string, string> = {
  gaokao: '招生简章',
  kaoyan: '招生简章',
  zhiye: '政策法规',
  bimian: '专业解读',
};


// 批量选择
const selectedCount = computed(() => searchResults.value.filter((r: any) => r._selected).length);
const allSelected = computed(() => searchResults.value.length > 0 && searchResults.value.every((r: any) => r._selected));

function toggleResult(index: number, val: boolean) {
  searchResults.value[index]._selected = val;
}

function toggleSelectAll() {
  if (allSelected.value) {
    searchResults.value.forEach((r: any) => r._selected = false);
  } else {
    searchResults.value.forEach((r: any) => r._selected = true);
  }
}

async function batchImport() {
  const selected = searchResults.value.filter((r: any) => r._selected && !r._imported);
  if (selected.length === 0) {
    ElMessage.warning('请选择要导入的条目');
    return;
  }
  batchImporting.value = true;
  let successCount = 0;
  let failCount = 0;
  for (const r of selected) {
    try {
      // 如果还没抓取，先抓取
      if (!r._scrapedData) {
        const res: any = await api.webScrape.scrape(r.url);
        r._scrapedData = res.data;
      }
      const d = r._scrapedData;
      const tags = (d.suggestedTags || []).join(', ');
      const tagList = tags.split(/[,，]/).map((t: string) => t.trim()).filter(Boolean);
      await api.knowledge.create({
        title: r.title || d.title,
        content: d.content,
        category: knowledgeCategoryMap[d.suggestedCategory] || '招生简章',
        tags: tagList,
        sourceName: d.sourceName || '',
        sourceUrl: d.sourceUrl || '',
        sourceDate: d.sourceDate || '',
        status: 'published',
      });
      r._imported = true;
      r._selected = false;
      successCount++;
    } catch (e: any) {
      failCount++;
      r._error = e?.response?.data?.message || e?.message || '入库失败';
    }
  }
  batchImporting.value = false;
  if (successCount > 0) {
    ElMessage.success(`成功导入 ${successCount} 条` + (failCount > 0 ? `，${failCount} 条失败` : ''));
    load();
  } else {
    ElMessage.error(`导入失败：${failCount} 条`);
  }
}
function openWebScrapeDialog() {
  scrapeMode.value = 'search';
  scrapeUrl.value = '';
  searchKeyword.value = '';
  searchResults.value = [];
  searchDone.value = false;
  scrapedData.value = null;
  webScrapeVisible.value = true;
}

function closeWebScrape() {
  webScrapeVisible.value = false;
}

function goBackToSearch() {
  scrapedData.value = null;
}

async function doWebSearch() {
  if (!searchKeyword.value.trim()) {
    ElMessage.warning('请输入搜索关键词');
    return;
  }
  searching.value = true;
  searchDone.value = false;
  searchResults.value = [];
  scrapedData.value = null;
  try {
    const res: any = await api.webScrape.search(searchKeyword.value.trim());
    searchResults.value = (res.data.results || []).map((r: any) => ({
      ...r,
      _loading: false,
      _error: '',
      _selected: false,
      _imported: false,
      _scrapedData: null,
    }));
    searchDone.value = true;
    if (searchResults.value.length > 0) {
      ElMessage.success(`找到 ${searchResults.value.length} 条结果，点击抓取`);
    }
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || e.message || '搜索失败');
  } finally {
    searching.value = false;
  }
}

async function scrapeFromSearch(result: any, index: number) {
  searchResults.value[index]._loading = true;
  searchResults.value[index]._error = '';
  scraping.value = true;
  try {
    const res: any = await api.webScrape.scrape(result.url);
    const d = res.data;
    scrapedData.value = {
      title: result.title || d.title,
      content: d.content,
      category: knowledgeCategoryMap[d.suggestedCategory] || '招生简章',
      sourceName: d.sourceName || '',
      sourceUrl: d.sourceUrl || '',
      sourceDate: d.sourceDate || '',
      tagsInput: (d.suggestedTags || []).join(', '),
    };
    ElMessage.success(`抓取成功，提取 ${d.contentLength} 字符`);
  } catch (e: any) {
    const errMsg = e.response?.data?.message || e.message || '抓取失败';
    searchResults.value[index]._error = errMsg;
  } finally {
    searchResults.value[index]._loading = false;
    scraping.value = false;
  }
}

async function doWebScrape() {
  if (!scrapeUrl.value.trim()) {
    ElMessage.warning('请输入网页链接');
    return;
  }
  scraping.value = true;
  try {
    const res: any = await api.webScrape.scrape(scrapeUrl.value.trim());
    const d = res.data;
    scrapedData.value = {
      title: d.title,
      content: d.content,
      category: knowledgeCategoryMap[d.suggestedCategory] || '招生简章',
      sourceName: d.sourceName || '',
      sourceUrl: d.sourceUrl || '',
      sourceDate: d.sourceDate || '',
      tagsInput: (d.suggestedTags || []).join(', '),
    };
    ElMessage.success(`抓取成功，提取 ${d.contentLength} 字符`);
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || e.message || '抓取失败');
  } finally {
    scraping.value = false;
  }
}

async function doPolish() {
  if (!scrapedData.value) return;
  polishing.value = true;
  try {
    const res: any = await api.webScrape.polish(
      scrapedData.value.title,
      scrapedData.value.content,
      'knowledge',
    );
    scrapedData.value.title = res.data.title;
    scrapedData.value.content = res.data.content;
    ElMessage.success(`AI 润色完成：${res.data.originalLength} → ${res.data.polishedLength} 字符`);
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || e.message || 'AI 润色失败');
  } finally {
    polishing.value = false;
  }
}

async function importScraped() {
  if (!scrapedData.value) return;
  try {
    const d = scrapedData.value;
    const tags = d.tagsInput
      .split(/[,，]/)
      .map((t: string) => t.trim())
      .filter(Boolean);
    await api.knowledge.create({
      title: d.title,
      content: d.content,
      category: d.category,
      tags,
      sourceName: d.sourceName,
      sourceUrl: d.sourceUrl,
      sourceDate: d.sourceDate,
      status: 'published',
    });
    ElMessage.success('导入成功');
    webScrapeVisible.value = false;
    load();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || e.message || '导入失败');
  }
}

onMounted(load);
</script>

<style lang="scss" scoped>
.kn-page {
  padding: 0;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  h2 { margin: 0; font-size: 20px; }
}
.header-actions { display: flex; gap: 12px; }

.scrape-tabs { margin-bottom: 0; }

.search-input-row, .url-input-row {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 16px;
}
.search-input-row :deep(.el-input), .url-input-row :deep(.el-input) { flex: 1; }

.scrape-layout {
  display: flex;
  gap: 20px;
  height: 65vh;
  overflow: hidden;
}

.search-list-panel {
  width: 380px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.search-list-panel.collapsed {
  width: 320px;
}

.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
  flex-shrink: 0;
}
.results-header-actions { display: flex; gap: 8px; align-items: center; }

.result-top-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.result-checkbox { flex-shrink: 0; margin-top: 4px; }
.result-content { flex: 1; cursor: pointer; min-width: 0; }

.search-results {
  flex: 1;
  overflow-y: auto;
  padding-right: 4px;
}

.search-result-item {
  padding: 10px 14px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  margin-bottom: 6px;
  transition: all 0.15s;
}
.search-result-item:hover {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.search-result-item.active {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  box-shadow: 0 0 0 1px var(--el-color-primary) inset;
}
.search-result-item.error {
  border-color: var(--el-color-danger);
  background: var(--el-color-danger-light-9);
}

.result-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-color-primary);
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.result-snippet { font-size: 12px; color: var(--el-text-color-regular); line-height: 1.5; }
.result-url { font-size: 11px; color: var(--el-color-success); margin-top: 3px; }
.result-error-msg { font-size: 12px; color: var(--el-color-danger); margin-top: 6px; }
.error-icon { font-size: 14px; }
.no-results { text-align: center; padding: 48px; color: var(--el-text-color-secondary); }

.edit-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.edit-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--el-fill-color-light);
  border-radius: 6px;
  margin-bottom: 12px;
  flex-shrink: 0;
}
.toolbar-left { display: flex; gap: 12px; align-items: center; }
.source-badge {
  font-size: 12px;
  padding: 2px 10px;
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
  border-radius: 4px;
  font-weight: 500;
}
.char-count { font-size: 12px; color: var(--el-text-color-secondary); }

.editor-wrap {
  flex: 1;
  overflow: hidden;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  margin-top: 8px;
}

.url-result-area {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  height: 60vh;
}

:deep(.md-editor) { border-radius: 4px; height: 100% !important; }

.filter-bar {
  margin-bottom: 16px;
}

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}
</style>
