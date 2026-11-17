/* AGRO FAZU — lavoura interativa da página inicial
   Fileiras de soja que seguem as curvas dos sulcos da logo. As plantas balançam com o vento
   e se inclinam quando o mouse (ou o dedo) passa por elas, voltando devagar ao lugar.
   Desenhado no próprio navegador (canvas), sem imagens. Para quando sai da tela.
   Modo calmo (?movimento=calmo): a lavoura fica parada. */
(function () {
  var caixa = document.querySelector('.lavoura');
  var tela = document.getElementById('lavoura');
  if (!caixa || !tela || !tela.getContext) return;
  var ctx = tela.getContext('2d');
  var calmo = location.search.indexOf('movimento=calmo') > -1;

  var COR = {
    solo: '#E07A0B',        // laranja dos sulcos da logo
    soloSombra: '#B85F05',
    sulco: '#F4F7F4',       // linha clara entre as fileiras, como na logo
    caule: '#2E6B3A',
    folha: ['#6FB45E', '#86C46B', '#5EA352', '#9BD07D'],
    nervura: 'rgba(15,61,34,.35)'
  };

  var W = 0, H = 0, dpr = 1;
  var fileiras = [];
  var plantas = [];

  // Ponteiro: posição e velocidade suavizada
  var mouse = { x: -9999, y: -9999, vx: 0, vy: 0, ativo: false, ultimo: 0 };

  function aleatorio(semente) {
    var s = semente % 2147483647; if (s <= 0) s += 2147483646;
    return function () { s = s * 16807 % 2147483647; return (s - 1) / 2147483646; };
  }

  // Fileiras em perspectiva, como no selo da logo: saem largas de baixo e se afunilam,
  // curvando, até um ponto de fuga no alto à direita. t = 0 perto (embaixo), t = 1 no ponto de fuga.
  var PF = { x: 0, y: 0 };
  function pontoCurva(f, t) {
    var u = 1 - t;
    return { x: u * u * f.x0 + 2 * u * t * f.cx + t * t * PF.x, y: u * u * f.y0 + 2 * u * t * f.cy + t * t * PF.y };
  }
  function normal(f, t) {
    var a = pontoCurva(f, Math.max(0, t - 0.01)), b = pontoCurva(f, Math.min(1, t + 0.01));
    var dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
    return { x: -dy / l, y: dx / l };
  }
  // Escala da perspectiva: 1 perto, 0 no ponto de fuga. Linear, para a largura das fileiras
  // diminuir no mesmo ritmo que a distância entre elas (fileiras paralelas, que nunca se encostam).
  function escala(t) { return 1 - t; }

  function montar() {
    var r = caixa.getBoundingClientRect();
    W = Math.max(320, Math.round(r.width));
    H = Math.round(r.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    tela.width = Math.round(W * dpr); tela.height = Math.round(H * dpr);
    tela.style.width = W + 'px'; tela.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (!carimbos) criarCarimbos();
    var estreita = W < 700;
    PF = { x: W * (estreita ? 1.25 : 1.12), y: -H * 0.32 };
    var rnd = aleatorio(20261117);
    var n = estreita ? 8 : 12;
    // Fileiras com a mesma distância entre si, como as linhas de uma plantadeira.
    // O ponto de controle de todas é deslocado igual, então elas ficam paralelas em perspectiva.
    var inicio = -W * (estreita ? 0.95 : 0.75), fimX = W * (estreita ? 1.05 : 0.95);
    var espaco = (fimX - inicio) / (n - 1);
    fileiras = []; plantas = [];
    for (var i = 0; i < n; i++) {
      var x0 = inicio + i * espaco;
      fileiras.push({
        x0: x0, y0: H * 1.08,
        cx: x0 * 0.5 + PF.x * 0.5 - W * 0.10, cy: H * (estreita ? 0.30 : 0.46),
        larg: espaco * 0.5,
        indice: i
      });
    }
    // Pontos de plantio: os mesmos t em todas as fileiras, então as plantas também ficam
    // alinhadas de uma fileira para a outra. Espaçamento igual no chão (menor na tela com a distância).
    var meio = fileiras[Math.floor(n / 2)];
    var passoPerto = estreita ? 30 : 38;
    var pontos = [];
    for (var t = 0.035; t < 0.86;) {
      pontos.push(t);
      var a = pontoCurva(meio, t), b = pontoCurva(meio, t + 0.001);
      var velTela = Math.hypot(b.x - a.x, b.y - a.y) / 0.001;
      t += passoPerto * escala(t) / velTela;
    }
    for (var fi = 0; fi < n; fi++) {
      var f = fileiras[fi];
      for (var k = 0; k < pontos.length; k++) {
        var tt = pontos[k], p = pontoCurva(f, tt), s = escala(tt);
        if (p.x < -40 || p.x > W + 40 || p.y < -40 || p.y > H + 60) continue;
        var corI = Math.floor(rnd() * COR.folha.length), lado = rnd() < 0.5 ? -1 : 1;
        var nFolhas = s > 0.45 ? 3 + Math.floor(rnd() * 2) : 3;
        plantas.push({
          x: p.x,                                   // exatamente sobre a linha
          y: p.y,
          h: (10 + 60 * s) * (0.94 + rnd() * 0.12),  // altura quase igual, como um plantio uniforme
          prof: s,
          ang: 0, vel: 0,
          fase: rnd() * Math.PI * 2,
          carimbo: carimbos[corI + '-' + nFolhas + '-' + lado]
        });
      }
    }
    // As de longe primeiro, as de perto por cima
    plantas.sort(function (a, b) { return a.y - b.y; });
    desenharSolo();
    // Usado só para conferir o comportamento (testes), não muda nada na página
    caixa.estadoLavoura = { plantas: plantas, passo: function (dt) { atualizar(dt); desenhar(); } };
  }

  function desenharFileira(f) {
    // Solo da fileira: faixa que vai afinando até o ponto de fuga
    var lados = [[], []];
    for (var k = 0; k <= 70; k++) {
      // A distância perpendicular até a fileira vizinha é espaço × escala × |normal.x|
      // (as fileiras só diferem no x); a faixa ocupa metade dela, então nunca encosta.
      var t = k / 70, p = pontoCurva(f, t), nn = normal(f, t), m = f.larg * escala(t) * Math.abs(nn.x) / 2;
      lados[0].push({ x: p.x + nn.x * m, y: p.y + nn.y * m });
      lados[1].push({ x: p.x - nn.x * m, y: p.y - nn.y * m });
    }
    ctx.beginPath();
    lados[0].forEach(function (q, i) { if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y); });
    for (var j = lados[1].length - 1; j >= 0; j--) ctx.lineTo(lados[1][j].x, lados[1][j].y);
    ctx.closePath();
    ctx.fillStyle = COR.solo; ctx.fill();
    // Borda sombreada de um lado e sulco claro do outro, como na logo
    ctx.lineJoin = 'round';
    ctx.beginPath(); lados[1].forEach(function (q, i) { if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y); });
    ctx.strokeStyle = COR.soloSombra; ctx.lineWidth = Math.max(1.5, f.larg * 0.08); ctx.stroke();
    ctx.beginPath(); lados[0].forEach(function (q, i) { if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y); });
    ctx.strokeStyle = COR.sulco; ctx.lineWidth = Math.max(1.5, f.larg * 0.06); ctx.stroke();
  }

  // Folha de soja: oval pontuda, presa pelo pecíolo
  function folha(g, x, y, comp, larg, ang, cor) {
    g.save(); g.translate(x, y); g.rotate(ang);
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(larg, -comp * 0.45, 0, -comp);
    g.quadraticCurveTo(-larg, -comp * 0.45, 0, 0);
    g.fillStyle = cor; g.fill();
    g.beginPath(); g.moveTo(0, -comp * 0.08); g.lineTo(0, -comp * 0.85);
    g.strokeStyle = COR.nervura; g.lineWidth = 0.8; g.stroke();
    g.restore();
  }

  // Desenha uma planta em pé, com a base em (x, y). Usado só para fazer os "carimbos".
  function desenharPlantaEmPe(g, x, y, h, folhas, lado, cor) {
    g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - h);
    g.strokeStyle = COR.caule; g.lineWidth = 3; g.lineCap = 'round'; g.stroke();
    var comp = h * 0.42, larg = comp * 0.42;
    // Folhas ao longo do caule, alternando os lados
    for (var i = 0; i < folhas; i++) {
      var t = 0.45 + i * (0.55 / folhas);
      var l = (i % 2 === 0 ? 1 : -1) * lado;
      folha(g, x, y - h * t, comp * (0.75 + 0.25 * t), larg, l * (0.75 - t * 0.35), cor);
    }
    // Trio de folhas no topo (folha de soja é trifoliolada)
    folha(g, x, y - h, comp, larg, -0.55, cor);
    folha(g, x, y - h, comp * 1.1, larg, 0, cor);
    folha(g, x, y - h, comp, larg, 0.55, cor);
  }

  // Carimbos: cada tipo de planta (cor x quantidade de folhas x lado) é desenhado uma vez só,
  // em alta resolução. A cada quadro a planta é só o carimbo, girado e no tamanho certo.
  var ALTURA_CARIMBO = 80, RES_CARIMBO = 2.5;
  var carimbos = null;
  function criarCarimbos() {
    carimbos = {};
    var w = ALTURA_CARIMBO * 1.3, h = ALTURA_CARIMBO * 1.55, ax = w / 2, ay = h - 4;
    for (var c = 0; c < COR.folha.length; c++) for (var f = 3; f <= 4; f++) for (var l = -1; l <= 1; l += 2) {
      var tela2 = document.createElement('canvas');
      tela2.width = Math.ceil(w * RES_CARIMBO); tela2.height = Math.ceil(h * RES_CARIMBO);
      var g = tela2.getContext('2d');
      g.scale(RES_CARIMBO, RES_CARIMBO);
      desenharPlantaEmPe(g, ax, ay, ALTURA_CARIMBO, f, l, COR.folha[c]);
      carimbos[c + '-' + f + '-' + l] = { tela: tela2, w: w, h: h, ax: ax, ay: ay };
    }
  }

  // Solo: as fileiras não se mexem, então ficam guardadas numa imagem, refeita só ao mudar o tamanho
  var solo = null;
  function desenharSolo() {
    solo = solo || document.createElement('canvas');
    solo.width = tela.width; solo.height = tela.height;
    var g = solo.getContext('2d');
    var antigo = ctx; ctx = g;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (var i = 0; i < fileiras.length; i++) desenharFileira(fileiras[i]);
    ctx = antigo;
  }

  function desenhar() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, tela.width, tela.height);
    ctx.drawImage(solo, 0, 0);
    // Plantas de longe para perto: carimbo girado em torno da base
    for (var k = 0; k < plantas.length; k++) {
      var p = plantas[k], cb = p.carimbo, e = p.h / ALTURA_CARIMBO * dpr;
      var cs = Math.cos(p.ang) * e, sn = Math.sin(p.ang) * e;
      ctx.setTransform(cs, sn, -sn, cs, p.x * dpr, p.y * dpr);
      ctx.drawImage(cb.tela, -cb.ax, -cb.ay, cb.w, cb.h);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  var tempo = 0;
  function atualizar(dt) {
    tempo += dt;
    // A velocidade do ponteiro some aos poucos quando ele para
    mouse.vx *= 0.86; mouse.vy *= 0.86;
    var raio = Math.max(110, W * 0.11);
    for (var i = 0; i < plantas.length; i++) {
      var p = plantas[i];
      // Vento: uma onda que atravessa a lavoura da esquerda para a direita
      var vento = 0.07 * Math.sin(tempo * 1.4 - p.x * 0.011 + p.fase * 0.25) + 0.03 * Math.sin(tempo * 2.7 + p.fase);
      var alvo = vento;
      if (mouse.ativo) {
        var dx = p.x - mouse.x, dy = (p.y - p.h * 0.5) - mouse.y;
        var d = Math.sqrt(dx * dx + dy * dy);
        // Plantas longe são pequenas: o alcance do ponteiro acompanha a perspectiva
        if (d < raio * (0.45 + 0.55 * p.prof)) {
          var forca = 1 - d / (raio * (0.45 + 0.55 * p.prof)); forca *= forca;
          // Empurra na direção em que a mão passa e afasta um pouco do ponteiro
          p.vel += forca * (mouse.vx * 0.0065 + (dx >= 0 ? 1 : -1) * 0.03);
        }
      }
      // Mola que traz a planta de volta, com amortecimento
      p.vel += (alvo - p.ang) * 0.05;
      p.vel *= 0.88;
      p.ang += p.vel;
      if (p.ang > 1.05) { p.ang = 1.05; p.vel *= -0.3; }
      if (p.ang < -1.05) { p.ang = -1.05; p.vel *= -0.3; }
    }
  }

  // Laço de animação: só roda com a lavoura visível e a aba aberta
  var visivel = false, rodando = false, antes = 0;
  function quadro(agora) {
    if (!visivel || document.hidden) { rodando = false; return; }
    var dt = Math.min(0.05, (agora - antes) / 1000 || 0.016); antes = agora;
    atualizar(dt); desenhar();
    requestAnimationFrame(quadro);
  }
  function ligar() { if (calmo || rodando || !visivel || document.hidden) return; rodando = true; antes = performance.now(); requestAnimationFrame(quadro); }

  // Ponteiro (mouse, caneta ou dedo)
  var dica = caixa.querySelector('.lavoura-dica');
  function mover(e) {
    var r = tela.getBoundingClientRect();
    var x = e.clientX - r.left, y = e.clientY - r.top;
    var agora = performance.now();
    if (mouse.ativo && agora - mouse.ultimo < 120) {
      var dt = Math.max(8, agora - mouse.ultimo);
      mouse.vx = mouse.vx * 0.5 + ((x - mouse.x) / dt * 16) * 0.5;
      mouse.vy = mouse.vy * 0.5 + ((y - mouse.y) / dt * 16) * 0.5;
    }
    mouse.x = x; mouse.y = y; mouse.ativo = true; mouse.ultimo = agora;
    if (dica && !dica.classList.contains('some')) dica.classList.add('some');
  }
  function sair() { mouse.ativo = false; mouse.x = mouse.y = -9999; }
  tela.addEventListener('pointermove', mover);
  tela.addEventListener('pointerdown', mover);
  tela.addEventListener('pointerleave', sair);
  tela.addEventListener('pointercancel', sair);
  tela.addEventListener('pointerup', function (e) { if (e.pointerType !== 'mouse') sair(); });

  // Texto da dica conforme o aparelho
  if (dica && window.matchMedia('(hover: none)').matches) dica.textContent = 'Passe o dedo pela lavoura';
  if (dica && calmo) dica.hidden = true;

  // Liga e desliga conforme a lavoura entra e sai da tela
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { visivel = es[0].isIntersecting; if (visivel) ligar(); }, { rootMargin: '80px' }).observe(caixa);
  } else { visivel = true; }
  document.addEventListener('visibilitychange', ligar);

  var espera;
  function redimensionar() { montar(); desenhar(); }
  if ('ResizeObserver' in window) {
    var larguraAnterior = 0;
    new ResizeObserver(function () {
      var w = Math.round(caixa.getBoundingClientRect().width);
      if (w === larguraAnterior) return; larguraAnterior = w;
      clearTimeout(espera); espera = setTimeout(redimensionar, 80);
    }).observe(caixa);
  } else { window.addEventListener('resize', function () { clearTimeout(espera); espera = setTimeout(redimensionar, 120); }); }

  montar(); desenhar(); ligar();
})();
