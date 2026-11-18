/* AGRO FAZU — pasto interativo da página Produtores e empresas
   Bois Nelore pastando. Quando o mouse (ou o dedo) chega perto, eles levantam a cabeça e olham;
   se ele passa por cima, o boi se afasta alguns passos. Um clique (ou toque) no pasto deixa um
   punhado de sal, e os bois mais perto vão até lá lamber. Um clique no cocho serve ração, e os bois
   vêm comer dos dois lados dele. Dá para pegar um boi, levantar, levar para outro lugar e soltar.
   O capim balança com o vento.
   Desenhado no próprio navegador (canvas), sem imagens. Para quando sai da tela.
   Modo calmo (?movimento=calmo): o pasto fica parado. */
(function () {
  var caixa = document.querySelector('.pasto');
  var tela = document.getElementById('pasto');
  if (!caixa || !tela || !tela.getContext) return;
  var ctx = tela.getContext('2d');
  var calmo = location.search.indexOf('movimento=calmo') > -1;

  var COR = {
    mata: '#0F3D22',
    capimLonge: '#23602F',
    capimPerto: '#4A9242',
    tufo: ['#5FA650', '#76B95E', '#4F9A47', '#8CC56E'],
    tufoEscuro: '#3C8340',
    mourao: '#6E4420',
    arame: 'rgba(244,247,244,.42)',
    arvore: '#1B5530',
    tronco: '#3A2A17',
    boiSombra: '#CCCBC2',
    rabo: '#D4D3CA',
    contorno: 'rgba(30,45,32,.32)',
    dobra: 'rgba(30,45,32,.2)',
    olheira: '#6B6A63',
    boiPerna: '#DEDDD4',
    boiLonge: '#B9B8AE',
    touro: '#A9A8A0',
    touroPaleta: '#C4C3BA',
    touroCabeca: '#D5D4CB',
    casco: '#33322E',
    chifre: '#4A463D',
    focinho: '#57564F',
    olho: '#1E1E1C',
    cocho: '#9A6332',
    cochoClaro: '#B47A42',
    cochoEscuro: '#6A4120',
    cochoDentro: '#3E2814',
    racao: '#C9A35B',
    racaoEscura: '#9C7638',
    racaoClara: '#D9BA74',
    sal: '#FBFBF7',
    salSombra: '#D9D8D1'
  };

  var W = 0, H = 0, dpr = 1, HOR = 0, Y_MIN = 0, Y_MAX = 0, L = 110, estreita = false;
  var tufos = [], tufosFixos = [], bois = [], montes = [], cocho = null;
  var mouse = { x: -9999, y: -9999, vx: 0, vy: 0, ativo: false, ultimo: 0 };
  var tempo = 0;

  function aleatorio(semente) {
    var s = semente % 2147483647; if (s <= 0) s += 2147483646;
    return function () { s = s * 16807 % 2147483647; return (s - 1) / 2147483646; };
  }
  function limitar(v, a, b) { return v < a ? a : v > b ? b : v; }

  // Perspectiva: tudo fica menor perto do horizonte (1 embaixo, perto de quem olha)
  function escala(y) { return 0.26 + 0.74 * limitar((y - HOR) / (H - HOR), 0, 1.1); }
  // Tamanho de 1 "unidade" do boi na tela; o boi tem cerca de 100 unidades de comprimento
  function unidade(b) { return escala(b.y) * L / 100 * b.tam; }

  function montar() {
    var r = caixa.getBoundingClientRect();
    W = Math.max(320, Math.round(r.width));
    H = Math.round(r.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    tela.width = Math.round(W * dpr); tela.height = Math.round(H * dpr);
    tela.style.width = W + 'px'; tela.style.height = H + 'px';

    estreita = W < 700;
    HOR = Math.round(H * (estreita ? 0.18 : 0.2));
    Y_MIN = HOR + (H - HOR) * 0.26;
    Y_MAX = H - 10;
    L = estreita ? 82 : Math.min(124, 70 + W * 0.035);

    if (!carimbos) criarCarimbos();
    criarCocho();
    montarTufos();
    criarBois();
    montes = [];
    desenharFundo();
    // Usado só para conferir o comportamento (testes), não muda nada na página
    caixa.estadoPasto = {
      bois: bois, tufos: tufos,
      montes: function () { return montes; },
      passo: function (dt) { atualizar(dt); desenhar(); },
      sal: darSal,
      cocho: function () { return cocho; },
      servir: servirRacao,
      pegar: function (b, x, y) { pegar(b, { x: x, y: y }, { pointerId: 0 }); },
      mover: function (x, y) { if (segurando) { segurando.alvoX = x + segurando.dx; segurando.alvoY = y + segurando.dy; } },
      largar: largar,
      mouse: function (x, y) { mouse.x = x; mouse.y = y; mouse.ativo = true; mouse.ultimo = performance.now(); }
    };
  }

  /* ---------- Fundo: céu escuro, árvores, cerca e o chão do pasto (fica guardado numa imagem) ---------- */
  var fundo = null;
  function desenharFundo() {
    fundo = fundo || document.createElement('canvas');
    fundo.width = tela.width; fundo.height = tela.height;
    var g = fundo.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = COR.mata; g.fillRect(0, 0, W, H);

    // Chão: nasce do mesmo verde-escuro do topo, sem linha no horizonte
    var gr = g.createLinearGradient(0, HOR - 18, 0, H);
    gr.addColorStop(0, COR.mata);
    gr.addColorStop(0.09, COR.capimLonge);
    gr.addColorStop(1, COR.capimPerto);
    g.fillStyle = gr; g.fillRect(0, HOR - 18, W, H - HOR + 18);

    // Faixas de roçada que se afunilam no horizonte, lembrando os sulcos da logo
    var pf = { x: W * 0.62, y: HOR - (H - HOR) * 0.9 };
    var luz = g.createLinearGradient(0, HOR, 0, H);
    luz.addColorStop(0, 'rgba(255,255,255,0)'); luz.addColorStop(1, 'rgba(255,255,255,.055)');
    g.save(); g.beginPath(); g.rect(0, HOR, W, H - HOR); g.clip();
    var nF = estreita ? 7 : 11, larg = W * 1.6 / nF;
    g.fillStyle = luz;
    for (var i = 0; i < nF; i += 2) {
      var xa = -W * 0.3 + i * larg;
      g.beginPath(); g.moveTo(pf.x, pf.y); g.lineTo(xa, H); g.lineTo(xa + larg, H); g.closePath(); g.fill();
    }
    g.restore();

    // Textura: milhares de risquinhos de capim, mais finos ao longe
    var r = aleatorio(4242), n = Math.round(W * (H - HOR) / 85);
    var claro = new Path2D(), escuro = new Path2D();
    for (var k = 0; k < n; k++) {
      var y = HOR + 6 + Math.pow(r(), 0.8) * (H - HOR), x = r() * W, s = escala(y), h = (3 + r() * 5) * s;
      var alvo = r() < 0.5 ? escuro : claro;
      alvo.moveTo(x, y); alvo.lineTo(x + (r() - 0.5) * h * 0.9, y - h);
    }
    g.lineCap = 'round'; g.lineWidth = estreita ? 1.1 : 1.3;
    g.strokeStyle = 'rgba(10,40,20,.26)'; g.stroke(escuro);
    g.strokeStyle = 'rgba(170,220,140,.2)'; g.stroke(claro);

    // Árvores do cerrado no horizonte e a cerca
    var arvores = estreita ? [[0.1, 0.9], [0.8, 1.15]] : [[0.07, 1], [0.4, 0.72], [0.84, 1.2]];
    for (var a = 0; a < arvores.length; a++) arvore(g, W * arvores[a][0], HOR + 3, (estreita ? 52 : 78) * arvores[a][1]);
    // Capim do fundo, parado (o que fica atrás da cerca vem antes dela)
    var yCerca = HOR + (H - HOR) * 0.1, cercaFeita = false;
    for (var f = 0; f < tufosFixos.length; f++) {
      var tf = tufosFixos[f], cb = tf.carimbo, e = tf.h / ALT;
      if (!cercaFeita && tf.y > yCerca) { g.setTransform(dpr, 0, 0, dpr, 0, 0); cerca(g); cercaFeita = true; }
      g.setTransform(e * dpr, 0, 0, e * dpr, tf.x * dpr, tf.y * dpr);
      g.drawImage(cb.tela, cb.sx, cb.sy, cb.sw, cb.sh, -cb.ax, -cb.ay, cb.w, cb.h);
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!cercaFeita) cerca(g);
  }

  function arvore(g, x, y, h) {
    g.lineCap = 'round';
    g.strokeStyle = COR.tronco; g.lineWidth = h * 0.07;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x - h * 0.09, y - h * 0.32, x + h * 0.03, y - h * 0.6); g.stroke();
    g.lineWidth = h * 0.04;
    g.beginPath(); g.moveTo(x - h * 0.02, y - h * 0.38); g.quadraticCurveTo(x - h * 0.15, y - h * 0.5, x - h * 0.24, y - h * 0.62); g.stroke();
    g.beginPath(); g.moveTo(x + h * 0.01, y - h * 0.48); g.quadraticCurveTo(x + h * 0.14, y - h * 0.55, x + h * 0.24, y - h * 0.66); g.stroke();
    // Copa larga e achatada, como as árvores do cerrado
    var copa = [[-0.24, -0.7, 0.24, 0.12], [0.02, -0.8, 0.3, 0.15], [0.26, -0.7, 0.22, 0.12], [0.0, -0.66, 0.34, 0.1]];
    g.fillStyle = COR.arvore;
    for (var i = 0; i < copa.length; i++) {
      g.beginPath(); g.ellipse(x + h * copa[i][0], y + h * copa[i][1], h * copa[i][2], h * copa[i][3], 0, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = 'rgba(255,255,255,.045)';
    g.beginPath(); g.ellipse(x + h * 0.02, y - h * 0.85, h * 0.22, h * 0.07, 0, 0, Math.PI * 2); g.fill();
  }

  function cerca(g) {
    var yC = HOR + (H - HOR) * 0.1, s = escala(yC), alt = 40 * s * L / 110, passo = 64 * s * L / 110;
    var x0 = ((W % passo) / 2) - passo, postes = [];
    for (var x = x0; x < W + passo; x += passo) postes.push(x);
    // Arames, caindo um pouco entre um mourão e outro
    g.strokeStyle = COR.arame; g.lineWidth = 1;
    [0.36, 0.63, 0.9].forEach(function (f) {
      g.beginPath();
      for (var i = 0; i < postes.length - 1; i++) {
        var ya = yC - alt * f;
        g.moveTo(postes[i], ya);
        g.quadraticCurveTo((postes[i] + postes[i + 1]) / 2, ya + 1.6, postes[i + 1], ya);
      }
      g.stroke();
    });
    g.fillStyle = COR.mourao;
    var lw = Math.max(2, 4.2 * s);
    for (var j = 0; j < postes.length; j++) g.fillRect(postes[j] - lw / 2, yC - alt - 1, lw, alt + 1);
  }

  /* ---------- Capim: tufos que balançam ----------
     Cada tipo de tufo é desenhado uma vez só, todos lado a lado numa única imagem (folha de carimbos).
     Uma imagem grande o navegador desenha muito mais rápido que várias pequenas. */
  var ALT = 40, RES = 2, carimbos = null;
  function criarCarimbos() {
    carimbos = [];
    var r = aleatorio(99), w = ALT * 1.5, h = ALT * 1.15, ax = w / 2, ay = h - 2;
    var sw = Math.ceil(w * RES), sh = Math.ceil(h * RES), colunas = 4, linhas = Math.ceil(COR.tufo.length * 3 / colunas);
    var folha = document.createElement('canvas');
    folha.width = sw * colunas; folha.height = sh * linhas;
    var g = folha.getContext('2d');
    var k = 0;
    for (var c = 0; c < COR.tufo.length; c++) for (var v = 0; v < 3; v++, k++) {
      var sx = (k % colunas) * sw, sy = Math.floor(k / colunas) * sh;
      g.setTransform(RES, 0, 0, RES, sx, sy);
      g.save(); g.beginPath(); g.rect(0, 0, w, h); g.clip();
      var n = 5 + v;
      for (var i = 0; i < n; i++) {
        var meio = (i - (n - 1) / 2) / ((n - 1) / 2);
        var bx = ax + meio * 5, lean = meio * 0.55 + (r() - 0.5) * 0.3, hh = ALT * (0.55 + r() * 0.45);
        var tx = bx + Math.sin(lean) * hh, ty = ay - Math.cos(lean) * hh;
        g.beginPath();
        g.moveTo(bx - 2.2, ay);
        g.quadraticCurveTo(bx + Math.sin(lean) * hh * 0.35 - 1, ay - hh * 0.55, tx, ty);
        g.quadraticCurveTo(bx + Math.sin(lean) * hh * 0.35 + 1.6, ay - hh * 0.5, bx + 2.2, ay);
        g.closePath();
        g.fillStyle = i % 3 === 1 ? COR.tufoEscuro : COR.tufo[c];
        g.fill();
      }
      g.restore();
      carimbos.push({ tela: folha, sx: sx, sy: sy, sw: sw, sh: sh, w: w, h: h, ax: ax, ay: ay });
    }
  }

  function montarTufos() {
    tufos = []; tufosFixos = [];
    var r = aleatorio(7), y = HOR + 6;
    while (y < H + 14) {
      var s = escala(y), passoX = (estreita ? 62 : 72) * s, x = -20 + r() * passoX;
      while (x < W + 20) {
        var tf = {
          x: x + (r() - 0.5) * passoX * 0.5, y: y + (r() - 0.5) * 4 * s, s: s,
          h: (estreita ? 22 : 27) * s * (0.8 + r() * 0.4),
          ang: 0, vel: 0, fase: r() * Math.PI * 2,
          carimbo: carimbos[Math.floor(r() * carimbos.length)]
        };
        // Os de longe são pequenos e quase não se mexem: ficam desenhados no fundo, sem custo
        if (!pertoDoCocho(tf.x, tf.y, 4)) (s < 0.5 ? tufosFixos : tufos).push(tf);
        x += passoX * (0.7 + r() * 0.6);
      }
      y += 15 * s;
    }
    tufos.sort(function (a, b) { return a.y - b.y; });
  }

  /* ---------- Cocho de ração ----------
     Um cocho de madeira comprido, de lado: vai de longe (F) para perto (N).
     Clicar nele serve a ração; os bois mais perto vêm, param dos dois lados dele,
     de perfil, com a cabeça baixa dentro do cocho, e comem até acabar. */
  function criarCocho() {
    var yN = HOR + (H - HOR) * (estreita ? 0.7 : 0.74), yF = HOR + (H - HOR) * (estreita ? 0.44 : 0.4);
    var xN = W * (estreita ? 0.56 : 0.7), xF = xN + (W * 0.62 - xN) * 0.25;   // a ponta de longe puxa um pouco para o centro
    var ut = escala(yN) * L / 100;
    // Lugares: posição ao longo do cocho (0 = ponta de longe, 1 = de perto) e de que lado (-1 esquerda, 1 direita)
    var lugares = estreita
      ? [{ t: 0.55, lado: -1 }, { t: 0.55, lado: 1 }]
      : [{ t: 0.3, lado: -1 }, { t: 0.3, lado: 1 }, { t: 0.82, lado: -1 }, { t: 0.82, lado: 1 }];
    cocho = {
      ehCocho: true, N: { x: xN, y: yN }, F: { x: xF, y: yF }, x: xN, y: yN, ut: ut,
      qtd: 0, enchendo: false, lugares: lugares, ocup: lugares.map(function () { return null; }), graos: []
    };
    var r = aleatorio(555);
    for (var i = 0; i < 90; i++) cocho.graos.push([r(), r() * 2 - 1, r()]);
    // O cocho é comprido em profundidade: é desenhado em fatias, cada uma na sua distância,
    // para ficar certo na frente ou atrás de cada boi
    var n = 10;
    cocho.fatias = [];
    for (var f = 0; f < n; f++) {
      var t0 = f / n, t1 = (f + 1) / n;
      cocho.fatias.push({ ehFatia: true, t0: t0, t1: t1, y: yF + (yN - yF) * t1, primeira: f === 0, ultima: f === n - 1 });
    }
  }

  // Um ponto do cocho em t (0 longe, 1 perto): centro, meia-largura e altura das tábuas, já em perspectiva
  function pontoCocho(t) {
    var y = cocho.F.y + (cocho.N.y - cocho.F.y) * t, x = cocho.F.x + (cocho.N.x - cocho.F.x) * t;
    var ut = escala(y) * L / 100;
    return { x: x, y: y, ut: ut, mw: 14 * ut, h: 12 * ut };
  }

  function pertoDoCocho(x, y, folga) {
    if (!cocho) return false;
    if (y < cocho.F.y - 14 * cocho.ut - folga * 0.4 || y > cocho.N.y + 3 + folga * 0.3) return false;
    var t = limitar((y - cocho.F.y) / (cocho.N.y - cocho.F.y), 0, 1), p = pontoCocho(t);
    return Math.abs(x - p.x) < p.mw + folga;
  }

  function noCocho(x, y) {
    if (y < cocho.F.y - 20 * cocho.ut || y > cocho.N.y + 8) return false;
    var t = limitar((y - cocho.F.y) / (cocho.N.y - cocho.F.y), 0, 1), p = pontoCocho(t);
    return Math.abs(x - p.x) < p.mw + 10;
  }

  // Onde o boi fica para comer: ao lado do cocho, de perfil, com a boca dentro dele
  function lugarDoBoi(b) {
    var l = cocho.lugares[b.lugar], p = pontoCocho(l.t);
    var u = escala(p.y) * L / 100 * b.tam;
    return { x: p.x + l.lado * (62 * u + p.mw * 0.3), y: p.y };   // a boca fica logo depois da borda
  }

  function desenharFatia(fa) {
    var c = cocho, A = pontoCocho(fa.t0), Z = pontoCocho(Math.min(1, fa.t1 + (fa.ultima ? 0 : 0.006))), ut = Z.ut;
    var F = pontoCocho(0), N = pontoCocho(1);
    var vis = N.x > W / 2 ? -1 : 1;   // lado do cocho virado para o centro da tela, que aparece
    function quad(a, b, cc, d, cor) {
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(cc[0], cc[1]); ctx.lineTo(d[0], d[1]); ctx.closePath();
      ctx.fillStyle = cor; ctx.fill();
    }
    // Sombra inteira, embaixo de tudo, desenhada com a primeira fatia
    if (fa.primeira) {
      quad([F.x - F.mw - 3 * F.ut, F.y + 1], [F.x + F.mw + 3 * F.ut, F.y + 1], [N.x + N.mw + 4 * N.ut, N.y + 3], [N.x - N.mw - 4 * N.ut, N.y + 3], 'rgba(8,36,18,.28)');
      // Tábua da ponta de longe (só a borda de cima aparece)
      ctx.fillStyle = COR.cochoClaro;
      ctx.fillRect(F.x - F.mw, F.y - F.h - 1.2 * F.ut, 2 * F.mw, 2.2 * F.ut);
    }
    // Lateral que aparece (tábua comprida)
    var lat = ctx.createLinearGradient(0, Z.y - Z.h, 0, Z.y);
    lat.addColorStop(0, COR.cocho); lat.addColorStop(1, COR.cochoEscuro);
    quad([A.x + vis * A.mw, A.y - A.h], [Z.x + vis * Z.mw, Z.y - Z.h], [Z.x + vis * Z.mw, Z.y], [A.x + vis * A.mw, A.y], lat);
    quad([A.x + vis * A.mw, A.y - A.h * 0.5], [Z.x + vis * Z.mw, Z.y - Z.h * 0.5],
      [Z.x + vis * Z.mw, Z.y - Z.h * 0.5 + Math.max(1, 0.9 * ut)], [A.x + vis * A.mw, A.y - A.h * 0.5 + Math.max(1, 0.9 * A.ut)], 'rgba(40,20,8,.3)');
    // Boca do cocho (por dentro)
    function borda(lado, p) { return [p.x + lado * (p.mw - 1.5 * p.ut), p.y - p.h]; }
    quad(borda(-1, A), borda(1, A), borda(1, Z), borda(-1, Z), COR.cochoDentro);
    // Ração: enche a boca, mais alta no meio, com grãos
    if (c.qtd > 0.01) {
      var q = c.qtd, enc = (1 - q) * 0.45;
      function pr(lado, p) { return [p.x + lado * (p.mw - 1.5 * p.ut) * (1 - enc), p.y - p.h - 1.5 * p.ut * q]; }
      quad(pr(-1, A), pr(1, A), pr(1, Z), pr(-1, Z), COR.racao);
      ctx.strokeStyle = COR.racaoClara; ctx.lineCap = 'butt';
      ctx.lineWidth = Math.max(1, 3 * ut * q);
      ctx.beginPath(); ctx.moveTo(A.x, A.y - A.h - 2.5 * A.ut * q); ctx.lineTo(Z.x, Z.y - Z.h - 2.5 * ut * q); ctx.stroke();
      ctx.fillStyle = COR.racaoEscura;
      for (var i = 0; i < c.graos.length; i++) {
        var gr = c.graos[i];
        if (gr[2] > q || gr[0] < fa.t0 || gr[0] >= fa.t1) continue;
        var p = pontoCocho(gr[0]), g = Math.max(1, 1.2 * p.ut);
        ctx.fillRect(p.x + gr[1] * (p.mw - 2.5 * p.ut) * (1 - enc), p.y - p.h - 1.5 * p.ut * q - (1 - gr[1] * gr[1]) * 2 * p.ut * q, g, g);
      }
    }
    // Bordas de cima das duas tábuas compridas
    ctx.strokeStyle = COR.cochoClaro; ctx.lineCap = 'butt';
    ctx.lineWidth = Math.max(1.5, 2.2 * (A.ut + ut) / 2);
    [-1, 1].forEach(function (lado) {
      ctx.beginPath(); ctx.moveTo(A.x + lado * A.mw, A.y - A.h); ctx.lineTo(Z.x + lado * Z.mw, Z.y - Z.h); ctx.stroke();
    });
    if (fa.ultima) {
      // Tábua da ponta de perto, de frente para quem olha, e os pés
      var fr = ctx.createLinearGradient(0, N.y - N.h, 0, N.y);
      fr.addColorStop(0, COR.cochoClaro); fr.addColorStop(1, COR.cochoEscuro);
      ctx.fillStyle = fr; ctx.fillRect(N.x - N.mw - 1.2 * N.ut, N.y - N.h - 1.2 * N.ut, 2 * N.mw + 2.4 * N.ut, N.h + 1.2 * N.ut);
      ctx.fillStyle = 'rgba(40,20,8,.3)'; ctx.fillRect(N.x - N.mw - 1.2 * N.ut, N.y - N.h * 0.5, 2 * N.mw + 2.4 * N.ut, Math.max(1, 0.9 * N.ut));
      ctx.fillStyle = COR.cochoEscuro;
      ctx.fillRect(N.x - N.mw - 1.2 * N.ut, N.y - 1, 3 * N.ut, 2.5 * N.ut + 1);
      ctx.fillRect(N.x + N.mw - 1.8 * N.ut, N.y - 1, 3 * N.ut, 2.5 * N.ut + 1);
    }
  }

  /* ---------- Bois Nelore ---------- */
  function criarBois() {
    var r = aleatorio(1311);
    var tipos = estreita ? ['vaca', 'touro', 'vaca', 'bezerro'] : ['vaca', 'touro', 'vaca', 'vaca', 'bezerro', 'vaca', 'vaca'];
    var tons = ['#EFEEE7', '#E9E8DF', '#F3F2EC', '#E6E5DC'];
    // Alguns sem chifre: Nelore mocho
    var mochos = estreita ? [2] : [2, 5];
    // Cupim de cada um: tamanho e quanto tomba para trás (0 = quase em pé, 1 = bem caído)
    var cupTam = [1, 1.05, 0.72, 1.12, 1, 0.82, 0.95], cupTombo = [1, 0.4, 0.7, 0.15, 0.5, 0.9, 0.3];
    var n = tipos.length, mae = null;
    bois = [];
    for (var i = 0; i < n; i++) {
      var tipo = tipos[i];
      var b = {
        tipo: tipo, tam: tipo === 'bezerro' ? 0.6 : tipo === 'touro' ? 1.08 : 1, tom: tons[i % tons.length],
        x: 0, y: 0, dir: r() < 0.5 ? -1 : 1, estado: 'pastar', t: 1 + r() * 6, t2: 2 + r() * 6, levanta: 0,
        cab: 0, cabAlvo: 0, andando: 0, movendo: false, passo: r() * 6.28, cauda: r() * 6.28, caudaForca: 0.3,
        fase: r() * 6.28, alvo: null, monte: null, vaga: 0, mae: null, alturaAr: 0, vy: 0, balanco: 0, erguido: false
      };
      if (tipo === 'bezerro' && mae) {
        b.mae = mae;
        b.y = limitar(mae.y + 14, Y_MIN, Y_MAX);
        b.x = limitar(mae.x + 58 * escala(mae.y) * L / 100, 50, W - 50);
        b.dir = mae.dir;
      } else {
        b.x = 50 + (i + 0.5) / n * (W - 100) + (r() - 0.5) * (W / n) * 0.4;
        b.y = Y_MIN + r() * (Y_MAX - Y_MIN);
      }
      if (pertoDoCocho(b.x, b.y, 60 * cocho.ut)) b.x = limitar(b.x < cocho.N.x ? cocho.N.x - 80 * cocho.ut : cocho.N.x + 80 * cocho.ut, 50, W - 50);
      b.psi = b.dir > 0 ? 0 : Math.PI;
      b.mocho = mochos.indexOf(i) > -1;
      b.cupimTam = cupTam[i % cupTam.length]; b.tombo = cupTombo[i % cupTombo.length];
      if (tipo === 'vaca') mae = b;
      bois.push(b);
    }
  }

  /* O boi é desenhado em "meio 3D": cada parte tem posição ao longo do corpo (x), altura (y)
     e lado (z: + é o lado de cá). psi é o giro: 0 = de lado para a direita, PI = para a esquerda.
     No meio da volta ele fica de frente para quem olha, com a cara para a frente. */
  var DUTY = 0.62, PASSADA = 22;   // parte do passo com o casco no chão; tamanho da passada
  // Ordem das patas de um bovino andando: traseira, dianteira do mesmo lado, depois o outro lado
  var PERNAS = [
    { x: -34, z: 11, tras: true, atraso: 0 },
    { x: 27, z: 11, tras: false, atraso: 0.25 },
    { x: -28, z: -11, tras: true, atraso: 0.5 },
    { x: 33, z: -11, tras: false, atraso: 0.75 }
  ];

  // Uma perna. No chão (apoio), o casco fica parado e o corpo passa por cima dele;
  // no ar, o casco sobe, a junta dobra e a perna vai para a frente, na direção em que o boi anda.
  function perna(b, L, cP, sP) {
    var g = geometriaPerna(b, L, cP, sP);
    var meiaTopo = L.tras ? 8 : 7, meiaJunta = L.tras ? 3.9 : 3.6;
    ctx.beginPath();
    ctx.moveTo(g.hx - meiaTopo, -46);
    ctx.quadraticCurveTo(g.hx - meiaTopo * 0.95, (-46 + g.jy) / 2, g.jx - meiaJunta, g.jy);
    ctx.lineTo(g.fx - 3, g.fy - 5);
    ctx.lineTo(g.fx + 3, g.fy - 5);
    ctx.lineTo(g.jx + meiaJunta, g.jy);
    ctx.quadraticCurveTo(g.hx + meiaTopo * 0.95, (-46 + g.jy) / 2, g.hx + meiaTopo, -46);
    ctx.closePath();
    ctx.fillStyle = g.perto ? corPerna(b) : COR.boiLonge; ctx.fill();
    ctx.fillStyle = COR.casco;
    ctx.fillRect(g.fx - 3.3, g.fy - 5, 6.6, 5);
  }

  // Posição de quadril, junta e casco de uma perna na tela (usada pela perna e pela emenda com o corpo)
  function geometriaPerna(b, L, cP, sP) {
    var f = (b.passo + L.atraso) % 1; if (f < 0) f += 1;
    var xo, lev;
    if (f < DUTY) { xo = PASSADA / 2 - PASSADA * f / DUTY; lev = 0; }
    else { var k = (f - DUTY) / (1 - DUTY); xo = -PASSADA / 2 + PASSADA * (0.5 - 0.5 * Math.cos(Math.PI * k)); lev = Math.sin(Math.PI * k); }
    xo *= b.andando; lev *= b.andando;
    if (b.erguido || b.estado === 'cair') lev = 0.35 + 0.65 * lev;    // no ar, as patas ficam soltas, meio dobradas
    var hx = L.x * cP - L.z * sP;
    var fx = (L.tras ? -1 : 0) + xo, fy = -lev * 6;
    var jx = fx * 0.55 + (L.tras ? -5 - 2 * lev : 1 + 3 * lev), jy = -19 - lev * 4;
    return { hx: hx, jx: hx + jx * cP, jy: jy, fx: hx + fx * cP, fy: fy, perto: L.x * sP + L.z * cP >= 0 };
  }

  // Cor das pernas do lado de cá: começa na cor da barriga e clareia descendo, sem emenda
  function corPerna(b) {
    var g = ctx.createLinearGradient(0, -30, 0, 0);
    g.addColorStop(0, COR.boiSombra); g.addColorStop(0.45, COR.boiPerna); g.addColorStop(1, COR.boiSombra);
    return g;
  }

  // Faixa que afina ao longo de uma linha de pontos (pescoço, rabo)
  function faixa(pts, larg, extraBaixo, sg) {
    var cima = [], baixo = [];
    for (var i = 0; i < pts.length; i++) {
      var a = pts[Math.max(0, i - 1)], z = pts[Math.min(pts.length - 1, i + 1)];
      var tx = z.x - a.x, ty = z.y - a.y, l = Math.sqrt(tx * tx + ty * ty) || 1;
      var nx = -ty / l * sg, ny = tx / l * sg, w = larg[i] / 2, e = extraBaixo ? extraBaixo[i] : 0;
      cima.push([pts[i].x - nx * w, pts[i].y - ny * w]);
      baixo.push([pts[i].x + nx * w, pts[i].y + ny * w + e]);
    }
    var p = new Path2D();
    p.moveTo(cima[0][0], cima[0][1]);
    for (var j = 1; j < cima.length; j++) p.lineTo(cima[j][0], cima[j][1]);
    for (var k = baixo.length - 1; k >= 0; k--) p.lineTo(baixo[k][0], baixo[k][1]);
    p.closePath();
    return p;
  }

  // Rabo: nasce em cima da garupa, desce rente à nádega e cai solto, com a vassoura escura na ponta
  function rabo(b, cP) {
    // Sai do alto da garupa, faz uma curva para trás e cai solto, um pouco afastado da traseira,
    // até perto do jarrete. A parte de baixo balança, mais forte quando ele espanta mosca.
    var forca = 0.25 + 0.75 * b.caudaForca, N = 16, pts = [], larg = [];
    for (var i = 0; i <= N; i++) {
      var t = i / N, x, y;
      if (t < 0.25) {
        var s = t / 0.25, m = 1 - s;
        x = m * m * -42 + 2 * m * s * -55 + s * s * -55;
        y = m * m * -72 + 2 * m * s * -73 + s * s * -59;
      } else {
        var q = (t - 0.25) / 0.75;
        x = -55 + Math.sin(b.cauda - q * 2.4) * forca * 7 * q - q * 1.5;
        y = -59 + q * 37;
      }
      pts.push({ x: x * cP, y: y });
      larg.push(4.4 - 2.4 * t);
    }
    var rab = faixa(pts, larg, null, 1);
    ctx.strokeStyle = COR.contorno; ctx.lineWidth = 1.4; ctx.stroke(rab);
    ctx.fillStyle = COR.rabo; ctx.fill(rab);
    // Vassoura: pelo escuro na ponta, em gota
    var a = pts[N - 1], z = pts[N], dir = Math.atan2(z.y - a.y, z.x - a.x);
    ctx.save(); ctx.translate(z.x, z.y); ctx.rotate(dir);
    ctx.beginPath(); ctx.moveTo(-3, 0);
    ctx.quadraticCurveTo(2, -3.6, 9, -0.8); ctx.quadraticCurveTo(11.5, 0, 9, 0.8); ctx.quadraticCurveTo(2, 3.6, -3, 0);
    ctx.fillStyle = COR.casco; ctx.fill();
    ctx.restore();
  }

  // Cabeça de lado: comprida, orelha caída e (se não for mocho) chifre curto
  function cabecaLado(b, chifre, cor) {
    ctx.save(); ctx.translate(1, 2); ctx.rotate(2.35 - 0.25 * b.angCab);
    ctx.beginPath(); ctx.moveTo(-1, -2.6); ctx.quadraticCurveTo(8, -4, 14, 0); ctx.quadraticCurveTo(8, 4, -1, 2.6); ctx.closePath();
    ctx.fillStyle = COR.boiSombra; ctx.fill();
    ctx.restore();
    if (chifre) {
      ctx.beginPath(); ctx.moveTo(1, -5); ctx.quadraticCurveTo(-2, -9, -1, -13);
      ctx.strokeStyle = COR.chifre; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.stroke();
    }
    var cabeca = new Path2D();
    cabeca.moveTo(-2, -6.5);
    cabeca.bezierCurveTo(6, -8, 16, -6, 22, -4);
    cabeca.bezierCurveTo(27, -2.5, 28.5, 2, 26.5, 5);
    cabeca.bezierCurveTo(24, 7.5, 16, 7.5, 6, 7.5);
    cabeca.bezierCurveTo(0, 7.5, -3, 4, -3, 0);
    cabeca.closePath();
    ctx.strokeStyle = COR.contorno; ctx.lineWidth = 2; ctx.stroke(cabeca);
    ctx.fillStyle = cor; ctx.fill(cabeca);
    ctx.beginPath(); ctx.ellipse(0.5, 1, 4.6, 5.6, 0, 0, Math.PI * 2); ctx.fill();   // nuca, emendando no pescoço
    ctx.beginPath(); ctx.ellipse(25, 1.5, 3.4, 4.2, 0, 0, Math.PI * 2); ctx.fillStyle = COR.focinho; ctx.fill();
    ctx.beginPath(); ctx.ellipse(8, -1.6, 2.4, 1.9, 0, 0, Math.PI * 2); ctx.fillStyle = COR.olheira; ctx.fill(); // pele escura em volta do olho
    ctx.beginPath(); ctx.arc(8.3, -1.6, 1.3, 0, Math.PI * 2); ctx.fillStyle = COR.olho; ctx.fill();
  }

  // Cabeça de frente: a cara vista por quem olha, com as duas orelhas e os dois chifres
  function cabecaFrente(b, chifre, cor) {
    var alt = 12 + 16 * Math.sin(b.angCab);   // cara mais curta quando olha para a frente, mais longa pastando
    ctx.fillStyle = COR.boiSombra;
    ctx.beginPath(); ctx.ellipse(-10.5, 1.5, 7.5, 2.8, 0.35, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(10.5, 1.5, 7.5, 2.8, -0.35, 0, Math.PI * 2); ctx.fill();
    if (chifre) {
      ctx.strokeStyle = COR.chifre; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-4.5, -4); ctx.quadraticCurveTo(-8.5, -7, -8, -11); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(4.5, -4); ctx.quadraticCurveTo(8.5, -7, 8, -11); ctx.stroke();
    }
    var cara = new Path2D();
    cara.moveTo(-7, -3);
    cara.quadraticCurveTo(0, -8, 7, -3);
    cara.bezierCurveTo(8, alt * 0.4, 6, alt * 0.8, 4.6, alt);
    cara.quadraticCurveTo(0, alt + 3, -4.6, alt);
    cara.bezierCurveTo(-6, alt * 0.8, -8, alt * 0.4, -7, -3);
    cara.closePath();
    ctx.strokeStyle = COR.contorno; ctx.lineWidth = 2; ctx.stroke(cara);
    ctx.fillStyle = cor; ctx.fill(cara);
    ctx.beginPath(); ctx.ellipse(0, alt - 0.5, 5, 3.4, 0, 0, Math.PI * 2); ctx.fillStyle = COR.focinho; ctx.fill();
    ctx.fillStyle = COR.olheira;
    ctx.beginPath(); ctx.ellipse(-5, 2, 2.2, 1.8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(5, 2, 2.2, 1.8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COR.olho;
    ctx.beginPath(); ctx.arc(-5, 2, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(5, 2, 1.2, 0, Math.PI * 2); ctx.fill();
  }

  // Pontos ao longo de uma sequência de curvas (início + trechos [c1, c2, fim])
  function amostrar(inicio, trechos, passos) {
    var pts = [{ x: inicio[0], y: inicio[1] }], a = inicio;
    for (var i = 0; i < trechos.length; i++) {
      var c1 = trechos[i][0], c2 = trechos[i][1], z = trechos[i][2];
      for (var s = 1; s <= passos; s++) {
        var t = s / passos, m = 1 - t;
        pts.push({
          x: m * m * m * a[0] + 3 * m * m * t * c1[0] + 3 * m * t * t * c2[0] + t * t * t * z[0],
          y: m * m * m * a[1] + 3 * m * m * t * c1[1] + 3 * m * t * t * c2[1] + t * t * t * z[1]
        });
      }
      a = z;
    }
    return pts;
  }

  // Volume: o contorno de lado "arrastado" para os dois lados conforme o boi vira.
  // Cada ponto do perfil vira uma faixa de -W a +W (W é a meia-largura do corpo naquela altura),
  // então o corpo engrossa na virada e as pernas, que ficam nos lados, continuam dentro dele.
  function volume(pts, k, larg) {
    var p = new Path2D();
    function poligono(lista) {
      var area = 0;
      for (var i = 0; i < lista.length; i++) { var a = lista[i], z = lista[(i + 1) % lista.length]; area += a[0] * z[1] - z[0] * a[1]; }
      if (area < 0) lista.reverse();
      p.moveTo(lista[0][0], lista[0][1]);
      for (var j = 1; j < lista.length; j++) p.lineTo(lista[j][0], lista[j][1]);
      p.closePath();
    }
    var esq = [], dir = [], n = pts.length;
    for (var i = 0; i < n; i++) {
      var w = larg(pts[i].y), x = pts[i].x * k;
      esq.push([x - w, pts[i].y]); dir.push([x + w, pts[i].y]);
    }
    poligono(esq.slice()); poligono(dir.slice());
    for (var e = 0; e < n; e++) {
      var f = (e + 1) % n;
      if (Math.abs(dir[e][0] - esq[e][0]) < 0.05) continue;
      poligono([esq[e], esq[f], dir[f], dir[e]]);
    }
    return p;
  }

  var CORPO = amostrar([-47, -60], [
    [[-47, -72], [-40, -76], [-28, -76]],
    [[-13, -75.3], [1, -74.7], [16, -74]],
    [[30, -74], [40, -70], [43, -58]],
    [[46, -46], [42, -34], [32, -31]],
    [[22, -29], [12, -33], [0, -34]],
    [[-14, -35], [-24, -33], [-32, -30]],
    [[-42, -28], [-48, -40], [-47, -60]]
  ], 7);

  function desenharBoi(b) {
    var u = unidade(b);
    var c = b.cab;
    if (c < 0.25) c = limitar(c + 0.035 * Math.sin(tempo * 5 + b.fase), 0, 1); // mastigando
    var touro = b.tipo === 'touro', bezerro = b.tipo === 'bezerro', chifre = !bezerro && !b.mocho;
    var cP = Math.cos(b.psi), sP = Math.sin(b.psi), aC = Math.abs(cP), sg = cP >= 0 ? 1 : -1, k = cP;
    var deLado = aC > 0.42;

    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.scale(u, u);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';

    // Sombra no chão: fica no chão e diminui quando o boi está no ar
    var ar = (b.alturaAr || 0) / u, enc = 1 / (1 + ar / 70);
    ctx.beginPath(); ctx.ellipse(0, 0, (48 * aC + 20 * sP) * enc, 6.5 * enc, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(8,36,18,' + (0.28 * enc).toFixed(3) + ')'; ctx.fill();
    // No ar: sobe e balança como um pêndulo, pendurado de onde foi pego
    if (ar > 0.01) ctx.translate(0, -ar);
    if (b.balanco) { ctx.translate(0, -60); ctx.rotate(b.balanco); ctx.translate(0, 60); }

    // Pernas, das mais longe para as mais perto
    var pernas = PERNAS.slice().sort(function (a, z) { return (a.x * sP + a.z * cP) - (z.x * sP + z.z * cP); });
    for (var i = 0; i < pernas.length; i++) perna(b, pernas[i], cP, sP);

    // O rabo vem antes do corpo: a raiz some dentro da garupa e ele aparece saindo dela
    rabo(b, cP);

    // Corpo com volume: seção arredondada, mais larga no meio da altura
    var corpo = volume(CORPO, k, function (y) {
      var q = (y + 53) / 24;
      return 20 * sP * Math.max(0.5, Math.sqrt(Math.max(0, 1 - q * q)));
    });

    // Cupim, a corcova do zebu, em cima da paleta: sobe devagar a partir do pescoço,
    // fica mais alto do meio para trás e tomba para trás, caindo sobre o lombo.
    // Cada animal tem o seu: uns maiores, outros menores, uns bem tombados, outros quase em pé
    var hf = (bezerro ? 0.25 : touro ? 1 : 0.6) * b.cupimTam, tb = b.tombo;
    function mix(a, z) { return a + (z - a) * tb; }
    var alt = 18 * hf, topo = -74 - alt;
    var pontosCupim = amostrar([40, -70], [
      [[36, -74 - 0.4 * alt], [mix(32, 29), topo], [mix(23, 18), topo]],
      [[mix(14, 9), topo], [mix(9, 3), topo + mix(0.35, 0.25) * alt], [mix(7, 2), -74 - mix(0.2, 0.5) * alt]],
      [[mix(6, 1.5), -74 - mix(0.05, 0.25) * alt], [mix(7, 4), -73.5], [10, -73]],
      [[20, -72], [30, -71], [40, -70]]
    ], 6);
    // O cupim também tem largura: mais fino no alto, mais largo onde encosta na paleta
    var cupim = volume(pontosCupim, k, function (y) {
      return 10 * sP * Math.max(0.35, Math.min(1, (y - topo) / (alt * 0.7 + 0.01)));
    });
    // A dobra embaixo da parte que tomba para trás, onde o cupim encosta no lombo
    var dobra = tb > 0.35 && deLado ? new Path2D() : null;
    if (dobra) {
      dobra.moveTo(mix(7, 2.5) * k, -74 - mix(0.18, 0.45) * alt);
      dobra.quadraticCurveTo(mix(7, 4) * k, -73.6, 10 * k, -73.2);
    }

    // Pescoço: uma faixa curva do ombro até a nuca, com a barbela pendurada embaixo.
    // A nuca vai do chão (pastando) até o alto (olhando)
    var Pl = { x: 50 + 6 * c, y: -28 - 44 * c };
    b.angCab = 1.3 - 0.78 * c;
    var S0 = { x: 28, y: -60 };
    var Q = { x: (S0.x + Pl.x) / 2 + 6 - 4 * c, y: (S0.y + Pl.y) / 2 - 6 + 2 * c };
    var pts = [], larg = [], barbela = [], N = 12;
    for (var j = 0; j <= N; j++) {
      var t = j / N, m = 1 - t;
      pts.push({ x: (m * m * S0.x + 2 * m * t * Q.x + t * t * Pl.x) * cP, y: m * m * S0.y + 2 * m * t * Q.y + t * t * Pl.y });
      larg.push(30 - 15 * t);
      barbela.push((3 + 9 * c) * aC * Math.sin(Math.PI * limitar((t - 0.1) / 0.75, 0, 1)));
    }
    var pescoco = faixa(pts, larg, barbela, sg);

    // Contorno suave só por fora (riscado antes e coberto pelo preenchimento)
    ctx.strokeStyle = COR.contorno; ctx.lineWidth = 2.4;
    ctx.stroke(corpo); ctx.stroke(cupim); ctx.stroke(pescoco);
    var gr = ctx.createLinearGradient(0, -80, 0, -30);
    gr.addColorStop(0, b.tom); gr.addColorStop(0.55, b.tom); gr.addColorStop(1, COR.boiSombra);
    var corCorpo = gr;
    if (touro) {
      // Touro Nelore: a frente (pescoço, cupim e paleta) vai escurecendo para o cinza
      corCorpo = ctx.createLinearGradient(-6 * k - 17 * sP, 0, 40 * k + 0.01, 0);
      corCorpo.addColorStop(0, b.tom); corCorpo.addColorStop(1, COR.touroPaleta);
    }
    // Pescoço e cupim com a mesma cor do corpo onde se encontram, para não marcar emenda
    var corPescoco = gr;
    if (touro) {
      corPescoco = ctx.createLinearGradient(40 * cP, -62, Pl.x * cP + 0.01, Pl.y);
      corPescoco.addColorStop(0, COR.touroPaleta); corPescoco.addColorStop(0.6, COR.touro); corPescoco.addColorStop(1, COR.touroCabeca);
    }
    var corCupim = gr;
    if (touro) {
      corCupim = ctx.createLinearGradient(0, -72, 0, topo);
      corCupim.addColorStop(0, COR.touroPaleta); corCupim.addColorStop(1, COR.touro);
    }
    // De lado, o pescoço sai de dentro do corpo; virando, ele vem para a frente do peito
    var pescocoNaFrente = sP > 0.25;
    if (!pescocoNaFrente) { ctx.fillStyle = corPescoco; ctx.fill(pescoco); }
    ctx.fillStyle = corCorpo; ctx.fill(corpo);
    // Emenda das pernas do lado de cá com a barriga: cobre a linha do contorno e funde as cores
    if (aC > 0.3) {
      for (var pe = 0; pe < PERNAS.length; pe++) {
        var gp = geometriaPerna(b, PERNAS[pe], cP, sP);
        if (!gp.perto) continue;
        // Mesma cor do corpo, afinando até a largura da perna
        var mt = PERNAS[pe].tras ? 8 : 7, cx = gp.hx + (gp.jx - gp.hx) * 0.3;
        ctx.beginPath();
        ctx.moveTo(gp.hx - mt - 2, -41);
        ctx.quadraticCurveTo(gp.hx - mt * 0.95, -32, cx - mt * 0.7, -26);
        ctx.lineTo(cx + mt * 0.7, -26);
        ctx.quadraticCurveTo(gp.hx + mt * 0.95, -32, gp.hx + mt + 2, -41);
        ctx.closePath();
        ctx.fillStyle = corCorpo; ctx.fill();
      }
    }
    ctx.fillStyle = corCupim; ctx.fill(cupim);
    if (dobra && !bezerro) { ctx.strokeStyle = COR.dobra; ctx.lineWidth = 1.5; ctx.stroke(dobra); }
    if (pescocoNaFrente) { ctx.fillStyle = corPescoco; ctx.fill(pescoco); }

    // Cabeça: de lado ou de frente. Na passagem de uma para a outra, uma some enquanto a outra aparece
    var corCabeca = touro ? COR.touroCabeca : b.tom;
    var hs = bezerro ? 1.25 : 1;
    var lado = limitar((aC - 0.3) / 0.24, 0, 1);   // 1 = só de lado, 0 = só de frente
    if (lado < 1) {
      ctx.save();
      ctx.globalAlpha = 1 - lado;
      ctx.translate(Pl.x * cP, Pl.y);
      ctx.scale(hs, hs);
      cabecaFrente(b, chifre, corCabeca);
      ctx.restore();
    }
    if (lado > 0) {
      ctx.save();
      ctx.globalAlpha = lado;
      ctx.translate(Pl.x * cP, Pl.y);
      ctx.scale(sg * Math.max(aC, 0.6), 1);
      ctx.rotate(b.angCab);
      ctx.scale(hs, hs);
      cabecaLado(b, chifre, corCabeca);
      ctx.restore();
    }

    ctx.restore();
  }

  function desenharMonte(m) {
    var s = escala(m.y), r = 10 * s * L / 110;
    var p = m.pop < 1 ? 1 + 2.2 * Math.pow(m.pop - 1, 3) + 1.2 * Math.pow(m.pop - 1, 2) : 1; // "pula" ao cair
    var k = r * p * (0.35 + 0.65 * Math.max(0, m.qtd));
    if (k <= 0.3) return;
    ctx.beginPath(); ctx.ellipse(m.x, m.y + 1, k * 1.9, k * 0.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(8,36,18,.25)'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(m.x, m.y, k * 1.5, k * 0.38, 0, 0, Math.PI * 2);
    ctx.fillStyle = COR.salSombra; ctx.fill();
    ctx.beginPath(); ctx.moveTo(m.x - k * 1.5, m.y);
    ctx.quadraticCurveTo(m.x - k * 0.2, m.y - k * 1.7, m.x + k * 1.5, m.y);
    ctx.closePath(); ctx.fillStyle = COR.sal; ctx.fill();
    ctx.fillStyle = COR.salSombra;
    ctx.beginPath(); ctx.arc(m.x + k * 0.5, m.y - k * 0.3, k * 0.14, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(m.x - k * 0.6, m.y - k * 0.2, k * 0.12, 0, Math.PI * 2); ctx.fill();
  }

  /* ---------- Comportamento ---------- */
  // A linha reta de (ax, ay) até (bx, by) passa por cima do cocho?
  function cruzaCocho(ax, ay, bx, by, folga) {
    for (var i = 1; i < 14; i++) {
      var t = i / 14;
      if (pertoDoCocho(ax + (bx - ax) * t, ay + (by - ay) * t, folga)) return true;
    }
    return false;
  }

  // Plano para dar a volta no cocho: sai para fora pelo lado em que está, passa atrás da ponta de longe
  // (ou na frente da ponta de perto, o que for mais curto) e entra pelo lado do destino.
  // A profundidade conta mais na distância, porque é "comprimida" na tela.
  function planoDeContorno(b, alvo, trocar) {
    var F = pontoCocho(0), N = pontoCocho(1), u = unidade(b);
    function centroEm(y) { return pontoCocho(limitar((y - cocho.F.y) / (cocho.N.y - cocho.F.y), 0, 1)).x; }
    var A = b.x < centroEm(b.y) ? -1 : 1, B = alvo.x < centroEm(alvo.y) ? -1 : 1;
    function plano(ponta, yFora) {
      var lista = [{ x: ponta.x + A * (ponta.mw + 30 * u), y: yFora }];
      if (B !== A) lista.push({ x: ponta.x + B * (ponta.mw + 30 * u), y: yFora });
      // Se já está fora do comprimento do cocho, não precisa do primeiro ponto
      if (B !== A && (b.y < cocho.F.y - 10 * u || b.y > cocho.N.y + 10 * u)) lista.shift();
      return lista;
    }
    var atras = plano(F, limitar(F.y - 14 * F.ut - 22 * u, Y_MIN - 8, Y_MAX));
    var frente = plano(N, limitar(N.y + 28 * N.ut, Y_MIN, Y_MAX));
    function custo(l) {
      var x = b.x, y = b.y, c = 0;
      l.concat([alvo]).forEach(function (q) { c += Math.hypot(q.x - x, (q.y - y) * 2.5); x = q.x; y = q.y; });
      return c;
    }
    var melhor = custo(atras) < custo(frente) ? atras : frente;
    if (trocar) melhor = melhor === atras ? frente : atras;   // se o primeiro caminho travou, tenta a outra ponta
    return melhor;
  }

  function andar(b, vel, dt) {
    var u = unidade(b);
    // Destino novo: esquece o plano antigo
    var chaveAlvo = Math.round(b.alvo.x) + ',' + Math.round(b.alvo.y);
    if (b.chaveAlvo !== chaveAlvo) { b.chaveAlvo = chaveAlvo; b.desvios = null; b.contornou = false; }
    // Se o caminho reto passa pelo cocho, planeja a volta (uma vez só para cada destino)
    if (!b.desvios && !b.contornou && cruzaCocho(b.x, b.y, b.alvo.x, b.alvo.y, 22 * u)) b.desvios = planoDeContorno(b, b.alvo, false);
    var alvo = b.desvios && b.desvios.length ? b.desvios[0] : b.alvo;
    var dx = alvo.x - b.x, dy = alvo.y - b.y, d = Math.sqrt(dx * dx + dy * dy);
    if (alvo !== b.alvo && d < 8) {
      b.desvios.shift();
      if (!b.desvios.length) { b.desvios = null; b.contornou = true; }
      alvo = b.desvios ? b.desvios[0] : b.alvo;
      dx = alvo.x - b.x; dy = alvo.y - b.y; d = Math.sqrt(dx * dx + dy * dy);
    }
    if (d < 1.5 && alvo === b.alvo) { b.travas = 0; return true; }
    // Travado: se não chega mais perto por um tempo, dá um passo para o lado ou tenta a outra ponta
    var chave = Math.round(alvo.x) + ',' + Math.round(alvo.y);
    if (b.chave !== chave) { b.chave = chave; b.dMelhor = 1e9; b.travado = 0; }
    if (d < b.dMelhor - 0.4) { b.dMelhor = d; b.travado = 0; } else b.travado += dt;
    if (b.travado > 0.9) {
      b.travado = 0; b.dMelhor = 1e9; b.travas = (b.travas || 0) + 1; b.contornou = false;
      b.desvios = cruzaCocho(b.x, b.y, b.alvo.x, b.alvo.y, 22 * u) || pertoDoCocho(b.x, b.y, 50 * u)
        ? planoDeContorno(b, b.alvo, b.travas % 2 === 0)
        : [{ x: limitar(b.x + (Math.random() - 0.5) * 120 * u, 40, W - 40), y: limitar(b.y + (Math.random() - 0.5) * 50 * u, Y_MIN, Y_MAX) }];
      alvo = b.desvios[0]; dx = alvo.x - b.x; dy = alvo.y - b.y; d = Math.sqrt(dx * dx + dy * dy) || 1;
    }
    var ux = dx / d, uy = dy / d, rx = 0, ry = 0;
    // Afasta-se dos outros bois no caminho (a profundidade conta mais, porque é "comprimida" na tela)
    for (var i = 0; i < bois.length; i++) {
      var o = bois[i];
      if (o === b || o.erguido || o.estado === 'cair') continue;
      var ox = b.x - o.x, oy = (b.y - o.y) * 3.2, dd = Math.sqrt(ox * ox + oy * oy), raio = 72 * Math.max(u, unidade(o));
      if (dd < raio && dd > 0.001) { var f = 1 - dd / raio; rx += ox / dd * f; ry += oy / dd * f; }
    }
    // E do cocho: contorna em vez de atravessar
    if (b.y > cocho.F.y - 25 * u && b.y < cocho.N.y + 18 * u) {
      var p = pontoCocho(limitar((b.y - cocho.F.y) / (cocho.N.y - cocho.F.y), 0, 1));
      var lx = b.x - p.x, folga = p.mw + 48 * u;
      if (Math.abs(lx) < folga) rx += (lx >= 0 ? 1 : -1) * (1 - Math.abs(lx) / folga) * 1.8;
    }
    var perto = alvo !== b.alvo ? 1 : limitar(d / (40 * u), 0, 1);   // chegando, desvia menos, para conseguir parar no lugar
    var mx = ux + rx * 1.3 * perto, my = uy + ry * 0.5 * perto;
    var ml = Math.sqrt(mx * mx + my * my) || 1; mx /= ml; my /= ml;
    if (mx * ux + my * uy < 0.2) { mx = mx * 0.5 + ux * 0.5; my = my * 0.5 + uy * 0.5; }  // nunca anda de costas para o destino
    var passo = Math.min(d, vel * dt);
    b.x += mx * passo; b.y = limitar(b.y + my * passo, Y_MIN - 8, Y_MAX);
    if (Math.abs(mx) > 0.2) b.dir = mx > 0 ? 1 : -1;
    b.passo += passo / (unidade(b) * PASSADA / DUTY);
    b.movendo = true;
    if (alvo !== b.alvo) return false;
    var chegou = Math.hypot(b.alvo.x - b.x, b.alvo.y - b.y) < 2;
    if (chegou) b.travas = 0;
    return chegou;
  }

  function soltarSal(b) {
    if (b.monte && b.monte.vagas[b.vaga] === b) b.monte.vagas[b.vaga] = null;
    b.monte = null;
  }

  function soltarCocho(b) {
    if (b.lugar != null && cocho.ocup[b.lugar] === b) cocho.ocup[b.lugar] = null;
    b.lugar = null; b.via = null;
  }

  function irAoCocho(b, i) {
    soltarSal(b); soltarCocho(b);
    cocho.ocup[i] = b; b.lugar = i; b.estado = 'cocho';
    // Quem está do outro lado do cocho dá a volta pela ponta de perto, em vez de passar por cima dele
    var lado = cocho.lugares[i].lado, u = unidade(b);
    var p = pontoCocho(limitar((b.y - cocho.F.y) / (cocho.N.y - cocho.F.y), 0, 1));
    if ((b.x - p.x) * lado < 0 && b.y > cocho.F.y - 20 * u) {
      b.via = { x: cocho.N.x + lado * 45 * u, y: limitar(cocho.N.y + 26 * cocho.ut, Y_MIN, Y_MAX) };
    }
  }

  // Lugar livre no cocho, de preferência do lado em que o boi está
  function lugarLivre(b) {
    var melhor = -1, dMelhor = 1e9;
    for (var i = 0; i < cocho.lugares.length; i++) {
      if (cocho.ocup[i]) continue;
      var l = cocho.lugares[i], p = pontoCocho(l.t);
      var d = Math.hypot(p.x + l.lado * 40 - b.x, p.y - b.y) + ((b.x - p.x) * l.lado < 0 ? 400 : 0);
      if (d < dMelhor) { dMelhor = d; melhor = i; }
    }
    return melhor;
  }

  function temRacao() { return cocho.qtd > 0.02 || cocho.enchendo; }

  function servirRacao() {
    cocho.enchendo = true;
    var livres = bois.filter(function (b) { return livreParaIr(b); });
    livres.sort(function (a, b) { return Math.hypot(a.x - cocho.N.x, a.y - cocho.N.y) - Math.hypot(b.x - cocho.N.x, b.y - cocho.N.y); });
    var vagas = cocho.ocup.filter(function (o) { return !o; }).length;
    var vao = livres.slice(0, vagas);
    // Cada lado recebe quem já está daquele lado; quem está mais ao fundo fica com o lugar do fundo
    [-1, 1].forEach(function (lado) {
      var lugares = [];
      for (var i = 0; i < cocho.lugares.length; i++) if (cocho.lugares[i].lado === lado && !cocho.ocup[i]) lugares.push(i);
      lugares.sort(function (a, z) { return cocho.lugares[a].t - cocho.lugares[z].t; });
      var daqui = vao.filter(function (b) { return (b.x - cocho.N.x) * lado > 0; }).sort(function (a, z) { return a.y - z.y; });
      for (var j = 0; j < daqui.length && j < lugares.length; j++) { irAoCocho(daqui[j], lugares[j]); vao.splice(vao.indexOf(daqui[j]), 1); }
    });
    // Quem sobrou vai para o lugar que restar (dando a volta pela ponta, se for do outro lado)
    for (var k = 0; k < vao.length; k++) { var l = lugarLivre(vao[k]); if (l > -1) irAoCocho(vao[k], l); }
    if (dica && !dica.classList.contains('some')) dica.classList.add('some');
  }

  function livreParaIr(b) {
    return b.estado !== 'fugir' && b.estado !== 'cocho' && b.estado !== 'comer' && b.estado !== 'erguido' && b.estado !== 'cair';
  }

  function voltarAPastar(b) {
    soltarSal(b); soltarCocho(b);
    b.estado = 'pastar';
    b.t = b.mae ? 1.5 + Math.random() * 3 : 3 + Math.random() * 7;
    b.alvo = null; b.desvios = null; b.travas = 0; b.chave = null; b.chaveAlvo = null;
  }

  function irAoSal(b, m) {
    var vaga = b.x <= m.x ? 0 : 1;
    if (m.vagas[vaga]) vaga = 2;
    if (m.vagas[vaga]) return false;
    soltarSal(b);
    m.vagas[vaga] = b; b.monte = m; b.vaga = vaga; b.estado = 'sal';
    return true;
  }

  // Onde o boi fica para alcançar o sal com a boca: de um lado, do outro, ou um pouco à frente
  function vagaNoSal(b) {
    var m = b.monte, u = escala(m.y) * L / 100 * b.tam, alcance = 57 * u * (b.tipo === 'bezerro' ? 1.1 : 1);
    if (b.vaga === 0) return { x: m.x - alcance, y: m.y };
    if (b.vaga === 1) return { x: m.x + alcance, y: m.y };
    return { x: m.x - alcance * 0.9, y: limitar(m.y + 16 * escala(m.y), Y_MIN, Y_MAX) };
  }

  function passear(b) {
    // Se ainda tem sal por perto com lugar livre, vai até ele
    for (var i = 0; i < montes.length; i++) {
      var m = montes[i];
      if (m.qtd > 0.15 && Math.hypot(m.x - b.x, m.y - b.y) < 320 * unidade(b) && irAoSal(b, m)) return;
    }
    if (temRacao()) {
      var livre = lugarLivre(b);
      if (livre > -1 && Math.hypot(cocho.N.x - b.x, cocho.N.y - b.y) < 420 * unidade(b)) { irAoCocho(b, livre); return; }
    }
    var u = unidade(b), alvo;
    if (b.mae) alvo = { x: b.mae.x - b.mae.dir * 40 * u + (Math.random() - 0.5) * 30 * u, y: b.mae.y + 10 + (Math.random() - 0.5) * 10 };
    else alvo = { x: b.x + (Math.random() - 0.5) * 260 * u, y: b.y + (Math.random() - 0.5) * 70 * u };
    b.alvo = { x: limitar(alvo.x, 50, W - 50), y: limitar(alvo.y, Y_MIN, Y_MAX) };
    if (pertoDoCocho(b.alvo.x, b.alvo.y, 55 * u)) {
      b.alvo.x = limitar(b.x < cocho.N.x ? cocho.N.x - 75 * u : cocho.N.x + 75 * u, 50, W - 50);
    }
    b.estado = 'andar';
  }

  function atualizarNoAr(b, dt) {
    var u = unidade(b);
    if (b.estado === 'erguido') {
      // Segue a mão com um pouco de atraso; o chão embaixo dele é onde a sombra fica
      var minimo = 22 * u;
      var topo = segurando.alvoY;
      var chao = limitar(topo + minimo, Y_MIN, Y_MAX);
      var xAntes = b.x;
      b.x += (limitar(segurando.alvoX, 30, W - 30) - b.x) * Math.min(1, dt * 14);
      b.y += (chao - b.y) * Math.min(1, dt * 14);
      var alturaAlvo = Math.max(b.y - topo, 6 * u);
      b.alturaAr += (alturaAlvo - b.alturaAr) * Math.min(1, dt * 12);
      var vx = (b.x - xAntes) / Math.max(dt, 0.001);
      b.balanco += (limitar(-vx * 0.0012, -0.32, 0.32) - b.balanco) * Math.min(1, dt * 5);
      b.passo += dt * 2.4;                       // patas pedalando no ar
      b.andando += (1 - b.andando) * Math.min(1, dt * 6);
      b.cabAlvo = 0.95; b.caudaForca = 1;
    } else {
      // Caindo: gravidade, um quique pequeno e volta a pastar, meio assustado
      b.vy += 2300 * u * dt;
      b.alturaAr -= b.vy * dt;
      b.balanco *= Math.max(0, 1 - dt * 5);
      b.andando += (0.4 - b.andando) * Math.min(1, dt * 6);
      if (b.alturaAr <= 0) {
        b.alturaAr = 0;
        if (b.vy > 260 * u) { b.vy = -b.vy * 0.28; b.alturaAr = 0.01; }
        else {
          b.vy = 0; b.balanco = 0; b.erguido = false;
          voltarAPastar(b);
          b.levanta = 1.4; b.caudaForca = 1; b.t = 1 + Math.random() * 2;
          if (pertoDoCocho(b.x, b.y, 50 * u)) {
            // Caiu em cima do cocho (ou colado nele): sai para o lado mais perto
            var p = pontoCocho(limitar((b.y - cocho.F.y) / (cocho.N.y - cocho.F.y), 0, 1));
            b.alvo = { x: limitar(p.x + (b.x >= p.x ? 1 : -1) * (p.mw + 70 * u), 50, W - 50), y: b.y };
            b.estado = 'andar'; b.levanta = 0;
          }
        }
      }
    }
    b.cab += (b.cabAlvo - b.cab) * Math.min(1, dt * 3.2);
    var psiAlvo = b.dir > 0 ? 0 : Math.PI;
    b.psi += limitar(psiAlvo - b.psi, -3.6 * dt, 3.6 * dt);
    b.cauda += dt * (2.2 + b.caudaForca * 2.5);
  }

  function atualizarBoi(b, dt) {
    if (b.estado === 'erguido' || b.estado === 'cair') { atualizarNoAr(b, dt); return; }
    var u = unidade(b);
    b.t -= dt;
    b.movendo = false;
    var dx = 0, dy = 0, d = 1e9;
    if (mouse.ativo) { dx = mouse.x - b.x; dy = mouse.y - (b.y - 48 * u); d = Math.sqrt(dx * dx + dy * dy); }
    var mexendo = mouse.ativo && performance.now() - mouse.ultimo < 300;
    var ocupado = b.estado === 'sal' || b.estado === 'lamber' || b.estado === 'cocho' || b.estado === 'comer';

    if (!ocupado && mexendo && d < 62 * u + 16 && b.estado !== 'fugir') {
      // Susto: se afasta do ponteiro
      b.estado = 'fugir'; b.t = 1.1; b.caudaForca = 1;
      var k = 1 / (d || 1);
      b.alvo = { x: limitar(b.x - dx * k * 150 * u, 40, W - 40), y: limitar(b.y - dy * k * 50 * u, Y_MIN, Y_MAX) };
    } else if (!ocupado && b.estado !== 'fugir' && d < 240 * u) {
      // Curiosidade: para e olha
      b.estado = 'olhar'; b.t = 0.9;
    }

    switch (b.estado) {
      case 'fugir':
        b.cabAlvo = 0.75;
        var chegou = andar(b, 120 * escala(b.y), dt);
        if ((chegou && b.t <= 0) || b.t < -1.5) voltarAPastar(b);
        break;
      case 'olhar':
        b.cabAlvo = 1;
        if (Math.abs(dx) > 10 * u) b.dir = dx > 0 ? 1 : -1;
        if (b.t <= 0) voltarAPastar(b);
        break;
      case 'sal':
        if (!b.monte || b.monte.qtd <= 0) { voltarAPastar(b); break; }
        b.cabAlvo = 0.5;
        b.alvo = vagaNoSal(b);
        if (andar(b, 45 * escala(b.y), dt)) b.estado = 'lamber';
        break;
      case 'lamber':
        if (!b.monte || b.monte.qtd <= 0) { voltarAPastar(b); break; }
        b.dir = b.monte.x >= b.x ? 1 : -1;
        b.cabAlvo = 0;
        b.monte.qtd -= dt * 0.045;
        break;
      case 'cocho':
        if (!temRacao()) { voltarAPastar(b); break; }
        b.cabAlvo = 0.5;
        b.alvo = b.via || lugarDoBoi(b);
        if (andar(b, 58 * escala(b.y), dt)) { if (b.via) b.via = null; else b.estado = 'comer'; }
        else if (b.travas > 5) voltarAPastar(b);   // não consegue chegar de jeito nenhum: desiste
        break;
      case 'comer':
        // Acabou a ração: logo sai do cocho e volta a andar pelo pasto
        if (!temRacao()) { voltarAPastar(b); b.t = 0.4 + Math.random() * 1.5; break; }
        // Cabeça só um pouco baixa: a boca fica na altura da ração, dentro do cocho
        b.dir = -cocho.lugares[b.lugar].lado; b.cabAlvo = 0.2;
        if (!cocho.enchendo) cocho.qtd = Math.max(0, cocho.qtd - dt * 0.02);
        break;
      case 'andar':
        b.cabAlvo = 0.45;
        if (andar(b, 24 * escala(b.y), dt) || b.travas > 2) voltarAPastar(b);   // chegou, ou desistiu e escolhe outro lugar
        break;
      default: // pastar
        if (b.levanta > 0) { b.levanta -= dt; b.cabAlvo = 0.9; }
        else {
          b.cabAlvo = 0; b.t2 -= dt;
          if (b.t2 <= 0) { b.levanta = 1 + Math.random() * 1.6; b.t2 = 5 + Math.random() * 8; }
        }
        if (b.t <= 0) passear(b);
    }

    b.cab += (b.cabAlvo - b.cab) * Math.min(1, dt * 3.2);
    // Virar: gira pela frente (cara para quem olha), dando uns passinhos no lugar
    var psiAlvo = b.dir > 0 ? 0 : Math.PI, dPsi = psiAlvo - b.psi, virando = Math.abs(dPsi) > 0.05;
    b.psi += limitar(dPsi, -3.6 * dt, 3.6 * dt);
    if (virando && !b.movendo) b.passo += dt * 1.1;
    b.andando += (((b.movendo || virando) ? 1 : 0) - b.andando) * Math.min(1, dt * 7);
    b.caudaForca += (0.3 - b.caudaForca) * Math.min(1, dt * 0.6);
    if (Math.random() < dt * 0.12) b.caudaForca = 1; // espanta uma mosca
    b.cauda += dt * (2.2 + b.caudaForca * 2.5);
  }

  function darSal(x, y) {
    x = limitar(x, 20, W - 20);
    y = limitar(y, Y_MIN - 6, Y_MAX - 4);
    var m = { x: x, y: y, qtd: 1, pop: 0, vagas: [null, null, null] };
    montes.push(m);
    if (montes.length > 3) montes.shift().qtd = 0;
    var livres = bois.filter(function (b) { return livreParaIr(b); });
    livres.sort(function (a, b) { return Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y); });
    var quantos = estreita ? 2 : 3;
    for (var i = 0; i < livres.length && quantos > 0; i++) if (irAoSal(livres[i], m)) quantos--;
    if (dica && !dica.classList.contains('some')) dica.classList.add('some');
  }

  function atualizar(dt) {
    tempo += dt;
    mouse.vx *= 0.86; mouse.vy *= 0.86;
    for (var i = 0; i < bois.length; i++) atualizarBoi(bois[i], dt);
    for (var j = 0; j < montes.length; j++) montes[j].pop = Math.min(1, montes[j].pop + dt * 3.5);
    montes = montes.filter(function (m) { return m.qtd > 0; });
    if (cocho.enchendo) { cocho.qtd = Math.min(1, cocho.qtd + dt * 1.6); if (cocho.qtd >= 1) cocho.enchendo = false; }
    // Capim: vento e o ponteiro passando
    var raio = Math.max(80, W * 0.07);
    for (var k = 0; k < tufos.length; k++) {
      var t = tufos[k];
      var alvo = 0.11 * Math.sin(tempo * 1.3 - t.x * 0.01 + t.fase * 0.2) + 0.04 * Math.sin(tempo * 2.9 + t.fase);
      if (mouse.ativo) {
        var ddx = t.x - mouse.x, ddy = (t.y - t.h * 0.5) - mouse.y, dd = Math.sqrt(ddx * ddx + ddy * ddy), rr = raio * (0.4 + 0.6 * t.s);
        if (dd < rr) { var f = 1 - dd / rr; f *= f; t.vel += f * (mouse.vx * 0.006 + (ddx >= 0 ? 1 : -1) * 0.025); }
      }
      t.vel += (alvo - t.ang) * 0.05;
      t.vel *= 0.88;
      t.ang = limitar(t.ang + t.vel, -0.9, 0.9);
    }
  }

  function desenhar() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, tela.width, tela.height);
    ctx.drawImage(fundo, 0, 0);
    // Bois e sal entram no meio do capim, na ordem de profundidade (de longe para perto)
    var objs = bois.slice();
    for (var m = 0; m < montes.length; m++) objs.push(montes[m]);
    for (var fc = 0; fc < cocho.fatias.length; fc++) objs.push(cocho.fatias[fc]);
    // O cocho entra pela ponta de longe: quem está ao lado dele fica por cima, com a cabeça sobre a ração
    function prof(o) { return o.ehFatia ? o.y - 0.5 : o.vagas ? o.y - 0.5 : o.y; }
    objs.sort(function (a, b) { return prof(a) - prof(b); });
    var i = 0;
    for (var o = 0; o < objs.length; o++) {
      var ob = objs[o], yo = prof(ob);
      while (i < tufos.length && tufos[i].y <= yo) desenharTufo(tufos[i++]);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (ob.ehFatia) desenharFatia(ob); else if (ob.vagas) desenharMonte(ob); else desenharBoi(ob);
    }
    while (i < tufos.length) desenharTufo(tufos[i++]);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function desenharTufo(t) {
    var cb = t.carimbo, e = t.h / ALT * dpr;
    var cs = Math.cos(t.ang) * e, sn = Math.sin(t.ang) * e;
    ctx.setTransform(cs, sn, -sn, cs, t.x * dpr, t.y * dpr);
    ctx.drawImage(cb.tela, cb.sx, cb.sy, cb.sw, cb.sh, -cb.ax, -cb.ay, cb.w, cb.h);
  }

  // Laço de animação: só roda com o pasto visível e a aba aberta
  var visivel = false, rodando = false, antes = 0;
  function quadro(agora) {
    if (!visivel || document.hidden) { rodando = false; return; }
    var dt = Math.min(0.05, (agora - antes) / 1000 || 0.016); antes = agora;
    atualizar(dt); desenhar();
    requestAnimationFrame(quadro);
  }
  function ligar() { if (calmo || rodando || !visivel || document.hidden) return; rodando = true; antes = performance.now(); requestAnimationFrame(quadro); }

  // Ponteiro (mouse, caneta ou dedo). Um toque rápido, sem arrastar, deixa o sal.
  var dica = caixa.querySelector('.pasto-dica');
  var toque = null;
  function posicao(e) { var r = tela.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function mover(e) {
    var p = posicao(e), agora = performance.now();
    if (mouse.ativo && agora - mouse.ultimo < 120) {
      var dt = Math.max(8, agora - mouse.ultimo);
      mouse.vx = mouse.vx * 0.5 + ((p.x - mouse.x) / dt * 16) * 0.5;
      mouse.vy = mouse.vy * 0.5 + ((p.y - mouse.y) / dt * 16) * 0.5;
    }
    mouse.x = p.x; mouse.y = p.y; mouse.ativo = true; mouse.ultimo = agora;
  }
  function sair() { if (segurando) return; mouse.ativo = false; mouse.x = mouse.y = -9999; toque = null; }

  // O boi que está debaixo do ponteiro (o mais da frente, se houver vários)
  function boiNoPonto(x, y) {
    var lista = bois.slice().sort(function (a, z) { return z.y - a.y; });
    for (var i = 0; i < lista.length; i++) {
      var b = lista[i], u = unidade(b), base = b.y - (b.alturaAr || 0);
      var meia = (62 * Math.max(Math.abs(Math.cos(b.psi)), 0.45) + 6) * u;
      if (x > b.x - meia && x < b.x + meia && y > base - 98 * u && y < base + 4) return b;
    }
    return null;
  }

  var segurando = null;
  function pegar(b, p, e) {
    soltarSal(b); soltarCocho(b);
    b.estado = 'erguido'; b.erguido = true; b.alvo = null; b.vy = 0; b.levanta = 0;
    b.alturaAr = b.alturaAr || 0; b.balanco = b.balanco || 0;
    segurando = { boi: b, dx: b.x - p.x, dy: (b.y - b.alturaAr) - p.y, alvoX: b.x, alvoY: b.y - b.alturaAr, id: e.pointerId };
    try { tela.setPointerCapture(e.pointerId); } catch (erro) {}
    tela.style.cursor = 'grabbing';
    if (dica && !dica.classList.contains('some')) dica.classList.add('some');
  }
  function largar() {
    if (!segurando) return;
    var b = segurando.boi;
    b.estado = 'cair'; b.vy = 0;
    segurando = null;
    tela.style.cursor = '';
  }

  tela.addEventListener('pointermove', function (e) {
    mover(e);
    var p = posicao(e);
    if (segurando) { segurando.alvoX = p.x + segurando.dx; segurando.alvoY = p.y + segurando.dy; return; }
    if (!calmo && e.pointerType === 'mouse') tela.style.cursor = boiNoPonto(p.x, p.y) ? 'grab' : '';
  });
  tela.addEventListener('pointerdown', function (e) {
    var p = posicao(e);
    var b = calmo ? null : boiNoPonto(p.x, p.y);
    if (b) { mover(e); pegar(b, p, e); toque = null; return; }
    toque = { x: p.x, y: p.y, t: performance.now() };
  });
  tela.addEventListener('pointerup', function (e) {
    var p = posicao(e);
    if (segurando) { largar(); if (e.pointerType !== 'mouse') sair(); return; }
    if (!calmo && toque && Math.hypot(p.x - toque.x, p.y - toque.y) < 12 && performance.now() - toque.t < 600) { if (noCocho(p.x, p.y)) servirRacao(); else darSal(p.x, p.y); }
    toque = null;
    if (e.pointerType !== 'mouse') sair();
  });
  tela.addEventListener('pointerleave', sair);
  tela.addEventListener('pointercancel', function () { largar(); sair(); });
  // No celular, segurar um boi não deve rolar a página
  tela.addEventListener('touchstart', function (e) { if (segurando) e.preventDefault(); }, { passive: false });
  tela.addEventListener('touchmove', function (e) { if (segurando) e.preventDefault(); }, { passive: false });

  // Texto da dica conforme o aparelho
  if (dica && window.matchMedia('(hover: none)').matches) dica.textContent = 'Arraste os bois · toque no cocho (ração) ou no pasto (sal)';
  if (dica && calmo) dica.hidden = true;
  if (calmo) caixa.style.cursor = 'default';

  // Liga e desliga conforme o pasto entra e sai da tela
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
