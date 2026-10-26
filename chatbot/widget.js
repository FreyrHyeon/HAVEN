import { validateGuide, matchQuestion, restoreState } from './rules.js';
import { createInquiryForm, loadInquiryConfig } from './inquiry.js';
const base = new URL('./', import.meta.url);
const site = location.pathname.startsWith('/Sk_Planet/') ? 'miraon' : 'haven';
const brand = site === 'miraon' ? 'MIRAON' : 'HAVEN';
const storageKey = site + '.guide.chat.v1';
if (!document.querySelector('haven-guide-chat')) {
  const host = document.createElement('haven-guide-chat'); document.body.append(host);
  const root = host.attachShadow({ mode: 'open' });
  const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = new URL('widget.css?v=20261026-3', base); root.append(css);
  const launcher = document.createElement('button'); launcher.className = 'launcher'; launcher.textContent = '안내 채팅'; launcher.setAttribute('aria-expanded', 'false'); launcher.setAttribute('aria-controls', 'haven-chat-panel');
  launcher.disabled = true;
  const panel = document.createElement('section'); panel.id = 'haven-chat-panel'; panel.className = 'panel'; panel.hidden = true; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', brand + ' 규칙형 안내 채팅');
  const header = document.createElement('header'), title = document.createElement('div'); title.textContent = brand + ' 안내';
  const subtitle = document.createElement('small'); subtitle.textContent = '등록된 질문·답변으로 안내합니다'; title.append(subtitle);
  const close = document.createElement('button'); close.textContent = '×'; close.setAttribute('aria-label', '채팅창 닫기'); header.append(title, close);
  const log = document.createElement('div'); log.className = 'messages'; log.setAttribute('role', 'log'); log.setAttribute('aria-live', 'polite'); log.setAttribute('aria-label', '대화 내용');
  const options = document.createElement('div'); options.className = 'options'; options.setAttribute('aria-label', '다음 선택지');
  const inquiry = document.createElement('div'); inquiry.className = 'inquiry'; inquiry.hidden = true;
  const inputForm = document.createElement('form'); inputForm.className = 'question-form';
  const input = document.createElement('input'); input.type = 'text'; input.maxLength = 300; input.placeholder = '등록된 안내 키워드를 입력하세요'; input.setAttribute('aria-label', '안내 질문'); input.autocomplete = 'off';
  const send = document.createElement('button'); send.textContent = '보내기'; send.type = 'submit'; inputForm.append(input, send);
  const nav = document.createElement('nav'); nav.setAttribute('aria-label', '대화 이동');
  const back = document.createElement('button'), home = document.createElement('button'), reset = document.createElement('button');
  back.textContent = '이전으로'; home.textContent = '처음으로'; reset.textContent = '대화 초기화'; nav.append(back, home, reset);
  panel.append(header, log, options, inquiry, inputForm, nav); root.append(launcher, panel);
  let guide, state, inquirySequence = 0;
  function fresh() { return { version: guide.version, release: guide.release, node: 'home', stack: [], open: false, fallback: false, messages: [{ role: 'bot', text: guide.intro }, { role: 'bot', text: guide.nodes.home.answer }] }; }
  function persist() { try { sessionStorage.setItem(storageKey, JSON.stringify(state)); } catch {} }
  function renderMessages() {
    log.replaceChildren();
    for (const message of state.messages) { const div = document.createElement('p'); div.className = 'message ' + message.role; div.textContent = message.text; log.append(div); }
    log.scrollTop = log.scrollHeight;
  }
  function append(role, text) { state.messages.push({ role, text }); state.messages = state.messages.slice(-80); }
  function action(label, next) { const button = document.createElement('button'); button.textContent = label; button.onclick = () => { append('user', label); go(next); }; return button; }
  async function renderControls() {
    const current = guide.nodes[state.node], sequence = ++inquirySequence;
    options.replaceChildren(...current.buttons.map(b => action(b.label, b.next)));
    if (state.fallback) options.replaceChildren(...guide.nodes.home.buttons.map(b => action(b.label,b.next)), action('제작 문의','inquiry'));
    back.disabled = !state.stack.length;
    inquiry.replaceChildren(); inquiry.hidden = current.action !== 'inquiry';
    if (current.action === 'inquiry') {
      const link = document.createElement('a'); link.href = new URL('../contact.html', base); link.textContent = '문의 페이지에서 열기'; inquiry.append(link);
      try { const config = await loadInquiryConfig(); if (sequence === inquirySequence) inquiry.append(createInquiryForm(config, 'chatbot')); }
      catch { if (sequence === inquirySequence) { const message = document.createElement('p'); message.textContent = '문의 접수 설정을 불러오지 못해 전송이 잠겨 있는 상태입니다.'; inquiry.append(message); } }
    }
  }
  function render() { renderMessages(); renderControls(); }
  function go(next, stack = true) {
    if (!guide.nodes[next]) return;
    state.fallback = false;
    if (stack && state.node !== next) { state.stack.push(state.node); state.stack = state.stack.slice(-30); }
    state.node = next; append('bot', guide.nodes[next].answer); render(); persist();
  }
  function setOpen(value, save = true, focus = true) { panel.hidden = !value; launcher.setAttribute('aria-expanded', String(value)); if (state) { state.open = value; if (save) persist(); } if (focus) { if (value) input.focus(); else launcher.focus(); } }
  launcher.onclick = () => setOpen(panel.hidden);
  close.onclick = () => setOpen(false);
  root.addEventListener('keydown', event => { if (event.key === 'Escape' && !panel.hidden) { event.preventDefault(); setOpen(false); } });
  inputForm.onsubmit = event => {
    event.preventDefault(); if (!guide || !state || !input.value.trim()) return;
    const text = input.value.trim(); input.value = '';
    // 문의 개인정보는 별도 양식으로 받고 대화 저장소에는 보존하지 않는다.
    if (/@|(?:\d[ -]?){8,}/.test(text)) { append('user', '[개인정보가 포함될 수 있는 입력은 저장하지 않습니다]'); append('bot', '연락처나 개인정보는 대화에 입력하지 않는 방식입니다. 동의 안내가 있는 제작 문의 양식을 이용하는 항목입니다.'); state.node = 'admin'; render(); persist(); return; }
    append('user', text);
    const next = matchQuestion(text, guide);
    if (next) go(next);
    else { state.fallback = true; append('bot', guide.fallback); render(); persist(); }
  };
  back.onclick = () => { if (state?.stack.length) { const next = state.stack.pop(); append('user', guide.navigation.back); go(next, false); } };
  home.onclick = () => { if (state) { append('user', guide.navigation.home); go('home'); } };
  reset.onclick = () => {
    if (!guide) return;
    const opened = !panel.hidden; state = fresh(); state.open = opened; input.value = ''; inquiry.replaceChildren();
    try { sessionStorage.removeItem(storageKey); } catch {}
    render(); if (opened) input.focus();
  };
  // 리틀 HAVEN 집합 버튼을 가리지 않도록 같은 오른쪽 열의 위쪽에 배치한다.
  const updatePosition = () => {
    const gather = document.querySelector('#little-gather') || document.querySelector('.footer-socials');
    const rect = gather?.getBoundingClientRect();
    const bottom = rect && rect.height && rect.top < innerHeight ? Math.max(24, innerHeight - rect.top + 14) : 24;
    host.style.setProperty('--chat-bottom', Math.min(bottom, innerHeight * .38) + 'px');
  };
  addEventListener('resize', updatePosition, { passive: true }); document.addEventListener('haven:navigation-complete', updatePosition); updatePosition();
  try {
    const config = await loadInquiryConfig();
    const response = await fetch(config.guideEndpoint, { cache: 'no-store', headers: { apikey: config.publishableKey }, signal: AbortSignal.timeout(15000) }); if (!response.ok) throw Error();
    const published = await response.json();
    guide = validateGuide(published.content); guide.release = published.id;
    back.textContent = guide.navigation.back; home.textContent = guide.navigation.home; reset.textContent = guide.navigation.reset;
    let raw; try { raw = sessionStorage.getItem(storageKey); } catch {}
    state = restoreState(raw, guide) || fresh(); render(); setOpen(state.open, false, state.open); launcher.disabled = false;
  } catch {
    launcher.disabled = false;
    log.textContent = '등록된 안내를 불러오지 못했습니다. 잠시 후 다시 열어주세요.';
    input.disabled = send.disabled = back.disabled = home.disabled = reset.disabled = true;
  }
}
