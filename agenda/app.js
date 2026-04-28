// ─── CONSTANTES ───────────────────────────────────────────────
const TURNO_ICONS_SM = {
  manha: `<svg class="card-turno-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>`,
  tarde:  `<svg class="card-turno-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/></svg>`,
  noite:  `<svg class="card-turno-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
};
const TURNO_LABELS = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' };
const ICON_CAL = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.8)" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;

// ─── ESTADO ───────────────────────────────────────────────────
const State = {
  profissionais: [],
  imgStates: {},
  turnoAtual: 'manha',
  MAX: 12,
  estadoPadrao: () => ({ zoom: 100, dragX: 0, dragY: 0, dragging: false, startX: 0, startY: 0, startDragX: 0, startDragY: 0 }),
  gerarId: () => 'prof_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
};

// ─── DATAS ────────────────────────────────────────────────────
function dataHoje() {
  const d = new Date(), pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatarData(str) {
  if (!str) return null;
  const [ano, mes, dia] = str.split('-');
  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const semana = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
  const d = new Date(Number(ano), Number(mes) - 1, Number(dia));
  return { diaSemana: semana[d.getDay()], dia, mes: meses[Number(mes) - 1], ano };
}

// ─── DEBOUNCE ─────────────────────────────────────────────────
function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ─── NOTIFICAÇÃO ──────────────────────────────────────────────
function notif(msg, tipo = 'sucesso', dur = 3000) {
  const el = document.getElementById('notif');
  if (!el) return;
  const cores = { sucesso: '#1B8A8A', erro: '#D93545', aviso: '#F59E0B', loading: '#6B7280' };
  el.textContent = msg;
  el.style.background = cores[tipo] || cores.sucesso;
  el.style.color = '#fff';
  el.style.display = 'block';
  el.style.opacity = '1';
  if (dur > 0) {
    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => { el.style.display = 'none'; }, 260);
    }, dur);
  }
}

// ─── RENDER LISTA ─────────────────────────────────────────────
function renderLista() {
  const lista = document.getElementById('lista-profissionais');
  if (!lista) return;

  if (State.profissionais.length === 0) {
    lista.innerHTML = `<div style="text-align:center;padding:12px 0 6px;color:#9CA3AF;font-size:11px;font-family:'Outfit',sans-serif;">Nenhum profissional adicionado.</div>`;
    atualizarBtnAdd();
    return;
  }

  lista.innerHTML = State.profissionais.map((p, idx) => {
    const s = State.imgStates[p.id] || {};
    const temFoto = !!p.fotoDataUrl;
    return `
    <div class="prof-card" id="prof-${p.id}" data-id="${p.id}">
      <div class="prof-header">
        <span class="prof-num">Profissional ${idx + 1}</span>
        <button class="btn btn-danger js-remover" data-id="${p.id}" type="button" title="Remover">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div class="prof-body">
        <div class="prof-foto-col">
          <input type="file" accept="image/*" class="foto-input" id="file-${p.id}" data-id="${p.id}">
          <div class="foto-zone" id="zona-${p.id}" data-id="${p.id}">
            <div class="foto-placeholder" id="ph-${p.id}" style="${temFoto ? 'display:none' : ''}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              <span>Foto</span>
            </div>
            <div class="foto-preview" id="preview-${p.id}" style="${temFoto ? 'display:block' : ''}">
              <img class="foto-img" id="img-${p.id}" src="${p.fotoDataUrl || ''}" draggable="false" alt="Foto de ${p.nome || 'profissional'}">
            </div>
          </div>
          <!-- Zoom Controls -->
          <div class="zoom-row" id="zoom-row-${p.id}" style="${temFoto ? '' : 'opacity:.3;pointer-events:none;'}">
            <button class="btn btn-ghost btn-sq js-zoom-minus" data-id="${p.id}" type="button">−</button>
            <input type="range" min="10" max="300" step="5" value="${s.zoom || 100}" class="slider js-zoom-slider" id="zoom-${p.id}" data-id="${p.id}">
            <button class="btn btn-ghost btn-sq js-zoom-plus" data-id="${p.id}" type="button">+</button>
          </div>
          <span class="zoom-label" id="zlabel-${p.id}" style="${temFoto ? '' : 'opacity:.3;'}">${s.zoom || 100}%</span>
          <button class="btn btn-ghost js-reset" data-id="${p.id}" type="button"
            style="font-size:9px;padding:3px 7px;${temFoto ? '' : 'opacity:.3;pointer-events:none;'}">
            Resetar
          </button>
        </div>
        <div class="prof-fields">
          <div class="field">
            <label class="label" for="nome-${p.id}">Nome</label>
            <input type="text" class="input js-nome" id="nome-${p.id}" data-id="${p.id}"
              placeholder="Dr. Nome Sobrenome" value="${p.nome || ''}">
          </div>
          <div class="field">
            <label class="label" for="esp-${p.id}">Especialidade</label>
            <input type="text" class="input js-esp" id="esp-${p.id}" data-id="${p.id}"
              placeholder="Ex: Clínica Médica" value="${p.especialidade || ''}">
          </div>
        </div>
      </div>
    </div>`;
  }).join('');

  State.profissionais.forEach(p => bindFotoEvents(p.id));
  bindListaEvents();
  atualizarBtnAdd();
}

// ─── DELEGAÇÃO DE EVENTOS NA LISTA ────────────────────────────
const atualizarCardDebounced = debounce(atualizarCard, 80);

function bindListaEvents() {
  const lista = document.getElementById('lista-profissionais');
  if (!lista) return;

  // Remove listener antigo clonando o nó
  const novo = lista.cloneNode(true);
  lista.parentNode.replaceChild(novo, lista);

  novo.addEventListener('click', (e) => {
    const remover = e.target.closest('.js-remover');
    if (remover) { removerProf(remover.dataset.id); return; }

    const minus = e.target.closest('.js-zoom-minus');
    if (minus) { ajustarZoom(minus.dataset.id, -5); return; }

    const plus = e.target.closest('.js-zoom-plus');
    if (plus) { ajustarZoom(plus.dataset.id, +5); return; }

    const reset = e.target.closest('.js-reset');
    if (reset) { resetarFoto(reset.dataset.id); return; }

    const zona = e.target.closest('.foto-zone');
    if (zona) {
      const id = zona.dataset.id;
      const prof = State.profissionais.find(p => p.id === id);
      if (!prof?.fotoDataUrl) document.getElementById(`file-${id}`)?.click();
      return;
    }
  });

  novo.addEventListener('input', (e) => {
    const slider = e.target.closest('.js-zoom-slider');
    if (slider) { setZoom(slider.dataset.id, slider.value); return; }

    const nome = e.target.closest('.js-nome');
    if (nome) { atualizarProf(nome.dataset.id, 'nome', nome.value); return; }

    const esp = e.target.closest('.js-esp');
    if (esp) { atualizarProf(esp.dataset.id, 'especialidade', esp.value); return; }
  });

  // Re-bind foto inputs (não borbulham em delegação cross-element)
  State.profissionais.forEach(p => {
    const fileEl = document.getElementById(`file-${p.id}`);
    if (fileEl) fileEl.onchange = (e) => carregarFoto(p.id, e.target.files[0]);
  });
}

// ─── BIND FOTO (drag na imagem) ───────────────────────────────
function bindFotoEvents(id) {
  const fotoImg = document.getElementById(`img-${id}`);
  if (fotoImg) {
    fotoImg.onmousedown = (e) => {
      e.stopPropagation();
      e.preventDefault();
      iniciarDrag(id, e.clientX, e.clientY);
    };
    fotoImg.ontouchstart = (e) => {
      iniciarDrag(id, e.touches[0].clientX, e.touches[0].clientY);
    };
  }
  atualizarTransform(id);
}

// ─── TRANSFORM ────────────────────────────────────────────────
function atualizarTransform(id) {
  const s = State.imgStates[id];
  if (!s) return;
  const scale = s.zoom / 100;
  const img = document.getElementById(`img-${id}`);
  if (img) {
    img.style.transform = `translate(calc(-50% + ${s.dragX}px), calc(-50% + ${s.dragY}px)) scale(${scale})`;
  }
}

// ─── ZOOM ─────────────────────────────────────────────────────
function setZoom(id, v) {
  const s = State.imgStates[id];
  if (!s) return;
  s.zoom = Math.min(300, Math.max(10, parseInt(v) || 100));
  const slider = document.getElementById(`zoom-${id}`);
  const label  = document.getElementById(`zlabel-${id}`);
  if (slider) slider.value = s.zoom;
  if (label)  label.textContent = s.zoom + '%';
  atualizarTransform(id);
  atualizarCardDebounced();
}

function ajustarZoom(id, delta) {
  const s = State.imgStates[id];
  if (!s) return;
  setZoom(id, s.zoom + delta);
}

// ─── DRAG ─────────────────────────────────────────────────────
function iniciarDrag(id, cx, cy) {
  const s = State.imgStates[id];
  if (!s) return;
  s.dragging = true;
  s.startX = cx; s.startY = cy;
  s.startDragX = s.dragX; s.startDragY = s.dragY;
}

function moverDrag(id, cx, cy) {
  const s = State.imgStates[id];
  if (!s || !s.dragging) return;
  s.dragX = s.startDragX + (cx - s.startX);
  s.dragY = s.startDragY + (cy - s.startY);
  atualizarTransform(id);
  // Card atualiza só ao soltar — evita recalcular a cada pixel
}

function finalizarDrag(id) {
  const s = State.imgStates[id];
  if (s && s.dragging) {
    s.dragging = false;
    atualizarCard(); // atualiza uma vez ao soltar
  }
}

// ─── RESETAR FOTO ─────────────────────────────────────────────
function resetarFoto(id) {
  const prof = State.profissionais.find(p => p.id === id);
  if (!prof?.fotoDataUrl) return;

  const img = new Image();
  img.onload = () => {
    const circleDia = 90;
    const menor = Math.min(img.naturalWidth, img.naturalHeight);
    const zoomIdeal = Math.round((circleDia / menor) * 100);
    State.imgStates[id] = { ...State.estadoPadrao(), zoom: zoomIdeal };
    const slider = document.getElementById(`zoom-${id}`);
    const label  = document.getElementById(`zlabel-${id}`);
    if (slider) slider.value = zoomIdeal;
    if (label)  label.textContent = zoomIdeal + '%';
    atualizarTransform(id);
    atualizarCard();
  };
  img.src = prof.fotoDataUrl;
}

// ─── AÇÕES ────────────────────────────────────────────────────
function adicionarProf() {
  if (State.profissionais.length >= State.MAX) {
    notif(`Máximo de ${State.MAX} profissionais.`, 'aviso');
    return;
  }
  const id = State.gerarId();
  State.profissionais.push({ id, nome: '', especialidade: '', fotoDataUrl: null });
  State.imgStates[id] = State.estadoPadrao();
  renderLista();
  atualizarCard();
  atualizarBtnAdd();
  setTimeout(() => document.getElementById(`prof-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
}

