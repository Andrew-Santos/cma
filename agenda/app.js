// ─── CONFIG ───────────────────────────────────────────────────
const API     = 'https://cma-cadastro-profissional.andrewmssantos.workers.dev';
const MAX_SEL = 12;

// ─── ESTADO ───────────────────────────────────────────────────
let todosProfs   = [];
let selecionados = [];

// Cache: prof.id → base64 string | null
const imgCache = {};

// ─── UTILS ────────────────────────────────────────────────────
function esc(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function iniciais(nome) {
  return (nome || '?').replace(/^(Dr\.|Dra\.|Prof\.)\s*/i, '').charAt(0).toUpperCase();
}

function showToast(msg, tipo) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast' + (tipo === 'err' ? ' err' : '');
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 3500);
}

// ─── DATAS ────────────────────────────────────────────────────
function dataHoje() {
  const d = new Date(), pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatarData(str) {
  if (!str) return null;
  const [ano, mes, dia] = str.split('-');
  const meses  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const semana = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira',
                  'Quinta-feira','Sexta-feira','Sábado'];
  const d = new Date(Number(ano), Number(mes) - 1, Number(dia));
  return { diaSemana: semana[d.getDay()], dia, mes: meses[Number(mes) - 1], ano };
}

// ─── URL DO PROXY ─────────────────────────────────────────────
// Após o deploy do worker.js, a rota GET /img/:filename
// serve a imagem do R2 com Access-Control-Allow-Origin: *
function proxyUrl(urlImagem) {
  if (!urlImagem) return null;
  try {
    const filename = urlImagem.split('/').pop();
    return filename ? `${API}/img/${filename}` : null;
  } catch { return null; }
}

// ─── CARREGAR IMAGEM COMO BASE64 ──────────────────────────────
// Estratégia em cascata:
//   1. fetch() via proxy do Worker (requer deploy do worker.js)
//   2. Image element + crossOrigin + canvas (fallback)
//   3. null → mostra inicial
async function carregarBase64(prof) {
  if (!prof.url_imagem) return null;
  if (imgCache[prof.id] !== undefined) return imgCache[prof.id];

  // Reserva o slot para evitar chamadas duplicadas
  imgCache[prof.id] = null;

  // ── Tentativa 1: fetch via proxy ────────────────────────────
  const url = proxyUrl(prof.url_imagem);
  if (url) {
    try {
      const r = await fetch(url, { cache: 'force-cache' });
      if (r.ok) {
        const blob = await r.blob();
        const b64  = await blobParaBase64(blob);
        imgCache[prof.id] = b64;
        return b64;
      }
    } catch { /* proxy ainda não deployado, tenta fallback */ }
  }

  // ── Tentativa 2: Image + crossOrigin + canvas ───────────────
  try {
    const b64 = await imgElementParaBase64(prof.url_imagem);
    imgCache[prof.id] = b64;
    return b64;
  } catch { /* servidor sem CORS — usa inicial */ }

  imgCache[prof.id] = null;
  return null;
}

function blobParaBase64(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = () => res(r.result);
    r.onerror = () => rej(new Error('FileReader error'));
    r.readAsDataURL(blob);
  });
}

function imgElementParaBase64(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const t = setTimeout(() => rej(new Error('timeout')), 8000);
    img.onload = () => {
      clearTimeout(t);
      try {
        const c = document.createElement('canvas');
        c.width  = img.naturalWidth  || 200;
        c.height = img.naturalHeight || 200;
        c.getContext('2d').drawImage(img, 0, 0);
        res(c.toDataURL('image/jpeg', 0.92));
      } catch (e) { rej(e); }
    };
    img.onerror = () => { clearTimeout(t); rej(new Error('img load error')); };
    img.src = src;
  });
}

async function preCarregarImagens() {
  const profs = selecionados.map(id => todosProfs.find(p => p.id === id)).filter(Boolean);
  await Promise.all(profs.map(p => carregarBase64(p)));
}

