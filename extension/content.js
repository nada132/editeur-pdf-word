/* ═══════════════════════════════════════════════
   PDF PRO SUITE — Extension Chrome/Edge
   Bulle flottante visible sur toutes les pages
═══════════════════════════════════════════════ */

(function () {
  'use strict';

  // Évite double injection
  if (document.getElementById('__pdfpro_host__')) return;

  const EDITOR_URL = 'https://editeuree.netlify.app/';

  /* ── Hôte isolé (Shadow DOM pour ne pas polluer la page) ── */
  const host = document.createElement('div');
  host.id = '__pdfpro_host__';
  host.style.cssText = `
    position: fixed !important;
    bottom: 28px !important;
    right: 28px !important;
    z-index: 2147483647 !important;
    pointer-events: none !important;
  `;
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });

  /* ── Styles encapsulés ── */
  const style = document.createElement('style');
  style.textContent = `
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', system-ui, sans-serif; }

    .bubble-wrap {
      position: relative;
      pointer-events: auto;
      cursor: pointer;
      animation: float 3s ease-in-out infinite;
      transition: filter 0.2s;
    }
    .bubble-wrap:hover { filter: drop-shadow(0 12px 28px rgba(230,57,70,.8)); }
    .bubble-wrap:hover .tooltip { opacity: 1; transform: translateX(-50%) translateY(-6px); }
    .bubble-wrap:hover .ring { transform: scale(1.1); }

    .ring {
      width: 66px;
      height: 66px;
      border-radius: 50%;
      background: conic-gradient(from 0deg, #9b59b6, #3498db, #e63946, #9b59b6);
      padding: 3px;
      transition: transform 0.25s;
      filter: drop-shadow(0 6px 18px rgba(230,57,70,.55));
    }

    .core {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background: linear-gradient(145deg, #e63946, #c1121f);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .core svg {
      width: 30px;
      height: 30px;
    }

    .badge {
      position: absolute;
      top: -4px;
      right: -4px;
      background: #7c3aed;
      color: white;
      font-size: 9px;
      font-weight: 900;
      padding: 2px 5px;
      border-radius: 8px;
      border: 2px solid white;
      letter-spacing: 0.5px;
      pointer-events: none;
    }

    .tooltip {
      position: absolute;
      bottom: 78px;
      left: 50%;
      transform: translateX(-50%) translateY(0);
      background: #0f172a;
      color: white;
      font-size: 12px;
      font-weight: 600;
      padding: 7px 13px;
      border-radius: 8px;
      white-space: nowrap;
      opacity: 0;
      transition: opacity 0.2s, transform 0.2s;
      pointer-events: none;
      box-shadow: 0 4px 16px rgba(0,0,0,.4);
    }
    .tooltip::after {
      content: '';
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      border: 5px solid transparent;
      border-top-color: #0f172a;
    }

    /* Panel latéral */
    .panel {
      position: fixed;
      bottom: 0;
      right: 0;
      width: 420px;
      height: 100vh;
      background: white;
      box-shadow: -4px 0 32px rgba(0,0,0,.25);
      display: flex;
      flex-direction: column;
      transform: translateX(110%);
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      pointer-events: auto;
      border-radius: 12px 0 0 12px;
      overflow: hidden;
    }
    .panel.open {
      transform: translateX(0);
    }

    .panel-header {
      background: #1e293b;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }
    .panel-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      color: white;
      font-size: 14px;
      font-weight: 700;
    }
    .panel-logo {
      width: 28px; height: 28px;
      border-radius: 50%;
      background: linear-gradient(145deg, #e63946, #c1121f);
      display: flex; align-items: center; justify-content: center;
    }
    .panel-badge {
      background: linear-gradient(90deg, #e63946, #c1121f);
      color: white;
      font-size: 9px;
      font-weight: 900;
      padding: 2px 6px;
      border-radius: 6px;
      letter-spacing: .6px;
    }
    .panel-close {
      background: rgba(255,255,255,.1);
      border: none;
      color: #94a3b8;
      width: 28px; height: 28px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 16px;
      display: flex; align-items: center; justify-content: center;
      transition: background .15s, color .15s;
    }
    .panel-close:hover { background: #dc2626; color: white; }

    .panel iframe {
      flex: 1;
      border: none;
      width: 100%;
    }

    .panel-mini-tools {
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      padding: 8px 12px;
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      flex-shrink: 0;
    }
    .mini-btn {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 5px 10px;
      font-size: 11px;
      font-weight: 600;
      color: #334155;
      cursor: pointer;
      text-decoration: none;
      transition: border-color .15s, color .15s;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .mini-btn:hover { border-color: #e63946; color: #e63946; }
    .mini-btn.primary { background: #e63946; color: white; border-color: #e63946; }
    .mini-btn.primary:hover { background: #c1121f; }

    @keyframes float {
      0%,100% { transform: translateY(0); }
      50%      { transform: translateY(-6px); }
    }

    @keyframes ripple {
      0%   { transform: scale(1); opacity: .6; }
      100% { transform: scale(1.8); opacity: 0; }
    }

    .ripple {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      border: 2px solid #e63946;
      animation: ripple 1.8s ease-out infinite;
      pointer-events: none;
    }
    .ripple:nth-child(2) { animation-delay: .9s; }
  `;
  shadow.appendChild(style);

  /* ── HTML de la bulle ── */
  const bubble = document.createElement('div');
  bubble.className = 'bubble-wrap';
  bubble.innerHTML = `
    <div class="ripple"></div>
    <div class="ripple"></div>
    <div class="ring">
      <div class="core">
        <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
          <rect x="6" y="2" width="16" height="24" rx="2" fill="white" opacity=".95"/>
          <path d="M18 2 L22 6 L18 6 Z" fill="#ffcccc"/>
          <rect x="8" y="14" width="10" height="1.5" rx=".75" fill="#e63946" opacity=".7"/>
          <rect x="8" y="17" width="8"  height="1.5" rx=".75" fill="#e63946" opacity=".5"/>
          <text x="11" y="13" fill="#e63946" font-size="5" font-weight="900" font-family="Arial">PDF</text>
        </svg>
      </div>
    </div>
    <div class="badge">PRO</div>
    <div class="tooltip">📄 PDF Pro Suite<br><span style="font-size:10px;opacity:.7">Cliquer pour ouvrir</span></div>
  `;
  shadow.appendChild(bubble);

  /* ── Panel latéral ── */
  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.innerHTML = `
    <div class="panel-header">
      <div class="panel-brand">
        <div class="panel-logo">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="white"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/></svg>
        </div>
        PDF Pro Suite
        <span class="panel-badge">COMPLET</span>
      </div>
      <button class="panel-close" id="closePanel">✕</button>
    </div>

    <div class="panel-mini-tools">
      <a class="mini-btn primary" href="${EDITOR_URL}" target="_blank">↗ Plein écran</a>
      <button class="mini-btn" id="btnCreate">📝 Créer PDF</button>
      <button class="mini-btn" id="btnMerge">🔀 Combiner</button>
      <button class="mini-btn" id="btnCompress">🗜 Compresser</button>
      <button class="mini-btn" id="btnSign">✍️ Signer</button>
    </div>

    <iframe id="pdfFrame" src="${EDITOR_URL}" allow="clipboard-write; clipboard-read"></iframe>
  `;
  shadow.appendChild(panel);

  /* ── État ── */
  let panelOpen = false;

  function openPanel(tool) {
    panelOpen = true;
    panel.classList.add('open');
    host.style.bottom = '0';
    host.style.right = '0';
    // Recharge l'iframe à chaque ouverture → mot de passe toujours demandé
    const frame = shadow.getElementById('pdfFrame');
    const url = EDITOR_URL + (tool ? '#' + tool : '');
    frame.src = 'about:blank';
    setTimeout(() => { frame.src = url; }, 50);
  }

  function closePanel() {
    panelOpen = false;
    panel.classList.remove('open');
    host.style.bottom = '28px';
    host.style.right = '28px';
    // Vide l'iframe à la fermeture pour forcer re-auth à la prochaine ouverture
    shadow.getElementById('pdfFrame').src = 'about:blank';
  }

  bubble.addEventListener('click', () => {
    if (panelOpen) closePanel();
    else openPanel();
  });

  shadow.getElementById('closePanel').addEventListener('click', closePanel);

  /* Mini boutons → ouvrir l'éditeur sur l'outil correspondant */
  function openTool(tool) {
    openPanel(tool);
  }

  shadow.getElementById('btnCreate').onclick   = () => openTool('create');
  shadow.getElementById('btnMerge').onclick    = () => openTool('merge');
  shadow.getElementById('btnCompress').onclick = () => openTool('compress');
  shadow.getElementById('btnSign').onclick     = () => openTool('fill-sign');

  /* Fermer panel si clic en dehors */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && panelOpen) closePanel();
  });

})();
