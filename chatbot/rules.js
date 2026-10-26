export function validateGuide(data) {
  if (data?.version !== 1 || typeof data.intro !== 'string' || typeof data.fallback !== 'string' || !data.nodes?.home) throw Error('등록된 안내 형식을 확인할 수 없습니다.');
  const validText = (s, max) => typeof s === 'string' && s.trim().length > 0 && s.length <= max;
  if (!validText(data.intro, 1500) || !validText(data.title, 120) || data.fallback !== '등록된 안내를 찾지 못했어요. 아래 메뉴를 선택하거나 제작 문의를 남겨주세요.' || Object.keys(data.nodes).length > 80 || !['back','home','reset'].every(k => validText(data.navigation?.[k], 30))) throw Error('안내 제목·이동 버튼·기본 답변을 확인해 주세요.');
  for (const [id, node] of Object.entries(data.nodes)) {
    if (!/^[a-z_]+$/.test(id) || typeof node.answer !== 'string' || !Array.isArray(node.keywords) || !node.keywords.every(k => typeof k === 'string' && k.trim()) || !Array.isArray(node.buttons) || node.buttons.some(b => typeof b.label !== 'string' || !data.nodes[b.next]) || (node.action && node.action !== 'inquiry')) throw Error('등록된 분기 규칙이 올바르지 않습니다.');
    if (!validText(node.answer, 1500) || node.keywords.length > 30 || !node.keywords.every(k => validText(k, 100)) || node.buttons.length > 12 || !node.buttons.every(b => validText(b.label, 60))) throw Error('답변 길이·키워드·버튼 개수를 확인해 주세요.');
  }
  if (data.nodes.home.buttons.map(b => b.label).join('|') !== '오늘 조회수|이번 주 인사이트|관리자 문의' || data.nodes.inquiry?.action !== 'inquiry') throw Error('시작 메뉴 3개와 문의 분기를 유지해 주세요.');
  return data;
}
export const normalize = text => text.normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
export function matchQuestion(text, guide) {
  const query = normalize(text), scores = [];
  if (!query || query.length > 300) return null;
  for (const [id, node] of Object.entries(guide.nodes)) {
    const score = Math.max(0, ...node.keywords.map(k => { const keyword = normalize(k); return query.includes(keyword) ? keyword.length : 0; }));
    if (score) scores.push({ id, score });
  }
  scores.sort((a, b) => b.score - a.score);
  return scores.length && (scores.length === 1 || scores[0].score > scores[1].score) ? scores[0].id : null;
}
export function restoreState(raw, guide) {
  try {
    const s = JSON.parse(raw);
    if (s?.version !== guide.version || s.release !== guide.release || !guide.nodes[s.node] || !Array.isArray(s.stack) || !s.stack.every(n => guide.nodes[n]) || !Array.isArray(s.messages) || s.messages.length > 80 || !s.messages.every(m => ['user', 'bot'].includes(m.role) && typeof m.text === 'string' && m.text.length <= 1500)) return null;
    return { version: s.version, release: s.release, fallback: s.fallback === true, node: s.node, stack: s.stack.slice(-30), messages: s.messages, open: s.open === true };
  } catch { return null; }
}
