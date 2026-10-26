const configUrl = new URL('./inquiry-config.json', import.meta.url);
export async function loadInquiryConfig() {
  const response = await fetch(configUrl, { cache: 'no-store' });
  if (!response.ok) throw Error('문의 접수 설정을 불러오지 못했습니다.');
  return response.json();
}
export function isInquiryReady(config) {
  if (config?.enabled !== true || !config.privacy?.controller || !config.privacy?.retention) return false;
  try { const url = new URL(config.endpoint); return url.protocol === 'https:' && url.pathname.startsWith('/functions/v1/') && /^[a-z0-9]+\.supabase\.co$/.test(url.hostname); } catch { return false; }
}
export function createInquiryForm(config, channel = 'contact') {
  const form = document.createElement('form'); form.className = 'inquiry-form';
  const status = document.createElement('p'); status.setAttribute('role', 'status');
  const ready = isInquiryReady(config);
  const note = document.createElement('p');
  note.textContent = ready ? `수집 주체: ${config.privacy.controller}. 목적: ${config.privacy.purpose}. 수집 항목: ${config.privacy.items}. 보유 기간: ${config.privacy.retention}. 동의를 거부할 수 있으며 거부 시 문의 접수가 제한됩니다.` : config.unavailableMessage || '문의 접수 설정을 확인할 수 없어 전송이 잠겨 있는 상태입니다.';
  form.append(note);
  for (const [name, title, type, maxLength] of [['name', '이름', 'text', 60], ['email', '답변받을 이메일', 'email', 254], ['message', '문의 내용', 'textarea', 3000]]) {
    const label = document.createElement('label'), field = document.createElement(type === 'textarea' ? 'textarea' : 'input');
    label.textContent = title; field.name = name; if (type !== 'textarea') field.type = type; else field.rows = 5;
    field.required = true; field.maxLength = maxLength; field.disabled = !ready; field.autocomplete = 'off'; label.append(field); form.append(label);
  }
  const consentLabel = document.createElement('label'), consent = document.createElement('input');
  consent.type = 'checkbox'; consent.name = 'consent'; consent.required = true; consent.disabled = !ready;
  consentLabel.className = 'consent'; consentLabel.append(consent, document.createTextNode('개인정보 수집·이용 안내를 확인했으며 동의합니다.')); form.append(consentLabel);
  const submit = document.createElement('button'); submit.type = 'submit'; submit.textContent = ready ? '문의 보내기' : '접수 연결 준비 중'; submit.disabled = !ready; form.append(submit, status);
  let pending = false, uncertain = false, requestId = crypto.randomUUID();
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (!ready || pending || uncertain || !form.reportValidity()) return;
    if (!consent.checked) { status.textContent = '개인정보 동의가 필요한 항목입니다.'; return; }
    const values = new FormData(form);
    const source = location.pathname.startsWith('/Sk_Planet/') ? 'miraon_web' : 'haven_web';
    const body = { request_id: requestId, name: String(values.get('name')).trim(), email: String(values.get('email')).trim(), message: String(values.get('message')).trim(), consent: true, consent_version: '20261026-90d', source, channel };
    if (!body.name || !body.message) { status.textContent = '이름과 문의 내용을 확인해 주세요.'; return; }
    pending = true; submit.disabled = true; status.textContent = '문의 접수 확인 중입니다.';
    try {
      const response = await fetch(config.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: config.publishableKey }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000), credentials: 'omit', redirect: 'error' });
      const result = await response.json();
      if (!response.ok || result.accepted !== true || typeof result.receipt_id !== 'string') throw Error('접수 결과를 확인하지 못했습니다.');
      form.reset(); requestId = crypto.randomUUID(); status.textContent = `문의가 접수된 상태입니다. 접수 번호: ${result.receipt_id}`;
    } catch {
      uncertain = true; status.textContent = '접수 결과를 확정하지 못했습니다. 중복 문의를 막기 위해 자동 재전송하지 않는 상태입니다. 운영자에게 접수 여부를 확인해 주세요.';
    } finally { pending = false; submit.disabled = uncertain; }
  });
  return form;
}
