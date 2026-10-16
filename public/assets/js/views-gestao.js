/* Telas da visão gestão: todos os projetos, projeto com abas e ficha da escola.
 * Seguem o mockup aprovado: faixa roxa no topo, conteúdo em UMA coluna, sem barra lateral.
 * Funções puras: recebem o contexto e devolvem { band, corpo, cls } (HTML). Não alteram dado nenhum.
 * O Detalhar da ficha é o mesmo da versão anterior (views.js), reaproveitado sem reescrever.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./regras.js'), require('./normalizar.js'), require('./gestao.js'), require('./views.js'));
  else root.PainelViewsGestao = factory(root.PainelRegras, root.PainelNorm, root.PainelGestao, root.PainelViews);
})(typeof self !== 'undefined' ? self : this, function (R, N, G, V) {
  'use strict';

  var ok = N.ok, esc = V.esc, dt = V.dt, milhar = G.milhar, pct = G.pct, pl = G.pl;
  var FX = G.FAIXAS; // nomes das faixas: sempre do dicionário em gestao.js, nunca escritos aqui
  var LIM_LISTA = 5, LIM_PROJ = 3, LIM_ESC = 8, DL_MAX = 150;
  var ABAS = [['visao', 'Visão executiva'], ['escolas', 'Escolas'], ['melhorias', 'Melhorias'], ['historico', 'Histórico']];
  var QC = {
    b: { bg: '#DDF3E5', fg: '#14693C', bar: '#1F8A4C', l: 'Bom' },
    r: { bg: '#FCEBC5', fg: '#7A4B00', bar: '#E0A526', l: 'Regular' },
    f: { bg: '#FAD9D9', fg: '#9B1C1C', bar: '#B4261E', l: 'Ruim' },
    n: { bg: '#E8E5EE', fg: '#4A4458', bar: '#9B94A8', l: 'Não registrado' }
  };
  var MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

  // ── pedaços pequenos ─────────────────────────────────────────────────────────
  function d1(n) { return String(n.toFixed(1)).replace('.', ','); }
  function nrTxt(s) { return '<span class="gv-nr">' + (s || 'Não registrado') + '</span>'; }
  function nrOu(x, f, s) { return ok(x) ? f(x) : nrTxt(s); }
  function pillF(f, mista) {
    var c = G.CORES[f] || G.CORES.nm;
    if (mista) return '<span class="gv-pill gv-mista"><i></i>' + esc(FX.apr.rotulo) + '</span>';
    return '<span class="gv-pill" style="background:' + c.bg + ';color:' + c.fg + '">' + esc((FX[f] || FX.nm).rotulo) + '</span>';
  }
  // nota meio verde meio âmbar quando a escola é apta mas uma das duas notas veio com ressalva
  function clsNota(l) { return l && l.mista ? ' gv-n2' : ''; }
  function pillQ(k) { var c = QC[k] || QC.n; return '<span class="gv-pill" style="background:' + c.bg + ';color:' + c.fg + '">' + c.l + '</span>'; }
  function seg(n, cor) { return '<i style="flex:' + n + ' 1 0;min-width:' + (n > 0 ? '4px' : '0') + ';background:' + cor + '"></i>'; }
  function barra(r, alto) { return '<div class="gv-bar" style="height:' + alto + 'px">' + seg(r.pp, G.CORES.ap.dot) + seg(r.pr, G.CORES.apr.dot) + seg(r.a, G.CORES.re.dot) + seg(r.b, G.CORES.rp.dot) + '</div>'; }
  function btn(act, arg, txt, cls, extra) {
    return '<button type="button" class="gv-btn' + (cls ? ' ' + cls : '') + '" data-act="' + act + '" data-arg="' + esc(arg == null ? '' : arg) + '"' + (extra || '') + '>' + txt + '</button>';
  }
  function kpi(rotulo, valor, sub, cor, op) {
    op = op || {};
    return '<div class="gv-kpi' + (op.tracejado ? ' dashed' : '') + '"><div class="gv-kl">' + rotulo + '</div><div class="gv-kv num' + (op.texto ? ' t' : '') + '"' + (cor ? ' style="color:' + cor + '"' : '') + '>' + valor + '</div><div class="gv-ks">' + sub + '</div>' +
      (op.meta ? '<div class="gv-meta">Meta: [definir]</div>' : '') + '</div>';
  }
  function dd(ms, comAno) { var d = new Date(ms); return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + (comAno ? '/' + d.getFullYear() : ''); }
  function faixaDatas(ini, fim) {
    if (!ok(ini) || !ok(fim)) return '';
    if (dt(ini) === dt(fim)) return dt(ini);
    return new Date(ini).getFullYear() === new Date(fim).getFullYear() ? dd(ini) + ' a ' + dt(fim) : dt(ini) + ' a ' + dt(fim);
  }
  function textoPeriodo(p) { return p ? 'Vistorias ' + (dt(p.ini) === dt(p.fim) ? 'em ' + dt(p.ini) : 'de ' + faixaDatas(p.ini, p.fim)) : ''; }
  function juntar(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' e ' + a[a.length - 1]; }
  function hm(ms) { var d = new Date(ms), h = d.getHours(), m = d.getMinutes(); return h || m ? ('0' + h).slice(-2) + ':' + ('0' + m).slice(-2) : ''; }

  function verTodos(S, chave, total, limite, rotulo) {
    if (total <= limite) return '';
    var aberto = S.gVer && S.gVer[chave];
    return '<div class="gv-mais">' + btn('gVer', chave, aberto ? 'Mostrar só ' + (limite === 1 ? 'o principal' : 'os ' + limite + ' principais') : rotulo, 'l', ' aria-expanded="' + !!aberto + '"') + '</div>';
  }
  function limitar(S, chave, lista, limite) { return S.gVer && S.gVer[chave] ? lista : lista.slice(0, limite); }
  function vazioBox(t) { return '<div class="gv-vazio">' + esc(t) + '</div>'; }

  // ── faixa roxa do topo ───────────────────────────────────────────────────────
  function btnsTopo(C, extra) {
    return '<div class="gv-btns">' + (extra || '') + (C.menuHtml || '') + '</div>';
  }
  function abasHtml(S) {
    return '<div class="gv-tabs" role="tablist">' + ABAS.map(function (a) {
      var on = S.gAba === a[0];
      return '<button type="button" class="gv-tab' + (on ? ' on' : '') + '" role="tab" aria-selected="' + on + '" data-act="gAba" data-arg="' + a[0] + '">' + a[1] + '</button>';
    }).join('') + '</div>';
  }
  function banda(o) {
    return '<div class="gv-band"><div class="gv-band-in' + (o.fim ? ' fim' : '') + '">' + V.selo() +
      '<div class="gv-top"><div class="gv-hd"><div class="gv-kick">Painel de Vistorias</div><div class="gv-t1"><h1 class="gv-title">' + esc(o.titulo) + '</h1>' + (o.voltar || '') + '</div>' +
      (o.sub ? '<div class="gv-sub">' + esc(o.sub) + '</div>' : '') + '</div>' + (o.botoes || '') + '</div>' + (o.abas || '') + '</div></div>';
  }
  var SETA = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';

  // ── bloco resumo + prontidão (home e visão do projeto) ───────────────────────
  function blocoResumo(titulo, f, r, comAlunos) {
    var linhas = [f.l1, f.l2, f.l3].filter(Boolean).map(function (t) { return '<div>' + esc(t) + '</div>'; }).join('');
    var linha = function (fx, nome, n, al) {
      return '<div><span class="gv-sw" style="background:' + G.CORES[fx].dot + '"></span><span class="n">' + nome + '</span><span class="a num">' + pl(n, 'escola', 'escolas') + '</span><span class="b num">' +
        (comAlunos && r.nComAlunos ? milhar(al) + ' alunos' : pct(n, r.n)) + '</span></div>';
    };
    return '<div class="gv-lin"><div class="gv-card g1" style="flex:1.45 1 560px"><div class="gv-cap">' + esc(titulo) + '</div><h2 class="gv-big">' + esc(f.manchete) + '</h2><div class="gv-lines">' + linhas + '</div>' +
      '</div>' +
      '<div class="gv-card g2" style="flex:1 1 400px"><div class="gv-cap">Prontidão para VDI</div>' + barra(r, 30) +
      '<div class="gv-leg">' + linha('ap', FX.ap.rotulo, r.pp, r.alPP) + (r.pr ? linha('apr', FX.apr.rotulo, r.pr, r.alPR) : '') + linha('re', FX.re.rotulo, r.a, r.alA) + linha('rp', FX.rp.rotulo, r.b, r.alB) + '</div>' +
      '<div class="gv-nota">Mesma régua do app. ' + FX.ap.rotulo + ': nota 80 ou mais. ' + FX.re.rotulo + ': 51 a 79. ' + FX.rp.rotulo + ': 50 ou menos. ' + FX.apr.rotulo + ': ' + FX.ap.uma + ' no geral, com uma das duas redes em ressalva.</div></div></div>';
  }
  function subAlunos(r) {
    if (!r.nComAlunos) return 'Alunos não registrados';
    var t = pct(r.alB, r.alunos) + ' dos ' + milhar(r.alunos) + ' alunos medidos';
    return r.nComAlunos < r.n ? t + ' (' + pl(r.n - r.nComAlunos, 'escola sem alunos registrados', 'escolas sem alunos registrados') + ')' : t;
  }

  // ══ Todos os projetos ═══════════════════════════════════════════════════════
  function viewInicial(C, subtitulo, corpo) {
    return { band: banda({ titulo: 'Painel de Vistorias', sub: subtitulo, fim: true, botoes: '<div class="gv-btns">' + (C.menuHtml || '') + '</div>' }), corpo: corpo || '', cls: '' };
  }

  function viewHome(C) {
    var S = C.S, GV = G.visaoGeral(C.escolas), r = GV.geral, np = GV.projetos.length;
    var band = banda({ titulo: 'Todos os projetos', fim: true, botoes: btnsTopo(C),
      sub: pl(np, 'projeto', 'projetos') + ', ' + pl(r.n, 'escola medida', 'escolas medidas') + ', ' + pl(C.todas.length, 'medição', 'medições') + ' no total.' });
    if (!r.n) return { band: band, cls: '', corpo: '<div class="gv-vz">Nenhuma escola com nota calculada ainda. Carregue pacotes ou planilhas com Wi-Fi ou rede física medidos.</div>' };
    var h = blocoResumo('Resumo de todos os projetos', GV.frases, r, false);
    h += '<div class="gv-kpis">' +
      kpi('Projetos', np, 'com escolas medidas') +
      kpi('Escolas medidas', r.n, r.semNota ? pl(r.semNota, 'escola ' + FX.nm.uma, 'escolas ' + FX.nm.varias) : 'todas com nota') +
      kpi('Alunos em escolas ' + FX.rp.varias, r.nComAlunos ? milhar(r.alB) : '-', subAlunos(r), '#9B1C1C') +
      kpi('Nota média', r.notaMedia, 'de 100, entre as escolas medidas') +
      kpi('Escolas com rede física', r.nComFisica, 'de ' + r.n + ' escolas medidas, ' + pct(r.nComFisica, r.n), '#4B1F7A') + '</div>';

    var projs = limitar(S, 'projetos', GV.projetos, LIM_PROJ);
    h += '<div style="display:flex;flex-direction:column;gap:14px"><div class="gv-sec"><div><h3 class="gv-h3 m">Projetos que pedem atenção</h3><div class="gv-s">' +
      (np > LIM_PROJ ? 'Os ' + LIM_PROJ + ' com mais alunos em escolas ' + FX.rp.varias + '.' : 'Do que tem mais alunos em escolas ' + FX.rp.varias + ' para o que tem menos.') + '</div></div>' +
      (np > LIM_PROJ ? btn('gVer', 'projetos', S.gVer && S.gVer.projetos ? 'Mostrar só os ' + LIM_PROJ : 'Ver os ' + np + ' projetos', 'l', ' aria-expanded="' + !!(S.gVer && S.gVer.projetos) + '"') : '') + '</div>';
    h += '<div class="gv-pjs">' + projs.map(function (p) {
      var q = p.resumo;
      return '<div class="gv-card pj"><div style="display:flex;flex-direction:column;gap:2px;min-width:0"><h4 class="gv-h3 m">' + esc(p.nome) + '</h4><div class="gv-nota">' + esc(textoPeriodo(p.periodo)) + '</div></div>' +
        '<div style="display:flex;flex-direction:column;gap:6px"><div class="gv-pj-row"><span style="font-weight:600">Escolas medidas</span><span class="num" style="font-weight:700">' + q.n + ' de ' + q.total + '</span></div>' +
        '<div class="gv-prog"><i style="width:' + (q.total ? (q.n / q.total * 100).toFixed(0) : 0) + '%"></i></div></div>' +
        '<div style="display:flex;flex-direction:column;gap:8px"><div style="font-size:13px;font-weight:600;color:#3A3250">Prontidão para VDI</div>' + barra(q, 22) +
        '<div class="num" style="display:flex;flex-wrap:wrap;gap:4px 14px;font-size:13px;color:#3A3250"><span><b style="color:#14693C">' + q.p + '</b> ' + FX.ap.varias + '</span>' + (q.pr ? '<span><b style="color:#14693C">' + q.pr + '</b> ' + FX.apr.varias.replace(FX.ap.varias + ' ', '') + '</span>' : '') + '<span><b style="color:#7A4B00">' + q.a + '</b> ' + FX.re.varias + '</span><span><b style="color:#9B1C1C">' + q.b + '</b> ' + FX.rp.varias + '</span></div></div>' +
        '<div class="gv-pj-par"><div><div class="k">Nota média</div><div class="v num">' + (q.notaMedia == null ? '-' : q.notaMedia) + '</div></div>' +
        '<div><div class="k">Alunos ' + FX.rp.varias + '</div><div class="v num" style="color:#9B1C1C">' + (q.nComAlunos ? milhar(q.alB) : '-') + '</div>' +
        '<div class="u num">' + (q.nComAlunos ? pct(q.alB, q.alunos) + ' dos ' + milhar(q.alunos) + ' alunos medidos' : 'Alunos não registrados') + '</div></div></div>' +
        '<div style="margin-top:auto;padding-top:4px">' + btn('abrirProjeto', p.nome, 'Abrir projeto', 'p pj') + '</div></div>';
    }).join('') + '</div></div>';
    return { band: band, corpo: h, cls: '' };
  }

  // ══ Projeto ═════════════════════════════════════════════════════════════════
  function linhasProj(r, L, causas) {
    var f = G.textoGeral(r, [], true);
    var gw = causas.filter(function (c) { return c.id === 'gateway'; })[0], aps = causas.filter(function (c) { return c.id === 'aps'; })[0];
    if (gw && aps && r.n) f.l2 = 'O maior ganho está em dois pontos: em ' + gw.qtd + ' das ' + r.n + ' escolas o gateway é o modem da operadora, e em ' + aps.qtd + ' os APs ficam no corredor, longe das salas.';
    else if (gw && r.n) f.l2 = 'O maior ganho está no gateway: em ' + gw.qtd + ' das ' + r.n + ' escolas ele é o modem da operadora.';
    else f.l2 = causas.length ? 'A causa que mais aparece: ' + causas[0].nome.toLowerCase() + ', em ' + causas[0].qtd + ' das ' + r.n + ' escolas.' : '';
    var comp = G.composicaoNota(L);
    if (!comp.length) f.l3 = r.nComFisica ? pl(r.nComFisica, 'escola tem', 'escolas têm') + ' só a rede física medida.' : 'Nenhuma escola tem rede física medida até agora. A nota é só do Wi-Fi.';
    else {
      var puxa = comp.filter(function (l) { return l.notaFis > l.notaWifi; }).length;
      f.l3 = (puxa === comp.length ? 'Em ' + pl(comp.length, 'escola', 'escolas') + ' a rede física está boa e puxa a nota geral para cima.' : pl(comp.length, 'escola tem', 'escolas têm') + ' Wi-Fi e rede física medidos. Nelas a nota geral é a média das duas.') +
        (r.nWifi && !r.nFis ? ' ' + (r.nWifi === 1 ? 'A outra tem o' : 'As outras ' + r.nWifi + ' têm o') + ' Wi-Fi medido.' : '');
    }
    return f;
  }

  function viewProjetoG(C) {
    var S = C.S, todas = G.linhasDe(C.escolas), L = G.doProjeto(todas, S.projeto), r = G.resumo(L);
    var per = textoPeriodo(G.periodo(L.map(function (l) { return l.e; })));
    var sub = pl(r.n, 'escola medida', 'escolas medidas') + (per ? ', ' + per.charAt(0).toLowerCase() + per.slice(1) : '') + '.';
    var band = banda({ titulo: S.projeto, sub: sub, botoes: btnsTopo(C, '<button type="button" class="gv-bo" data-act="exportarEscopo" data-arg="projeto">Exportar projeto em HTML</button>'), abas: abasHtml(S),
      voltar: '<button type="button" class="gv-bk" data-act="verGeral" data-arg="">' + SETA + 'Todos os projetos</button>' });
    if (!r.n && S.gAba !== 'escolas' && S.gAba !== 'historico') return { band: band, cls: 'ab', corpo: '<div class="gv-vz">Este projeto ainda não tem escola com nota calculada.</div>' };
    var causas = G.causasDoProjeto(L);
    var fn = { visao: abaVisao, escolas: abaEscolas, melhorias: abaMelhorias, historico: abaHistorico }[S.gAba] || abaVisao;
    return { band: band, cls: 'ab', corpo: fn(C, L, r, causas) };
  }

  function dispersao(L, causas) {
    var lim = R.LIM.wifi, med = G.medidas(L), pts = med.filter(function (l) { return l.dl != null && l.ping != null && l.tipo !== 'fis'; });
    var fora = med.filter(function (l) { return pts.indexOf(l) < 0; });
    var rot = {}; G.prioridade(L, 3).forEach(function (p) { rot[p.l.chave] = p.l.nome; });
    var xz = lim.dlRegular / DL_MAX * 100, hz = lim.pingRegular;
    var h = '<div class="gv-card" style="flex:1.1 1 560px"><h3 class="gv-h3">Velocidade e latência do Wi-Fi</h3><div class="gv-s">Cada ponto é uma escola. A zona verde é onde o VDI roda bem: mais de ' + lim.dlRegular + ' Mbps e até ' + lim.pingRegular + ' ms.</div>' +
      '<div class="gv-leg2">' + ['ap', 're', 'rp'].map(function (f) { return '<span><i style="background:' + G.CORES[f].dot + '"></i>' + FX[f].rotulo + '</span>'; }).join('') + '</div>';
    if (!pts.length) return h + vazioBox('Nenhuma escola com download e latência do Wi-Fi registrados.') + '</div>';
    h += '<div class="gv-scat"><div style="position:absolute;left:' + xz.toFixed(2) + '%;right:0;bottom:0;height:' + hz + '%;background:#DDF3E5;border-top:1px dashed #1F8A4C;border-left:1px dashed #1F8A4C"></div>' +
      '<div style="position:absolute;left:' + (xz + 1.2).toFixed(2) + '%;bottom:6px;font-size:12px;font-weight:700;color:#14693C">Zona VDI</div>';
    [['100 ms', 0], ['75 ms', 25], ['50 ms', 50], ['25 ms', 75]].forEach(function (y) { h += '<div class="gv-eixo" style="left:-52px;top:calc(' + y[1] + '% - 8px)">' + y[0] + '</div>'; });
    [['0', 0], ['50 Mbps', 33.33], ['100 Mbps', 66.67], ['150', 100]].forEach(function (x) { h += '<div class="gv-eixo" style="bottom:-26px;left:' + x[1] + '%;transform:translateX(-50%)">' + x[0] + '</div>'; });
    pts.forEach(function (l) {
      var x = Math.min(l.dl / DL_MAX, 1) * 100, y = Math.min(l.ping / 100, 1) * 100, cor = G.CORES[l.faixa].dot;
      h += '<div class="gv-pt" title="' + esc(l.nome + ': ' + d1(l.dl) + ' Mbps, ' + Math.round(l.ping) + ' ms') + '" style="left:' + x + '%;bottom:' + y + '%;background:' + cor + ';box-shadow:0 0 0 1px ' + cor + '"></div>';
      if (rot[l.chave]) h += '<span class="gv-ptn" style="left:' + x + '%;bottom:' + y + '%">' + esc(rot[l.chave]) + '</span>';
    });
    var nota = 'Pontos do Wi-Fi, na cor da nota geral. Mostra ' + pts.length + ' de ' + med.length + ' escolas.' +
      (fora.length === 1 ? ' ' + fora[0].nome + ' ficou fora: sem download e latência do Wi-Fi registrados (estava sem rede na visita).' : fora.length > 1 ? ' ' + fora.length + ' escolas ficaram fora: sem download e latência do Wi-Fi registrados.' : '');
    return h + '</div><div class="gv-nota">' + esc(nota) + '</div></div>';
  }

  // ── quadrante Histórico do projeto (Visão executiva) ─────────────────────────
  function graficoAptas(pts, atual) {
    var W = 410, H = 190, x0 = 15, x1 = 390, yb = 160, yt = 30;
    var t0 = pts[0].t, t1 = pts[pts.length - 1].fim || pts[pts.length - 1].t, span = Math.max(t1 - t0, 1);
    var nmax = Math.max.apply(null, pts.map(function (p) { return p.n; }).concat([atual, 4]));
    var X = function (t) { return x0 + (t - t0) / span * (x1 - x0); }, Y = function (n) { return yb - n / nmax * (yb - yt); };
    var lista = [];
    pts.forEach(function (p, i) { lista.push({ x: X(p.t), n: p.n }); if (p.fim && i < pts.length - 1) lista.push({ x: X(p.fim), n: p.n }); });
    var ultimo = pts[pts.length - 1]; if (ultimo.fim) lista.push({ x: X(ultimo.fim), n: ultimo.n });
    var dLinha = lista.map(function (q, i) { return (i ? 'L' : 'M') + q.x.toFixed(1) + ',' + Y(q.n).toFixed(1); }).join(' ');
    var ult = lista[lista.length - 1];
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="Escolas ' + FX.ap.varias + ' ao longo do tempo, de ' + pts[0].n + ' para ' + atual + '">' +
      '<defs><linearGradient id="gvAp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2FAE6A" stop-opacity=".55"/><stop offset="1" stop-color="#2FAE6A" stop-opacity=".05"/></linearGradient></defs>' +
      '<g stroke="#E6E2EF"><line x1="0" y1="' + yb + '" x2="' + W + '" y2="' + yb + '"/><line x1="0" y1="' + Y(nmax / 2).toFixed(1) + '" x2="' + W + '" y2="' + Y(nmax / 2).toFixed(1) + '" stroke-dasharray="3 4"/></g>' +
      '<path d="' + dLinha + ' L' + ult.x.toFixed(1) + ',' + yb + ' L' + lista[0].x.toFixed(1) + ',' + yb + ' Z" fill="url(#gvAp)"/>' +
      '<path d="' + dLinha + '" fill="none" stroke="#1E8E55" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>';
    var lx0 = X(pts[pts.length - 1].t), ultLab = -99;
    pts.forEach(function (p, i) {
      var cx = X(p.t).toFixed(1), cy = Y(p.n).toFixed(1);
      if (i === pts.length - 1) return;
      var rotulo = (lx0 - X(p.t) > 30) && (X(p.t) - ultLab > 22);
      if (rotulo) ultLab = X(p.t);
      svg += '<circle cx="' + cx + '" cy="' + cy + '" r="5" fill="#fff" stroke="#1E8E55" stroke-width="3"/>' +
        (i === 0 ? '<text x="' + cx + '" y="' + (Y(p.n) - 12).toFixed(1) + '" text-anchor="middle" font-size="' + (i === 0 ? 15 : 12) + '" font-weight="800" fill="#14693C">' + p.n + '</text>' : '');
    });
    var lx = X(pts[pts.length - 1].t);
    svg += '<circle cx="' + lx.toFixed(1) + '" cy="' + Y(ultimo.n).toFixed(1) + '" r="15" fill="#1E8E55"/><text x="' + lx.toFixed(1) + '" y="' + (Y(ultimo.n) + 6).toFixed(1) + '" text-anchor="middle" font-size="16" font-weight="800" fill="#fff">' + ultimo.n + '</text>';
    // meses no eixo
    var d = new Date(t0); d.setDate(1); d.setHours(0, 0, 0, 0);
    var meses = [];
    for (var g = 0; g < 14 && d.getTime() <= t1; g++) { if (d.getTime() >= t0 - 15 * 864e5) meses.push({ t: Math.max(d.getTime(), t0), m: d.getMonth() }); d = new Date(d.getFullYear(), d.getMonth() + 1, 1); }
    var salto = meses.length > 7 ? 2 : 1;
    svg += '<g font-size="10.5" fill="#6A6480">' + meses.filter(function (m, i) { return i % salto === 0; }).map(function (m) {
      var x = Math.min(Math.max(X(m.t), 8), W - 22);
      return '<text x="' + x.toFixed(1) + '" y="178">' + MESES[m.m].charAt(0).toUpperCase() + MESES[m.m].slice(1) + '</text>';
    }).join('') + '</g></svg>';
    return svg;
  }

  function sugestaoOfensor(L) {
    var o = G.maiorOfensor(L);
    if (!o) return '<div class="gv-sug"><div class="gv-sug-t"><span>Sugestões · maior ofensor</span></div><div class="gv-s" style="margin:6px 0 0">Nenhuma sugestão de melhoria pendente nas escolas desta seleção.</div></div>';
    var chips = o.escolas.slice(0, 3).map(function (l) { return '<button type="button" class="gv-sug-e" data-act="abrirFicha" data-arg="' + esc(l.chave) + '">' + esc(l.nome) + '</button>'; }).join('') +
      (o.escolas.length > 3 ? '<span class="gv-sug-e mais">+' + (o.escolas.length - 3) + '</span>' : '');
    return '<div class="gv-sug"><div class="gv-sug-t"><span>Sugestões · maior ofensor</span></div><div class="gv-sug-n">' + esc(o.nome) + '</div>' +
      '<div class="gv-sug-b"><i style="width:' + (o.qtd / o.de * 100).toFixed(0) + '%"></i></div>' +
      '<div class="gv-sug-s"><b>' + o.qtd + ' de ' + o.de + '</b> ' + (o.de === 1 ? 'escola com ' : 'escolas com ') + esc(o.campo) + '.' + (o.sem > 0 ? ' ' + (o.sem === 1 ? 'Outra ainda sem registro.' : 'Outras ' + o.sem + ' ainda sem registro.') : '') + '</div>' +
      '<div class="gv-sug-s">Ação: ' + esc(o.acao.charAt(0).toLowerCase() + o.acao.slice(1)) + (o.segundo ? ' Em seguida: ' + esc(o.segundo.charAt(0).toLowerCase() + o.segundo.slice(1)) + '.' : '') + '</div>' +
      '<div class="gv-sug-es">' + chips + '</div></div>';
  }

  function cardHistorico(L, r, ev) {
    var pts = G.serieAptas(L);
    var h = '<div class="gv-card gv-hc" style="flex:1 1 460px"><div class="gv-cap">Histórico do projeto</div>';
    if (pts.length >= 2) {
      h += '<div class="gv-hc-t">Escolas ' + FX.ap.varias + ' para VDI: de ' + pts[0].n + ' para ' + r.p + '</div>' + graficoAptas(pts, r.p) +
        '<div class="gv-nota" style="margin:2px 0 14px">' + (ev ? 'Nota média das escolas medidas mais de uma vez: ' + (ev.media > 0 ? '+' : '') + d1(ev.media) + ' pts desde a medição anterior. ' : '') + 'A linha segue a data de cada medição.</div>';
    } else h += '<div class="gv-hc-t">Escolas ' + FX.ap.varias + ' para VDI: ' + r.p + '</div>' + vazioBox('A evolução aparece quando o projeto tiver uma segunda rodada de vistorias.');
    return h + sugestaoOfensor(L) + '</div>';
  }

  function abaVisao(C, L, r, causas) {
    var h = '';
    h += blocoResumo('Resumo executivo', linhasProj(r, L, causas), r, true);
    var ev = G.evolucao(L);
    h += '<div class="gv-kpis">' +
      kpi('Escolas ' + FX.ap.varias + ' para VDI', r.p, 'de ' + r.n + ' medidas, ' + pct(r.p, r.n), '#14693C', { meta: true }) +
      kpi('Alunos em escolas ' + FX.rp.varias, r.nComAlunos ? milhar(r.alB) : '-', subAlunos(r), '#9B1C1C') +
      kpi('Nota média', r.notaMedia, 'de 100, ' + r.n + ' escolas', '#2E1250', { meta: true }) +
      kpi('Latência acima de ' + R.LIM.wifi.pingRegular + ' ms', r.comPing ? r.latAlta : '-', r.comPing ? 'de ' + r.comPing + ' escolas com latência medida' : 'Latência não registrada', '#7A4B00') + '</div>';

    h += '<div class="gv-lin">' + dispersao(L, causas) + cardHistorico(L, r, ev) + '</div>';

    var refs = G.referencias(L, 3);
    h += '<div class="gv-lin"><div class="gv-card" style="flex:1 1 340px"><h3 class="gv-h3">Escolas de referência</h3><div class="gv-s">' + (refs.length === 1 ? 'A melhor nota.' : 'As ' + refs.length + ' melhores notas.') + ' São o padrão a replicar nas outras.</div><div style="display:flex;flex-direction:column;margin-top:10px">' +
      refs.map(function (l) {
        var c = G.CORES[l.faixa];
        return '<div class="gv-ref"><div class="gv-ref-n num" style="background:' + c.bg + ';color:' + c.fg + '">' + Math.round(l.nota) + '</div><div style="display:flex;flex-direction:column;gap:2px;min-width:0"><div style="font-weight:700">' + esc(l.nome) + '</div><div class="num" style="font-size:13px;color:#5F5870">' +
          esc([l.alunos != null ? milhar(l.alunos) + ' alunos' : 'Alunos não registrados', l.dl != null ? d1(l.dl) + ' Mbps' : null, l.ping != null ? Math.round(l.ping) + ' ms' : null].filter(Boolean).join(', ')) + '</div></div></div>';
      }).join('') + '</div></div>';
    h += '</div>';
    var pr = G.prioridade(L, LIM_LISTA);
    h += '<div class="gv-card"><div class="gv-hh"><div><h3 class="gv-h3">Prioridade de intervenção</h3><div class="gv-s">As ' + LIM_LISTA + ' escolas onde agir primeiro: quem afeta mais alunos e está pior vem na frente.</div></div>' +
      btn('gAba', 'escolas', 'Ver as ' + r.n + ' escolas') + '</div>';
    h += pr.length ? '<div class="gv-scroll"><div class="gv-tbl" style="--w:1060px;--pad:16px;--cols:40px minmax(190px,1.5fr) 80px 64px 120px minmax(130px,.9fr) minmax(280px,2.2fr) 110px"><div class="gv-th"><div>#</div><div>Escola</div><div class="gv-r">Alunos</div><div class="gv-r">Nota</div><div>Prontidão</div><div>Causa principal</div><div>Ação sugerida</div><div></div></div>' +
      pr.map(function (p) {
        return '<div class="gv-tr"><div class="num gv-ord" style="font-size:18px">' + p.pos + '</div><div class="b">' + esc(p.l.nome) + '</div><div class="num gv-r">' + nrOu(p.l.alunos, milhar) + '</div><div class="num gv-r h">' + Math.round(p.l.nota) + '</div><div>' + pillF(p.l.faixa, p.l.mista) + '</div>' +
          '<div style="font-weight:600">' + esc(p.causa) + '</div><div style="color:#3A3250">' + esc(p.acao) + '</div><div>' + btn('abrirFicha', p.l.chave, 'Abrir ficha') + '</div></div>';
      }).join('') + '</div></div>' : '<div class="gv-vazio">Nenhuma escola abaixo da nota 80.</div>';
    return h + '</div>';
  }

  function chip(act, arg, on, txt) { return '<button type="button" class="gv-chip' + (on ? ' on' : '') + '" data-act="' + act + '" data-arg="' + arg + '" aria-pressed="' + on + '">' + txt + '</button>'; }

  // seletor do cabeçalho da lista de escolas (troca o estado pelo evento change)
  function seletor(chave, rotulo, atual, ops) {
    return '<label class="gv-sel"><span>' + rotulo + '</span><select data-sel="' + chave + '">' + ops.map(function (o) {
      return '<option value="' + o[0] + '"' + (o[0] === atual ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
    }).join('') + '</select></label>';
  }

  // barra clicável do gráfico: filtra a lista abaixo (clicar de novo limpa)
  function gbar(act, arg, ativo, algumAtivo, nome, n, total, cor, tip) {
    var larg = total ? (n / total * 100) : 0;
    return '<button type="button" class="gv-gb' + (ativo ? ' on' : algumAtivo ? ' dim' : '') + '" data-act="' + act + '" data-arg="' + arg + '" aria-pressed="' + ativo + '" title="' + esc(tip) + '"' + (n === 0 && !ativo ? ' disabled' : '') + '>' +
      '<span class="n">' + esc(nome) + '</span><span class="t"><i style="width:' + larg.toFixed(1) + '%;min-width:' + (n > 0 ? '6px' : '0') + ';background:' + cor + '"></i></span><span class="v num"><b>' + n + '</b> ' + pct(n, total) + '</span></button>';
  }

  function dataUlt(l) { var d = l.e && l.e.ultima && l.e.ultima.data; return ok(d) ? d : 0; }
  function abaEscolas(C, L, r) {
    var S = C.S, M = G.medidas(L);
    var porT = G.porTipo(M, S.gTipo);                                                        // escolas do tipo escolhido
    var daFaixa = function (l, fx) { return fx === 'todas' || (fx === 'apr' ? !!l.mista : l.faixa === fx && !(fx === 'ap' && l.mista)); };
    var porF = M.filter(function (l) { return daFaixa(l, S.gFiltro); });   // escolas da faixa escolhida
    var cont = G.contagemTipos(porF);
    var nf = function (f) { return porT.filter(function (l) { return daFaixa(l, f); }).length; };
    var base = porT.filter(function (l) { return daFaixa(l, S.gFiltro); }).sort(function (a, b) { return S.gOrdem === 'nota' ? a.nota - b.nota : (dataUlt(b) - dataUlt(a)) || (a.nota - b.nota); });
    var lista = limitar(S, 'escolas', base, LIM_ESC);
    var fxAtivo = S.gFiltro !== 'todas', tpAtivo = S.gTipo !== 'todas';
    var dica = function (n, tot, quem) { return n + (n === 1 ? ' escola ' : ' escolas ') + quem + ' (' + pct(n, tot) + ' de ' + tot + '). Clique para filtrar a lista abaixo.'; };
    var TP = [['wifi', 'Só Wi-Fi', '#4B1F7A', 'só com Wi-Fi'], ['hib', 'Wi-Fi e rede física', '#7B4FB0', 'com Wi-Fi e rede física'], ['fis', 'Só rede física', '#B79BDB', 'só com rede física']];
    var h = '<div class="gv-card"><h3 class="gv-h3">Como estão as escolas</h3><div class="gv-s">Passe o mouse para ver os números. Clique em uma barra para filtrar a lista abaixo. Clique de novo para limpar.</div><div class="gv-gcols">' +
      '<div class="gv-gcol"><div class="gv-cap">Prontidão para VDI</div>' + [['ap', FX.ap.rotulo, FX.ap.varias + ' para VDI'], ['apr', FX.apr.rotulo, FX.apr.varias], ['re', FX.re.rotulo, FX.re.varias], ['rp', FX.rp.rotulo, FX.rp.varias]].map(function (x) {
        return gbar('gFiltro', x[0], S.gFiltro === x[0], fxAtivo, x[1], nf(x[0]), porT.length, G.CORES[x[0]].dot, dica(nf(x[0]), porT.length, x[2]));
      }).join('') + '</div><div class="gv-gcol"><div class="gv-cap">Tipo de rede</div>' + TP.map(function (x) {
        return gbar('gTipo', x[0], S.gTipo === x[0], tpAtivo, x[1], cont[x[0]], porF.length, x[2], dica(cont[x[0]], porF.length, x[3]));
      }).join('') + '</div></div></div>';
    var sit = [['todas', 'Todas (' + porT.length + ')'], ['ap', FX.ap.plural + ' (' + nf('ap') + ')']].concat(nf('apr') ? [['apr', FX.apr.plural + ' (' + nf('apr') + ')']] : []).concat([['re', FX.re.plural + ' (' + nf('re') + ')'], ['rp', FX.rp.plural + ' (' + nf('rp') + ')']]);
    h += '<div class="gv-card"><div class="gv-hh" style="gap:16px"><div><h3 class="gv-h3">Escolas</h3><div class="gv-s">' + (S.gOrdem === 'nota' ? 'Da pior nota para a melhor.' : 'As vistorias mais recentes primeiro.') + '</div></div><div class="gv-sels">' +
      seletor('gFiltro', 'Situação', S.gFiltro, sit) +
      seletor('gTipo', 'Tipo de rede', S.gTipo, [['todas', 'Todas as redes (' + cont.todas + ')'], ['wifi', 'Só Wi-Fi (' + cont.wifi + ')'], ['hib', 'Híbridas, Wi-Fi e rede física (' + cont.hib + ')'], ['fis', 'Só rede física (' + cont.fis + ')']]) +
      seletor('gOrdem', 'Ordenar por', S.gOrdem === 'nota' ? 'nota' : 'recentes', [['recentes', 'Última vistoria'], ['nota', 'Pior nota']]) + '</div></div>';
    h += '<div class="gv-scroll"><div class="gv-tbl" style="--w:960px;--gap:12px;--pad:13px;--cols:minmax(200px,2fr) 100px 70px 80px 70px 90px 160px 80px"><div class="gv-th"><div>Escola</div><div>Vistoria</div><div class="gv-r">Alunos</div><div class="gv-r">Nota geral</div><div class="gv-r">Wi-Fi</div><div class="gv-r">Rede física</div><div>Prontidão</div><div></div></div>' +
      lista.map(function (l) {
        return '<div class="gv-tr"><div class="b">' + esc(l.nome) + '</div><div class="num">' + (dataUlt(l) ? dt(dataUlt(l)) : '-') + '</div><div class="num gv-r">' + (l.alunos != null ? milhar(l.alunos) : '<span class="gv-ph" style="font-size:11px">Não registrado</span>') + '</div><div class="num gv-r h' + clsNota(l) + '">' + Math.round(l.nota) + '</div>' +
          '<div class="num gv-r">' + (l.notaWifi != null && l.tipo !== 'fis' ? Math.round(l.notaWifi) : '<span class="gv-ph" style="font-size:11px">Sem Wi-Fi</span>') + '</div>' +
          '<div class="num gv-r">' + (l.notaFis != null ? Math.round(l.notaFis) : '<span class="gv-ph" style="font-size:11px">Sem rede física</span>') + '</div><div style="justify-self:start">' + pillF(l.faixa, l.mista) + '</div><div>' + btn('abrirFicha', l.chave, 'Abrir', 's') + '</div></div>';
      }).join('') + '</div></div>';
    if (!base.length) h += '<div style="padding:28px 8px;text-align:center;color:#5F5870;font-size:14px">Nenhuma escola neste filtro.</div>';
    if (base.length > LIM_ESC) h += '<div class="gv-mais">' + btn('gVer', 'escolas', S.gVer && S.gVer.escolas ? 'Mostrar só as ' + LIM_ESC : 'Ver as ' + base.length + ' escolas', 'l', ' aria-expanded="' + !!(S.gVer && S.gVer.escolas) + '"') + '</div>';
    return h + '</div>';
  }

  function abaMelhorias(C, L, r) {
    var S = C.S, cats = G.melhorias(L), sel = S.gMelhoria || 'todas';
    var cat = cats.filter(function (c) { return c.id === sel; })[0];
    if (!cat) sel = 'todas';
    var h = '<div class="gv-card"><h3 class="gv-h3">Melhorias do projeto</h3><div class="gv-s">Todas as melhorias que o app sugere, somadas por tipo. Clique em um tipo para ver as escolas que precisam dela. Clique na escola para abrir a ficha.</div>';
    if (!cats.length) return h + vazioBox('Nenhuma melhoria sugerida com os dados desta seleção.') + '</div>';
    h += '<div class="gv-chips" style="margin:10px 0 14px">' + chip('gMelhoria', 'todas', sel === 'todas', 'Todas (' + cats.length + ')') +
      cats.map(function (c) { return chip('gMelhoria', c.id, sel === c.id, esc(c.nome) + ' (' + c.qtd + ')'); }).join('') + '</div>';
    h += '<div class="gv-mels">' + cats.map(function (c) {
      var on = sel === c.id;
      return '<button type="button" class="gv-mel' + (on ? ' on' : sel !== 'todas' ? ' dim' : '') + '" data-act="gMelhoria" data-arg="' + c.id + '" aria-pressed="' + on + '">' +
        '<div class="a"><div style="display:flex;justify-content:space-between;gap:12px;font-size:15px"><span style="font-weight:700">' + esc(c.nome) + '</span><span class="num" style="font-weight:800">' + c.qtd + ' de ' + c.de + '</span></div>' +
        '<div class="gv-fb"><i style="width:' + (c.qtd / c.de * 100).toFixed(0) + '%;background:#B4261E"></i></div>' +
        '<div class="gv-nota" style="margin-top:4px">' + (c.de === 1 ? 'escola' : 'escolas') + ' com ' + esc(c.campo) + (c.sem > 0 ? '. ' + (c.sem === 1 ? 'Outra ainda sem registro.' : 'Outras ' + c.sem + ' ainda sem registro.') : '.') + '</div></div>' +
        '<div class="b"><div class="k">Por que importa</div>' + esc(c.porque) + '</div><div class="c"><div class="k">Ação sugerida</div>' + esc(c.acao) + '</div></button>';
    }).join('') + '</div></div>';

    // escolas: do tipo escolhido, ou todas as que têm alguma melhoria
    var por = {};
    cats.forEach(function (c) { c.escolas.forEach(function (l) { (por[l.chave] = por[l.chave] || { l: l, itens: [] }).itens.push(c.nome); }); });
    var linhas = Object.keys(por).map(function (k) { return por[k]; }).filter(function (x) { return sel === 'todas' || x.itens.indexOf(cat.nome) >= 0; })
      .sort(function (a, b) { return b.itens.length - a.itens.length || (a.l.nota == null ? 101 : a.l.nota) - (b.l.nota == null ? 101 : b.l.nota); });
    h += '<div class="gv-card"><div class="gv-hh"><div><h3 class="gv-h3">' + (sel === 'todas' ? 'Escolas com melhorias sugeridas' : 'Escolas que precisam de: ' + esc(cat.nome)) + '</h3><div class="gv-s">' +
      pl(linhas.length, 'escola', 'escolas') + '. Quem tem mais melhorias vem na frente.</div></div>' + (sel !== 'todas' ? btn('gMelhoria', sel, 'Limpar filtro') : '') + '</div>';
    h += '<div class="gv-scroll"><div class="gv-tbl" style="--w:940px;--gap:12px;--pad:13px;--cols:minmax(200px,2fr) 70px 64px 160px minmax(220px,2.4fr) 100px"><div class="gv-th"><div>Escola</div><div class="gv-r">Alunos</div><div class="gv-r">Nota</div><div>Prontidão</div><div>Melhorias</div><div></div></div>' +
      limitar(S, 'melhorias', linhas, LIM_ESC).map(function (x) {
        var l = x.l;
        return '<div class="gv-tr"><div class="b"><button type="button" class="gv-link" data-act="abrirFicha" data-arg="' + esc(l.chave) + '">' + esc(l.nome) + '</button></div><div class="num gv-r">' + nrOu(l.alunos, milhar) + '</div><div class="num gv-r h">' + (l.nota == null ? '-' : Math.round(l.nota)) + '</div><div>' + pillF(l.faixa, l.mista) + '</div>' +
          '<div style="font-size:13px;color:#3A3250">' + x.itens.map(esc).join(', ') + '</div><div>' + btn('abrirFicha', l.chave, 'Abrir', 's') + '</div></div>';
      }).join('') + '</div></div>' + verTodos(S, 'melhorias', linhas.length, LIM_ESC, 'Ver as ' + linhas.length + ' escolas') + '</div>';
    return h;
  }

  function abaHistorico(C, L, r) {
    var S = C.S, rs = G.rodadas(L), fontes = G.fontes(L), n = rs.length, N2 = Math.max(n, 2);
    var h = '<div style="display:flex;flex-direction:column;gap:24px"><div class="gv-lin"><div class="gv-card" style="flex:1 1 520px"><h3 class="gv-h3">Nota média por rodada</h3><div class="gv-s">Uma rodada é um conjunto de vistorias feitas no mesmo período (sem pausa de mais de ' + G.CORTE_RODADA_DIAS + ' dias). Com uma rodada só, não há o que comparar.</div>';
    if (!n) h += vazioBox('Nenhuma medição com data para montar as rodadas.');
    else {
      var X = function (i) { return ((i + 0.5) / N2 * 100); };
      h += '<div class="gv-hist"><div class="gv-eixo" style="left:-44px;top:-8px">100</div><div class="gv-eixo" style="left:-36px;top:calc(50% - 8px)">50</div><div class="gv-eixo" style="left:-26px;bottom:-8px">0</div>' +
        '<div style="position:absolute;left:0;right:0;top:50%;border-top:1px dashed #E4DEEC"></div><div style="position:absolute;left:0;right:0;top:20%;border-top:1px dashed #1F8A4C"></div>' +
        '<div style="position:absolute;right:4px;top:20%;margin-top:-20px;font-size:12px;font-weight:700;color:#14693C">Nota 80, ' + FX.ap.uma + '</div>';
      var linhas = '', ant = null;
      rs.forEach(function (x, i) {
        if (x.notaMedia == null) { ant = null; return; }
        if (ant) linhas += '<line x1="' + X(ant.i) + '" y1="' + (100 - ant.v) + '" x2="' + X(i) + '" y2="' + (100 - x.notaMedia) + '" stroke="#4B1F7A" stroke-width="2" vector-effect="non-scaling-stroke"/>';
        ant = { i: i, v: x.notaMedia };
      });
      if (n === 1 && rs[0].notaMedia != null) linhas += '<line x1="' + X(0) + '" y1="' + (100 - rs[0].notaMedia) + '" x2="' + X(1) + '" y2="' + (100 - rs[0].notaMedia) + '" stroke="#CDBBE6" stroke-width="2" stroke-dasharray="6 5" vector-effect="non-scaling-stroke"/>';
      h += '<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' + linhas + '</svg>';
      rs.forEach(function (x, i) {
        if (x.notaMedia != null) h += '<div class="gv-hdot on" style="left:' + X(i) + '%;bottom:' + x.notaMedia + '%"></div><div class="gv-hval num" style="left:' + X(i) + '%;bottom:' + x.notaMedia + '%">' + x.notaMedia + '</div>';
        h += '<div class="gv-hlab" style="left:' + X(i) + '%">Rodada ' + x.n + ', ' + MESES[new Date(x.ini).getMonth()] + '/' + new Date(x.ini).getFullYear() + '</div>';
      });
      if (n === 1) {
        if (rs[0].notaMedia != null) h += '<div class="gv-hdot fut" style="left:' + X(1) + '%;bottom:' + rs[0].notaMedia + '%"></div><div style="position:absolute;left:' + X(1) + '%;bottom:' + rs[0].notaMedia + '%;margin:0 0 16px -50px;width:100px;text-align:center;font-size:12px;color:#5F5870">Aguardando</div>';
        h += '<div class="gv-hlab" style="left:' + X(1) + '%;color:#5F5870">Rodada 2</div>';
      }
      h += '</div>';
    }
    h += '</div><div class="gv-card" style="flex:1 1 380px"><h3 class="gv-h3">Rodadas</h3><div class="gv-rods">';
    var rev = rs.slice().reverse();
    h += limitar(S, 'rodadas', rev, 3).map(function (x, i) {
      return '<div class="gv-rod' + (x.n === n ? ' on' : '') + '"><div style="font-weight:800">Rodada ' + x.n + '</div><div style="font-size:14px;color:#3A3250">' + esc(faixaDatas(x.ini, x.fim)) + '. ' + pl(x.medicoes, 'vistoria', 'vistorias') + ', ' + pl(x.escolas, 'escola medida', 'escolas medidas') + '.</div>' +
        '<div class="num" style="font-size:13px;color:#5F5870">' + (x.notaMedia == null ? 'Sem nota.' : 'Nota média ' + x.notaMedia + '. ' + pl(x.p, FX.ap.uma, FX.ap.varias) + ', ' + x.a + ' ' + FX.re.varias + ', ' + x.b + ' ' + FX.rp.varias + '.') + '</div></div>';
    }).join('') + (n === 1 ? '<div class="gv-rod dashed"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span style="font-weight:800;color:#5F5870">Rodada 2</span><span class="gv-pill sm gray" style="font-size:12px">A fazer</span></div><div style="font-size:14px;color:#5F5870">Ainda sem vistorias. Quando chegar, mostra a comparação com a rodada 1, escola a escola.</div></div>' : '') + '</div>' +
      verTodos(S, 'rodadas', rs.length, 3, 'Ver as ' + rs.length + ' rodadas') + '</div></div>';
    h += '<div class="gv-card"><h3 class="gv-h3">Pacote em uso</h3><div class="gv-s">De onde vieram os números. Um pacote novo com a mesma vistoria substitui o anterior.</div>' +
      limitar(S, 'fontes', fontes, 3).map(function (f, i) {
        return '<div class="gv-up"' + (i ? ' style="margin-top:0"' : '') + '><span style="font-weight:700">' + esc(f.nome) + '</span><span class="num" style="color:#3A3250">' + pl(f.qtd, 'vistoria', 'vistorias') + ', ' + (f.plan ? 'planilhas antigas' : 'pacote do app') + '</span><span class="gv-pill ok" style="font-size:12px">Em uso</span></div>';
      }).join('') + verTodos(S, 'fontes', fontes.length, 3, 'Ver os ' + fontes.length + ' pacotes') + '</div></div>';
    return h;
  }

  // ══ Ficha da escola (uma coluna só) ═════════════════════════════════════════
  // "Apta para VDI", "Com severas restrições para VDI"... montado a partir do dicionário de faixas
  function nomeFx(k) { return k === 'nm' || !FX[k] ? FX.nm.rotulo : V.cap(FX[k].uma) + ' para VDI'; }

  function maxJitter(v) { var j = ((v.wifi && v.wifi.pontos) || []).filter(function (p) { return !(ok(p.download) && p.download <= 0); }).map(function (p) { return p.jitter; }).filter(ok); return j.length ? Math.max.apply(null, j) : null; }
  function redesMedidas(v) { return ((v.cabeada && v.cabeada.redes) || []).filter(function (r) { return ok(r.download); }); }
  function primeiro(v, campo) {
    var rs = (v.cabeada && v.cabeada.redes) || [], t = '';
    rs.forEach(function (r) { if (!t && r[campo] && String(r[campo]).trim()) t = String(r[campo]).trim(); });
    if (!t && campo === 'switch' && v.cabeada && v.cabeada.legadoSwitch) t = String(v.cabeada.legadoSwitch).trim();
    return t;
  }
  function situacaoFisica(l) {
    var c = l.v.cabeada || {};
    if (l.tipo === 'hib' || l.tipo === 'fis') return 'Medida';
    if (c.possui === false) return 'Sem laboratório';
    if (c.possui === true) return 'Sem medição';
    return nrTxt();
  }
  function subtituloFicha(v) {
    var t = 'Vistoria' + (v.idLocal ? ' #' + v.idLocal : '');
    if (ok(v.data)) t += ', ' + dt(v.data) + (hm(v.data) ? ' às ' + hm(v.data) : '');
    t += '.';
    var c = v.censo || [], it = [];
    if (ok(c.salas)) it.push(pl(milhar(c.salas), 'sala', 'salas'));
    if (ok(c.alunos)) it.push(pl(milhar(c.alunos), 'aluno', 'alunos'));
    if (ok(c.professores)) it.push(pl(milhar(c.professores), 'professor', 'professores'));
    return t + (it.length ? ' ' + juntar(it) + '.' : '');
  }
  function mini(k, v, un) { return '<div><div class="k">' + k + '</div><div class="v num">' + v + (un ? ' <small>' + un + '</small>' : '') + '</div></div>'; }
  function grupo(g, i, v) { return '<div class="gv-gr"><span class="g">' + esc(g) + '</span><span class="i">' + esc(i) + '</span><span class="v">' + v + '</span></div>'; }
  function linhaBarra(nome, dl, textoMed, k) {
    var c = QC[k] || QC.n;
    return '<div class="gv-amb"><div class="n">' + esc(nome) + '</div><div class="m"><div class="gv-fb"><i style="width:' + (ok(dl) ? Math.min(dl / DL_MAX, 1) * 100 : 0) + '%;min-width:6px;background:' + c.bar + '"></i></div><div class="t num">' + textoMed + '</div></div>' + pillQ(k) + '</div>';
  }
  function textoPonto(p) {
    var t = [];
    if (ok(p.download) && p.download <= 0) return 'Sem conexão na medição';
    t.push(ok(p.download) ? d1(p.download) + ' Mbps' : 'Download não registrado');
    if (ok(p.ping)) t.push(d1(p.ping) + ' ms de latência');
    if (ok(p.jitter)) t.push(d1(p.jitter) + ' ms de jitter');
    return esc(t.join(', '));
  }

  function evolucaoCard(e, v) {
    var pts = e.serie.filter(function (x) { return ok(x.data) && x.calculado && ok(x.calculado.nota); }).sort(function (a, b) { return a.data - b.data; });
    var h = '<div class="gv-card sd dashed"><h3 class="gv-h3 p">Evolução da nota</h3>';
    if (!pts.length) return h + '<div style="font-size:14px;color:#3A3250">Sem nota com data para mostrar.</div></div>';
    var n = pts.length, X = function (i) { return n === 1 ? 6 : 4 + i * 88 / (n - 1); };
    h += '<div class="gv-evo">' + (n > 1 ? '<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline fill="none" stroke="#4B1F7A" stroke-width="2" vector-effect="non-scaling-stroke" points="' + pts.map(function (p, i) { return X(i) + ',' + (100 - Math.max(0, Math.min(100, p.calculado.nota))); }).join(' ') + '"/></svg>' : '') +
      '<div style="position:absolute;left:0;right:0;top:50%;border-top:1px dashed #E4DEEC"></div>';
    pts.forEach(function (p, i) {
      var f = p.calculado.faixa, cor = (G.CORES[f] || G.CORES.nm).dot, y = Math.max(0, Math.min(100, p.calculado.nota));
      h += '<div class="pt" style="left:' + X(i) + '%;bottom:' + y + '%;background:' + cor + ';box-shadow:0 0 0 1px ' + cor + '"></div>';
      if (n === 1) h += '<div class="lb num" style="left:calc(' + X(i) + '% + 14px);bottom:calc(' + y + '% - 7px)">' + Math.round(p.calculado.nota) + ', ' + dt(p.data) + '</div>';
      else h += '<div class="lb num" style="left:' + X(i) + '%;bottom:calc(' + y + '% + 10px);transform:translateX(-50%)">' + Math.round(p.calculado.nota) + '</div>';
    });
    h += '</div><div style="font-size:14px;color:#3A3250">';
    if (n === 1) h += 'Primeira medição. A linha de evolução aparece a partir da segunda visita.';
    else {
      var a = pts[n - 2], b = pts[n - 1], dif = Math.round(b.calculado.nota) - Math.round(a.calculado.nota);
      h += 'De ' + Math.round(a.calculado.nota) + ' em ' + dt(a.data) + ' para ' + Math.round(b.calculado.nota) + ' em ' + dt(b.data) + ': ' + (dif > 0 ? '+' + dif + ' pontos.' : dif < 0 ? dif + ' pontos.' : 'sem mudança.');
    }
    return h + '</div></div>';
  }

  function viewFicha(C) {
    var S = C.S, e = C.escolas.filter(function (x) { return x.chave === S.ficha; })[0];
    if (!e) return { band: banda({ titulo: 'Escola não encontrada', fim: true }), cls: 'fc', corpo: '<div class="gv-vz">Escola não encontrada. ' + btn('verGeral', '', 'Voltar') + '</div>' };
    var v = C.vistoriaSelecionada(e), sel = v !== e.ultima;
    var l = G.linhasDe([{ chave: e.chave, ultima: v, serie: e.serie }])[0], lAtual = G.linhasDe([e])[0];
    var L = G.doProjeto(G.linhasDe(C.escolas), lAtual.projeto), fi = G.ficha(l), fx = G.CORES[l.faixa] || G.CORES.nm;
    var origem = S.fichaOrigem || 'Prioridade de intervenção';

    // faixa roxa: caminho, título, botões
    var temPdf = !!(v.arquivos && v.arquivos.pdf);
    var band = '<div class="gv-band"><div class="gv-band-in ficha">' + V.selo() + '<div class="gv-crumbs"><button type="button" class="gv-crumb" data-act="voltarProjeto" data-arg="">' + esc(l.projeto) + '</button><span>/</span>' +
      '<button type="button" class="gv-crumb" data-act="voltarProjeto" data-arg="' + (origem === 'Escolas' ? 'escolas' : origem === 'Melhorias' ? 'melhorias' : 'visao') + '">' + esc(origem) + '</button><span>/</span><span>' + esc(l.nome) + '</span></div>' +
      '<div class="gv-top mid"><div class="gv-hd" style="gap:6px"><div class="gv-t1"><h1 class="gv-title">' + esc(l.nome) + '</h1><button type="button" class="gv-bk" data-act="voltarProjeto" data-arg="' + (origem === 'Escolas' ? 'escolas' : origem === 'Melhorias' ? 'melhorias' : 'visao') + '">' + SETA + 'Voltar para ' + esc(origem) + '</button></div><div class="gv-sub">' + esc(subtituloFicha(v)) + '</div></div>' +
      '<div class="gv-btns"><button type="button" class="gv-bw" data-act="verPdf" data-arg="' + esc(v.chave) + '"' + (temPdf ? '' : ' disabled title="Esta vistoria não tem PDF"') + '>Abrir relatório em PDF</button><button type="button" class="gv-bo" data-act="copiarTexto" data-arg="">Copiar resumo</button><button type="button" class="gv-bo" data-act="exportarEscopo" data-arg="escola">Exportar escola em HTML</button></div></div></div></div>';

    var h = '';
    if (sel) h += '<div class="gv-warn">Você está vendo a medição de ' + dt(v.data) + '. A mais recente é a de ' + dt(e.ultima.data) + '.</div>';

    // nota e diagnóstico
    var sub = l.tipo === 'hib' ? 'Nota geral: média da nota Wi-Fi (' + Math.round(l.notaWifi) + ') e da rede física (' + Math.round(l.notaFis) + ').' :
      l.tipo === 'fis' ? 'Só a nota da rede física. O Wi-Fi não entra.' : (sel ? '' : G.posicao(L, lAtual));
    if (l.tipo === 'hib' && (l.notaWifi == null || l.notaFis == null)) sub = '';
    h += '<div class="gv-card g3"><div style="display:flex;flex-wrap:wrap;align-items:center;gap:24px"><div style="display:flex;align-items:baseline;gap:8px"><span class="gv-nota-n num' + clsNota(l) + '" style="color:' + fx.fg + '">' + (l.nota == null ? '-' : Math.round(l.nota)) + '</span><span style="font-size:16px;color:#5F5870;font-weight:600">de 100</span></div>' +
      '<div style="display:flex;flex-direction:column;gap:8px">' + (l.mista ? '<span class="gv-pill g gv-mista"><i></i>' + esc(nomeFx('apr')) + '</span>' : '<span class="gv-pill g" style="background:' + fx.bg + ';color:' + fx.fg + '">' + esc(nomeFx(l.faixa)) + '</span>') + (sub ? '<span style="font-size:14px;color:#3A3250">' + esc(sub) + '</span>' : '') + '</div></div>' +
      '<div class="gv-frase">' + esc(G.diagnostico(l)) + '</div>';
    if (l.tipo === 'wifi') {
      var sr = G.semRede(v), msg = sr ? 'Sem rede na visita' : 'Não registrado';
      h += '<div class="gv-mini">' + mini('Download médio', nrOu(l.dl, d1, msg), ok(l.dl) ? 'Mbps' : '') + mini('Latência média', nrOu(l.ping, function (x) { return Math.round(x); }, msg), ok(l.ping) ? 'ms' : '') +
        mini('Pior jitter', nrOu(maxJitter(v), function (x) { return Math.round(x); }, msg), ok(maxJitter(v)) ? 'ms' : '') + mini(l.faixa === 'ap' ? 'Alunos' : 'Alunos afetados', nrOu(l.alunos, milhar)) + '</div>';
    } else if (l.tipo === 'hib') {
      h += '<div class="gv-mini h3">' + mini('Nota Wi-Fi', Math.round(l.notaWifi)) + mini('Nota rede física', Math.round(l.notaFis)) + mini('Nota geral', Math.round(l.nota), 'média das duas') + '</div>';
    } else if (l.tipo === 'fis') {
      var rf = redesMedidas(v), dlf = G.mediaDe(rf.map(function (r) { return r.download; })), pgf = G.mediaDe(rf.map(function (r) { return r.ping; }));
      h += '<div class="gv-mini h3">' + mini('Nota rede física', nrOu(l.notaFis, Math.round)) + mini('Download médio', nrOu(dlf, d1), ok(dlf) ? 'Mbps' : '') + mini('Latência média', nrOu(pgf, function (x) { return Math.round(x); }), ok(pgf) ? 'ms' : '') + '</div>';
    }
    h += '</div>';

    // Wi-Fi e rede física (escola com as duas)
    if (l.tipo === 'hib' && fi.wifi) {
      var w = fi.wifi, lw = R.LIM.wifi;
      h += '<div class="gv-card fx"><div class="gv-hh top"><div><h3 class="gv-h3">Wi-Fi</h3><div class="gv-s">Média das medições da visita, régua do Wi-Fi: bom acima de ' + lw.dlRegular + ' Mbps e até ' + lw.pingRegular + ' ms.</div></div>' + pillQ(w.qual.k) + '</div>' +
        '<div style="padding:16px 0 4px">' + linhaBarraSemChip('Download', w.dl, (ok(w.dl) ? d1(w.dl) + ' Mbps' : 'Download não registrado') + (ok(w.ping) ? ', ' + Math.round(w.ping) + ' ms de latência' : ''), w.qual.k) + '</div></div>';
    }
    if ((l.tipo === 'hib' || l.tipo === 'fis') && fi.fisica) {
      var rm = redesMedidas(v), dlc = G.mediaDe(rm.map(function (r) { return r.download; })), pgc = G.mediaDe(rm.map(function (r) { return r.ping; })), qk = G.qualRede(v).k, lc = R.LIM.cabeada;
      var nomeRede = ((v.cabeada.redes || [])[0] || {}).nome || '';
      var sw = primeiro(v, 'switch'), cab = primeiro(v, 'cabeamento'), so = primeiro(v, 'sistemaOperacional');
      h += '<div class="gv-card fx"><div class="gv-hh top"><div><h3 class="gv-h3">Rede física' + (/lab/i.test(nomeRede) ? ', laboratório de informática' : '') + '</h3><div class="gv-s">Régua da rede cabeada: bom acima de ' + lc.dlRegular + ' Mbps e até ' + lc.pingRegular + ' ms.</div></div>' + pillQ(qk) + '</div>';
      if (ok(dlc)) h += '<div style="padding:16px 0;border-bottom:1px solid #EEE9F4">' + linhaBarraSemChip('Download', dlc, d1(dlc) + ' Mbps' + (ok(pgc) ? ', ' + Math.round(pgc) + ' ms de latência' : ''), qk) + '</div>';
      else h += vazioBox('Nota da rede física registrada, sem os detalhes da medição.');
      h += '<div style="display:flex;flex-direction:column;margin-top:6px">' + grupo('Equipamento', 'Switch', sw ? esc(sw) : nrTxt()) + grupo('Instalação', 'Cabeamento', cab ? esc(cab) : nrTxt()) + grupo('Máquinas', 'Sistema operacional', so ? esc(so) : nrTxt()) + '</div></div>';
    }
    if (l.tipo === 'nenhum') h += '<div class="gv-vz">Esta vistoria não tem Wi-Fi nem rede física medidos.</div>';

    // medições por ambiente + Detalhar
    var pts = (v.wifi && v.wifi.pontos) || [], nr_ = (v.cabeada && v.cabeada.redes) ? v.cabeada.redes.length : 0;
    var subAmb = l.tipo === 'wifi' ? (pts.length ? pl(pts.length, 'medição', 'medições') + ' da visita, com a mesma régua do app.' : 'Nenhum ponto de Wi-Fi nesta vistoria.') :
      [pts.length ? pl(pts.length, 'ponto de Wi-Fi', 'pontos de Wi-Fi') : '', nr_ ? pl(nr_, 'rede cabeada', 'redes cabeadas') : ''].filter(Boolean).join(' e ') + (pts.length || nr_ ? ', na mesma régua do app.' : 'Nenhuma medição por ambiente nesta vistoria.');
    h += '<div class="gv-card fx"><div class="gv-hh"><div><h3 class="gv-h3">Medições por ambiente</h3><div class="gv-s">' + esc(subAmb) + '</div></div>' +
      '</div>';
    if (l.tipo === 'wifi' && pts.length) {
      var ord = pts.slice().sort(function (a, b) { return (ok(a.download) ? a.download : 1e9) - (ok(b.download) ? b.download : 1e9); }), mostra = ord.slice(0, LIM_LISTA);
      h += '<div style="display:flex;flex-direction:column;margin-top:10px">' + mostra.map(function (p) { return linhaBarra(p.nome || 'Ponto sem nome', p.download, textoPonto(p), R.qualidadeWifi(p.download, p.ping, p.jitter).k); }).join('') + '</div>' +
        (ord.length > LIM_LISTA ? '<div class="gv-nota" style="margin-top:6px">Mostra os ' + LIM_LISTA + ' piores de ' + ord.length + ' pontos. O detalhe logo abaixo mostra todos.</div>' : '');
    }
    h += '<div class="gv-detalhe">' + V.detalhe(C, e, v) + '</div>';
    h += '</div>';

    // causas por tipo
    var cs = G.causasPorTipo(v);
    h += '<div class="gv-card fx"><h3 class="gv-h3">Causas identificadas</h3><div class="gv-s">Agrupadas por tipo, para saber quem resolve: equipamento é compra, instalação é obra, pessoas é conversa.</div>' +
      (cs.length ? '<div style="display:flex;flex-direction:column;margin-top:10px">' + cs.map(function (c) { return grupo(c.grupo, c.item, esc(c.valor)); }).join('') + '</div>' : vazioBox('Nenhuma causa registrada com os dados desta vistoria.')) + '</div>';

    // situação, evolução, arquivos, vistoria (empilhados, sem coluna lateral)
    var nFotos = V.listaFotos(v).length, nEsp = ((v.arquivos && v.arquivos.espectro) || []).length;
    h += '<div class="gv-card sd"><h3 class="gv-h3 p">Situação</h3><div class="gv-ls">' +
      [['Prontidão', esc((l.mista ? FX.apr : FX[l.faixa] || FX.nm).rotulo)], ['Rede medida', esc(G.TIPOS[l.tipo])], ['Rede física', situacaoFisica(l)], ['Ação em andamento', 'Nenhuma']]
        .map(function (x) { return '<div><span class="gv-mut">' + x[0] + '</span><strong>' + x[1] + '</strong></div>'; }).join('') + '</div></div>';
    h += evolucaoCard(e, v);
    h += '<div class="gv-card sd"><h3 class="gv-h3 p">Arquivos</h3><div class="gv-ls"><div><span>Relatório da vistoria</span>' + (temPdf ? btn('verPdf', v.chave, 'PDF', 's') : '<span class="gv-mut">Não registrado</span>') + '</div>' +
      '<div class="gv-mut"><span>Fotos</span><span>' + (nFotos ? pl(nFotos, 'foto', 'fotos') : 'Não registradas') + '</span></div><div class="gv-mut"><span>Espectro</span><span>' + (nEsp ? pl(nEsp, 'arquivo', 'arquivos') : 'Não registrado') + '</span></div></div></div>';
    h += '<div class="gv-card sd"><h3 class="gv-h3 p">Vistoria</h3><div class="gv-ls"><div><span class="gv-mut">Técnico</span><strong>' + (v.tecnico && v.tecnico.nome ? esc(v.tecnico.nome) : nrTxt()) + '</strong></div>' +
      '<div><span class="gv-mut">Origem</span><strong>' + (v.origem === 'planilha' ? 'Planilha antiga' : 'Pacote do app') + '</strong></div></div></div>';
    return { band: band, corpo: h, cls: 'fc' };
  }
  function linhaBarraSemChip(nome, dl, texto, k) {
    var c = QC[k] || QC.n;
    return '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:14px"><div style="flex:1 1 180px;font-weight:700">' + esc(nome) + '</div><div class="gv-amb" style="flex:2 1 260px;padding:0;border:0"><div class="m" style="flex:1"><div class="gv-fb"><i style="width:' + (ok(dl) ? Math.min(dl / DL_MAX, 1) * 100 : 0) + '%;min-width:6px;background:' + c.bar + '"></i></div><div class="t num">' + esc(texto) + '</div></div></div></div>';
  }

  // ── texto para copiar (resumo para diretoria, texto do projeto, resumo da escola) ──
  function textoCopiavel(C) {
    var S = C.S, GV, f, L, r, t;
    if (S.view === 'ficha') {
      var e = C.escolas.filter(function (x) { return x.chave === S.ficha; })[0]; if (!e) return '';
      var v = C.vistoriaSelecionada(e), l = G.linhasDe([{ chave: e.chave, ultima: v, serie: e.serie }])[0];
      t = l.nome + ' (' + l.projeto + ')\n' + (l.nota == null ? 'Sem nota.' : 'Nota ' + Math.round(l.nota) + ' de 100. ' + nomeFx(l.mista ? 'apr' : l.faixa) + '.') + '\n' + G.diagnostico(l);
      var cs = G.causasPorTipo(v);
      if (cs.length) t += '\nCausas: ' + cs.map(function (c) { return c.item + ' (' + c.valor + ')'; }).join('; ') + '.';
      return t;
    }
    if (S.view === 'projeto') {
      L = G.doProjeto(G.linhasDe(C.escolas), S.projeto); r = G.resumo(L); f = linhasProj(r, L, G.causasDoProjeto(L));
      return S.projeto + '\n' + [f.manchete, f.l1, f.l2, f.l3].filter(Boolean).join('\n');
    }
    GV = G.visaoGeral(C.escolas);
    return 'Todos os projetos\n' + [GV.frases.manchete, GV.frases.l1, GV.frases.l2, GV.frases.l3].filter(Boolean).join('\n');
  }

  return { viewHome: viewHome, viewProjetoG: viewProjetoG, viewFicha: viewFicha, viewInicial: viewInicial, textoCopiavel: textoCopiavel, ABAS: ABAS };
});
