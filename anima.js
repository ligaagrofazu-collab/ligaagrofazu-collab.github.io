/* AGRO FAZU — animações do site
   Desenha os sulcos da logo, revela o conteúdo ao rolar e deixa botões e topo reagirem ao mouse.
   Todas as animações ficam ligadas para todos (decisão da liga).
   Modo calmo, sem parallax, faixa correndo nem botões que seguem o mouse: só com ?movimento=calmo no endereço. */
(function () {
  var calmo = location.search.indexOf('movimento=calmo') > -1;
  var reduzir = false; /* animações suaves valem para todos */
  var mouseFino = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var raiz = document.documentElement;
  raiz.classList.add('anima');
  if (calmo) raiz.classList.add('calmo');

  /* ---------- Sulcos em SVG ---------- */
  var SULCOS = [
    ['M-40 250 Q 300 120 700 60', '#F4F7F4', 30],
    ['M-40 312 Q 300 172 700 122', '#E07A0B', 36],
    ['M-40 378 Q 300 228 700 190', '#F4F7F4', 30],
    ['M-40 448 Q 300 290 700 262', '#E07A0B', 40],
    ['M-40 524 Q 300 356 700 340', '#F4F7F4', 32],
    ['M-40 606 Q 300 428 700 424', '#E07A0B', 44],
    ['M-40 694 Q 300 506 700 514', '#F4F7F4', 34]
  ];
  var NS = 'http://www.w3.org/2000/svg';

  function criarCampo(alvo, desenharAgora) {
    var caixa = document.createElement('div');
    caixa.className = 'campo';
    caixa.setAttribute('aria-hidden', 'true');
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 640 520');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    var grupos = [];
    SULCOS.forEach(function (s) {
      var g = document.createElementNS(NS, 'g');
      var p = document.createElementNS(NS, 'path');
      p.setAttribute('d', s[0]);
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', s[1]);
      p.setAttribute('stroke-width', s[2]);
      g.appendChild(p);
      svg.appendChild(g);
      grupos.push(g);
    });
    caixa.appendChild(svg);
    alvo.insertBefore(caixa, alvo.firstChild);
    alvo.classList.add('tem-campo');

    var desenhar = function () {
      if (reduzir) return;
      grupos.forEach(function (g, i) {
        var p = g.firstChild, L = p.getTotalLength();
        p.style.strokeDasharray = L;
        p.animate([{ strokeDashoffset: L }, { strokeDashoffset: 0 }],
          { duration: 1500, delay: 120 + i * 110, easing: 'cubic-bezier(.2,.75,.15,1)', fill: 'both' });
      });
    };
    if (desenharAgora) desenhar();
    return { caixa: caixa, grupos: grupos, desenhar: desenhar };
  }

  var topo = document.querySelector('.topo');
  var campoTopo = topo ? criarCampo(topo, true) : null;
  var fotos = [].map.call(document.querySelectorAll('.foto'), function (f) {
    var c = criarCampo(f, false);
    c.foto = f;
    return c;
  });

  /* ---------- Título palavra por palavra ---------- */
  var h1 = topo && topo.querySelector('h1');
  if (h1 && !reduzir) {
    var texto = h1.textContent.trim();
    h1.setAttribute('aria-label', texto);
    h1.innerHTML = texto.split(/\s+/).map(function (w, i) {
      return '<span class="palavra" aria-hidden="true" style="--i:' + i + '"><span>' + w + '</span></span>';
    }).join(' ');
    [].forEach.call(topo.querySelectorAll('.texto>:not(h1)'), function (el, i) { el.style.setProperty('--i', i); });
  }

  /* ---------- Faixa surpresa ---------- */
  var trilho = document.querySelector('.faixa-trilho');
  if (trilho) trilho.innerHTML += trilho.innerHTML; /* duas cópias para dar a volta sem emenda */

  /* ---------- Barra de leitura ---------- */
  var cabecalho = document.querySelector('.cabecalho');
  var barra = null;
  if (cabecalho) {
    barra = document.createElement('div');
    barra.className = 'progresso';
    barra.setAttribute('aria-hidden', 'true');
    cabecalho.appendChild(barra);
  }

  /* ---------- Conteúdo aparece ao rolar ---------- */
  var SELETORES = 'main section h2, .intro, .cartao, .pessoa, .lista-check li, .requisitos>div, .etapa, .data, .bloco, .foto, .chamada .caixa>*, .final .caixa>*, .diretoria>p, main section .mais';
  /* Revela tudo o que já chegou à tela, inclusive o que passou direto numa rolagem rápida ou num pulo de âncora */
  var pendentes = [];
  if (!reduzir) {
    pendentes = [].slice.call(document.querySelectorAll(SELETORES)).filter(function (el) { return !el.closest('.topo'); });
    pendentes.forEach(function (el) {
      var irmaos = [].filter.call(el.parentNode.children, function (x) { return pendentes.indexOf(x) > -1; });
      el.style.setProperty('--i', Math.min(irmaos.indexOf(el), 8));
      el.classList.add('revelar');
    });
  }
  function revelarChegados() {
    if (!pendentes.length) return;
    var limite = window.innerHeight * 0.92;
    pendentes = pendentes.filter(function (el) {
      if (el.getBoundingClientRect().top > limite) return true;
      el.classList.add('visivel');
      fotos.forEach(function (f) { if (f.foto === el) f.desenhar(); });
      return false;
    });
  }
  revelarChegados();
  window.addEventListener('scroll', revelarChegados, { passive: true });
  window.addEventListener('resize', revelarChegados);

  /* ---------- Mouse: luz no topo, sulcos com profundidade, botões atraídos ---------- */
  var mx = 0, my = 0;
  if (mouseFino && !calmo) {
    if (topo) topo.addEventListener('pointermove', function (e) {
      var r = topo.getBoundingClientRect();
      topo.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      topo.style.setProperty('--my', (e.clientY - r.top) + 'px');
      mx = (e.clientX - r.left) / r.width * 2 - 1;
      my = (e.clientY - r.top) / r.height * 2 - 1;
    });
    if (topo) topo.addEventListener('pointerleave', function () { mx = 0; my = 0; });

    fotos.forEach(function (f) {
      f.foto.addEventListener('pointermove', function (e) {
        var r = f.foto.getBoundingClientRect();
        f.mx = (e.clientX - r.left) / r.width * 2 - 1;
        f.my = (e.clientY - r.top) / r.height * 2 - 1;
      });
      f.foto.addEventListener('pointerleave', function () { f.mx = 0; f.my = 0; });
    });

    [].forEach.call(document.querySelectorAll('.botao'), function (b) {
      b.innerHTML = '<span class="rotulo">' + b.innerHTML + '</span>';
      var rot = b.firstChild;
      b.addEventListener('pointermove', function (e) {
        var r = b.getBoundingClientRect();
        var dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        b.style.transform = 'translate(' + dx * 0.18 + 'px,' + dy * 0.3 + 'px)';
        rot.style.transform = 'translate(' + dx * 0.08 + 'px,' + dy * 0.12 + 'px)';
      });
      b.addEventListener('pointerleave', function () { b.style.transform = ''; rot.style.transform = ''; });
    });
  }

  /* ---------- Menu do celular: estado para leitores de tela, fecha com Esc, toque fora e teclado ---------- */
  var caixaMenu = document.getElementById('menu-celular');
  var botaoMenu = document.querySelector('.abrir-menu');
  if (caixaMenu && botaoMenu) {
    var sincronizarMenu = function () {
      botaoMenu.setAttribute('aria-expanded', caixaMenu.checked ? 'true' : 'false');
      botaoMenu.setAttribute('aria-label', caixaMenu.checked ? 'Fechar o menu' : 'Abrir o menu');
    };
    caixaMenu.addEventListener('change', sincronizarMenu);
    botaoMenu.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); caixaMenu.checked = !caixaMenu.checked; sincronizarMenu(); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && caixaMenu.checked) { caixaMenu.checked = false; sincronizarMenu(); botaoMenu.focus(); }
    });
    document.addEventListener('click', function (e) {
      if (caixaMenu.checked && !e.target.closest('.cabecalho')) { caixaMenu.checked = false; sincronizarMenu(); }
    });
    sincronizarMenu();
  }

  /* ---------- Cartões que abrem ----------
     Um cartão com <div class="cartao-mais"> ganha um botão no título.
     Ao tocar no cartão, o conteúdo extra se abre; os outros cartões do mesmo grupo se fecham.
     Sem este script, o conteúdo extra simplesmente aparece aberto. */
  [].forEach.call(document.querySelectorAll('.cartao'), function (cartao, n) {
    var mais = cartao.querySelector('.cartao-mais');
    var titulo = cartao.querySelector('h3');
    if (!mais || !titulo) return;
    mais.id = mais.id || 'cartao-mais-' + n;
    var botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'cartao-alternar';
    botao.setAttribute('aria-expanded', 'false');
    botao.setAttribute('aria-controls', mais.id);
    botao.innerHTML = '<span>' + titulo.innerHTML + '</span><span class="sinal" aria-hidden="true"></span>';
    titulo.innerHTML = '';
    titulo.appendChild(botao);
    cartao.classList.add('abre');
    mais.inert = true;

    cartao.addEventListener('click', function (e) {
      if (e.target.closest('a')) return; /* links de dentro funcionam normalmente */
      if (window.getSelection && String(window.getSelection()).length) return; /* quem está selecionando texto não fecha o cartão */
      var abrir = !cartao.classList.contains('aberto');
      [].forEach.call(cartao.parentNode.querySelectorAll('.cartao.aberto'), function (outro) {
        if (outro !== cartao) alternar(outro, false);
      });
      alternar(cartao, abrir);
    });
  });
  function alternar(cartao, abrir) {
    cartao.classList.toggle('aberto', abrir);
    cartao.querySelector('.cartao-alternar').setAttribute('aria-expanded', abrir);
    cartao.querySelector('.cartao-mais').inert = !abrir;
  }

  /* ---------- Laço de animação: rolagem, sulcos e faixa ---------- */
  var ultimoY = window.scrollY, velocidade = 0, posFaixa = 0;
  var sx = 0, sy = 0; /* mouse suavizado */
  function quadro() {
    var y = window.scrollY;
    var delta = y - ultimoY; ultimoY = y;
    velocidade += (delta - velocidade) * 0.12;

    if (barra) {
      var total = document.documentElement.scrollHeight - window.innerHeight;
      barra.style.setProperty('--p', total > 0 ? Math.min(y / total, 1) : 0);
    }

    if (!calmo) {
      sx += (mx - sx) * 0.07; sy += (my - sy) * 0.07;
      if (campoTopo && y < window.innerHeight * 1.2) {
        campoTopo.grupos.forEach(function (g, i) {
          var prof = i + 1;
          g.setAttribute('transform', 'translate(' + (sx * prof * 4) + ' ' + (sy * prof * 3 - y * (0.05 + i * 0.035)) + ')');
        });
      }
      fotos.forEach(function (f) {
        f.sx = (f.sx || 0) + ((f.mx || 0) - (f.sx || 0)) * 0.08;
        f.sy = (f.sy || 0) + ((f.my || 0) - (f.sy || 0)) * 0.08;
        f.grupos.forEach(function (g, i) {
          g.setAttribute('transform', 'translate(' + (f.sx * (i + 1) * 5) + ' ' + (f.sy * (i + 1) * 4) + ')');
        });
      });
      if (trilho) {
        var metade = trilho.scrollWidth / 2;
        posFaixa -= 0.6 + Math.abs(velocidade) * 0.5;
        if (velocidade < -0.5) posFaixa += Math.abs(velocidade) * 1.0; /* rolando para cima, a faixa volta */
        if (metade > 0) { posFaixa = posFaixa % metade; if (posFaixa > 0) posFaixa -= metade; }
        trilho.style.transform = 'translate3d(' + posFaixa + 'px,0,0)';
      }
    }
    requestAnimationFrame(quadro);
  }
  requestAnimationFrame(quadro);
})();
