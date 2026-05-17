<template>
  <div class="wechat-page">
    <h2>公众号管理</h2>

    <el-card class="section-card" header="自动回复规则">
      <el-button type="primary" @click="openReplyDialog()" style="margin-bottom: 12px">添加规则</el-button>
      <el-table :data="autoReplies" style="width: 100%">
        <el-table-column prop="keyword" label="关键词" width="200" />
        <el-table-column prop="matchMode" label="匹配模式" width="100" />
        <el-table-column prop="replyContent" label="回复内容" min-width="200" show-overflow-tooltip />
        <el-table-column prop="status" label="状态" width="80" />
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button link type="danger" @click="removeReply(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card class="section-card" header="自定义菜单">
      <el-button type="primary" @click="syncMenu" :loading="syncing" style="margin-bottom: 12px">
        同步到公众号
      </el-button>
      <p class="tip">菜单在数据库中管理，编辑完成后点击上方按钮同步到微信。</p>
    </el-card>

    <el-dialog v-model="replyDialogVisible" title="添加自动回复规则" width="500px">
      <el-form :model="replyForm" label-width="80px">
        <el-form-item label="关键词"><el-input v-model="replyForm.keyword" /></el-form-item>
        <el-form-item label="匹配模式">
          <el-select v-model="replyForm.matchMode">
            <el-option label="精确匹配" value="exact" />
            <el-option label="包含匹配" value="contains" />
          </el-select>
        </el-form-item>
        <el-form-item label="回复内容"><el-input v-model="replyForm.replyContent" type="textarea" :rows="4" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="replyDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveReply">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { api } from '@/api';
import { ElMessage } from 'element-plus';

const autoReplies = ref([]);
const syncing = ref(false);
const replyDialogVisible = ref(false);
const replyForm = reactive({ keyword: '', matchMode: 'exact', replyContent: '' });

async function loadReplies() {
  const res = await api.autoReply.list() as any;
  autoReplies.value = res.data;
}

async function syncMenu() {
  syncing.value = true;
  try {
    await api.wechatMenu.sync();
    ElMessage.success('菜单同步成功');
  } catch (e: any) { ElMessage.error(e.message); }
  finally { syncing.value = false; }
}

function openReplyDialog() { Object.assign(replyForm, { keyword: '', matchMode: 'exact', replyContent: '' }); replyDialogVisible.value = true; }
async function saveReply() {
  try { await api.autoReply.create(replyForm); ElMessage.success('添加成功'); replyDialogVisible.value = false; loadReplies(); }
  catch (e: any) { ElMessage.error(e.message); }
}
async function removeReply(id: string) { await api.autoReply.delete(id); ElMessage.success('删除成功'); loadReplies(); }

onMounted(loadReplies);
</script>

<style lang="scss" scoped>
h2 { margin-bottom: 20px; }
.section-card { margin-bottom: 16px; }
.tip { font-size: 13px; }
</style>