function preCarregarBackground() {
  todosProfs.forEach(p => { if (p.url_imagem && imgCache[p.id] === undefined) carregarBase64(p); });
}

// ─── AVATAR PAINEL ────────────────────────────────────────────
// Usa proxy URL ou URL original — o browser exibe sem restrição de CORS para <img>
function avatarPainelHtml(prof, size) {
  const url = proxyUrl(prof.url_imagem) || prof.url_imagem;
  if (url) {
    return `<img src="${esc(url)}" alt="" loading="lazy"
              style="width:100%;height:100%;object-fit:cover;display:block;"
              onerror="this.style.display='none'">`;
  }
  return `<div class="av-inicial" style="font-size:${Math.round(size * .4)}px;">${iniciais(prof.nome)}</div>`;
}

// ─── AVATAR CARD PARA DOWNLOAD (usa base64) ───────────────────
function avatarCardHtml(prof, size) {
  const b64 = imgCache[prof.id];
  if (b64) {
    return `<img src="${b64}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;">`;
  }
  return `<div class="av-inicial" style="font-size:${Math.round(size * .38)}px;">${iniciais(prof.nome)}</div>`;
}

// ─── CARREGAR PROFISSIONAIS ────────────────────────────────────
async function carregarProfs() {
  const lista = document.getElementById('lista-disponiveis');
  lista.innerHTML = '<div class="lista-vazia">Carregando profissionais...</div>';
  try {
    const r = await fetch(`${API}/profissionais`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    todosProfs = await r.json();
    renderDisponiveis();
    preCarregarBackground();
  } catch (e) {
    console.error(e);
    lista.innerHTML = `<div class="lista-vazia" style="color:#D93545;">
      Erro ao carregar.<br>
      <span style="cursor:pointer;text-decoration:underline;color:#1B8A8A;"
            onclick="carregarProfs()">Tentar novamente</span>
    </div>`;
  }
}

function filtrarProfs() {
  renderDisponiveis(document.getElementById('inp-busca').value.trim().toLowerCase());
}

// ─── RENDER DISPONÍVEIS ───────────────────────────────────────
function renderDisponiveis(q = '') {
  const lista = document.getElementById('lista-disponiveis');
  const filtrados = q
    ? todosProfs.filter(p => (p.nome + ' ' + p.especialidade).toLowerCase().includes(q))
    : todosProfs;

  if (!filtrados.length) {
    lista.innerHTML = `<div class="lista-vazia">${q ? 'Nenhum resultado.' : 'Nenhum profissional cadastrado.'}</div>`;
    return;
  }

  lista.innerHTML = filtrados.map(p => {
    const isSel = selecionados.includes(p.id);
    return `
      <div class="prof-disp-item${isSel ? ' selecionado' : ''}"
           onclick="selecionarProf('${esc(p.id)}')"
           title="${isSel ? 'Já na agenda' : 'Adicionar à agenda'}">
        <div class="disp-av">${avatarPainelHtml(p, 34)}</div>
        <div class="disp-info">
          <div class="disp-nome">${esc(p.nome) || 'Sem nome'}</div>
          <div class="disp-esp">${esc(p.especialidade) || '—'}</div>
        </div>
        <div class="disp-check">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
      </div>`;
  }).join('');
}

// ─── RENDER SELECIONADOS ──────────────────────────────────────
function renderSelecionados() {
  const secao  = document.getElementById('secao-selecionados');
  const lista  = document.getElementById('lista-selecionados');
  const count  = document.getElementById('sel-count');
  const cntHdr = document.getElementById('cnt-sel');

  cntHdr.textContent = selecionados.length;
  count.textContent  = selecionados.length;
  secao.style.display = selecionados.length ? 'block' : 'none';
  if (!selecionados.length) { lista.innerHTML = ''; return; }

  const profs = selecionados.map(id => todosProfs.find(p => p.id === id)).filter(Boolean);
  lista.innerHTML = profs.map(p => `
    <div class="prof-sel-item">
      <div class="sel-av">${avatarPainelHtml(p, 26)}</div>
      <div class="sel-info">
        <div class="sel-nome">${esc(p.nome) || 'Sem nome'}</div>
        <div class="sel-esp">${esc(p.especialidade) || '—'}</div>
      </div>
      <button class="btn-remover-sel" onclick="removerProf('${esc(p.id)}')" title="Remover">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>`).join('');
}

// ─── SELECIONAR / REMOVER ─────────────────────────────────────
function selecionarProf(id) {
  if (selecionados.includes(id)) return;
  if (selecionados.length >= MAX_SEL) {
    showToast(`Máximo de ${MAX_SEL} profissionais.`, 'err');
    return;
  }
  selecionados.push(id);
  const prof = todosProfs.find(p => p.id === id);
  if (prof) carregarBase64(prof);
  renderDisponiveis(document.getElementById('inp-busca').value.trim().toLowerCase());
  renderSelecionados();
  atualizarCard();
}

function removerProf(id) {
  selecionados = selecionados.filter(x => x !== id);
  renderDisponiveis(document.getElementById('inp-busca').value.trim().toLowerCase());
  renderSelecionados();
  atualizarCard();
}

// ─── GERAR HTML DO CARD ───────────────────────────────────────
function gerarCardHtml(useBase64 = false) {
  const dataVal = document.getElementById('inp-data')?.value || '';
  const dataFmt = dataVal ? formatarData(dataVal) : null;
  const profs   = selecionados.map(id => todosProfs.find(p => p.id === id)).filter(Boolean);
  const n       = profs.length;

  const dataText = dataFmt
    ? `${dataFmt.diaSemana}, ${dataFmt.dia} de ${dataFmt.mes} de ${dataFmt.ano}`
    : 'Selecione uma data';

  const BODY_H       = 540;
  const spacePerItem = n > 0 ? BODY_H / n : BODY_H;
  const avatarSize   = Math.min(96,  Math.max(26, Math.round(spacePerItem * (n >= 6 ? 0.62 : 0.48))));
  const nomeSize     = Math.min(20,  Math.max(7,  Math.round(avatarSize   * (n >= 6 ? 0.240 : 0.185))));
  const espSize      = Math.min(12,  Math.max(5,  Math.round(avatarSize   * (n >= 6 ? 0.148 : 0.115))));
  const itemPadV     = Math.min(14,  Math.max(2,  Math.round(spacePerItem * 0.032)));
  const stripeH      = Math.min(34,  Math.max(10, Math.round(avatarSize   * 0.42)));

  const profsHtml = n === 0
    ? `<div class="card-empty">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#B8DEDE" stroke-width="1.2" style="display:block;margin:0 auto 8px;">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
        Selecione profissionais<br>no painel para visualizar.
      </div>`
    : profs.map(p => {
        let avHtml;
        if (useBase64) {
          avHtml = avatarCardHtml(p, avatarSize);
        } else {
          const url = proxyUrl(p.url_imagem) || p.url_imagem;
          avHtml = url
            ? `<img src="${esc(url)}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.style.display='none';">`
            : `<div class="av-inicial" style="font-size:${Math.round(avatarSize * .38)}px;">${iniciais(p.nome)}</div>`;
        }
        return `
          <div class="card-prof-item" style="padding:${itemPadV}px 18px;">
            <div class="card-prof-av" style="width:${avatarSize}px;height:${avatarSize}px;">${avHtml}</div>
            <div class="card-prof-stripe" style="height:${stripeH}px;"></div>
            <div class="card-prof-info">
              <div class="card-prof-nome" style="font-size:${nomeSize}px;">${esc(p.nome) || 'Nome'}</div>
              <div class="card-prof-esp"  style="font-size:${espSize}px;">${esc(p.especialidade) || 'Especialidade'}</div>
            </div>
          </div>`;
      }).join('');

  return `
    <div class="card-hdr">
      <div class="card-hdr-deco-a"></div>
      <div class="card-hdr-deco-b"></div>
      <div class="card-hdr-content">
        <div class="card-titulo">Agenda</div>
        <div class="card-subtitulo">Centro Médico AMAR · Atendimentos do Dia</div>
        <div class="card-data-linha">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="2" stroke-linecap="round" style="flex-shrink:0;">
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <span>${dataText}</span>
        </div>
      </div>
    </div>
    <div class="card-body">
      <div class="card-divider">
        <div class="card-divider-line"></div>
        <span class="card-divider-label">Profissionais de Plantão</span>
        <div class="card-divider-line"></div>
      </div>
      <div class="card-profs">${profsHtml}</div>
    </div>
    <div class="card-footer">
      <img src="../logo-amar.png" style="width:26%;height:auto;" alt="Centro Médico AMAR"
           onerror="this.style.display='none';">
      <span class="card-footer-txt">Agende sua consulta</span>
    </div>`;
}

// ─── CSS INLINE PARA O CLONE (html2canvas) ────────────────────
const CSS_CLONE = `
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  .card-wrapper{width:405px;height:720px;display:flex;flex-direction:column;overflow:hidden;font-family:'Outfit',sans-serif;background:#FAFAF8;position:relative;}
  .card-hdr{background:linear-gradient(145deg,#052828 0%,#0A4848 45%,#1B8A8A 100%);position:relative;overflow:hidden;flex-shrink:0;padding:20px 22px 18px;}
  .card-hdr-deco-a{position:absolute;top:-50px;right:-50px;width:200px;height:200px;border-radius:50%;border:1px solid rgba(255,255,255,.07);pointer-events:none;}
  .card-hdr-deco-b{position:absolute;bottom:-35px;left:-25px;width:140px;height:140px;border-radius:50%;background:radial-gradient(circle,rgba(27,138,138,.4) 0%,transparent 70%);pointer-events:none;}
  .card-hdr-content{position:relative;z-index:2;}
  .card-titulo{font-family:'Outfit',sans-serif;font-size:42px;font-weight:800;color:#fff;line-height:.85;letter-spacing:-3px;text-transform:uppercase;}
  .card-subtitulo{font-size:6.5px;font-weight:600;letter-spacing:.26em;text-transform:uppercase;color:rgba(255,255,255,.38);margin-top:5px;}
  .card-data-linha{display:inline-flex;align-items:center;gap:7px;margin-top:14px;background:rgba(255,255,255,.11);border:1px solid rgba(255,255,255,.18);border-radius:6px;padding:6px 11px;}
  .card-data-linha span{font-size:11.5px;font-weight:700;color:#fff;letter-spacing:.01em;}
  .card-body{flex:1;display:flex;flex-direction:column;overflow:hidden;background:#FAFAF8;}
  .card-divider{display:flex;align-items:center;gap:6px;padding:9px 16px 4px;flex-shrink:0;}
  .card-divider-line{flex:1;height:1px;background:#B8DEDE;opacity:.45;}
  .card-divider-label{font-size:6px;font-weight:800;letter-spacing:.22em;text-transform:uppercase;color:#1B8A8A;white-space:nowrap;}
  .card-profs{flex:1;display:flex;flex-direction:column;justify-content:center;overflow:hidden;}
  .card-prof-item{display:flex;align-items:center;gap:12px;}
  .card-prof-av{border-radius:50%;overflow:hidden;flex-shrink:0;border:2px solid #B8DEDE;background:#EAF5F5;box-shadow:0 2px 8px rgba(27,138,138,.18);}
  .card-prof-av img{width:100%;height:100%;object-fit:cover;display:block;}
  .card-prof-stripe{width:2px;border-radius:2px;flex-shrink:0;background:linear-gradient(to bottom,#1B8A8A,rgba(27,138,138,.12));}
  .card-prof-info{flex:1;min-width:0;}
  .card-prof-nome{font-weight:700;color:#111827;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .card-prof-esp{font-weight:600;color:#1B8A8A;letter-spacing:.05em;text-transform:uppercase;margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:.85;}
  .card-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;color:#D1D5DB;font-size:10px;line-height:1.8;}
  .card-footer{background:linear-gradient(to right,#E8EAEC,#EFF1F3);padding:8px 16px;border-top:1px solid #DDE0E3;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}
  .card-footer-txt{font-size:6.5px;font-weight:700;color:#6B7280;letter-spacing:.13em;text-transform:uppercase;white-space:nowrap;}
  .av-inicial{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-family:'Cormorant Garamond',serif;font-weight:600;color:#1B8A8A;}
`;

// ─── PREVIEW AO VIVO ──────────────────────────────────────────
function atualizarCard() {
  const wrapper = document.getElementById('card-wrapper');
  if (wrapper) wrapper.innerHTML = gerarCardHtml(false);
}

// ─── ESCALAR CARD ─────────────────────────────────────────────
function escalarCard() {
  const outer = document.querySelector('.card-outer');
  const area  = document.querySelector('.preview-area');
  if (!outer || !area) return;
  const pad    = 40;
  const scaleH = (area.clientHeight - pad) / 720;
  const scaleW = (area.clientWidth  - pad) / 405;
  const scale  = Math.min(scaleH, scaleW, 1);
  outer.style.setProperty('--card-scale', scale.toFixed(4));
}

// ─── DOWNLOAD ─────────────────────────────────────────────────
async function baixarCard() {
  const btn     = document.getElementById('btn-download');
  const dataVal = document.getElementById('inp-data')?.value || '';

  if (!dataVal)             { showToast('Selecione uma data antes de baixar.', 'err'); return; }
  if (!selecionados.length) { showToast('Adicione ao menos um profissional.', 'err'); return; }

  btn.disabled = true;
  showToast('Carregando imagens…', '');

  await preCarregarImagens();

  showToast('Gerando card…', '');

  if (!window.html2canvas) {
    try {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
    } catch {
      showToast('Erro ao carregar html2canvas.', 'err');
      btn.disabled = false;
      return;
    }
  }

  const tmp = document.createElement('div');
  tmp.style.cssText = 'position:fixed;left:-9999px;top:0;width:405px;height:720px;overflow:hidden;';
  tmp.innerHTML = `<style>${CSS_CLONE}</style>
    <div id="card-dl" class="card-wrapper">${gerarCardHtml(true)}</div>`;
  document.body.appendChild(tmp);

  // Aguarda dois frames para garantir renderização
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

  try {
    const canvas = await window.html2canvas(tmp.querySelector('#card-dl'), {
      scale:           4,
      useCORS:         false,
      allowTaint:      true,
      backgroundColor: '#FAFAF8',
      logging:         false,
      imageTimeout:    0,
    });

    document.body.removeChild(tmp);

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    canvas.toBlob(blob => {
      if (!blob) { showToast('Erro ao gerar imagem.', 'err'); return; }
      const url = URL.createObjectURL(blob);
      if (isIOS) {
        window.open(url, '_blank');
        showToast('Imagem aberta! Pressione e segure para salvar.', '');
      } else {
        const a = document.createElement('a');
        a.download = `agenda-amar-${dataVal}.png`;
        a.href = url;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast('Card baixado com sucesso!', '');
      }
      setTimeout(() => URL.revokeObjectURL(url), 15000);
    }, 'image/png');

  } catch (e) {
    console.error('Erro no download:', e);
    if (document.body.contains(tmp)) document.body.removeChild(tmp);
    showToast('Erro ao exportar o card.', 'err');
  } finally {
    btn.disabled = false;
  }
}

// ─── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const inpData = document.getElementById('inp-data');
  inpData.value = dataHoje();
  inpData.addEventListener('input', atualizarCard);
  document.getElementById('btn-download').addEventListener('click', baixarCard);

  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(escalarCard, 80); });

  carregarProfs();
  atualizarCard();
  escalarCard();
});