function removerProf(id) {
  State.profissionais = State.profissionais.filter(p => p.id !== id);
  delete State.imgStates[id];
  renderLista();
  atualizarCard();
  atualizarBtnAdd();
}

function atualizarProf(id, campo, valor) {
  const p = State.profissionais.find(p => p.id === id);
  if (p) {
    p[campo] = valor;
    atualizarCardDebounced();
  }
}

function atualizarBtnAdd() {
  const btn = document.getElementById('btn-add-prof');
  if (btn) btn.disabled = State.profissionais.length >= State.MAX;
}

// ─── CARREGAR FOTO ────────────────────────────────────────────
function carregarFoto(id, file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const prof = State.profissionais.find(p => p.id === id);
    if (!prof) return;
    prof.fotoDataUrl = e.target.result;

    const imgTmp = new Image();
    imgTmp.onload = () => {
      const circleDia = 90;
      const menor = Math.min(imgTmp.naturalWidth, imgTmp.naturalHeight);
      const zoomIdeal = Math.round((circleDia / menor) * 100);
      State.imgStates[id] = { ...State.estadoPadrao(), zoom: zoomIdeal };
      renderFotoPreview(id);
      atualizarCard();
    };
    imgTmp.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function renderFotoPreview(id) {
  const ph       = document.getElementById(`ph-${id}`);
  const preview  = document.getElementById(`preview-${id}`);
  const imgEl    = document.getElementById(`img-${id}`);
  const zoomRow  = document.getElementById(`zoom-row-${id}`);
  const zoomLbl  = document.getElementById(`zlabel-${id}`);
  const resetBtn = document.querySelector(`.js-reset[data-id="${id}"]`);
  const prof     = State.profissionais.find(p => p.id === id);
  const s        = State.imgStates[id] || {};

  if (ph)      ph.style.display = 'none';
  if (preview) preview.style.display = 'block';
  if (imgEl && prof?.fotoDataUrl) imgEl.src = prof.fotoDataUrl;
  if (zoomRow) { zoomRow.style.opacity = '1'; zoomRow.style.pointerEvents = 'auto'; }
  if (zoomLbl) { zoomLbl.style.opacity = '1'; zoomLbl.textContent = (s.zoom || 100) + '%'; }
  if (resetBtn) { resetBtn.style.opacity = '1'; resetBtn.style.pointerEvents = 'auto'; }
  const slider = document.getElementById(`zoom-${id}`);
  if (slider) slider.value = s.zoom || 100;

  bindFotoEvents(id);
}

// ─── CARD ─────────────────────────────────────────────────────
function atualizarCard() {
  const wrapper = document.getElementById('card-wrapper');
  if (!wrapper) return;

  const dataVal     = document.getElementById('inp-data')?.value || '';
  const dataFmt     = dataVal ? formatarData(dataVal) : null;
  const turnoLabel  = TURNO_LABELS[State.turnoAtual];
  const turnoIconSm = TURNO_ICONS_SM[State.turnoAtual];
  const profs       = State.profissionais;
  const dateStr     = dataFmt ? `${dataFmt.diaSemana}, ${dataFmt.dia} de ${dataFmt.mes}` : 'Selecione uma data';

  const n           = profs.length || 1;
  const BODY_H      = 547;
  const spacePerItem = BODY_H / n;
  // A partir do 5º profissional, aumenta os fatores de avatar e nome para melhor legibilidade
  const muitosProfissionais = n >= 5;
  const avatarFactor = muitosProfissionais ? 0.70 : 0.52;
  const nomeFactor   = muitosProfissionais ? 0.260 : 0.195;
  const espFactor    = muitosProfissionais ? 0.165 : 0.125;
  const avatarSize  = Math.min(110, Math.max(24, Math.round(spacePerItem * avatarFactor)));
  const nomeSize    = Math.min(22,  Math.max(7,  Math.round(avatarSize * nomeFactor)));
  const espSize     = Math.min(14,  Math.max(5,  Math.round(avatarSize * espFactor)));
  const itemPadV    = Math.min(18,  Math.max(2,  Math.round(spacePerItem * 0.04)));
  const stripeH     = Math.min(40,  Math.max(10, Math.round(avatarSize * 0.45)));
  const dividerSize = Math.min(8,   Math.max(5,  Math.round(6 + (4 - Math.min(n, 4)) * 0.5)));

  const profsHtml = profs.length === 0
    ? `<div class="card-empty">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#B8DEDE" stroke-width="1" style="display:block;margin:0 auto 6px;">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
        Adicione profissionais no painel<br>para visualizar o card.
      </div>`
    : profs.map(p => {
        const s     = State.imgStates[p.id];
        const scale = s ? s.zoom / 100 : 1;
        const dx    = s ? s.dragX : 0;
        const dy    = s ? s.dragY : 0;
        const avatarHtml = p.fotoDataUrl
          ? `<div class="card-prof-avatar">
               <div style="position:absolute;inset:0;overflow:hidden;border-radius:50%;">
                 <img src="${p.fotoDataUrl}"
                   style="position:absolute;top:50%;left:50%;width:auto;height:auto;min-width:100%;min-height:100%;max-width:none;max-height:none;transform-origin:center;transform:translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(${scale});"
                   draggable="false" alt="">
               </div>
             </div>`
          : `<div class="card-prof-avatar">
               <div class="card-prof-avatar-placeholder" style="font-size:${Math.round(avatarSize * 0.4)}px;">
                 ${p.nome ? p.nome.replace(/^(Dr\.|Dra\.|Prof\.)\s*/i, '').charAt(0).toUpperCase() : '?'}
               </div>
             </div>`;

        return `<div class="card-prof-item" style="padding-top:${itemPadV}px;padding-bottom:${itemPadV}px;">
          ${avatarHtml}
          <div class="card-prof-stripe" style="height:${stripeH}px;"></div>
          <div class="card-prof-info">
            <div class="card-prof-nome" style="font-size:${nomeSize}px;">${p.nome || 'Nome do Profissional'}</div>
            <div class="card-prof-esp"  style="font-size:${espSize}px;">${p.especialidade || 'Especialidade'}</div>
          </div>
        </div>`;
      }).join('');

  wrapper.innerHTML = `
    <div class="card-header" style="--avatar-size:${avatarSize}px;">
      <div class="card-header-top">
        <div class="card-header-left">
          <div class="card-agenda-word">Agenda</div>
          <div class="card-agenda-sub">Especialistas que cuidam de você</div>
        </div>
        <div class="card-turno-tag">
          <span class="card-turno-tag-label">Turno</span>
          <span class="card-turno-tag-value">${turnoIconSm}${turnoLabel}</span>
        </div>
      </div>
      <div class="card-date-row">
        <div class="card-date-inner">
          <span class="card-date-label">Data de atendimento</span>
          <span class="card-date-text">${dateStr}</span>
        </div>
      </div>
    </div>
    <div class="card-body" style="--avatar-size:${avatarSize}px;">
      <div class="card-divider">
        <div class="card-divider-line"></div>
        <span class="card-divider-label" style="font-size:${dividerSize}px;">Atendimentos do dia</span>
        <div class="card-divider-line"></div>
      </div>
      <div class="card-profs-list">${profsHtml}</div>
    </div>
    <div class="card-footer">
      <div class="card-footer-left">
        <img src="logo-amar.png" style="width:30%;height:auto;" class="card-footer-logo" alt="Centro Médico AMAR">
      </div>
      <div class="card-footer-right">Agende sua consulta</div>
    </div>`;
}

// ─── DOWNLOAD ─────────────────────────────────────────────────
async function baixarCard() {
  if (!window.html2canvas) { notif('html2canvas não carregado.', 'erro'); return; }
  notif('Gerando imagem em alta qualidade...', 'loading', 0);
  try {
    const wrapper = document.getElementById('card-wrapper');
    if (!wrapper) throw new Error('Card não encontrado');

    const SCALE = 8;
    const shadowOrig = wrapper.style.boxShadow;
    wrapper.style.boxShadow = 'none';

    const rawCanvas = await window.html2canvas(wrapper, {
      scale: SCALE,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#FAF8F5',
      logging: false,
      imageTimeout: 30000,
      onclone: (doc) => {
        // Injeta a fonte no documento clonado e aguarda antes de capturar
        return new Promise((resolve) => {
          const link = doc.createElement('link');
          link.rel = 'stylesheet';
          link.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&display=swap';
          link.onload = resolve;
          link.onerror = resolve; // continua mesmo se fonte falhar
          doc.head.appendChild(link);

          const cw = doc.getElementById('card-wrapper');
          if (cw) {
            cw.style.transform       = 'none';
            cw.style.transformOrigin = 'top left';
            cw.style.boxShadow       = 'none';
            cw.style.border          = 'none';
            cw.style.outline         = 'none';
            cw.style.margin          = '0';
            cw.style.padding         = '0';
            cw.style.width           = '405px';
            cw.style.height          = '720px';
            cw.style.overflow        = 'hidden';
            cw.style.borderRadius    = '0';
            cw.style.fontFamily      = "'Outfit', sans-serif";
          }
          const co = doc.querySelector('.card-outer');
          if (co) { co.style.transform = 'none'; co.style.filter = 'none'; }
        });
      },
    });

    wrapper.style.boxShadow = shadowOrig;

    const final = document.createElement('canvas');
    final.width  = rawCanvas.width;
    final.height = rawCanvas.height;
    const ctx = final.getContext('2d');
    ctx.imageSmoothingEnabled  = true;
    ctx.imageSmoothingQuality  = 'high';
    ctx.drawImage(rawCanvas, 0, 0);

    const data = document.getElementById('inp-data')?.value || 'agenda';
    const a = document.createElement('a');
    a.download = `agenda-amar-${data}.png`;
    a.href = final.toDataURL('image/png');
    a.click();
    notif('Card baixado com máxima qualidade!', 'sucesso', 3000);
  } catch (e) {
    console.error(e);
    notif('Erro ao exportar.', 'erro');
  }
}

// ─── ESCALA DO CARD NA PREVIEW ────────────────────────────────
function escalarCard() {
  const outer = document.querySelector('.card-outer');
  const area  = document.querySelector('.preview-area');
  if (!outer || !area) return;
  const pad    = 40;
  const scaleH = (area.clientHeight - pad) / 720;
  const scaleW = (area.clientWidth  - pad) / 405;
  const scale  = Math.min(scaleH, scaleW, 1);
  outer.style.transform = `scale(${scale})`;
  outer.style.width     = `${405 * scale}px`;
  outer.style.height    = `${720 * scale}px`;
}

// ─── EVENTOS GLOBAIS ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Data
  const inpData = document.getElementById('inp-data');
  inpData.value = dataHoje();
  inpData.addEventListener('input', atualizarCard);

  // Botões
  document.getElementById('btn-add-prof').addEventListener('click', adicionarProf);
  document.getElementById('btn-download').addEventListener('click', baixarCard);

  // Turno
  document.querySelectorAll('.turno-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.turno-btn').forEach(b => b.classList.remove('ativo'));
      btn.classList.add('ativo');
      State.turnoAtual = btn.dataset.turno;
      atualizarCard();
    });
  });

  // Drag global — mouse
  document.addEventListener('mousemove', (e) => {
    State.profissionais.forEach(p => {
      if (State.imgStates[p.id]?.dragging) moverDrag(p.id, e.clientX, e.clientY);
    });
  });
  document.addEventListener('mouseup', () => {
    State.profissionais.forEach(p => finalizarDrag(p.id));
  });

  // Drag global — touch
  document.addEventListener('touchmove', (e) => {
    State.profissionais.forEach(p => {
      if (State.imgStates[p.id]?.dragging) moverDrag(p.id, e.touches[0].clientX, e.touches[0].clientY);
    });
  }, { passive: true });
  document.addEventListener('touchend', () => {
    State.profissionais.forEach(p => finalizarDrag(p.id));
  });

  // Resize
  window.addEventListener('resize', debounce(escalarCard, 100));

  // Init
  renderLista();
  atualizarCard();
  escalarCard();
});