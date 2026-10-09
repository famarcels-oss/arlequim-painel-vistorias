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
  function mbTxt(n) { return ok(n) ? fmt(n) + ' Mbps' : 'não medido'; }
  function nr(s) { return '<span class="nr">não registrado</span>'; }
  function val(x, sufixo) {
    if (x === null || x === undefined || x === '') return nr();
    if (typeof x === 'number') return esc(fmt(x, Number.isInteger(x) ? 0 : 1)) + (sufixo || '');
    if (typeof x === 'boolean') return x ? 'Sim' : 'Não';
    return esc(x) + (sufixo || '');
  }
  function q(k) { return 'q-' + (k || 'n'); }

  function faixaChip(f) {
    var F = R.FAIXAS[f] || R.FAIXAS.nm;
    return '<span class="pill" style="background:' + F.bg + ';color:' + F.fg + '">' + F.l + '</span>';
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
      { id: 'todos', l: 'Total de escolas', v: base.length, s: 'neste projeto', fg: '#3F1D63' },
      { id: 'ap', l: 'Aprovadas', v: cont('ap'), s: 'nota 80 ou mais', fg: '#14693C' },
      { id: 're', l: 'Com ressalva', v: cont('re'), s: 'nota de 51 a 79', fg: '#7A4B00' },
      { id: 'rp', l: 'Reprovadas', v: cont('rp'), s: 'nota 50 ou menos', fg: '#9B1C1C' },
      { id: 'nm', l: 'Wi-Fi não medido', v: cont('nm'), s: 'sem medição', fg: '#4A4458' }
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
        '<span class="small vel-v">↓ ' + (ok(dl) ? fmt(dl) : 'não medido') + '<br>↑ ' + (ok(ul) ? fmt(ul) : 'não registrado') + '</span></div>';
    }).join('') + '<div class="small muted">Barra escura: download. Barra clara: upload (vistorias antigas não têm upload).</div>' : '<span class="muted">Sem escolas.</span>') + '</div>';

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
      '<span>' + faixaChip(c.faixa) + '</span><span>' + (ok(v.wifi.mediaDownload) ? fmt(v.wifi.mediaDownload) + ' Mbps' : 'não medido') + '</span>' +
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

  function item(k, v) { return '<div class="card it"><span class="small muted">' + k + '</span><span class="it-v">' + v + '</span></div>'; }
  function itemQ(k, texto, kq) { return '<div class="card it"><span class="small muted">' + k + '</span><span class="it-v">' + (texto == null || texto === '' ? nr() : '<span class="dot ' + q(kq) + '"></span>' + esc(texto)) + '</span></div>'; }

  function tabResumo(C, e, v) {
    var c = v.censo, i = v.infra;
    var links = v.links.length ? v.links.map(function (l) { return esc((l.operadora || 'Link') + (l.tamanho ? ', ' + l.tamanho : '')); }).join('<br>') : nr();
    var sw = R.qualidadeSwitch(i.switch), gw = R.qualidadeGateway(i.gateway), cb = R.qualidadeCabos(i.cabeamento), dn = R.qualidadeDensidade(i.densidadeAps), es = R.qualidadeEspectro(i.espectroWifi);
    var h = '<h3>Identificação</h3><div class="grid g-it">' +
      item('Data da vistoria', v.data ? dthm(v.data) : nr()) + item('Projeto', v.projeto ? esc(v.projeto) : nr()) + item('Endereço', val(v.endereco)) +
      item('Técnico', val(v.tecnico.nome)) + item('E-mail do técnico', val(v.tecnico.email)) + item('Versão do app', val(v.versaoApp)) + item('Aparelho', val(v.aparelho)) +
      item('Identificador (uuid)', v.uuid ? '<span class="mono small">' + esc(v.uuid) + '</span>' : nr()) + item('Origem do dado', v.origem === 'planilha' ? 'Planilha antiga (' + esc(v.arquivoOrigem || '') + ')' : 'Pacote do app (' + esc(v.arquivoOrigem || '') + ')') + '</div>';
    h += '<h3>Censo</h3><div class="grid g-it">' + item('Salas', val(c.salas)) + item('Alunos', val(c.alunos)) + item('Professores', val(c.professores)) +
      item('Chromebooks', c.possuiChromebooks === false ? 'Não possui' : val(c.chromebooks)) + item('Desktops', c.possuiDesktops === false ? 'Não possui' : val(c.desktops)) +
      item('Projetores', c.possuiProjetores === false ? 'Não possui' : val(c.projetores)) + item('Nível de informática', val(c.nivelInformatica)) + '</div>';
    h += '<h3>Infraestrutura</h3><div class="grid g-it">' +
      itemQ('Switch', i.switch, sw.k) + itemQ('Gateway', i.gateway, gw.k) + itemQ('Cabeamento', i.cabeamento, cb.k) +
      itemQ('Densidade de APs', i.densidadeAps, dn.k) + itemQ('Espectro', i.espectroWifi, es.k) + item('Access points', val(i.accessPoints)) +
      item('Nota do professor', val(i.notaProfessor)) + item('Links de internet', links) +
      item('Zona de sombra', i.possuiZonaSombra == null ? nr() : (i.possuiZonaSombra ? 'Sim' + (i.salasSemSinal ? ': ' + esc(i.salasSemSinal) : '') : 'Não')) + '</div>';
    var con = v.conclusao;
    h += '<h3>Conclusão</h3><div class="grid g-it">' +
      item('Impeditivos', con.possuiImpeditivo == null ? nr() : (con.possuiImpeditivo ? 'Sim' + (con.observacoesImpeditivo ? ': ' + esc(con.observacoesImpeditivo) : '') : 'Nenhum')) +
      item('Dificuldades', con.possuiDificuldade == null ? nr() : (con.possuiDificuldade ? 'Sim' + (con.observacoesDificuldade ? ': ' + esc(con.observacoesDificuldade) : '') : 'Nenhuma')) +
      item('Nota geral', ok(v.calculado.nota) ? fmt(v.calculado.nota, 0) + ' ' + faixaChip(v.calculado.faixa) : nr()) +
      item('Nota Wi-Fi / cabeada', (ok(v.calculado.notaWifi) ? fmt(v.calculado.notaWifi, 0) : '—') + ' / ' + (ok(v.calculado.notaCabeada) ? fmt(v.calculado.notaCabeada, 0) : '—')) + '</div>';
    return h;
  }

  function legenda(cab) {
    var L = R.LIM[cab ? 'cabeada' : 'wifi'];
    return '<div class="row wrap gap small"><span>Cor do card, régua ' + (cab ? 'do laboratório' : 'do Wi-Fi') + ' no app:</span>' +
      '<span class="pill q-b b-pill">Bom</span><span class="pill q-r b-pill">Regular</span><span class="pill q-f b-pill">Ruim</span>' +
      '<span class="muted">Ruim: download até ' + L.dlRuim + ' Mbps, ping acima de ' + L.pingRuim + ' ms ou jitter acima de ' + L.jitter + ' ms. Regular: download até ' + L.dlRegular + ' Mbps ou ping acima de ' + L.pingRegular + ' ms. Passe o mouse ou toque para ver todos os dados.</span></div>';
  }

  function linhaExtra(k, v) { return '<span class="ln"><span class="muted">' + k + '</span><span class="lv">' + v + '</span></span>'; }

  function tabPontos(C, e, v) {
    var pts = v.wifi.pontos;
    if (!pts.length) return '<div class="dash-box">' + (v.calculado.faixa === 'nm' ? 'Wi-Fi não medido nesta vistoria.' : 'Nenhum ponto de Wi-Fi registrado nesta vistoria.') + '</div>';
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
        linhaExtra('Upload', ok(p.upload) ? fmt(p.upload) + ' Mbps' : nr()) + linhaExtra('Suporta', p.capacidade ? esc(p.capacidade) : nr()) +
        linhaExtra('Medição manual', p.manual == null ? nr() : (p.manual ? 'Sim' : 'Não')) +
        linhaExtra('Qualidade geral', '<span class="' + q(qd.k) + '-t">' + qd.l + '</span>') + linhaExtra('Por quê', esc(qd.motivo)) + '</span>' +
        '<span class="pt-hint small muted">Passe o mouse ou toque para ver todos os dados</span></button>';
    });
    return h + '</div>';
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

  function montarTopologia(v) {
    var i = v.infra, tiers = [];
    var no = function (id, tipo, titulo, det, extra, kq, ql, miss) {
      return { id: id, tipo: tipo, titulo: titulo, det: det, extra: extra, k: miss ? 'n' : kq, ql: miss ? 'não registrado' : (ql || R.NOMES[kq]), miss: !!miss };
    };
    // Internet
    var nIn = v.links.length ? v.links.map(function (l, n) {
      var ql = R.qualidadeLink(l.mbps);
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
    tiers.push({ nome: 'REDE CABEADA', conn: 'cabos', nos: nRede });
    tiers.push({ nome: 'WI-FI', conn: 'cabo até os access points', nos: [no('ap', 'ACCESS POINTS', ok(i.accessPoints) ? i.accessPoints + ' access points' : 'Access points', (i.densidadeAps || 'densidade não registrada') + (i.espectroWifi ? ', ' + i.espectroWifi : ''), 'Densidade: ' + (den.l || '') + '. Espectro: ' + (esp.l || '') + '. A quantidade e a posição de cada AP não são registradas pelo app.', kAp, R.NOMES[kAp], apMiss)] });
    var pts = v.wifi.pontos;
    var nAmb = pts.length ? pts.map(function (p, n) {
      var qd = R.qualidadeWifi(p.download, p.ping, p.jitter), sg = R.qualidadeSinal(p.sinalDbm);
      var k = qd.k !== 'n' ? qd.k : sg.k;
      return no('amb' + n, 'AMBIENTE', p.nome, (p.banda ? p.banda + ', ' : '') + (sg.k === 'n' ? 'sinal não registrado' : p.sinalDbm + ' dBm, ' + sg.nivel), 'Download ' + mbTxt(p.download) + ', ping ' + (ok(p.ping) ? fmt(p.ping) + ' ms' : 'não registrado') + '. ' + qd.motivo, k, R.NOMES[k], k === 'n');
    }) : [no('amb', 'AMBIENTES', 'Pontos medidos', 'sem medição', 'Esta vistoria não tem pontos de Wi-Fi medidos.', 'n', '', true)];
    tiers.push({ nome: 'AMBIENTES ATENDIDOS', conn: 'sinal sem fio', nos: nAmb });
    return tiers;
  }

  function tabTopo(C, e, v) {
    var tiers = montarTopologia(v);
    var chaveSel = C.S.no, sel = null;
    var h = '<div class="info-box">Esquema montado automaticamente com o que foi registrado na vistoria (links, gateway, switch, redes cabeadas, access points e ambientes). Não é planta física. Clique em um elemento para ver os detalhes. Cada elemento é pintado com a mesma régua de cores do app.</div>' +
      '<div class="row wrap gap small"><span>Cores:</span><span class="pill q-b b-pill">Bom</span><span class="pill q-r b-pill">Regular</span><span class="pill q-f b-pill">Ruim</span><span class="pill q-n b-pill dashed">não registrado</span><span class="muted">Link, gateway e switch seguem as penalidades de hardware do app. Wi-Fi, rede cabeada e ambientes seguem as medições.</span></div>';
    h += '<div class="card topo">';
    tiers.forEach(function (t, ti) {
      h += '<div class="tier">';
      if (ti > 0) h += '<div class="conn"><i></i><span class="small muted">' + esc(t.conn) + '</span><i></i></div>';
      h += '<div class="small muted tier-n">' + t.nome + '</div><div class="row wrap gap center">';
      t.nos.forEach(function (n) {
        var key = v.chave + ':' + n.id, on = chaveSel === key;
        if (on) sel = n;
        h += '<button class="no ' + q(n.k) + (n.miss ? ' miss' : '') + (on ? ' sel' : '') + (n.neutro ? ' neutro' : '') + '" data-act="no" data-arg="' + esc(key) + '" aria-pressed="' + on + '">' +
          '<span class="no-tipo">' + n.tipo + '</span><span class="no-t' + (n.miss ? ' nr' : '') + '">' + esc(n.titulo) + '</span><span class="small">' + esc(n.det) + '</span>' +
          '<span class="no-q ' + q(n.k) + '-t">' + esc(n.ql) + '</span></button>';
      });
      h += '</div></div>';
    });
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

  function tabEspectro(C, e, v) {
    var esp = v.arquivos.espectro || [];
    if (!esp.length) return '<div class="dash-box">' + (v.campos !== 'completa' ? 'Esta vistoria foi feita antes do recurso de análise de espectro (ou o pacote não trouxe os prints). Nada a mostrar aqui.' : 'Nenhum print de espectro nesta vistoria.') + '</div>';
    return '<div class="grid g-foto">' + esp.map(function (rel, i) {
      return '<div class="card nopad foto"><div class="img-box">' + imgTag(v, rel, 'Espectro ' + (i + 1)) + '</div><div class="foto-n">Espectro Wi-Fi ' + (i + 1) + '</div></div>';
    }).join('') + '</div>';
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
    if (C.S.foto) {
      var sel = fotos.filter(function (f) { return f.rel === C.S.foto; })[0];
      if (sel) h += '<div class="card sel-box"><div class="img-big">' + imgTag(v, sel.rel, sel.nome, 'big') + '</div><div class="row gap"><b>' + esc(sel.nome) + '</b><button class="btn" data-act="fecharFoto" data-arg="">Fechar foto</button></div></div>';
    }
    h += '<div class="grid g-foto">' + fotos.map(function (f) {
      return '<button class="card nopad foto" data-act="foto" data-arg="' + esc(f.rel) + '"><div class="img-box">' + imgTag(v, f.rel, f.nome) + '</div><div class="foto-n">' + esc(f.nome) + '</div></button>';
    }).join('') + '</div>';
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
    esc: esc, fmt: fmt, dt: dt, dthm: dthm, viewGeral: viewGeral, viewProjeto: viewProjeto, montarTopologia: montarTopologia,
    criticos: criticos, listaFotos: listaFotos, nomeProjeto: nomeProjeto
  };
});
