/* Telas do painel: funções que recebem o estado e devolvem HTML (sem efeitos colaterais). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./regras.js'), require('./normalizar.js'));
  else root.PainelViews = factory(root.PainelRegras, root.PainelNorm);
})(typeof self !== 'undefined' ? self : this, function (R, N) {
  'use strict';

  var ok = N.ok;
  var MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function fmt(n, d) {
    if (!ok(n)) return '—';
    var x = n.toFixed(d == null ? 1 : d);
    return x.replace('.', ',');
  }
  function dt(ms) {
    if (!ok(ms)) return '—';
    var d = new Date(ms);
    return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear();
  }
  function dthm(ms) {
    if (!ok(ms)) return '—';
    var d = new Date(ms);
    return dt(ms) + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }
  function mbTxt(n) { return ok(n) ? fmt(n) + ' Mbps' : 'Não medido'; }
  // primeira letra maiúscula (início de frase e de rótulo)
  function cap(t) { t = String(t == null ? '' : t); return t.charAt(0).toUpperCase() + t.slice(1); }
  function nr(s) { return '<span class="nr">Não registrado</span>'; }
  function val(x, sufixo) {
    if (x === null || x === undefined || x === '') return nr();
    if (typeof x === 'number') return esc(fmt(x, Number.isInteger(x) ? 0 : 1)) + (sufixo || '');
    if (typeof x === 'boolean') return x ? 'Sim' : 'Não';
    return esc(x) + (sufixo || '');
  }
  function q(k) { return 'q-' + (k || 'n'); }

  // Versão do painel: única fonte; o selo discreto aparece na faixa de todas as telas (tem de bater com o package.json)
  var VERSAO = '1.5.7';
  function selo(claro) { return '<span class="gv-ver' + (claro ? ' cl' : '') + '" title="Versão do painel">v' + VERSAO + '</span>'; }

  // Nome da faixa: vem do dicionário de gestao.js (carregado depois deste arquivo, por isso lido na hora)
  function rotGestao(f) {
    var G = typeof window !== 'undefined' && window.PainelGestao ? window.PainelGestao : typeof module === 'object' && module.exports ? require('./gestao.js') : null;
    return G && G.FAIXAS[f] ? G.FAIXAS[f].rotulo : null;
  }
  function faixaChip(f) {
    var F = R.FAIXAS[f] || R.FAIXAS.nm;
    return '<span class="pill" style="background:' + F.bg + ';color:' + F.fg + '">' + (rotGestao(f) || F.l) + '</span>';
  }

  function nomeProjeto(v) { return v.projeto || 'Sem projeto'; }

  // ── indicadores para o painel (por escola, usando a medição mais recente) ─────
  function criticos(lista) {
    var regras = [
      { tit: 'Sinal Wi-Fi fraco', desc: 'Pelo menos um ponto abaixo de -70 dBm', teste: function (v) { return v.wifi.pontos.some(function (p) { return ok(p.sinalDbm) && p.sinalDbm !== 0 && p.sinalDbm < -70; }); } },
      { tit: 'Latência alta', desc: 'Ping acima de 50 ms, ruim para desktop virtual', teste: function (v) { return ok(v.wifi.mediaPing) && v.wifi.mediaPing > 50; } },
      { tit: 'Velocidade baixa', desc: 'Download médio abaixo de 25 Mbps', teste: function (v) { return ok(v.wifi.mediaDownload) && v.wifi.mediaDownload < 25; } },
      { tit: 'Wi-Fi não medido', desc: 'Vistoria sem medição de Wi-Fi', teste: function (v) { return v.calculado.faixa === 'nm'; } },
      { tit: 'Dados parciais', desc: 'Vistorias antigas sem upload, dBm e espectro', teste: function (v) { return v.campos === 'parcial'; } }
    ];
    return regras.map(function (r) {
      var alvo = lista.filter(function (e) { return r.teste(e.ultima); });
      var ratio = lista.length ? alvo.length / lista.length : 0;
      var sev = ratio >= 0.2 ? { s: 'Alto', bg: '#FAD9D9', fg: '#9B1C1C' } : ratio >= 0.1 ? { s: 'Médio', bg: '#FCEBC5', fg: '#7A4B00' } : { s: 'Baixo', bg: '#E8E5EE', fg: '#4A4458' };
      var projs = []; alvo.forEach(function (e) { var p = nomeProjeto(e.ultima); if (projs.indexOf(p) < 0) projs.push(p); });
      return { tit: r.tit, sev: sev, qtd: alvo.length, alvo: alvo, desc: alvo.length + ' de ' + lista.length + ' escolas. ' + r.desc + '.', onde: alvo.length ? 'Afeta: ' + projs.join(', ') : 'Nenhuma escola afetada' };
    }).filter(function (c) { return c.qtd > 0; }).sort(function (a, b) { return b.qtd - a.qtd; });
  }

  function listaCriticos(lista, acaoVer) {
    if (!lista.length) return '<div class="ok-box">Nenhum ponto crítico nesta seleção.</div>';
    return '<div class="grid g-crit">' + lista.map(function (c, i) {
      return '<div class="card">' +
        '<div class="row sb"><span class="t-card">' + esc(c.tit) + '</span><span class="pill" style="background:' + c.sev.bg + ';color:' + c.sev.fg + '">' + c.sev.s + '</span></div>' +
        '<div class="small">' + esc(c.desc) + '</div><div class="small muted">' + esc(c.onde) + '</div>' +
        '<div><button class="btn" data-act="' + acaoVer + '" data-arg="' + esc(c.tit) + '">Ver no projeto</button></div></div>';
    }).join('') + '</div>';
  }

  function mediaLista(arr) { return N.media(arr.filter(ok)); }

  // ══ Visão geral ═══════════════════════════════════════════════════════════════
  function viewGeral(C) {
    var esc_ = C.escolas, projs = C.projetos;
    var comNota = esc_.filter(function (e) { return ok(e.ultima.calculado.nota); });
    var nAp = esc_.filter(function (e) { return e.ultima.calculado.faixa === 'ap'; }).length;
    var nRp = esc_.filter(function (e) { return e.ultima.calculado.faixa === 'rp'; }).length;
    var nCompl = esc_.filter(function (e) { return e.ultima.campos === 'completa'; }).length;
    var tot = esc_.length;
    var nMed = C.todas.length;
    var kpis = [
      { l: 'Escolas', v: tot, s: 'em ' + projs.length + ' projeto' + (projs.length === 1 ? '' : 's') + ', ' + nMed + (nMed === 1 ? ' medição' : ' medições') + ' no total', fg: '#3F1D63' },
      { l: 'Nota média', v: fmt(mediaLista(comNota.map(function (e) { return e.ultima.calculado.nota; })), 0), s: 'de 100, só Wi-Fi medido', fg: '#3F1D63' },
      { l: 'Aprovadas', v: tot ? Math.round(nAp / tot * 100) + '%' : '—', s: nAp + ' de ' + tot + ' escolas', fg: '#14693C' },
      { l: 'Escolas críticas', v: nRp, s: 'reprovadas, precisam de ação', fg: '#9B1C1C' },
      { l: 'Dados completos', v: tot ? Math.round(nCompl / tot * 100) + '%' : '—', s: 'o resto é vistoria antiga', fg: '#4A4458' }
    ];
    var h = '<div class="grid g-kpi">' + kpis.map(function (k) {
      return '<div class="card kpi"><span class="small muted">' + k.l + '</span><span class="kpi-v" style="color:' + k.fg + '">' + k.v + '</span><span class="small muted">' + k.s + '</span></div>';
    }).join('') + '</div>';

    // projetos
    var linhas = projs.map(function (p) {
      var l = esc_.filter(function (e) { return nomeProjeto(e.ultima) === p; });
      var c = function (f) { return l.filter(function (e) { return e.ultima.calculado.faixa === f; }).length; };
      var t = l.length;
      var nm = mediaLista(l.map(function (e) { return e.ultima.calculado.nota; }));
      return { p: p, t: t, ap: c('ap'), re: c('re'), rp: c('rp'), nm: nm, nmn: c('nm'), compl: Math.round(l.filter(function (e) { return e.ultima.campos === 'completa'; }).length / t * 100) };
    }).sort(function (a, b) { return (a.nm == null ? 999 : a.nm) - (b.nm == null ? 999 : b.nm); });
    var w = function (x, t) { return t ? (x / t * 100).toFixed(0) + '%' : '0%'; };
    h += '<h2>Qualidade por projeto</h2><div class="card nopad"><div class="tr th proj-row"><span>Projeto</span><span>Escolas</span><span>Nota média</span><span>Distribuição</span><span>Dados completos</span><span></span></div>' +
      linhas.map(function (r) {
        return '<div class="tr proj-row"><span class="b">' + esc(r.p) + '</span><span>' + r.t + '</span><span class="b">' + fmt(r.nm, 0) + '</span>' +
          '<span><div class="stack"><i style="width:' + w(r.ap, r.t) + ';background:#1E7B4B"></i><i style="width:' + w(r.re, r.t) + ';background:#E0A100"></i><i style="width:' + w(r.rp, r.t) + ';background:#B3261E"></i><i style="width:' + w(r.nmn, r.t) + ';background:#9B94A8"></i></div>' +
          '<div class="small muted">' + r.ap + ' aprovadas, ' + r.re + ' com ressalva, ' + r.rp + ' reprovadas</div></span>' +
          '<span>' + r.compl + '%</span><span><button class="btn" data-act="abrirProjeto" data-arg="' + esc(r.p) + '">Abrir projeto</button></span></div>';
      }).join('') + '</div>';

    // pontos críticos
    h += '<h2>Principais pontos críticos</h2>' + listaCriticos(criticos(esc_), 'criticoGeral');

    // piores 5
    var piores = comNota.slice().sort(function (a, b) { return a.ultima.calculado.nota - b.ultima.calculado.nota; }).slice(0, 5);
    h += '<h2>Cinco piores escolas</h2><div class="card nopad">' + (piores.length ? piores.map(function (e) {
      var v = e.ultima;
      return '<div class="tr row sb"><span><span class="b">' + esc(v.escola) + '</span> <span class="muted small">' + esc(nomeProjeto(v)) + '</span></span><span class="row">' +
        '<span class="b">' + fmt(v.calculado.nota, 0) + '</span>' + faixaChip(v.calculado.faixa) +
        '<button class="btn" data-act="abrirEscola" data-arg="' + esc(e.chave) + '">Ver escola</button></span></div>';
    }).join('') : '<div class="pad muted">Sem notas calculadas.</div>') + '</div>';

    // evolução por mês (todas as medições)
    var meses = {};
    C.todas.forEach(function (v) {
      if (!ok(v.data) || !ok(v.calculado.nota)) return;
      var d = new Date(v.data), k = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2);
      (meses[k] = meses[k] || []).push(v.calculado.nota);
    });
    var ks = Object.keys(meses).sort();
    h += '<h2>Evolução da nota média por mês</h2><div class="card">' + (ks.length ? ks.map(function (k) {
      var m = N.media(meses[k]);
      return '<div class="bar-row"><span class="bar-l">' + MESES[+k.slice(5) - 1] + '/' + k.slice(2, 4) + '</span><div class="bar-t"><i style="width:' + m.toFixed(0) + '%;background:#5B2A86"></i></div><span class="b">' + fmt(m, 0) + '</span><span class="small muted">' + meses[k].length + (meses[k].length === 1 ? ' medição' : ' medições') + '</span></div>';
    }).join('') : '<span class="muted">Sem datas e notas suficientes.</span>') + '</div>';
    return h;
  }

  // ══ Visão por projeto ═════════════════════════════════════════════════════════
  function viewProjeto(C) {
    var S = C.S;
    var base = C.escolas.filter(function (e) { return nomeProjeto(e.ultima) === S.projeto; });
    var cont = function (f) { return base.filter(function (e) { return e.ultima.calculado.faixa === f; }).length; };
    var kdef = [
      { id: 'todos', l: 'Total de escolas', v: base.length, s: 'Neste projeto', fg: '#3F1D63' },
      { id: 'ap', l: 'Aprovadas', v: cont('ap'), s: 'Nota 80 ou mais', fg: '#14693C' },
      { id: 're', l: 'Com ressalva', v: cont('re'), s: 'Nota de 51 a 79', fg: '#7A4B00' },
      { id: 'rp', l: 'Reprovadas', v: cont('rp'), s: 'Nota 50 ou menos', fg: '#9B1C1C' },
      { id: 'nm', l: 'Wi-Fi não medido', v: cont('nm'), s: 'Sem medição', fg: '#4A4458' }
    ];
    var h = '<div class="grid g-kpi">' + kdef.map(function (k) {
      var on = S.filtro === k.id;
      return '<button class="card kpi kpi-btn ' + (on ? 'on' : '') + '" data-act="filtro" data-arg="' + k.id + '" aria-pressed="' + on + '"><span class="small muted">' + k.l + '</span><span class="kpi-v" style="color:' + k.fg + '">' + k.v + '</span><span class="small muted">' + k.s + '</span></button>';
    }).join('') + '</div>';

    var qd = [{ id: 'todas', l: 'Todos' }, { id: 'completa', l: 'Completos' }, { id: 'parcial', l: 'Parciais (app antigo)' }];
    var busca = (S.busca || '').toLowerCase();
    var filtrados = base.filter(function (e) {
      var v = e.ultima;
      if (S.filtro !== 'todos' && v.calculado.faixa !== S.filtro) return false;
      if (S.qual === 'completa' && v.campos !== 'completa') return false;
      if (S.qual === 'parcial' && v.campos === 'completa') return false;
      if (busca && v.escola.toLowerCase().indexOf(busca) < 0) return false;
      return true;
    });
    h += '<div class="row wrap gap"><input id="busca" class="inp" type="search" placeholder="Buscar escola" value="' + esc(S.busca) + '" aria-label="Buscar escola">' +
      qd.map(function (x) { return '<button class="chip ' + (S.qual === x.id ? 'on' : '') + '" data-act="qual" data-arg="' + x.id + '" aria-pressed="' + (S.qual === x.id) + '">' + x.l + '</button>'; }).join('') +
      '<span class="small muted">' + filtrados.length + ' de ' + base.length + ' escolas</span></div>';

    // velocidades
    var mx = Math.max.apply(null, [200].concat(base.map(function (e) { return e.ultima.wifi.mediaDownload || 0; })));
    h += '<h2>Velocidade por escola</h2><div class="card">' + (base.length ? base.map(function (e) {
      var v = e.ultima, dl = v.wifi.mediaDownload, ul = v.wifi.mediaUpload;
      var pct = function (x) { return ok(x) ? Math.min(100, x / mx * 100).toFixed(0) + '%' : '2%'; };
      return '<div class="vel-row"><span class="vel-n">' + esc(v.escola) + '</span><div class="vel-b"><div class="bar-t"><i style="width:' + pct(dl) + ';background:#5B2A86"></i></div><div class="bar-t"><i style="width:' + pct(ul) + ';background:#B88CDD"></i></div></div>' +
        '<span class="small vel-v">↓ ' + (ok(dl) ? fmt(dl) : 'Não medido') + '<br>↑ ' + (ok(ul) ? fmt(ul) : 'Não registrado') + '</span></div>';
    }).join('') + '<div class="small muted">Barra escura: download. Barra clara: upload (vistorias antigas não têm upload).</div>' : '<span class="muted">Sem escolas.</span>') + '</div>';

    // ranking por nota: melhores e piores (nota da última vistoria de cada escola)
    var medidas = base.filter(function (e) { return ok(e.ultima.calculado.nota); })
      .sort(function (a, b) { return b.ultima.calculado.nota - a.ultima.calculado.nota; });
    var kRank = Math.min(3, Math.floor(medidas.length / 2));   // com poucas escolas, divide ao meio para não repetir
    var melhores = medidas.slice(0, kRank);
    var piores = kRank ? medidas.slice(-kRank).reverse() : [];
    var linhaRank = function (e, n, cls) {
      var v = e.ultima;
      return '<button class="rk-row" data-act="verEscola" data-arg="' + esc(e.chave) + '" title="Abrir o detalhamento desta escola"><span class="rk-n ' + cls + '">' + n + '</span><span class="rk-esc">' + esc(v.escola) + '</span>' +
        '<span class="rk-v"><span class="b">' + fmt(v.calculado.nota, 0) + '</span> ' + faixaChip(v.calculado.faixa) + '</span></button>';
    };
    var tBom = kRank === 1 ? 'A melhor nota' : 'As ' + (kRank || 3) + ' melhores notas';
    var tRuim = kRank === 1 ? 'A pior nota' : 'As ' + (kRank || 3) + ' piores notas';
    h += '<div class="g-rank"><div class="card"><div class="t-card rk-t rk-bom">' + tBom + '</div>' +
      (melhores.length ? melhores.map(function (e, i) { return linhaRank(e, i + 1, 'rk-bom'); }).join('') : '<span class="muted">Poucas escolas com nota para comparar.</span>') + '</div>' +
      '<div class="card"><div class="t-card rk-t rk-ruim">' + tRuim + '</div>' +
      (piores.length ? piores.map(function (e, i) { return linhaRank(e, i + 1, 'rk-ruim'); }).join('') : '<span class="muted">Poucas escolas com nota para comparar.</span>') + '</div></div>';

    h += '<h2>Pontos críticos deste projeto</h2>' + listaCriticos(criticos(base), 'criticoProjeto');

    h += '<h2>Escolas</h2><div class="card nopad"><div class="tr th esc-row"><span>Escola</span><span>Data</span><span>Nota</span><span>Status</span><span>Download</span><span>Upload</span><span>Ping</span><span>Dados</span><span></span></div>' +
      (filtrados.length ? filtrados.map(function (e) { return linhaEscola(C, e); }).join('') : '<div class="pad muted">Nenhuma escola com esses filtros.</div>') + '</div>';
    return h;
  }

  function tendencia(e) {
    if (e.serie.length < 2) return '';
    var ult = e.serie[e.serie.length - 1].calculado.nota, ant = null;
    for (var i = e.serie.length - 2; i >= 0; i--) { if (ok(e.serie[i].calculado.nota)) { ant = e.serie[i].calculado.nota; break; } }
    if (!ok(ult) || ant === null || ult === ant) return '';
    var d = Math.round(ult - ant);
    return d > 0 ? '<span class="tend up">▲ +' + d + '</span>' : '<span class="tend down">▼ −' + Math.abs(d) + '</span>';
  }

  function linhaEscola(C, e) {
    var S = C.S;
    var v = C.vistoriaSelecionada(e);
    var open = S.aberto === e.chave;
    var c = v.calculado;
    var h = '<div class="tr esc-row ' + (open ? 'open' : '') + '">' +
      '<span class="b">' + esc(v.escola) + (e.serie.length > 1 ? ' <span class="small muted">' + e.serie.length + ' medições</span>' : '') + '</span>' +
      '<span class="muted">' + dt(v.data) + '</span><span class="b">' + (ok(c.nota) ? fmt(c.nota, 0) : '—') + ' ' + tendencia(e) + '</span>' +
      '<span>' + faixaChip(c.faixa) + '</span><span>' + (ok(v.wifi.mediaDownload) ? fmt(v.wifi.mediaDownload) + ' Mbps' : 'Não medido') + '</span>' +
      '<span>' + (ok(v.wifi.mediaUpload) ? fmt(v.wifi.mediaUpload) + ' Mbps' : '—') + '</span><span>' + (ok(v.wifi.mediaPing) ? fmt(v.wifi.mediaPing, 0) + ' ms' : '—') + '</span>' +
      '<span><span class="pill ' + (v.campos === 'completa' ? 'p-ok' : 'p-gray') + '">' + (v.campos === 'completa' ? 'Completo' : 'Parcial') + '</span></span>' +
      '<span><button class="btn ' + (open ? 'btn-p' : '') + '" data-act="abrir" data-arg="' + esc(e.chave) + '" aria-expanded="' + open + '">' + (open ? 'Fechar' : 'Detalhar') + '</button></span></div>';
    if (open) h += '<div class="detalhe">' + detalhe(C, e, v) + '</div>';
    return h;
  }

  // ══ Detalhe da vistoria ═══════════════════════════════════════════════════════
  var ABAS = [
    ['resumo', 'Resumo'], ['pontos', 'Pontos Wi-Fi'], ['cabeada', 'Rede cabeada'], ['topo', 'Topologia de rede'],
    ['sug', 'Sugestões de melhorias'], ['hist', 'Histórico'], ['espectro', 'Espectro'], ['fotos', 'Fotos'], ['pdf', 'PDF e arquivos']
  ];

  function detalhe(C, e, v) {
    var S = C.S;
    var sug = R.gerarSugestoes(v);
    var tabs = ABAS.filter(function (a) { return a[0] !== 'hist' || e.serie.length > 1; }).map(function (a) {
      var label = a[1];
      if (a[0] === 'sug' && sug.total) label += ' (' + sug.total + ')';
      if (a[0] === 'hist') label += ' (' + e.serie.length + ' medições)';
      return '<button class="chip ' + (S.aba === a[0] ? 'on' : '') + '" data-act="aba" data-arg="' + a[0] + '" aria-pressed="' + (S.aba === a[0]) + '">' + label + '</button>';
    }).join('');
    var h = '<div class="row wrap gap">' + tabs + '</div>';
    if (v !== e.ultima) {
      h += '<div class="warn-box">Você está vendo a medição de ' + dt(v.data) + '. A mais recente é a de ' + dt(e.ultima.data) + '. <button class="btn" data-act="voltarUltima" data-arg="' + esc(e.chave) + '">Voltar para a mais recente</button></div>';
    }
    if (v.campos !== 'completa') h += '<div class="warn-box">Vistoria antiga: alguns campos não existiam no app naquela época. Eles aparecem como não registrado e ficam fora das médias e das notas novas.</div>';
    var aba = S.aba === 'hist' && e.serie.length < 2 ? 'resumo' : S.aba;
    var corpo = {
      resumo: tabResumo, pontos: tabPontos, cabeada: tabCabeada, topo: tabTopo, sug: function (C2, e2, v2) { return tabSug(v2, sug); },
      hist: tabHist, espectro: tabEspectro, fotos: tabFotos, pdf: tabPdf
    }[aba] || tabResumo;
    return h + corpo(C, e, v);
  }

  // ícones dos cards do Resumo (traços simples, herdam a cor do card)
  var RIC = {
    salas: '<path d="M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17M3 21h18M14 12h.01"/>',
    alunos: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14a5 5 0 0 1 4.5 5"/>',
    prof: '<path d="M2 9l10-5 10 5-10 5-10-5z"/><path d="M6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5"/>',
    chrome: '<rect x="4" y="5" width="16" height="11" rx="1.5"/><path d="M2 20h20"/>',
    ap: '<path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19.5" r="1"/>',
    sw: '<rect x="2" y="8" width="20" height="8" rx="2"/><path d="M6 12h.01M10 12h.01M14 12h.01M18 12h.01"/>',
    gw: '<rect x="3" y="14" width="18" height="6" rx="2"/><path d="M7 17h.01M11 17h.01M8 11a6 6 0 0 1 8 0M5.5 8a10 10 0 0 1 13 0"/>',
    link: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
    nota: '<path d="M5 3h10l4 4v14H5z"/><path d="M14 3v5h5M8 13h8M8 17h6"/>',
    alerta: '<path d="M12 3l10 18H2L12 3z"/><path d="M12 10v5M12 18h.01"/>',
    cabo: '<path d="M9 3v4M15 3v4M7 7h10v4a5 5 0 0 1-10 0V7zM12 16v5"/>',
    dens: '<circle cx="7" cy="7" r="2"/><circle cx="17" cy="7" r="2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><circle cx="12" cy="12" r="2"/>',
    esp: '<path d="M3 20h18M6 20v-6M10 20V8M14 20v-10M18 20v-4"/>',
    sombra: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
    desk: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20h8M12 16v4"/>',
    proj: '<rect x="3" y="8" width="18" height="9" rx="2"/><circle cx="14" cy="12.5" r="2.5"/><path d="M6 17v2M18 17v2"/>',
    nivel: '<path d="M4 18l5-5 4 4 7-8"/><path d="M15 9h5v5"/>',
    duvida: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17h.01"/>',
    estrela: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>'
  };
  function ric(ic) {
    return ic && RIC[ic] ? '<svg class="it-ic" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + RIC[ic] + '</svg>' : '';
  }
  function item(k, v, ic) { return '<div class="card it">' + ric(ic) + '<span class="small muted">' + k + '</span><span class="it-v">' + v + '</span></div>'; }
  function itemQ(k, texto, kq, ic, cls) { return '<div class="card it">' + ric(ic) + '<span class="small muted">' + k + '</span><span class="it-v">' + (texto == null || texto === '' ? nr() : '<span class="dot ' + q(kq) + (cls || '') + '"></span>' + esc(texto)) + '</span></div>'; }

  function tabResumo(C, e, v) {
    var c = v.censo, i = v.infra;
    var links = v.links.length ? v.links.map(function (l) { return esc((l.operadora || 'Link') + (l.tamanho ? ', ' + l.tamanho : '')); }).join('<br>') : nr();
    var sw = R.qualidadeSwitch(i.switch), gw = R.qualidadeGateway(i.gateway), cb = R.qualidadeCabos(i.cabeamento), dn = R.qualidadeDensidade(i.densidadeAps), es = R.qualidadeEspectro(i.espectroWifi);
    var con = v.conclusao;
    var imped = con.possuiImpeditivo == null ? nr() : (con.possuiImpeditivo ? 'Sim' + (con.observacoesImpeditivo ? ': ' + esc(con.observacoesImpeditivo) : '') : 'Nenhum');
    var h = '<div class="small muted">' + [v.data ? dthm(v.data) : null, v.tecnico.nome ? 'Técnico: ' + esc(v.tecnico.nome) : null, v.endereco ? esc(v.endereco) : null].filter(Boolean).join(' · ') + '</div>';
    // Em destaque só a contagem do local; o resto fica em "Mais detalhes"
    h += '<div class="grid g-it">' +
      item('Salas', val(c.salas), 'salas') + item('Alunos', val(c.alunos), 'alunos') + item('Professores', val(c.professores), 'prof') +
      item('Chromebooks', c.possuiChromebooks === false ? 'Não possui' : val(c.chromebooks), 'chrome') +
      item('Access points', val(i.accessPoints), 'ap') + '</div>';
    h += '<details class="mais"><summary>Mais detalhes desta vistoria</summary>' +
      '<div class="grid g-it">' +
      itemQ('Switch', i.switch, sw.k, 'sw') + itemQ('Gateway', i.gateway, gw.k, 'gw') +
      item('Links de internet', links, 'link') + item('Nota do professor', val(i.notaProfessor), 'nota') + item('Impeditivos', imped, 'alerta') +
      itemQ('Cabeamento', i.cabeamento, cb.k, 'cabo') + itemQ('Densidade de APs', i.densidadeAps, dn.k, 'dens', dn.k === 'r' ? ' ap-reg' : '') + itemQ('Espectro', i.espectroWifi, es.k, 'esp') +
      item('Zona de sombra', i.possuiZonaSombra == null ? nr() : (i.possuiZonaSombra ? 'Sim' + (i.salasSemSinal ? ': ' + esc(i.salasSemSinal) : '') : 'Não'), 'sombra') +
      item('Desktops', c.possuiDesktops === false ? 'Não possui' : val(c.desktops), 'desk') + item('Projetores', c.possuiProjetores === false ? 'Não possui' : val(c.projetores), 'proj') +
      item('Nível de informática', val(c.nivelInformatica), 'nivel') +
      item('Dificuldades', con.possuiDificuldade == null ? nr() : (con.possuiDificuldade ? 'Sim' + (con.observacoesDificuldade ? ': ' + esc(con.observacoesDificuldade) : '') : 'Nenhuma'), 'duvida') +
      item('Nota Wi-Fi / cabeada', (ok(v.calculado.notaWifi) ? fmt(v.calculado.notaWifi, 0) : '—') + ' / ' + (ok(v.calculado.notaCabeada) ? fmt(v.calculado.notaCabeada, 0) : '—'), 'estrela') +
      '</div>' +
      '<div class="small muted tec">Dados técnicos: ' + [v.projeto ? 'projeto ' + esc(v.projeto) : null, v.tecnico.email ? esc(v.tecnico.email) : null, v.versaoApp ? 'app ' + esc(v.versaoApp) : null, v.aparelho ? esc(v.aparelho) : null,
        v.uuid ? 'id ' + esc(v.uuid) : null, v.origem === 'planilha' ? 'planilha antiga ' + esc(v.arquivoOrigem || '') : 'pacote ' + esc(v.arquivoOrigem || '')].filter(Boolean).join(' · ') + '</div></details>';
    return h;
  }

  function legenda(cab) {
    var L = R.LIM[cab ? 'cabeada' : 'wifi'];
    return '<div class="row wrap gap small"><span>Cor do card, régua ' + (cab ? 'do laboratório' : 'do Wi-Fi') + ' no app:</span>' +
      '<span class="pill q-b b-pill">Bom</span><span class="pill q-r b-pill">Regular</span><span class="pill q-f b-pill">Ruim</span>' +
      '<span class="muted">Ruim: download até ' + L.dlRuim + ' Mbps, ping acima de ' + L.pingRuim + ' ms ou jitter acima de ' + L.jitter + ' ms. Regular: download até ' + L.dlRegular + ' Mbps ou ping acima de ' + L.pingRegular + ' ms. Passe o mouse ou toque para ver todos os dados.</span></div>';
  }

  function linhaExtra(k, v) { return '<span class="ln"><span class="muted">' + k + '</span><span class="lv">' + v + '</span></span>'; }

  // Teste de carga (app 1.1.40): fica no fim da aba Pontos Wi-Fi. Só leitura; o resultado e a nota vêm prontos do app (desde a 1.2.0 a nota Wi-Fi já chega com o desconto).
  var TC_COR = { b: '#1E8E4E', r: '#E0A82A', f: '#B4261E', n: '#B9B2C6' };
  var TC_PILL = { b: ['#DDF3E5', '#14693C', 'Bom'], r: ['#FCEBC5', '#7A4B00', 'Regular'], f: ['#FAD9D9', '#9B1C1C', 'Ruim'], n: ['#E8E5EE', '#4A4458', 'Não registrado'] };
  function tcQual(par, x) {
    if (!ok(x)) return 'n';
    if (par === 'dl') return x >= 9 ? 'b' : x >= 4 ? 'r' : 'f';
    if (par === 'ping') return x <= 50 ? 'b' : x <= 100 ? 'r' : 'f';
    if (par === 'jit') return x <= 15 ? 'b' : x <= 30 ? 'r' : 'f';
    if (par === 'sinal') return x >= 0 ? 'n' : x >= -65 ? 'b' : x >= -72 ? 'r' : 'f';
    return 'n';
  }
  function tcTile(k, x, un, qk, rot) {
    var vazio = !ok(x);
    return '<div class="gv-tc-t"><div class="k">' + k + '</div><div class="v">' +
      (vazio ? '<b class="gv-ph" style="font-size:14px;font-weight:600">Não registrado</b>' : '<b>' + tcNum(x) + '</b>' + (un ? ' <span>' + un + '</span>' : '')) +
      '</div><div class="s"><i style="background:' + TC_COR[vazio ? 'n' : qk] + '"></i>' + (vazio ? 'Sem leitura' : rot) + '</div></div>';
  }
  function tcNum(x) { return Math.abs(x - Math.round(x)) < 0.05 ? String(Math.round(x)) : fmt(x); }
  function tcPill(k) { var c = TC_PILL[k] || TC_PILL.n; return '<span class="gv-pill" style="background:' + c[0] + ';color:' + c[1] + '">' + c[2] + '</span>'; }
  function blocoTesteCarga(v) {
    var t = v.testeCarga;
    var tit = '<div><div class="gv-tc-tt">Teste de carga' + (t && t.editado ? ' <span style="font-size:14px;font-weight:600;color:#5F5870">(editado)</span>' : '') + '</div></div>';
    if (!t) return '<div class="gv-tc-wrap"><div class="gv-tc-box">' + tit + tcPill('n') + '</div><div class="gv-tc-vz">Esta vistoria não tem teste de carga.</div></div></div>';
    var k = { 'Bom': 'b', 'Regular': 'r', 'Ruim': 'f' }[t.resultado] || 'n', rot = { b: 'Bom', r: 'Regular', f: 'Ruim' };
    var qs = tcQual('sinal', t.sinalDbm), qd = tcQual('dl', t.download), qp = tcQual('ping', t.ping), qj = tcQual('jit', t.jitter);
    var rod = [ok(t.dataMedicao) ? 'Teste de ' + dt(t.dataMedicao) : null, t.ssid ? 'rede ' + esc(t.ssid) : null, t.banda ? esc(t.banda) : null].filter(Boolean).join(', ');
    if (ok(t.usuarios) && t.usuarios < 10) rod += (rod ? '. ' : '') + 'Menos de 10 usuários: o app avisa.'; else if (rod) rod += '.';
    return '<div class="gv-tc-wrap"><div class="gv-tc-box">' + tit + tcPill(k) + '</div><div class="gv-tc">' +
      tcTile('Usuários simultâneos', t.usuarios, '', ok(t.usuarios) && t.usuarios < 10 ? 'r' : 'n', ok(t.usuarios) && t.usuarios < 10 ? 'Abaixo de 10 usuários' : 'Informado no app') +
      tcTile('Download', t.download, 'Mbps', qd, rot[qd]) +
      tcTile('Upload', t.upload, 'Mbps', 'n', 'Informativo') +
      tcTile('Ping', t.ping, 'ms', qp, rot[qp]) +
      tcTile('Jitter', t.jitter, 'ms', qj, rot[qj]) +
      (ok(t.sinalDbm) && t.sinalDbm < 0 ? tcTile('Sinal', t.sinalDbm, 'dBm', qs, rot[qs]) :
        '<div class="gv-tc-t"><div class="k">Sinal</div><div class="v"><b class="gv-ph" style="font-size:14px;font-weight:600">Não registrado</b></div><div class="s"><i style="background:' + TC_COR.n + '"></i>Ignorado no resultado</div></div>') +
      '</div>' + (t.motivo ? '<div class="gv-tc-m">' + esc(t.motivo) + '</div>' : '') + (rod ? '<div class="gv-tc-r">' + rod + '</div>' : '') + '</div></div>';
  }

  // Rede e caminho até o VDI (app 1.2.0): linhas extras do cartão, só quando a vistoria trouxe algum desses dados.
  function linhasRede(p) {
    var r = p.rede || {}, ms = function (x) { return ok(x) ? tcNum(x) + ' ms' : nr(); };
    var canal = ok(r.canal) ? r.canal + (ok(r.larguraMhz) ? ', ' + r.larguraMhz + ' MHz' : '') : (ok(r.larguraMhz) ? r.larguraMhz + ' MHz' : nr());
    var redes = ok(r.redesNoCanal) ? r.redesNoCanal + (ok(r.redesNoCanalFortes) ? ' (' + (r.redesNoCanalFortes === 0 ? 'nenhuma forte' : r.redesNoCanalFortes + (r.redesNoCanalFortes === 1 ? ' forte' : ' fortes')) + ')' : '') : nr();
    return linhaExtra('TX negociada', ok(r.txNegociadaMbps) ? tcNum(r.txNegociadaMbps) + ' Mbps' : nr()) + linhaExtra('Canal e largura', canal) + linhaExtra('Redes no canal', redes) +
      linhaExtra('DNS até o VDI', ms(r.dnsMs)) + linhaExtra('TCP/443 até o VDI', ms(r.tcp443Ms)) + linhaExtra('Destino do VDI', r.destino ? esc(r.destino) : nr());
  }

  function tabPontos(C, e, v) {
    var pts = v.wifi.pontos, comRede = pts.some(function (p) { return !!p.rede; });
    if (!pts.length) return '<div class="dash-box">' + (v.calculado.faixa === 'nm' ? 'Wi-Fi não medido nesta vistoria.' : 'Nenhum ponto de Wi-Fi registrado nesta vistoria.') + '</div>' + blocoTesteCarga(v);
    var cs = { b: 0, r: 0, f: 0, n: 0 };
    pts.forEach(function (p) { cs[R.qualidadeSinal(p.sinalDbm).k]++; });
    var chips = v.wifi.pontos.some(function (p) { return ok(p.sinalDbm) && p.sinalDbm !== 0; }) ?
      '<div class="row wrap gap small"><span class="pill q-b b-pill">' + cs.b + ' pontos com sinal excelente ou muito bom</span><span class="pill q-r b-pill">' + cs.r + ' com sinal bom</span><span class="pill q-f b-pill">' + cs.f + ' com sinal ruim ou inutilizável</span></div>' :
      '<div class="row wrap gap small"><span class="pill p-gray">Sinal em dBm não registrado nesta vistoria</span></div>';
    var h = chips + legenda(false) + '<div class="grid g-pt">';
    pts.forEach(function (p, i) {
      var qd = R.qualidadeWifi(p.download, p.ping, p.jitter), sg = R.qualidadeSinal(p.sinalDbm);
      var chave = v.chave + ':' + i, pinned = C.S.pin === chave;
      h += '<button class="pt-card ' + q(qd.k) + (pinned ? ' pinned' : '') + '" data-act="pin" data-arg="' + esc(chave) + '" aria-pressed="' + pinned + '">' +
        '<span class="pt-t">#' + (i + 1) + ' ' + esc(p.nome) + '</span>' +
        linhaExtra('SSID', p.ssid ? esc(p.ssid) : nr()) + linhaExtra('Download', '<b>' + (ok(p.download) ? fmt(p.download) + ' Mbps' : '—') + '</b>') +
        linhaExtra('Ping', '<b>' + (ok(p.ping) ? fmt(p.ping) + ' ms' : '—') + '</b>') + linhaExtra('Jitter', '<b>' + (ok(p.jitter) ? fmt(p.jitter) + ' ms' : nr()) + '</b>') +
        '<span class="pt-q">' + qd.l + '</span>' +
        '<span class="pt-extra">' + linhaExtra('Ordem do ponto', '#' + (i + 1) + ' de ' + pts.length) + linhaExtra('Banda', p.banda ? esc(p.banda) : nr()) +
        linhaExtra('Sinal', sg.k === 'n' ? nr() : '<span class="' + q(sg.k) + '-t">' + sg.l + ' (' + p.sinalDbm + ' dBm)</span>') +
        linhaExtra('Upload', ok(p.upload) ? fmt(p.upload) + ' Mbps' : nr()) + linhaExtra('Suporta', p.capacidade ? esc(p.capacidade) : nr()) + (comRede ? linhasRede(p) : '') +
        linhaExtra('Medição manual', p.manual == null ? nr() : (p.manual ? 'Sim' : 'Não')) +
        linhaExtra('Qualidade geral', '<span class="' + q(qd.k) + '-t">' + qd.l + '</span>') + linhaExtra('Por quê', esc(qd.motivo)) + '</span>' +
        '<span class="pt-hint small muted">Passe o mouse ou toque para ver todos os dados</span></button>';
    });
    return h + '</div>' + blocoTesteCarga(v);
  }

  function tabCabeada(C, e, v) {
    var redes = v.cabeada.redes.slice();
    var legadoOk = ok(v.cabeada.legadoDownload) && v.cabeada.legadoDownload > 0;
    if (!redes.length && legadoOk) redes.push({ nome: 'Rede cabeada (registro antigo)', switch: v.cabeada.legadoSwitch, cabeamento: v.cabeada.legadoCabeamento, desktops: null, download: v.cabeada.legadoDownload, ping: v.cabeada.legadoPing, jitter: v.cabeada.legadoJitter, sistemaOperacional: null });
    if (!redes.length) {
      return '<div class="dash-box">' + (v.cabeada.possui === false ? 'Esta vistoria não tem rede cabeada.' : 'Nenhuma rede cabeada registrada nesta vistoria.') + '</div>';
    }
    var h = legenda(true) + '<div class="grid g-pt">';
    redes.forEach(function (r, i) {
      var qd = R.qualidadeCabeada(r.download, r.ping, r.jitter), sw = R.qualidadeSwitch(r.switch), cb = R.qualidadeCabos(r.cabeamento);
      var chave = v.chave + ':c' + i, pinned = C.S.pin === chave;
      h += '<button class="pt-card ' + q(qd.k) + (pinned ? ' pinned' : '') + '" data-act="pin" data-arg="' + esc(chave) + '" aria-pressed="' + pinned + '">' +
        '<span class="pt-t">#' + (i + 1) + ' ' + esc(r.nome) + '</span>' +
        linhaExtra('Switch', '<span class="' + q(sw.k) + '-t">' + (r.switch ? esc(r.switch) : nr()) + '</span>') + linhaExtra('Cabeamento', '<span class="' + q(cb.k) + '-t">' + (r.cabeamento ? esc(r.cabeamento) : nr()) + '</span>') +
        linhaExtra('Download', '<b>' + (ok(r.download) ? fmt(r.download) + ' Mbps' : '—') + '</b>') + linhaExtra('Ping', '<b>' + (ok(r.ping) ? fmt(r.ping, 1) + ' ms' : nr()) + '</b>') +
        linhaExtra('Jitter', '<b>' + (ok(r.jitter) ? fmt(r.jitter, 1) + ' ms' : nr()) + '</b>') + '<span class="pt-q">' + qd.l + '</span>' +
        '<span class="pt-extra">' + linhaExtra('Ordem do local', '#' + (i + 1) + ' de ' + redes.length) + linhaExtra('Desktops no local', val(r.desktops)) +
        linhaExtra('Sistema operacional', val(r.sistemaOperacional)) + linhaExtra('Qualidade do switch', sw.k === 'n' ? nr() : esc(sw.l)) +
        linhaExtra('Qualidade do cabo', cb.k === 'n' ? nr() : esc(cb.l)) + linhaExtra('Qualidade geral', '<span class="' + q(qd.k) + '-t">' + qd.l + '</span>') + linhaExtra('Por quê', esc(qd.motivo)) + '</span>' +
        '<span class="pt-hint small muted">Passe o mouse ou toque para ver todos os dados</span></button>';
    });
    return h + '</div>';
  }

  // ── Topologia ─────────────────────────────────────────────────────────────────
  function pior(a, b) { var ord = { n: 0, b: 1, r: 2, f: 3 }; return ord[a] >= ord[b] ? a : b; }

  var ICONES = {
    internet: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
    gateway: '<rect x="3" y="14" width="18" height="6" rx="2"/><path d="M7 17h.01M11 17h.01M8 11a6 6 0 0 1 8 0M5.5 8a10 10 0 0 1 13 0"/>',
    switch: '<rect x="2" y="8" width="20" height="8" rx="2"/><path d="M6 12h.01M10 12h.01M14 12h.01M18 12h.01"/>',
    cabo: '<path d="M9 3v4M15 3v4M7 7h10v4a5 5 0 0 1-10 0V7zM12 16v5"/>',
    cabeada: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    wifi: '<path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19.5" r="1"/>',
    ambiente: '<path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>'
  };
  var COR_ICONE = { b: '#14693C', r: '#7A4B00', f: '#9B1C1C', n: '#6B6479' };
  var COR_AP_REG = '#3A4D41'; // access point "Regular": cinza esverdeado (só o AP; o resto do Regular continua amarelo)
  function iconeDe(tipo) {
    var t = String(tipo || '');
    if (t.indexOf('LINK') === 0) return 'internet';
    if (t === 'GATEWAY') return 'gateway';
    if (t.indexOf('SWITCH') === 0) return 'switch';
    if (t === 'CABEAMENTO') return 'cabo';
    if (t === 'REDE CABEADA') return 'cabeada';
    if (t === 'ACCESS POINTS') return 'wifi';
    return 'ambiente';
  }

  // Link escrito com Gb/Giga ("10 Giga", "1 Gb", "2Gbps") vale n x 1000 Mbps, mesmo que o app tenha gravado o número puro (ex.: 10).
  function mbpsLink(l) {
    var t = String((l && l.tamanho) || '').toLowerCase().replace(',', '.');
    var m = t.match(/(\d+(?:\.\d+)?)\s*(?:gb|giga|g\b)/);
    return m ? parseFloat(m[1]) * 1000 : l.mbps;
  }

  function montarTopologia(v) {
    var i = v.infra, tiers = [];
    var no = function (id, tipo, titulo, det, extra, kq, ql, miss) {
      return { id: id, tipo: tipo, titulo: titulo, det: det, extra: extra, k: miss ? 'n' : kq, ql: miss ? 'Não registrado' : (ql || R.NOMES[kq]), miss: !!miss };
    };
    // Internet
    var nIn = v.links.length ? v.links.map(function (l, n) {
      var ql = R.qualidadeLink(mbpsLink(l));
      return no('l' + n, 'LINK DE INTERNET', l.operadora || ('Link ' + (n + 1)), l.tamanho || 'tamanho não registrado', 'Medido na vistoria: ' + mbTxt(v.wifi.mediaDownload) + ' de download. Link abaixo de 1 Gbps entra como ponto de atenção no app.', ql.k, ql.l, ql.k === 'n');
    }) : [no('l', 'LINK DE INTERNET', 'Links', 'não registrado', 'Esta vistoria não guardou os links de internet.', 'n', '', true)];
    tiers.push({ nome: 'INTERNET', nos: nIn, conn: '' });
    var gw = R.qualidadeGateway(i.gateway);
    tiers.push({ nome: 'ENTRADA', conn: v.links.length ? 'link de internet' : 'link não registrado', nos: [no('gw', 'GATEWAY', i.gateway || 'Gateway', i.gateway ? 'Entrega a internet para a escola' : 'não registrado', 'Campo Gateway da vistoria. Modem da operadora é o pior caso, solução profissional o melhor.', gw.k, gw.l, gw.k === 'n')] });
    var sw = R.qualidadeSwitch(i.switch), cb = R.qualidadeCabos(i.cabeamento);
    tiers.push({ nome: 'DISTRIBUIÇÃO', conn: 'cabo até o switch', nos: [
      no('sw', 'SWITCH PRINCIPAL', i.switch || 'Switch', i.switch ? 'Ativo que distribui a rede da escola' : 'não registrado', 'Campo Switch da vistoria. Fast 10/100 é o pior caso, Gigabit o melhor.', sw.k, sw.l, sw.k === 'n'),
      no('cabos', 'CABEAMENTO', i.cabeamento || 'Cabeamento', i.cabeamento ? 'Estado dos cabos da infraestrutura' : 'não registrado', 'Campo Cabeamento da vistoria.', cb.k, cb.l, cb.k === 'n')
    ] });
    var redes = v.cabeada.redes;
    var nRede;
    if (redes.length) {
      nRede = redes.map(function (r, n) {
        var qd = R.qualidadeCabeada(r.download, r.ping, r.jitter);
        return no('cab' + n, 'REDE CABEADA', r.nome, (r.cabeamento || 'cabeamento não registrado') + ', ' + (ok(r.download) ? fmt(r.download) + ' Mbps' : 'não medido'), 'Switch: ' + (r.switch || 'não registrado') + '. Ping ' + (ok(r.ping) ? fmt(r.ping, 0) + ' ms' : 'não registrado') + '. ' + qd.motivo, qd.k, qd.l, qd.k === 'n');
      });
    } else if (v.cabeada.possui === false) {
      nRede = [{ id: 'cab', tipo: 'REDE CABEADA', titulo: 'Sem rede cabeada', det: 'A escola não tem rede cabeada para os computadores', extra: 'Registrado no app: sem rede cabeada.', k: 'n', ql: '', miss: false, neutro: true }];
    } else {
      nRede = [no('cab', 'REDE CABEADA', 'Redes cabeadas', 'não registrado', 'Esta vistoria não guardou a rede cabeada.', 'n', '', true)];
    }
    var den = R.qualidadeDensidade(i.densidadeAps), esp = R.qualidadeEspectro(i.espectroWifi);
    var kAp = pior(den.k === 'n' ? 'n' : den.k, esp.k === 'n' ? 'n' : esp.k);
    var apMiss = den.k === 'n' && esp.k === 'n' && !ok(i.accessPoints);
    var apReg = kAp === 'r' && !apMiss;
    tiers.push({ nome: 'REDE CABEADA', conn: 'cabos', ramo: 'cab', nos: nRede });
    tiers.push({ nome: 'WI-FI', conn: 'cabo até os access points', ramo: 'wifi', nos: [no('ap', 'ACCESS POINTS', ok(i.accessPoints) ? i.accessPoints + ' access points' : 'Access points', (i.densidadeAps || 'densidade não registrada') + (i.espectroWifi ? ', ' + i.espectroWifi : ''), 'Densidade: ' + (den.l || '') + '. Espectro: ' + (esp.l || '') + '. A quantidade e a posição de cada AP não são registradas pelo app.', kAp, R.NOMES[kAp], apMiss)] });
    if (apReg) tiers[tiers.length - 1].nos[0].apReg = true;
    var pts = v.wifi.pontos;
    var nAmb = pts.length ? pts.map(function (p, n) {
      var qd = R.qualidadeWifi(p.download, p.ping, p.jitter), sg = R.qualidadeSinal(p.sinalDbm);
      var k = qd.k !== 'n' ? qd.k : sg.k;
      return no('amb' + n, 'AMBIENTE', p.nome, (p.banda ? p.banda + ', ' : '') + (sg.k === 'n' ? 'sinal não registrado' : p.sinalDbm + ' dBm, ' + sg.nivel), 'Download ' + mbTxt(p.download) + ', ping ' + (ok(p.ping) ? fmt(p.ping) + ' ms' : 'não registrado') + '. ' + qd.motivo, k, R.NOMES[k], k === 'n');
    }) : [no('amb', 'AMBIENTES', 'Pontos medidos', 'sem medição', 'Esta vistoria não tem pontos de Wi-Fi medidos.', 'n', '', true)];
    tiers.push({ nome: 'AMBIENTES ATENDIDOS', conn: 'sinal sem fio', ramo: 'wifi', nos: nAmb });
    tiers.forEach(function (t) { t.conn = cap(t.conn); t.nos.forEach(function (n) { n.det = cap(n.det); }); });
    return tiers;
  }

  function tabTopo(C, e, v) {
    var tiers = montarTopologia(v);
    var chaveSel = C.S.no, sel = null;
    var h = '<div class="info-box">Esquema montado automaticamente com o que foi registrado na vistoria (links, gateway, switch, redes cabeadas, access points e ambientes). Não é planta física. Clique em um elemento para ver os detalhes. Cada elemento é pintado com a mesma régua de cores do app.</div>' +
      '<div class="row wrap gap small"><span>Cores:</span><span class="pill q-b b-pill">Bom</span><span class="pill q-r b-pill">Regular</span><span class="pill q-f b-pill">Ruim</span><span class="pill q-n b-pill dashed">não registrado</span><span class="muted">Link, gateway e switch seguem as penalidades de hardware do app. Wi-Fi, rede cabeada e ambientes seguem as medições.</span></div>';
    h += '<div class="card topo">';
    var desenharNo = function (n) {
      var key = v.chave + ':' + n.id, on = chaveSel === key;
      if (on) sel = n;
      var ic = '<svg class="no-ic" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="' + (n.apReg ? COR_AP_REG : (COR_ICONE[n.k] || COR_ICONE.n)) + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONES[iconeDe(n.tipo)] + '</svg>';
      return '<button class="no ' + q(n.k) + (n.apReg ? ' ap-reg' : '') + (n.miss ? ' miss' : '') + (on ? ' sel' : '') + (n.neutro ? ' neutro' : '') + '" data-act="no" data-arg="' + esc(key) + '" aria-pressed="' + on + '">' + ic +
        '<span class="no-tipo">' + n.tipo + '</span><span class="no-t' + (n.miss ? ' nr' : '') + '">' + esc(n.titulo) + '</span><span class="small">' + esc(n.det) + '</span>' +
        '<span class="no-q ' + q(n.k) + '-t' + (n.apReg ? ' ap-reg-t' : '') + '">' + esc(n.ql) + '</span></button>';
    };
    var desenharTier = function (t, comLigacao) {
      var r = '<div class="tier">';
      if (comLigacao) r += '<div class="conn"><i></i><span class="small muted">' + esc(t.conn) + '</span><i></i></div>';
      r += '<div class="small muted tier-n">' + t.nome + '</div><div class="nos">' + t.nos.map(desenharNo).join('') + '</div></div>';
      return r;
    };
    var principais = tiers.filter(function (t) { return !t.ramo; });
    principais.forEach(function (t, ti) { h += desenharTier(t, ti > 0); });
    var ramos = [tiers.filter(function (t) { return t.ramo === 'cab'; }), tiers.filter(function (t) { return t.ramo === 'wifi'; })];
    h += '<div class="conn"><i></i></div><div class="ramos">';
    ramos.forEach(function (rm, ri) {
      h += '<div class="ramo ' + (ri === 0 ? 'ramo-cab' : 'ramo-wifi') + '">' + rm.map(function (t) { return desenharTier(t, true); }).join('') + '</div>';
    });
    h += '</div>';
    h += '</div>';
    if (sel) h += '<div class="card sel-box"><span class="t-card">' + esc(sel.titulo) + '</span><span>' + esc(sel.det) + '</span><span class="small muted">' + esc(sel.extra) + (sel.miss ? '' : ' Qualidade: ' + esc(sel.ql) + '.') + '</span></div>';
    h += '<div class="row wrap gap"><button class="btn" data-act="avisar" data-arg="Editar o esquema à mão fica para uma fase futura. Hoje ele é montado com os dados da vistoria.">Editar esquema (futuro)</button>' +
      '<button class="btn" data-act="baixarTopo" data-arg="' + esc(v.chave) + '">Baixar esquema como imagem</button></div>';
    return h;
  }

  function tabSug(v, sug) {
    var h = '<div class="info-box">Mesmas regras e mesmos textos do botão de sugestões do app e do PDF. Aparece só o que se aplica a esta escola. Os modelos são referências de mercado, não indicação de compra.</div>';
    if (!sug.total) h += '<div class="ok-box">Nenhum risco e nenhuma melhoria necessária com os dados registrados.</div>';
    if (sug.riscos.length) {
      h += '<h3>Riscos identificados</h3><div class="lista">' + sug.riscos.map(function (r) {
        return '<div class="l-row l-risco"><span class="l-tag">' + r.tag + '</span><span class="l-txt">' + esc(r.t) + '</span></div>';
      }).join('') + '</div>';
    }
    if (sug.recs.length) {
      h += '<h3>Recomendações de equipamentos</h3><div class="lista">' + sug.recs.map(function (r) {
        return '<div class="l-row l-rec"><div class="l-col"><span class="t-card" style="color:#2A4F7A">' + esc(r.tit) + '</span><span class="l-txt">' + esc(r.corpo) + '</span></div>' +
          '<div class="l-col">' + r.ops.map(function (o) { return '<div class="l-op"><span class="l-opk" style="color:' + o.fg + '">' + o.k + '</span><span>' + esc(o.v) + '</span></div>'; }).join('') + '</div></div>';
      }).join('') + '</div>';
    }
    if (sug.naoAvaliado.length) h += '<div class="dash-box nr">Não avaliado por falta de registro nesta vistoria: ' + esc(sug.naoAvaliado.join(', ')) + '.</div>';
    return h;
  }

  // ── Histórico ─────────────────────────────────────────────────────────────────
  var METS = [
    { k: 'nota', l: 'Nota geral', u: '', up: true, d: 0 }, { k: 'dl', l: 'Download médio', u: ' Mbps', up: true, d: 1 },
    { k: 'ul', l: 'Upload médio', u: ' Mbps', up: true, d: 1 }, { k: 'ping', l: 'Ping médio', u: ' ms', up: false, d: 0 },
    { k: 'sinal', l: 'Sinal Wi-Fi médio', u: ' dBm', up: true, d: 0 }, { k: 'cab', l: 'Rede cabeada (média)', u: ' Mbps', up: true, d: 0 }
  ];

  function tabHist(C, e, v) {
    var serie = e.serie, nums = serie.map(N.resumoNumerico);
    var melhor = 0, pior_ = 0;
    var cards = METS.map(function (m) {
      var vals = nums.map(function (n) { return n[m.k]; });
      var vv = vals.filter(ok), mx = Math.max.apply(null, vv.concat([1]));
      var cur = vals[vals.length - 1], prev = null;
      for (var i = vals.length - 2; i >= 0; i--) { if (ok(vals[i])) { prev = vals[i]; break; } }
      var dTxt = 'sem base para comparar', cls = 'p-gray';
      if (ok(cur) && prev !== null) {
        var df = cur - prev;
        if (Math.abs(df) < 0.05) dTxt = 'estável';
        else { var bom = m.up ? df > 0 : df < 0; dTxt = (df > 0 ? '▲ +' : '▼ −') + fmt(Math.abs(df), m.d) + m.u + (bom ? ', melhorou' : ', piorou'); cls = bom ? 'p-ok' : 'p-bad'; if (bom) melhor++; else pior_++; }
      }
      var cols = serie.map(function (s, idx) {
        var x = vals[idx];
        var hpx = !ok(x) ? 6 : Math.round(m.k === 'sinal' ? Math.max(8, Math.min(100, (x + 95) / 55 * 100)) : Math.max(8, x / mx * 100));
        var last = idx === serie.length - 1;
        return '<div class="hcol"><span class="small">' + (ok(x) ? fmt(x, m.d) : 'n/r') + '</span><div class="hbar" style="height:' + hpx + 'px;background:' + (last ? '#5B2A86' : (ok(x) ? '#B9A4D4' : '#E3DEEA')) + '"></div></div>';
      }).join('');
      var datas = serie.map(function (s) { return '<span class="hdt">' + dt(s.data).slice(0, 6) + dt(s.data).slice(8) + '</span>'; }).join('');
      return '<div class="card"><div class="row sb"><span class="muted">' + m.l + '</span><span class="kpi-s">' + (ok(cur) ? fmt(cur, m.d) + m.u : 'não registrado') + '</span></div>' +
        '<span class="pill ' + cls + '" style="align-self:flex-start">' + dTxt + '</span><div class="hbars">' + cols + '</div><div class="row">' + datas + '</div></div>';
    });
    var h = '<div class="info-box">' + serie.length + ' medições desta escola, de ' + dt(serie[0].data) + ' a ' + dt(serie[serie.length - 1].data) + '. A lista, o ranking, as notas e o topo do painel mostram sempre a mais recente. Barras escuras são a medição mais recente. Setas comparam a última com a anterior.</div>' +
      '<div class="row wrap gap small"><span class="pill p-ok">' + melhor + ' indicadores melhoraram</span><span class="pill ' + (pior_ ? 'p-bad' : 'p-gray') + '">' + pior_ + ' pioraram</span></div>' +
      '<div class="grid g-hist">' + cards.join('') + '</div><h3>Medições desta escola</h3><div class="col gap">';
    serie.slice().reverse().forEach(function (s, idx) {
      var atual = s === e.ultima, vendo = s === v;
      h += '<div class="card hist-card" style="' + (atual ? 'border:2px solid #5B2A86;background:#FAF8FD' : '') + '"><div class="row wrap gap"><span class="b" style="color:#3F1D63">' + dt(s.data) + '</span><span>Nota ' + (ok(s.calculado.nota) ? fmt(s.calculado.nota, 0) : '—') + '</span>' + faixaChip(s.calculado.faixa) +
        '<span class="small b" style="color:' + (atual ? '#14693C' : '#6B6479') + '">' + (atual ? 'Mais recente' : 'Anterior') + '</span><span class="small muted">' + (s.origem === 'planilha' ? 'planilha antiga' : 'pacote do app') + '</span></div>' +
        (vendo ? '<span class="small b">Em exibição</span>' : '<button class="btn" data-act="verMedicao" data-arg="' + esc(e.chave + '||' + s.chave) + '">Abrir esta medição</button>') + '</div>';
    });
    return h + '</div>';
  }

  // ── Espectro, fotos, PDF ──────────────────────────────────────────────────────
  function imgTag(v, rel, alt, cls) {
    return '<img class="' + (cls || 'thumb') + '" alt="' + esc(alt) + '" data-rel="' + esc(rel) + '" data-ch="' + esc(v.chave) + '">';
  }

  // Visualização ampliada (tela cheia) de uma foto ou print, com anterior/próxima.
  function lightbox(v, lista, atual) {
    var idx = -1;
    lista.forEach(function (f, n) { if (f.rel === atual) idx = n; });
    if (idx < 0) return '';
    var f = lista[idx], multi = lista.length > 1;
    return '<div class="lightbox" role="dialog" aria-modal="true" aria-label="' + esc(f.nome) + '"><div class="lb-bg" data-act="fecharFoto" data-arg=""></div>' +
      '<div class="lb-card"><div class="lb-img">' + imgTag(v, f.rel, f.nome, 'lb-pic') + '</div>' +
      '<div class="row sb wrap gap lb-bar"><b>' + esc(f.nome) + ' <span class="small muted">' + (idx + 1) + ' de ' + lista.length + '</span></b><div class="row gap">' +
      (multi ? '<button class="btn" data-act="fotoNav" data-arg="-1">Anterior</button><button class="btn" data-act="fotoNav" data-arg="1">Próxima</button>' : '') +
      '<button class="btn btn-p" data-act="fecharFoto" data-arg="">Fechar</button></div></div></div></div>';
  }
  function listaEspectro(v) { return (v.arquivos.espectro || []).map(function (rel, i) { return { nome: 'Espectro Wi-Fi ' + (i + 1), rel: rel }; }); }

  function tabEspectro(C, e, v) {
    var esp = v.arquivos.espectro || [];
    if (!esp.length) return '<div class="dash-box">' + (v.campos !== 'completa' ? 'Esta vistoria foi feita antes do recurso de análise de espectro (ou o pacote não trouxe os prints). Nada a mostrar aqui.' : 'Nenhum print de espectro nesta vistoria.') + '</div>';
    var lista = listaEspectro(v);
    return '<div class="grid g-foto">' + lista.map(function (f) {
      return '<button class="card nopad foto" data-act="foto" data-arg="' + esc(f.rel) + '"><div class="img-box tall">' + imgTag(v, f.rel, f.nome) + '</div><div class="foto-n">' + esc(f.nome) + '</div></button>';
    }).join('') + '</div>' + lightbox(v, lista, C.S.foto);
  }

  function listaFotos(v) {
    var f = v.arquivos.fotos || {}, out = [];
    var add = function (nome, rel) { if (rel) out.push({ nome: nome, rel: rel }); };
    add('Local', f.local); add('Switch', f.switch); add('Ambiente', f.ambiente); add('Modem', f.modem); add('Antenas', f.antenas);
    (f.switchEvidencias || []).forEach(function (r, i) { add('Switch, evidência ' + (i + 1), r); });
    (f.fibraEvidencias || []).forEach(function (r, i) { add('Fibra, evidência ' + (i + 1), r); });
    (f.antenasEvidencias || []).forEach(function (r, i) { add('Antenas, evidência ' + (i + 1), r); });
    v.cabeada.redes.forEach(function (r) { var fr = r.fotos || {}; add(r.nome + ', local', fr.laboratorio); add(r.nome + ', teste', fr.teste); add(r.nome + ', switch', fr.switch); add(r.nome + ', extra', fr.extra); });
    return out;
  }

  function tabFotos(C, e, v) {
    var fotos = listaFotos(v);
    if (!fotos.length) return '<div class="dash-box">' + (v.origem === 'planilha' ? 'Vistoria vinda de planilha antiga: a planilha não traz fotos.' : 'Nenhuma foto nesta vistoria.') + '</div>';
    var h = '';
    h += '<div class="grid g-foto">' + fotos.map(function (f) {
      return '<button class="card nopad foto" data-act="foto" data-arg="' + esc(f.rel) + '"><div class="img-box">' + imgTag(v, f.rel, f.nome) + '</div><div class="foto-n">' + esc(f.nome) + '</div></button>';
    }).join('') + '</div>';
    h += lightbox(v, fotos, C.S.foto);
    var aus = (v.arquivos.fotosAusentes || []).length;
    if (aus) h += '<div class="dash-box nr">' + aus + ' foto(s) não estavam mais no aparelho quando o pacote foi gerado.</div>';
    return h;
  }

  function tabPdf(C, e, v) {
    var tem = !!v.arquivos.pdf;
    var h = '<div class="card row sb wrap gap"><div class="col"><span class="t-card">' + (tem ? 'Relatório da vistoria' : 'Sem arquivos anexos') + '</span><span class="small muted">' +
      (tem ? esc(v.escola) + '.pdf' : 'Esta vistoria veio de planilha antiga: só os dados existem, sem PDF, fotos ou espectro.') + '</span></div><div class="row wrap gap">' +
      (tem ? '<button class="btn btn-p" data-act="abrirPdf" data-arg="">' + (C.S.pdf ? 'Fechar PDF' : 'Abrir PDF') + '</button><button class="btn" data-act="baixarPdf" data-arg="' + esc(v.chave) + '">Baixar PDF</button>' : '') +
      '<button class="btn" data-act="baixarJson" data-arg="' + esc(v.chave) + '">Baixar dados desta vistoria (.json)</button>' +
      (v.zipRef ? '<button class="btn" data-act="baixarPacote" data-arg="' + esc(v.chave) + '">Baixar pacote completo (.zip)</button>' : '') + '</div></div>';
    if (!v.zipRef && tem) h += '<div class="info-box">Este painel foi aberto a partir de um arquivo exportado: PDF e fotos estão embutidos, mas o pacote com os originais é o .zip que acompanhou o envio.</div>';
    if (tem && C.S.pdf) h += '<div class="card"><iframe class="pdf-frame" title="PDF da vistoria" data-pdf="' + esc(v.chave) + '"></iframe></div>';
    return h;
  }

  return {
    esc: esc, cap: cap, fmt: fmt, dt: dt, dthm: dthm, viewGeral: viewGeral, viewProjeto: viewProjeto, montarTopologia: montarTopologia, ICONES: ICONES, COR_ICONE: COR_ICONE, COR_AP_REG: COR_AP_REG, VERSAO: VERSAO, blocoTesteCarga: blocoTesteCarga, selo: selo, iconeDe: iconeDe,
    criticos: criticos, listaFotos: listaFotos, listaEspectro: listaEspectro, nomeProjeto: nomeProjeto,
    detalhe: detalhe, faixaChip: faixaChip, tendencia: tendencia
  };
});
