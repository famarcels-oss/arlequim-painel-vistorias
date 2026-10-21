/* Camada de gestão: contas da visão executiva, do projeto e da ficha da escola.
 *
 * REGRA PÉTREA: este arquivo só LÊ. Recebe as escolas já agrupadas por dados.js e devolve números novos.
 * Nunca altera uma vistoria, nunca chama adicionar/limpar do banco, nunca recalcula nota ou faixa.
 * Dado que falta fica fora da conta (null), nunca vira zero.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./regras.js'), require('./normalizar.js'));
  else root.PainelGestao = factory(root.PainelRegras, root.PainelNorm);
})(typeof self !== 'undefined' ? self : this, function (R, N) {
  'use strict';

  var ok = N.ok;

  // ── nomes das faixas: ÚNICO lugar onde eles são escritos ──────────────────────
  // Só texto; a régua de 80 / 51 / 50 é a do app. Trocar um nome aqui troca em todas as telas
  // (teste "trocar o nome de uma faixa muda o painel inteiro").
  //   rotulo: pílula e filtros (singular)   plural: filtros e contagens
  //   uma / varias: como cabe depois de "escola(s)"   verbo: "a escola <verbo> <uma>"
  var FAIXAS = {
    ap: { rotulo: 'Apta', plural: 'Aptas', uma: 'apta', varias: 'aptas', verbo: 'está' },
    apr: { rotulo: 'Apta com ressalva', plural: 'Aptas com ressalva', uma: 'apta com ressalva', varias: 'aptas com ressalva', verbo: 'está' },
    re: { rotulo: 'Com ajustes', plural: 'Com ajustes', uma: 'com ajustes', varias: 'com ajustes', verbo: 'funciona' },
    rp: { rotulo: 'Severas restrições', plural: 'Severas restrições', uma: 'com severas restrições', varias: 'com severas restrições', verbo: 'tem' },
    nm: { rotulo: 'Sem nota', plural: 'Sem nota', uma: 'sem nota', varias: 'sem nota', verbo: 'está' }
  };
  // "tem severas restrições": com o verbo "tem", o "com" do início sai
  function fraseFaixa(k) { var f = FAIXAS[k] || FAIXAS.nm; return f.verbo + ' ' + (f.verbo === 'tem' ? f.uma.replace(/^com /, '') : f.uma); }
  // rótulos antigos, sempre lidos do dicionário
  var ROTULOS = {};
  Object.keys(FAIXAS).forEach(function (k) { Object.defineProperty(ROTULOS, k, { enumerable: true, get: function () { return FAIXAS[k].rotulo; } }); });
  var CORES = {
    ap: { bg: '#DDF3E5', fg: '#14693C', dot: '#1F8A4C' },
    re: { bg: '#FCEBC5', fg: '#7A4B00', dot: '#E0A526' },
    rp: { bg: '#FAD9D9', fg: '#9B1C1C', dot: '#B4261E' },
    nm: { bg: '#E8E5EE', fg: '#4A4458', dot: '#9B94A8' },
    apr: { bg: 'linear-gradient(100deg,#DDF3E5 0 52%,#FCEBC5 100%)', fg: '#14693C', dot: 'linear-gradient(100deg,#1F8A4C 0 50%,#E0A526 50% 100%)' }
  };
  // Faixa de cada parte, lida do status que o app gravou (nada é recalculado).
  function faixaParte(st) {
    if (!st) return null;
    var t = String(st).toUpperCase();
    if (t.indexOf('RESSALVA') >= 0) return 're';
    if (t.indexOf('APROVAD') >= 0) return 'ap';
    if (t.indexOf('REPROVAD') >= 0) return 'rp';
    return null;
  }
  // Escola com Wi-Fi e rede física medidos, apta no geral, mas uma das duas partes com ressalva.
  function ehMista(v, tipo, faixa) {
    if (tipo !== 'hib' || faixa !== 'ap') return false;
    var c = v.calculado || {}, w = faixaParte(c.statusWifi), r = faixaParte(c.statusCabeada);
    return (w === 're' || r === 're') && w !== 'rp' && r !== 'rp';
  }
  var TIPOS = { hib: 'Wi-Fi e rede física', wifi: 'Só Wi-Fi', fis: 'Só rede física', nenhum: 'Sem medição' };

  // ── formatação ───────────────────────────────────────────────────────────────
  function milhar(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function pct(n, t) { return (t ? Math.round(n / t * 100) : 0) + '%'; }
  function soma(arr, f) { return arr.reduce(function (s, x) { var y = f(x); return ok(y) ? s + y : s; }, 0); }
  function mediaDe(arr) { var v = arr.filter(ok); return v.length ? v.reduce(function (s, x) { return s + x; }, 0) / v.length : null; }
  function txt(s) { return s == null ? '' : String(s); }
  function pl(n, um, varios) { return n + ' ' + (n === 1 ? um : varios); }


  // Nome para exibir: nome escrito só em maiúsculas vira "Nome Próprio" (só na tela, o dado não muda)
  var SIGLAS = { CEI: 1, CMEI: 1, CEIM: 1, EMEI: 1, EMEF: 1, EM: 1, EE: 1, EJA: 1, CEEBJA: 1, SEMED: 1, II: 1, III: 1 };
  var MIUDAS = { DA: 1, DE: 1, DO: 1, DAS: 1, DOS: 1, E: 1, A: 1, O: 1 };
  function nomeEscola(nome) {
    var t = txt(nome);
    if (!t || t !== t.toUpperCase() || t === t.toLowerCase()) return t;
    var primeiro = true;
    return t.replace(/[^\s\/]+/g, function (w) {
      var up = w.toUpperCase(), r;
      if (SIGLAS[up] || /^([A-Z]\.)+[A-Z]?$/.test(up)) r = up;
      else if (!primeiro && MIUDAS[up]) r = w.toLowerCase();
      else r = w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      primeiro = false;
      return r;
    });
  }

  // ── tipo de rede medida, pela medição mais recente ───────────────────────────
  function temWifi(v) {
    var w = v.wifi || {};
    return w.medido !== false && ((w.pontos && w.pontos.length > 0) || ok(w.mediaDownload));
  }
  function temFisica(v) {
    var c = v.cabeada || {};
    if ((c.redes || []).some(function (r) { return ok(r.download); })) return true;
    if (ok(c.legadoDownload) && c.legadoDownload > 0) return true;
    return c.possui === true && ok((v.calculado || {}).notaCabeada);
  }
  function tipoRede(v) {
    var w = temWifi(v), f = temFisica(v);
    return w && f ? 'hib' : w ? 'wifi' : f ? 'fis' : 'nenhum';
  }

  // ── uma linha por escola (medição mais recente), sem alterar nada ───────────
  function linhasDe(escolas) {
    return escolas.map(function (e) {
      var v = e.ultima, c = v.calculado || {};
      var faixa = (c.faixa === 'ap' || c.faixa === 're' || c.faixa === 'rp') && ok(c.nota) ? c.faixa : 'nm';
      var medida = faixa !== 'nm';
      var redes = (v.cabeada && v.cabeada.redes) || [];
      var tipo = tipoRede(v);
      var nW = ok(c.notaWifi) ? c.notaWifi : (tipo === 'wifi' && ok(c.nota) ? c.nota : null);
      var nF = ok(c.notaCabeada) && temFisica(v) ? c.notaCabeada : (tipo === 'fis' && ok(c.nota) ? c.nota : null);
      return {
        chave: e.chave, e: e, v: v, nome: nomeEscola(v.escola), projeto: v.projeto || 'Sem projeto',
        nota: ok(c.nota) ? c.nota : null, faixa: faixa, medida: medida, tipo: tipo, mista: ehMista(v, tipo, faixa),
        alunos: ok(v.censo && v.censo.alunos) ? v.censo.alunos : null,
        notaWifi: nW, notaFis: nF,
        dl: ok(v.wifi && v.wifi.mediaDownload) && v.wifi.mediaDownload > 0 ? v.wifi.mediaDownload : null, ping: ok(v.wifi && v.wifi.mediaPing) && v.wifi.mediaPing > 0 ? v.wifi.mediaPing : null,
        dlFis: mediaDe(redes.map(function (r) { return r.download; })), medicoes: e.serie.length
      };
    });
  }

  function doProjeto(linhas, nome) { return linhas.filter(function (l) { return l.projeto === nome; }); }
  function medidas(linhas) { return linhas.filter(function (l) { return l.medida; }); }

  // ── resumo de um conjunto de escolas ─────────────────────────────────────────
  function resumo(linhas) {
    var m = medidas(linhas);
    var por = function (f) { return m.filter(function (l) { return l.faixa === f; }); };
    var P = por('ap'), A = por('re'), B = por('rp');
    var PR = P.filter(function (l) { return l.mista; }), PP = P.filter(function (l) { return !l.mista; });
    var comAlunos = m.filter(function (l) { return l.alunos != null; });
    var comPing = m.filter(function (l) { return l.ping != null; });
    return {
      total: linhas.length, n: m.length, semNota: linhas.length - m.length,
      p: P.length, a: A.length, b: B.length, pr: PR.length, pp: PP.length,
      alPR: soma(PR, function (l) { return l.alunos; }), alPP: soma(PP, function (l) { return l.alunos; }),
      alP: soma(P, function (l) { return l.alunos; }), alA: soma(A, function (l) { return l.alunos; }), alB: soma(B, function (l) { return l.alunos; }),
      alunos: soma(m, function (l) { return l.alunos; }), nComAlunos: comAlunos.length,
      notaMedia: m.length ? Math.round(mediaDe(m.map(function (l) { return l.nota; }))) : null,
      nHib: m.filter(function (l) { return l.tipo === 'hib'; }).length,
      nWifi: m.filter(function (l) { return l.tipo === 'wifi'; }).length,
      nFis: m.filter(function (l) { return l.tipo === 'fis'; }).length,
      nComFisica: m.filter(function (l) { return l.tipo === 'hib' || l.tipo === 'fis'; }).length,
      latAlta: comPing.filter(function (l) { return l.ping > R.LIM.wifi.pingRegular; }).length, comPing: comPing.length
    };
  }

  function periodo(escolas) {
    var ds = [];
    escolas.forEach(function (e) { e.serie.forEach(function (v) { if (ok(v.data)) ds.push(v.data); }); });
    if (!ds.length) return null;
    return { ini: Math.min.apply(null, ds), fim: Math.max.apply(null, ds) };
  }

  // ── todos os projetos ────────────────────────────────────────────────────────
  function visaoGeral(escolas) {
    var linhas = linhasDe(escolas);
    var nomes = [];
    linhas.forEach(function (l) { if (nomes.indexOf(l.projeto) < 0) nomes.push(l.projeto); });
    var projetos = nomes.map(function (nome) {
      var ls = doProjeto(linhas, nome);
      var es = ls.map(function (l) { return l.e; });
      return { nome: nome, linhas: ls, resumo: resumo(ls), periodo: periodo(es), medicoes: es.reduce(function (s, e) { return s + e.serie.length; }, 0) };
    }).sort(function (a, b) {
      return (b.resumo.alB - a.resumo.alB) || (b.resumo.b - a.resumo.b) || (a.nome < b.nome ? -1 : 1);
    });
    var geral = resumo(linhas);
    var top2 = projetos.filter(function (p) { return p.resumo.alB > 0; }).slice(0, 2);
    var frases = textoGeral(geral, top2);
    return { linhas: linhas, projetos: projetos, geral: geral, frases: frases };
  }

  function textoGeral(r, top2, comEscolas) {
    var f = {};
    if (!r.n) { f.manchete = 'Ainda não há escola com nota para resumir.'; f.l1 = ''; f.l2 = ''; f.l3 = ''; return f; }
    var esc1 = r.n === 1;
    f.manchete = r.p === 0
      ? (esc1 ? 'Ainda não há escola ' + FAIXAS.ap.uma + ' para VDI entre as medidas' : 'Ainda não há escola ' + FAIXAS.ap.uma + ' para VDI entre as ' + r.n + ' medidas') + '.'
      : 'Hoje ' + r.p + ' de ' + r.n + (esc1 ? ' escola medida já sustenta' : ' escolas medidas já sustentam') + ' VDI' + (r.alP > 0 ? ', com ' + milhar(r.alP) + ' alunos' : '') + '.';
    var outras = [];
    if (r.a > 0) outras.push((r.p > 0 ? (r.a === 1 ? 'Outra funciona' : 'Outras ' + r.a + ' funcionam') : (r.a === 1 ? '1 escola funciona' : r.a + ' escolas funcionam')) + ' ' + FAIXAS.re.varias + '.');
    if (r.b > 0) outras.push((r.b === 1 ? '1 ainda pede' : r.b + ' ainda pedem') + ' intervenção' + (r.alB > 0 ? ' e ' + (r.b === 1 ? 'concentra ' : 'concentram ') + milhar(r.alB) + ' alunos' + (r.alunos ? ', ' + pct(r.alB, r.alunos) + ' do total' : '') : '') + '.');
    f.l1 = outras.join(' ');
    f.l2 = top2.length >= 2 && r.alB > 0
      ? top2[0].nome + ' e ' + top2[1].nome + ' juntos têm ' + pct(top2[0].resumo.alB + top2[1].resumo.alB, r.alB) + ' dos alunos em escolas ' + FAIXAS.rp.varias + '.'
      : (top2.length === 1 ? top2[0].nome + ' concentra os alunos em escolas ' + FAIXAS.rp.varias + '.' : '');
    f.l3 = r.nComFisica
      ? (r.nComFisica === r.n ? 'Todas as ' + r.n + ' escolas têm rede física medida.' : r.nComFisica + ' das ' + r.n + ' escolas têm rede física medida. Nas demais vale só o Wi-Fi.')
      : 'Nenhuma escola tem rede física medida até agora. A nota é só do Wi-Fi.';
    return f;
  }

  // ── causas e plano de ação ───────────────────────────────────────────────────
  function numProf(v) { var n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(n) ? n : null; }
  function fastEmAlgum(v) {
    var i = v.infra || {}, c = v.cabeada || {};
    var re = /fast\s*10\/100/i;
    return re.test(txt(i.switch)) || (c.redes || []).some(function (r) { return re.test(txt(r.switch)); }) || re.test(txt(c.legadoSwitch));
  }

  var CAUSAS = [
    { id: 'gateway', nome: 'Gateway é o modem da operadora',
      porque: 'O modem da operadora costuma limitar a rede e não deixa ajustar a configuração.',
      acao: 'Instalar um gateway próprio da escola, com configuração controlada.',
      teste: function (v) { return /modem da operadora/i.test(txt((v.infra || {}).gateway)); } },
    { id: 'prof', nome: 'Professores deram nota 5 ou menos',
      porque: 'É a percepção de quem usa. O Wi-Fi instável aparece na sala antes de aparecer na medição.',
      acao: 'Ouvir os professores e tratar as queixas junto com a correção técnica.',
      teste: function (v) { var n = numProf((v.infra || {}).notaProfessor); return n !== null && n <= 5; } },
    { id: 'lat', nome: 'Latência acima de 50 ms',
      porque: 'Acima de 50 ms o desktop virtual atrasa o clique e a digitação.',
      acao: 'Verificar o link e o caminho até a operadora.',
      teste: function (v) { var p = (v.wifi || {}).mediaPing; return ok(p) && p > R.LIM.wifi.pingRegular; } },
    { id: 'aps', nome: 'APs no corredor, longe das salas',
      porque: 'O sinal chega fraco dentro das salas, onde os alunos usam.',
      acao: 'Reposicionar os APs perto das salas.',
      teste: function (v) { return R.qualidadeDensidade((v.infra || {}).densidadeAps).k === 'f'; } },
    { id: 'dl', nome: 'Download médio abaixo de 25 Mbps',
      porque: 'Com pouca banda, poucos alunos ao mesmo tempo já saturam a conexão.',
      acao: 'Revisar o contrato de banda com a operadora.',
      teste: function (v) { var d = (v.wifi || {}).mediaDownload; return ok(d) && d > 0 && d < 25; } },
    { id: 'switch', nome: 'Switch 10/100 ou não identificado',
      porque: 'Limita o tráfego a 100 Mbps ou esconde onde está o gargalo.',
      acao: 'Trocar por switch gigabit e identificar o equipamento.',
      teste: function (v) { var k = R.qualidadeSwitch((v.infra || {}).switch).k; return k === 'f' || k === 'r' || fastEmAlgum(v); } },
    { id: 'imped', nome: 'Impeditivo registrado (obra, resistência)',
      porque: 'Obra, prédio temporário ou resistência dos usuários: trocar equipamento antes disso não resolve.',
      acao: 'Resolver a pendência externa antes de investir na rede.',
      teste: function (v) { return (v.conclusao || {}).possuiImpeditivo === true; } },
    { id: 'esp24', nome: 'Wi-Fi só em 2.4 GHz',
      porque: 'Faixa mais congestionada e mais lenta, com mais interferência.',
      acao: 'Trocar os APs por dual-band.',
      teste: function (v) { return R.qualidadeEspectro((v.infra || {}).espectroWifi).k === 'f'; } }
  ];
  var ORDEM_PRINCIPAL = ['lat', 'dl', 'switch', 'esp24', 'aps', 'gateway', 'prof', 'imped'];

  function causasDaEscola(v) {
    return CAUSAS.filter(function (c) { try { return !!c.teste(v); } catch (e) { return false; } });
  }

  function causaPrincipal(v) {
    var ativas = causasDaEscola(v).map(function (c) { return c.id; });
    for (var i = 0; i < ORDEM_PRINCIPAL.length; i++) if (ativas.indexOf(ORDEM_PRINCIPAL[i]) >= 0) return CAUSAS.filter(function (c) { return c.id === ORDEM_PRINCIPAL[i]; })[0];
    return null;
  }

  function causasDoProjeto(linhas) {
    var m = medidas(linhas);
    return CAUSAS.map(function (c, idx) {
      var alvo = m.filter(function (l) { try { return !!c.teste(l.v); } catch (e) { return false; } });
      return { id: c.id, nome: c.nome, porque: c.porque, acao: c.acao, qtd: alvo.length, de: m.length, escolas: alvo.map(function (l) { return l.nome; }), idx: idx };
    }).filter(function (c) { return c.qtd > 0; }).sort(function (a, b) { return (b.qtd - a.qtd) || (a.idx - b.idx); });
  }

  // ── listas de apoio ──────────────────────────────────────────────────────────
  function prioridade(linhas, n) {
    return medidas(linhas).filter(function (l) { return l.nota < R.LIM.nota.aprovada; })
      .sort(function (a, b) { return ((b.alunos || 0) * (100 - b.nota)) - ((a.alunos || 0) * (100 - a.nota)) || (a.nota - b.nota); })
      .slice(0, n)
      .map(function (l, i) {
        var c = causaPrincipal(l.v);
        return { pos: i + 1, l: l, causa: c ? c.nome : 'Sem causa registrada', acao: c ? c.acao : 'Rever os dados da vistoria com o técnico.' };
      });
  }
  function referencias(linhas, n) {
    return medidas(linhas).slice().sort(function (a, b) { return b.nota - a.nota; }).slice(0, n);
  }
  function porTipo(linhas, tipo) {
    return linhas.filter(function (l) { return tipo === 'todas' || !tipo || l.tipo === tipo; });
  }
  function contagemTipos(linhas) {
    var m = medidas(linhas);
    return {
      todas: m.length,
      wifi: m.filter(function (l) { return l.tipo === 'wifi'; }).length,
      hib: m.filter(function (l) { return l.tipo === 'hib'; }).length,
      fis: m.filter(function (l) { return l.tipo === 'fis'; }).length
    };
  }
  // Notas das escolas que têm rede física e Wi-Fi: mostra como a nota geral é formada
  function composicaoNota(linhas) {
    return medidas(linhas).filter(function (l) { return l.tipo === 'hib' && l.notaWifi != null && l.notaFis != null; })
      .sort(function (a, b) { return a.nota - b.nota; });
  }

  // ── histórico: rodadas e evolução ────────────────────────────────────────────
  var DIA = 86400000, CORTE_RODADA_DIAS = 21;

  function rodadas(linhas) {
    var itens = [];
    linhas.forEach(function (l) {
      l.e.serie.forEach(function (v) { if (ok(v.data)) itens.push({ data: v.data, v: v, escola: l.chave }); });
    });
    itens.sort(function (a, b) { return a.data - b.data; });
    var grupos = [];
    itens.forEach(function (it) {
      var g = grupos[grupos.length - 1];
      if (g && it.data - g.fim <= CORTE_RODADA_DIAS * DIA) { g.itens.push(it); g.fim = it.data; }
      else grupos.push({ ini: it.data, fim: it.data, itens: [it] });
    });
    return grupos.map(function (g, i) {
      var notas = g.itens.map(function (x) { return x.v.calculado && x.v.calculado.nota; }).filter(ok);
      var cont = function (f) { return g.itens.filter(function (x) { return x.v.calculado && x.v.calculado.faixa === f && ok(x.v.calculado.nota); }).length; };
      var esc = {}; g.itens.forEach(function (x) { esc[x.escola] = 1; });
      return { n: i + 1, ini: g.ini, fim: g.fim, medicoes: g.itens.length, escolas: Object.keys(esc).length,
        notaMedia: notas.length ? Math.round(mediaDe(notas)) : null, p: cont('ap'), a: cont('re'), b: cont('rp') };
    });
  }

  function evolucao(linhas) {
    var difs = [];
    linhas.forEach(function (l) {
      var s = l.e.serie; if (s.length < 2) return;
      var ult = s[s.length - 1].calculado.nota, ant = null;
      for (var i = s.length - 2; i >= 0; i--) { if (ok(s[i].calculado.nota)) { ant = s[i].calculado.nota; break; } }
      if (ok(ult) && ant !== null) difs.push(ult - ant);
    });
    if (!difs.length) return null;
    return { n: difs.length, media: mediaDe(difs), melhoraram: difs.filter(function (d) { return d > 0; }).length, pioraram: difs.filter(function (d) { return d < 0; }).length };
  }

  // De onde vieram os números (arquivo de origem das medições mais recentes)
  function fontes(linhas) {
    var mapa = {};
    linhas.forEach(function (l) {
      l.e.serie.forEach(function (v) {
        var plan = v.origem === 'planilha';
        var nome = v.arquivoOrigem || (plan ? 'planilha antiga' : 'pacote');
        var k = (plan ? 'planilha|' : 'pacote|') + nome;
        mapa[k] = mapa[k] || { nome: nome, origem: plan ? 'planilha antiga' : 'pacote do app', plan: plan, qtd: 0 };
        mapa[k].qtd++;
      });
    });
    return Object.keys(mapa).map(function (k) { return mapa[k]; }).sort(function (a, b) { return b.qtd - a.qtd; });
  }

  // ── ficha da escola ──────────────────────────────────────────────────────────
  function ficha(l) {
    var v = l.v, w = v.wifi || {}, pts = w.pontos || [];
    var comDl = pts.filter(function (p) { return ok(p.download); });
    var pior = comDl.length ? comDl.slice().sort(function (a, b) { return a.download - b.download; })[0] : null;
    var redes = ((v.cabeada && v.cabeada.redes) || []).map(function (r) {
      return { nome: r.nome, download: ok(r.download) ? r.download : null, ping: ok(r.ping) ? r.ping : null, qual: R.qualidadeCabeada(r.download, r.ping, r.jitter) };
    });
    var legado = ok(v.cabeada && v.cabeada.legadoDownload) && v.cabeada.legadoDownload > 0;
    if (!redes.length && legado) redes.push({ nome: 'Rede cabeada (registro antigo)', download: v.cabeada.legadoDownload, ping: ok(v.cabeada.legadoPing) ? v.cabeada.legadoPing : null, qual: R.qualidadeCabeada(v.cabeada.legadoDownload, v.cabeada.legadoPing, v.cabeada.legadoJitter) });
    return {
      wifi: l.tipo === 'wifi' || l.tipo === 'hib' ? {
        nota: l.notaWifi, dl: l.dl, ping: l.ping, jitter: mediaDe(pts.map(function (p) { return p.jitter; })), upload: ok(w.mediaUpload) ? w.mediaUpload : null,
        pontos: pts.length, pior: pior, qual: R.qualidadeWifi(l.dl, l.ping, mediaDe(pts.map(function (p) { return p.jitter; })))
      } : null,
      fisica: l.tipo === 'fis' || l.tipo === 'hib' ? { nota: l.notaFis, redes: redes } : null,
      causas: causasDaEscola(v),
      sugestoes: R.gerarSugestoes(v).total
    };
  }


  // ── ficha: texto de diagnóstico, posição no projeto e causas por tipo ─────────
  function dec1(n) { return String(n.toFixed(1)).replace('.', ','); }
  function jitterMedio(v) { return mediaDe(((v.wifi && v.wifi.pontos) || []).map(function (p) { return p.jitter; })); }
  function qualRede(v) {
    var r = ((v.cabeada && v.cabeada.redes) || []).filter(function (x) { return ok(x.download); })[0];
    if (r) return R.qualidadeCabeada(r.download, r.ping, r.jitter);
    var c = v.cabeada || {};
    return ok(c.legadoDownload) && c.legadoDownload > 0 ? R.qualidadeCabeada(c.legadoDownload, c.legadoPing, c.legadoJitter) : { k: 'n', l: R.NOMES.n };
  }
  // Todos os pontos de Wi-Fi mediram 0 Mbps: a escola estava sem conexão na visita (não é medição de qualidade)
  function semRede(v) {
    var pts = (v.wifi && v.wifi.pontos) || [];
    return pts.length > 0 && pts.every(function (p) { return ok(p.download) && p.download <= 0; });
  }
  function diagnostico(l) {
    var v = l.v, w = v.wifi || {};
    var pts = (w.pontos || []).filter(function (p) { return ok(p.download) && ok(p.ping); });
    var fx = fraseFaixa(l.faixa === 'ap' || l.faixa === 're' ? l.faixa : 'rp');
    if (l.tipo === 'nenhum') return 'Esta vistoria não tem Wi-Fi nem rede física medidos.';
    if (semRede(v)) return 'Sem rede na visita: todos os pontos de Wi-Fi mediram 0 Mbps. A nota reflete a falta de conexão, não a qualidade do Wi-Fi. Refazer a medição quando a conexão voltar.';
    if (l.tipo === 'fis') return 'Só a rede física foi medida. Sem o Wi-Fi medido, a nota vale só a rede cabeada.';
    var qw = R.qualidadeWifi(l.dl, l.ping, jitterMedio(v));
    if (l.tipo === 'hib') {
      var qf = qualRede(v), t = 'Na média das duas redes, a escola ' + fx + '.';
      if (qf.k === 'b' && qw.k !== 'b') t += ' A rede física está boa' + (l.faixa === 'ap' ? ' e compensa um Wi-Fi ' + (qw.k === 'r' ? 'regular' : 'ruim') : ' mas não compensa um Wi-Fi ' + (qw.k === 'r' ? 'regular' : 'ruim')) + '.';
      else if (qw.k === 'b' && (qf.k === 'r' || qf.k === 'f')) t += ' O Wi-Fi está bom, mas a rede física está ' + (qf.k === 'r' ? 'regular' : 'ruim') + '.';
      return t;
    }
    if (pts.length >= 2) {
      var o = pts.slice().sort(function (a, b) { return a.download - b.download; }), lo = o[0], hi = o[o.length - 1];
      if (hi.download - lo.download >= 0.5 * hi.download) {
        return 'A cobertura é desigual. Em ' + hi.nome + ' a medição é de ' + dec1(hi.download) + ' Mbps e ' + dec1(hi.ping) + ' ms, e em ' + lo.nome + ' é de ' + dec1(lo.download) + ' Mbps e ' + dec1(lo.ping) + ' ms. ' +
          (hi.download > R.LIM.wifi.dlRuim ? 'Isso indica que o link entrega e o Wi-Fi não chega em todos os ambientes.' : 'Isso indica que o link é o gargalo.');
      }
    }
    if (qw.k === 'n') return 'O Wi-Fi não tem medição de velocidade e latência registrada.';
    if (qw.k === 'b') return 'O Wi-Fi atende o VDI: ' + dec1(l.dl) + ' Mbps e ' + Math.round(l.ping) + ' ms em média.';
    return 'O Wi-Fi está ' + (qw.k === 'r' ? 'regular' : 'ruim') + ' em todos os ambientes: ' + dec1(l.dl) + ' Mbps e ' + Math.round(l.ping) + ' ms em média.';
  }

  var ORD_MAIOR = ['Maior', 'Segunda maior', 'Terceira maior', 'Quarta maior', 'Quinta maior', 'Sexta maior', 'Sétima maior', 'Oitava maior', 'Nona maior', 'Décima maior'];
  var ORD_MELHOR = ['Melhor', 'Segunda melhor', 'Terceira melhor', 'Quarta melhor', 'Quinta melhor', 'Sexta melhor', 'Sétima melhor', 'Oitava melhor', 'Nona melhor', 'Décima melhor'];
  function posicao(L, l) {
    var m = medidas(L); if (!l.medida) return '';
    var fim = ', em um ranking de ' + m.length + (m.length === 1 ? ' escola.' : ' escolas.');
    if (l.nota < R.LIM.nota.aprovada) {
      var pr = prioridade(L, m.length + 1), idx = -1;
      pr.forEach(function (x, i) { if (x.l.chave === l.chave) idx = i; });
      if (idx < 0) return '';
      return (idx < 10 ? ORD_MAIOR[idx] : (idx + 1) + 'ª maior') + ' prioridade do projeto' + fim;
    }
    var idx2 = m.slice().sort(function (a, b) { return b.nota - a.nota; }).map(function (x) { return x.chave; }).indexOf(l.chave);
    return (idx2 < 10 ? ORD_MELHOR[idx2] : (idx2 + 1) + 'ª melhor') + ' nota do projeto' + fim;
  }

  // Causas desta escola, agrupadas por quem resolve: equipamento é compra, instalação é obra, pessoas é conversa
  function causasPorTipo(v) {
    var i = v.infra || {}, c = v.conclusao || {}, w = v.wifi || {}, out = [];
    var add = function (grupo, item, valor) { out.push({ grupo: grupo, item: item, valor: valor }); };
    var esp = R.qualidadeEspectro(i.espectroWifi); if (esp.k === 'f' || esp.k === 'r') add('EQUIPAMENTO', 'Espectro do Wi-Fi', i.espectroWifi);
    var sw = R.qualidadeSwitch(i.switch); if (sw.k === 'f' || sw.k === 'r') add('EQUIPAMENTO', 'Switch', i.switch);
    else if (fastEmAlgum(v)) add('EQUIPAMENTO', 'Switch da rede cabeada', 'Fast 10/100');
    var gw = R.qualidadeGateway(i.gateway); if (gw.k === 'f' || gw.k === 'r') add('EQUIPAMENTO', 'Gateway', i.gateway);
    var dn = R.qualidadeDensidade(i.densidadeAps); if (dn.k === 'f' || dn.k === 'r') add('INSTALAÇÃO', 'Posição dos APs', i.densidadeAps);
    var cb = R.qualidadeCabos(i.cabeamento); if (cb.k === 'f') add('INSTALAÇÃO', 'Cabeamento', i.cabeamento);
    if (i.possuiZonaSombra === true) add('INSTALAÇÃO', 'Zona de sombra', i.salasSemSinal || 'Sim');
    if (c.possuiImpeditivo === true) add('PESSOAS', 'Impeditivo registrado', c.observacoesImpeditivo || 'Sim');
    var np = numProf(i.notaProfessor); if (np !== null && np <= 5) add('PERCEPÇÃO', 'Nota dos professores', txt(i.notaProfessor));
    if (ok(w.mediaPing) && w.mediaPing > R.LIM.wifi.pingRegular) add('DESEMPENHO', 'Latência média', dec1(w.mediaPing) + ' ms');
    if (ok(w.mediaDownload) && w.mediaDownload > 0 && w.mediaDownload < 25) add('DESEMPENHO', 'Download médio', dec1(w.mediaDownload) + ' Mbps');
    return out;
  }


  // ── evolução das escolas aptas e maior ofensor (só leitura) ──────────────────
  // Estado de cada escola em cada data de medição: vale a última medição até aquele dia.
  function serieAptas(linhas) {
    var ev = [];
    linhas.forEach(function (l, i) {
      l.e.serie.forEach(function (v) { if (ok(v.data) && v.calculado && ok(v.calculado.nota)) ev.push({ t: v.data, i: i, f: v.calculado.faixa }); });
    });
    if (!ev.length) return [];
    ev.sort(function (a, b) { return a.t - b.t; });
    // a série começa ao fim da primeira rodada: antes disso as escolas ainda estavam sendo medidas pela primeira vez
    var rs = rodadas(linhas), corte = rs.length ? rs[0].fim : 0;
    var dias = [];
    ev.forEach(function (x) { var d = new Date(Math.max(x.t, corte)); d.setHours(23, 59, 59, 999); var k = d.getTime(); if (dias.indexOf(k) < 0) dias.push(k); });
    dias.sort(function (a, b) { return a - b; });
    var estado = {}, k = 0, pts = [], ult = null;
    dias.forEach(function (lim) {
      while (k < ev.length && ev[k].t <= lim) { estado[ev[k].i] = ev[k].f; k++; }
      var n = 0; for (var q in estado) if (estado[q] === 'ap') n++;
      var ponto = { t: lim, n: n, medidas: Object.keys(estado).length };
      if (!ult || ult.n !== n) pts.push(ponto); else pts[pts.length - 1].fim = lim;
      ult = ponto;
    });
    if (pts[pts.length - 1].t !== dias[dias.length - 1] && !pts[pts.length - 1].fim) pts[pts.length - 1].fim = dias[dias.length - 1];
    return pts;
  }

  // Link escrito com Gb/Giga vale n x 1000 Mbps, mesmo que o app tenha gravado o número puro.
  function mbpsLink(l) {
    var t = txt(l && l.tamanho).toLowerCase().replace(',', '.');
    var m = t.match(/(\d+(?:\.\d+)?)\s*(?:gb|giga|g\b)/);
    return m ? parseFloat(m[1]) * 1000 : (l ? l.mbps : null);
  }
  function vazioCampo(s) { var t = txt(s).trim().toLowerCase(); return t === '' || t === 'selecione'; }

  var OFENSORES = [
    { id: 'link', nome: 'Link de internet abaixo de 1 Gbps', campo: 'link registrado', acao: 'Upgrade do link para 1 Gbps.',
      tem: function (v) { return (v.links || []).some(function (l) { return ok(mbpsLink(l)); }); }, tag: 'LINK' },
    { id: 'gateway', nome: 'Gateway é o modem da operadora', campo: 'gateway registrado', acao: 'Instalar um roteador profissional.',
      tem: function (v) { return !vazioCampo((v.infra || {}).gateway); }, tag: 'GATEWAY' },
    { id: 'aps', nome: 'APs no corredor, longe das salas', campo: 'densidade de APs registrada', acao: 'Instalar uma antena dentro de cada sala.',
      tem: function (v) { return !vazioCampo((v.infra || {}).densidadeAps); }, tag: 'WI-FI', chave: 'corredores' },
    { id: 'sombra', nome: 'Salas sem sinal (zonas de sombra)', campo: 'zona de sombra registrada', acao: 'Reforçar a cobertura nas salas sem sinal.',
      tem: function (v) { return (v.infra || {}).possuiZonaSombra != null; }, tag: 'WI-FI', chave: 'zonas mortas' },
    { id: 'switch', nome: 'Switch 10/100', campo: 'switch registrado', acao: 'Trocar por switch gigabit.',
      tem: function (v) { return !vazioCampo((v.infra || {}).switch); }, tag: 'SWITCH' },
    { id: 'cabos', nome: 'Cabos danificados', campo: 'cabeamento registrado', acao: 'Renovar a cabeação.',
      tem: function (v) { return !vazioCampo((v.infra || {}).cabeamento); }, tag: 'CABOS' },
    { id: 'lat', nome: 'Latência acima de 100 ms', campo: 'latência medida', acao: 'Verificar o link e o caminho até a operadora.',
      tem: function (v) { return ok((v.wifi || {}).mediaPing); }, tag: 'DESEMPENHO', chave: 'latência' },
    { id: 'dl', nome: 'Download de 80 Mbps ou menos', campo: 'download medido', acao: 'Rever a banda e o desempenho da rede.',
      tem: function (v) { var d = (v.wifi || {}).mediaDownload; return ok(d) && d > 0; }, tag: 'DESEMPENHO', chave: 'Mbps' },
    // Teste de carga (app 1.2.0): conta direto do resultado que veio do app, sem passar pelas sugestões; fica fora do "maior ofensor" da visão executiva.
    { id: 'carga', nome: 'Teste de carga Regular ou Ruim', campo: 'teste de carga', acao: 'Redimensionar os canais dos access points.', soMelhorias: true,
      tem: function (v) { var t = v.testeCarga; return !!(t && t.resultado); },
      conta: function (v) { var x = (v.testeCarga || {}).resultado; return x === 'Regular' || x === 'Ruim'; } }
  ];
  function corrigeLinks(v) {
    return Object.assign({}, v, { links: (v.links || []).map(function (l) { return Object.assign({}, l, { mbps: mbpsLink(l) }); }) });
  }
  // Melhorias sugeridas pelo app (regras.js, só leitura), somadas por tipo na última vistoria de cada escola.
  // Ordem: a que atinge a maior proporção das escolas com o dado registrado; desempate por volume.
  var GENERICO = {
    dl: 'A banda por sala fica pequena para o número de acessos simultâneos. O resultado é lentidão e travamentos nas máquinas virtuais.',
    lat: 'Latência alta deixa a sessão remota lenta e instável para quem está usando.',
    carga: 'Com a sala cheia, a rede não segurou o uso ao mesmo tempo. No VDI isso vira travamento justamente na aula.'
  };
  function melhorias(linhas) {
    var cont = OFENSORES.map(function (o) { return { o: o, qtd: 0, de: 0, escolas: [], porque: '' }; });
    linhas.forEach(function (l) {
      var v = corrigeLinks(l.e.ultima), g = R.gerarSugestoes(v);
      cont.forEach(function (c) {
        var o = c.o; if (!o.tem(v)) return;
        c.de++;
        if (o.conta) { if (o.conta(v)) { c.qtd++; c.escolas.push(l); c.porque = GENERICO[o.id]; } return; }
        var risco = g.riscos.filter(function (r) { return r.tag === o.tag && (!o.chave || r.t.indexOf(o.chave) >= 0); })[0];
        if (risco) { c.qtd++; c.escolas.push(l); if (!c.porque) c.porque = (GENERICO[o.id] || risco.t); }
      });
    });
    var lista = cont.filter(function (c) { return c.qtd > 0 && c.de > 0; }).sort(function (a, b) { return (b.qtd / b.de) - (a.qtd / a.de) || b.qtd - a.qtd; });
    return lista.map(function (c) {
      c.so = !!c.o.soMelhorias;
      c.escolas.sort(function (a, b) { return (a.nota == null ? 101 : a.nota) - (b.nota == null ? 101 : b.nota); });
      return { id: c.o.id, nome: c.o.nome, campo: c.o.campo, acao: c.o.acao, porque: c.porque, qtd: c.qtd, de: c.de, sem: linhas.length - c.de, total: linhas.length, escolas: c.escolas, soMelhorias: c.so };
    });
  }
  function maiorOfensor(linhas) {
    var lista = melhorias(linhas).filter(function (c) { return !c.soMelhorias; });
    if (!lista.length) return null;
    var t = lista[0];
    return { id: t.id, nome: t.nome, campo: t.campo, acao: t.acao, qtd: t.qtd, de: t.de, sem: t.sem, total: t.total, escolas: t.escolas, segundo: lista[1] ? lista[1].nome : null };
  }

  return {
    FAIXAS: FAIXAS, fraseFaixa: fraseFaixa, ROTULOS: ROTULOS, faixaParte: faixaParte, ehMista: ehMista, CORES: CORES, TIPOS: TIPOS, CAUSAS: CAUSAS, CORTE_RODADA_DIAS: CORTE_RODADA_DIAS,
    milhar: milhar, pct: pct, pl: pl, mediaDe: mediaDe,
    tipoRede: tipoRede, temWifi: temWifi, temFisica: temFisica,
    linhasDe: linhasDe, doProjeto: doProjeto, medidas: medidas, resumo: resumo, periodo: periodo, visaoGeral: visaoGeral, textoGeral: textoGeral,
    causasDaEscola: causasDaEscola, causaPrincipal: causaPrincipal, causasDoProjeto: causasDoProjeto,
    prioridade: prioridade, referencias: referencias, porTipo: porTipo, contagemTipos: contagemTipos, composicaoNota: composicaoNota,
    rodadas: rodadas, evolucao: evolucao, serieAptas: serieAptas, maiorOfensor: maiorOfensor, melhorias: melhorias, mbpsLink: mbpsLink, fontes: fontes, ficha: ficha,
    semRede: semRede, nomeEscola: nomeEscola, diagnostico: diagnostico, posicao: posicao, causasPorTipo: causasPorTipo, jitterMedio: jitterMedio, qualRede: qualRede
  };
});
