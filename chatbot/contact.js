import { createInquiryForm, loadInquiryConfig } from './inquiry.js';
const root = document.querySelector('#inquiry-root');
const brand = location.pathname.startsWith('/Sk_Planet/') ? 'MIRAON' : 'HAVEN';
document.title = '제작 문의 — ' + brand;
document.querySelector('header a').textContent = brand;
try { root.replaceChildren(createInquiryForm(await loadInquiryConfig())); }
catch { root.textContent = '접수 설정을 불러오지 못해 입력·전송이 잠겨 있는 상태입니다.'; }
