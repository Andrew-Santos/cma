// ─── CONFIG ───────────────────────────────────────────────────
const API = 'https://cma-cadastro-profissional.andrewmssantos.workers.dev';
const MAX_SEL = 12;

// ─── ESTADO ───────────────────────────────────────────────────
let todosProfs   = [];
let selecionados = [];

// ─── UTILS ────────────────────────────────────────────────────
function esc(s) {
  if (!s) return '';
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function ini(nome) {
  return (nome||'?').replace(/^(Dr\.|Dra\.|Prof\.)\s*/i,'').charAt(0).toUpperCase();
}
function showToast(msg, tipo) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast' + (tipo === 'err' ? ' err' : '');
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3200);
}

// ─── DATAS ────────────────────────────────────────────────────
function dataHoje() {
  const d = new Date(), pad = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function formatarData(str) {
  if (!str) return null;
  const [ano, mes, dia] = str.split('-');
  const meses  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const semana = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
  const d = new Date(Number(ano), Number(mes)-1, Number(dia));
  return { diaSemana: semana[d.getDay()], dia, mes: meses[Number(mes)-1], ano };
}

// ─── CONVERTER IMAGEM PARA BASE64 (resolve CORS no download) ──
async function imgParaBase64(url) {
  if (!url) return null;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const blob = await r.blob();
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

// Pré-carrega e cacheia base64 de todos os profissionais selecionados
const imgCache = {};
async function preCarregarImagens() {
  const profs = selecionados.map(id => todosProfs.find(p => p.id === id)).filter(Boolean);
  await Promise.all(profs.map(async p => {
    if (p.url_imagem && !imgCache[p.id]) {
      imgCache[p.id] = await imgParaBase64(p.url_imagem);
    }
  }));
}

// ─── AVATAR PAINEL ────────────────────────────────────────────
function avatarPainel(p, size) {
  if (p.url_imagem) {
    return `<img src="${esc(p.url_imagem)}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;">`;
  }
  return `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-family:'Cormorant Garamond',serif;font-size:${Math.round(size*.45)}px;font-weight:600;color:#1B8A8A;">${ini(p.nome)}</div>`;
}

// ─── LOAD API ─────────────────────────────────────────────────
async function carregarProfs() {
  const lista = document.getElementById('lista-disponiveis');
  lista.innerHTML = `<div class="lista-vazia">Carregando...</div>`;
  try {
    const r = await fetch(`${API}/profissionais`);
    if (!r.ok) throw new Error();
    todosProfs = await r.json();
    renderDisponiveis();
  } catch {
    lista.innerHTML = `<div class="lista-vazia" style="color:#D93545;">Erro ao carregar. <span style="cursor:pointer;text-decoration:underline;" onclick="carregarProfs()">Tentar novamente</span></div>`;
  }
}

function filtrarProfs() {
  renderDisponiveis(document.getElementById('inp-busca').value.trim().toLowerCase());
}

// ─── RENDER DISPONÍVEIS ───────────────────────────────────────
function renderDisponiveis(q = '') {
  const lista = document.getElementById('lista-disponiveis');
  const filtrados = q
    ? todosProfs.filter(p => (p.nome+p.especialidade).toLowerCase().includes(q))
    : todosProfs;

  if (filtrados.length === 0) {
    lista.innerHTML = `<div class="lista-vazia">${q ? 'Nenhum resultado.' : 'Nenhum profissional cadastrado.'}</div>`;
    return;
  }

  lista.innerHTML = filtrados.map(p => {
    const isSel = selecionados.includes(p.id);
    return `
    <div class="prof-disp-item ${isSel ? 'selecionado' : ''}"
         data-id="${p.id}"
         onclick="${isSel ? '' : `selecionarProf('${p.id}')`}"
         title="${isSel ? 'Já na agenda' : 'Adicionar à agenda'}">
      <div class="disp-av">${avatarPainel(p, 36)}</div>
      <div class="disp-info">
        <div class="disp-nome">${esc(p.nome)||'Sem nome'}</div>
        <div class="disp-esp">${esc(p.especialidade)||'—'}</div>
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
  secao.style.display = selecionados.length > 0 ? 'block' : 'none';
  if (selecionados.length === 0) { lista.innerHTML = ''; return; }

  const profs = selecionados.map(id => todosProfs.find(p => p.id === id)).filter(Boolean);
  lista.innerHTML = profs.map(p => `
    <div class="prof-sel-item">
      <div class="sel-av">${avatarPainel(p, 28)}</div>
      <div class="sel-info">
        <div class="sel-nome">${esc(p.nome)||'Sem nome'}</div>
        <div class="sel-esp">${esc(p.especialidade)||'—'}</div>
      </div>
      <button class="btn-remover-sel" onclick="removerProf('${p.id}')" title="Remover">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>`).join('');
}

// ─── SELECIONAR / REMOVER ─────────────────────────────────────
function selecionarProf(id) {
  if (selecionados.includes(id)) return;
  if (selecionados.length >= MAX_SEL) { showToast(`Máximo de ${MAX_SEL} profissionais.`, 'err'); return; }
  selecionados.push(id);
  // Pré-carrega imagem em background
  const p = todosProfs.find(x => x.id === id);
  if (p?.url_imagem && !imgCache[id]) imgParaBase64(p.url_imagem).then(b64 => { imgCache[id] = b64; });
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
// useBase64: true para download (resolve CORS), false para preview ao vivo
function gerarCardHtml(useBase64 = false) {
  const dataVal = document.getElementById('inp-data')?.value || '';
  const dataFmt = dataVal ? formatarData(dataVal) : null;
  const profs   = selecionados.map(id => todosProfs.find(p => p.id === id)).filter(Boolean);
  const n       = profs.length;

  const dataText = dataFmt
    ? `${dataFmt.diaSemana}, ${dataFmt.dia} de ${dataFmt.mes} de ${dataFmt.ano}`
    : 'Selecione uma data';

  // Tipografia dinâmica
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
        const letra  = ini(p.nome);
        const imgSrc = useBase64 ? (imgCache[p.id] || null) : p.url_imagem;
        const avHtml = imgSrc
          ? `<img src="${imgSrc}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;">`
          : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-family:'Cormorant Garamond',serif;font-size:${Math.round(avatarSize*.38)}px;font-weight:600;color:#1B8A8A;">${letra}</div>`;
        return `<div class="card-prof-item" style="padding:${itemPadV}px 18px;">
          <div class="card-prof-av" style="width:${avatarSize}px;height:${avatarSize}px;">${avHtml}</div>
          <div class="card-prof-stripe" style="height:${stripeH}px;"></div>
          <div class="card-prof-info">
            <div class="card-prof-nome" style="font-size:${nomeSize}px;">${esc(p.nome)||'Nome'}</div>
            <div class="card-prof-esp"  style="font-size:${espSize}px;">${esc(p.especialidade)||'Especialidade'}</div>
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
      <img src="../logo-amar.png" style="width:26%;height:auto;" alt="Centro Médico AMAR">
      <span class="card-footer-txt">Agende sua consulta</span>
    </div>`;
}

// ─── ATUALIZAR CARD (preview) ─────────────────────────────────
function atualizarCard() {
  const wrapper = document.getElementById('card-wrapper');
  if (!wrapper) return;
  wrapper.innerHTML = gerarCardHtml(false);
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
  outer.style.setProperty('--card-scale', scale);
}

// ─── DOWNLOAD ─────────────────────────────────────────────────
async function baixarCard() {
  if (!window.html2canvas) { showToast('html2canvas não carregado.', 'err'); return; }

  showToast('Carregando imagens...', '');
  await preCarregarImagens();

  // Cria card temporário fora da tela com imagens em base64
  const tmp = document.createElement('div');
  tmp.style.cssText = 'position:fixed;left:-9999px;top:0;width:405px;height:720px;overflow:hidden;';
  tmp.innerHTML = `<div id="card-tmp" class="card-wrapper" style="width:405px;height:720px;position:relative;">${gerarCardHtml(true)}</div>`;
  document.body.appendChild(tmp);

  showToast('Gerando imagem...', '');

  try {
    const cardEl = tmp.querySelector('#card-tmp');
    const canvas = await window.html2canvas(cardEl, {
      scale: 4,
      useCORS: false,       // base64 não precisa de CORS
      allowTaint: true,
      backgroundColor: '#FAFAF8',
      logging: false,
      imageTimeout: 30000,
      onclone: (doc) => new Promise((resolve) => {
        const link = doc.createElement('link');
        link.rel = 'stylesheet';
        link.href = window.location.href.replace(/[^/]*$/, '') + 'style.css';
        link.onload = resolve; link.onerror = resolve;
        doc.head.appendChild(link);
        setTimeout(resolve, 600);
      }),
    });

    document.body.removeChild(tmp);

    const dataVal  = document.getElementById('inp-data')?.value || 'agenda';
    const filename = `agenda-amar-${dataVal}.png`;
    const isIOS    = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    canvas.toBlob(blob => {
      if (!blob) { showToast('Erro ao gerar imagem.', 'err'); return; }
      const url = URL.createObjectURL(blob);
      if (isIOS) {
        window.open(url, '_blank');
        showToast('Imagem aberta! Pressione e segure para salvar.', '');
      } else {
        const a = document.createElement('a');
        a.download = filename; a.href = url;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        showToast('Card baixado!', '');
      }
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }, 'image/png');
  } catch(e) {
    console.error(e);
    if (document.body.contains(tmp)) document.body.removeChild(tmp);
    showToast('Erro ao exportar.', 'err');
  }
}

// ─── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const inpData = document.getElementById('inp-data');
  inpData.value = dataHoje();
  inpData.addEventListener('input', atualizarCard);
  document.getElementById('btn-download').addEventListener('click', baixarCard);
  window.addEventListener('resize', () => {
    clearTimeout(window._rt);
    window._rt = setTimeout(escalarCard, 80);
  });
  carregarProfs();
  atualizarCard();
  escalarCard();
});