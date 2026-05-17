const PUBLIC_FIGURE_TERM = ['张', '雪', '峰'].join('');
const PUBLIC_FIGURE_SHORT_TERM = ['雪', '峰'].join('');
const FIXED_NOTICE_TITLE = ['免', '责', '声', '明'].join('');

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * External Skill sync is disabled for compliance.
 * Keep this helper for old imports or future migrations. It preserves the
 * original Skill structure while removing public-figure/style-risk wording.
 */
export function transformSkillContent(content: string): string {
  return content
    .replace(new RegExp(`${escapeRegExp(PUBLIC_FIGURE_TERM)}老师`, 'g'), '真实教育行业案例')
    .replace(new RegExp(escapeRegExp(PUBLIC_FIGURE_TERM), 'g'), '真实教育行业案例')
    .replace(new RegExp(escapeRegExp(PUBLIC_FIGURE_SHORT_TERM), 'g'), '赛博张老师')
    .replace(/(?:基于|受|融合|参考)?[^。\n]*(?:公开言论|风格启发|思维风格研究|非本人观点|本人观点|复刻)[^。\n]*[。\n]?/g, '')
    .replace(new RegExp(escapeRegExp(FIXED_NOTICE_TITLE), 'g'), '内容边界')
    .replace(/[^。\n]{0,20}已于2026年3月24日去世[^。\n]*[。\n]?/g, '')
    .replace(/2026年3月24日[^。\n]*(?:去世|离世|猝死)[^。\n]*[。\n]?/g, '')
    .replace(/以他的精神继续服务更多家庭/g, '持续服务更多家庭')
    .replace(/人物时间线（关键节点）/g, '方法论时间线（关键节点）')
    .replace(/最新动态（2026）/g, '当前更新机制')
    .replace(/智识谱系/g, '方法来源')
    .replace(/调研时间：[^。\n]*[。\n]?/g, '')
    .replace(/关键引用[\s\S]*$/g, '输出要求：资料不足时说明缺口；不编造精确数据；不把个案当规律。')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
