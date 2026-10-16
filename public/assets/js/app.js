/* Painel de Vistorias: estado, eventos, leitura de arquivos e exportação.
 * Roda 100% no navegador. Nada é enviado para a internet.
 */
(function () {
  'use strict';
  var R = window.PainelRegras, N = window.PainelNorm, D = window.PainelDados, V = window.PainelViews;
  var esc = V.esc, PP = window.PainelPasta, VG = window.PainelViewsGestao;
  var banco = D.criar();

  var S = {
    view: 'geral', projeto: null, filtro: 'todos', qual: 'todas', busca: '', aberto: null, aba: 'resumo', pin: null, no: null, foto: null, pdf: false,
    sel: {}, exportar: false, carregar: false, aviso: '', leitura: null, ocupado: '', embutido: null, pasta: null, lidos: {}, lendoPasta: false, menuDados: false, exportEscopo: null,
    inc: { pdf: true, fotos: true, espectro: true, tecnico: true }
  };

  // Visão gestão: estado das telas novas (só tela, nenhum dado). A tela anterior continua disponível com #classico no endereço.
  S.gAba = 'visao'; S.gTipo = 'todas'; S.gFiltro = 'todas'; S.gMelhoria = 'todas'; S.gOrdem = 'recentes'; S.gVer = {}; S.ficha = null; S.rolarTopo = false;
  function classico() { return /classico/i.test(String(location.hash || '')); }
  function resetGestao() { S.gAba = 'visao'; S.gTipo = 'todas'; S.gFiltro = 'todas'; S.gMelhoria = 'todas'; S.gOrdem = 'recentes'; S.gVer = {}; }

  var app = document.getElementById('app');
  var cacheUrl = {};

  // ── utilitários ──────────────────────────────────────────────────────────────
  function mime(rel) {
    var e = String(rel).split('.').pop().toLowerCase();
    return { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', pdf: 'application/pdf', json: 'application/json' }[e] || 'application/octet-stream';
  }
  function salvar(blob, nome) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = nome;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }
  function nomeArq(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'vistoria'; }
  function limpo(v) { // vistoria sem referências a arquivos abertos
    var c = {}; Object.keys(v).forEach(function (k) { if (k !== 'zipRef' && k !== 'embut') c[k] = v[k]; }); return c;
  }
  function vistoriaPorChave(chave) { return banco.todas().filter(function (v) { return v.chave === chave; })[0]; }

  async function blobDe(v, rel) {
    if (v.embut && v.embut[rel]) return (await fetch(v.embut[rel])).blob();
    if (v.zipRef) {
      var f = v.zipRef.file((v.arquivos.base || '') + rel);
      if (f) return new Blob([await f.async('arraybuffer')], { type: mime(rel) });
    }
    return null;
  }
  async function urlArquivo(v, rel, comoBlob) {
    var k = v.chave + '|' + rel + (comoBlob ? '|b' : '');
    if (cacheUrl[k]) return cacheUrl[k];
    var url = null;
    if (v.embut && v.embut[rel] && !comoBlob) url = v.embut[rel];
    else { var b = await blobDe(v, rel); if (b) url = URL.createObjectURL(b); }
    cacheUrl[k] = url;
    return url;
  }

  // ── contexto entregue às telas ───────────────────────────────────────────────
  function contexto() {
    var escolas = banco.escolas();
    var projs = [];
    escolas.forEach(function (e) { var p = V.nomeProjeto(e.ultima); if (projs.indexOf(p) < 0) projs.push(p); });
    projs.sort();
    return {
      S: S, escolas: escolas, projetos: projs, todas: banco.todas(),
      vistoriaSelecionada: function (e) {
        var ch = S.sel[e.chave];
        return (ch && e.serie.filter(function (x) { return x.chave === ch; })[0]) || e.ultima;
      }
    };
  }

  // ── desenho da página ────────────────────────────────────────────────────────
  function subtituloApp(C) {
    var total = C.todas.length;
    var sub = S.embutido ? 'Painel gerado em ' + V.dthm(S.embutido.geradoEm) + ' com ' + S.embutido.total + ' medições embutidas neste arquivo. Tudo roda no seu navegador, nada é enviado para a internet.' :
      (total ? 'Carregado: ' + total + ' medições de ' + C.escolas.length + ' escolas em ' + C.projetos.length + ' projeto' + (C.projetos.length === 1 ? '' : 's') + '. Tudo roda no seu navegador, nada é enviado para a internet.' : 'Nenhum dado carregado ainda. Tudo roda no seu navegador, nada é enviado para a internet.');
    return sub;
  }

  function cabecalho(C) {
    var total = C.todas.length, sub = subtituloApp(C);
    return '<div class="row wrap sb gap"><div class="col"><h1>Painel de Vistorias' + V.selo(true) + '</h1><div class="small muted">' + esc(sub) + '</div>' + linhaPasta() + '</div>' +
      menuDados(total) + '</div>';
  }

  function menuDados(total) {
    var temPasta = !!(window.PainelPasta && PP.suportado());
    var it = function (act, txt, desab, sub) {
      return '<button class="md-item" data-act="' + act + '" data-arg=""' + (desab ? ' disabled' : '') + '><span class="b">' + txt + '</span>' + (sub ? '<span class="small muted">' + sub + '</span>' : '') + '</button>';
    };
    var itens = '';
    if (temPasta) {
      if (S.pasta) {
        itens += it('atualizarPasta', S.lendoPasta ? 'Lendo a pasta...' : 'Atualizar da pasta', S.lendoPasta, 'Lê os arquivos novos de "' + esc(S.pasta.nome) + '"');
        itens += it('conectarPasta', 'Trocar pasta', S.lendoPasta, 'Escolher outra pasta do OneDrive');
      } else itens += it('conectarPasta', 'Conectar pasta do OneDrive', S.lendoPasta, 'Escolha a pasta aplicativos, só leitura');
    }
    itens += it('toggleCarregar', 'Carregar arquivo (.zip ou .csv)', false, 'Escolher ou arrastar arquivos');
    itens += it('toggleExportar', 'Exportar painel em HTML', !total, 'Arquivo único com os dados embutidos');
    return '<div class="menu-dados"><button class="btn btn-p" data-act="toggleMenuDados" data-arg="" aria-haspopup="true" aria-expanded="' + (S.menuDados ? 'true' : 'false') + '">Dados ' + (S.menuDados ? '▴' : '▾') + '</button>' +
      (S.menuDados ? '<div class="md-lista" role="menu">' + itens + '</div>' : '') + '</div>';
  }

  function linhaPasta() {
    if (!window.PainelPasta) return '';
    if (!PP.suportado()) return '<div class="small muted">Para ler a pasta do OneDrive sozinho, abra este painel no Chrome ou no Edge. Neste navegador use "Carregar arquivo".</div>';
    var P = S.pasta; if (!P) return '';
    return '<div class="small muted">Pasta conectada: <b>' + esc(P.nome) + '</b>' + (P.lidoEm ? ' · lida às ' + V.dthm(P.lidoEm).slice(-5) + ' · ' + P.total + ' arquivo' + (P.total === 1 ? '' : 's') + ' encontrado' + (P.total === 1 ? '' : 's') : '') +
      (P.permitido === false ? ' · clique em "Atualizar da pasta" para liberar o acesso' : '') + '. Somente leitura.</div>';
  }

  function painelCarregar() {
    var h = '<div class="panel"><div class="t-card" style="font-size:18px">Carregar pacote</div>' +
      '<div class="drop" id="drop">Arraste aqui os pacotes .zip, as planilhas .csv antigas ou a pasta Recebidos. Pode soltar vários de uma vez.<br><br>' +
      '<button class="btn btn-p" data-act="escolherArquivos" data-arg="">Escolher arquivos</button> <button class="btn" data-act="escolherPasta" data-arg="">Escolher pasta</button></div>' +
      '<div class="small muted">Arquivos repetidos são reconhecidos pelo identificador de cada vistoria e descartados sozinhos. Planilhas antigas entram com os campos que existiam; o resto aparece como não registrado.</div>' +
      '<div><button class="btn" data-act="toggleCarregar" data-arg="">Fechar</button></div></div>';
    return h;
  }

  function painelLeitura() {
    var L = S.leitura; if (!L) return '';
    var caixas = [
      ['#DDF3E5', '#14693C', L.novas + ' vistorias novas lidas'],
      ['#E8E5EE', '#4A4458', L.duplicadas + ' duplicadas descartadas (mesmo identificador)'],
      L.atualizadas ? ['#EFE7F7', '#3F1D63', L.atualizadas + ' atualizadas (versão mais nova da mesma vistoria)'] : null,
      L.substituidas ? ['#EFE7F7', '#3F1D63', L.substituidas + ' da planilha antiga trocadas pelo pacote novo'] : null,
      L.parciais ? ['#FCEBC5', '#7A4B00', L.parciais + ' vistorias antigas: campos ausentes marcados como não registrado'] : null,
      L.pacotes ? ['#E8E5EE', '#4A4458', L.pacotes + ' pacote(s) .zip, ' + L.planilhas + ' planilha(s), ' + L.jsons + ' json'] : null,
      L.repetidos ? ['#E8E5EE', '#4A4458', L.repetidos + ' pacote(s) já carregado(s) antes, ignorado(s)'] : null,
      L.ignorados ? ['#FAD9D9', '#9B1C1C', L.ignorados + ' arquivo(s) não reconhecido(s): ' + L.nomesIgnorados.slice(0, 5).join(', ')] : null
    ].filter(Boolean);
    return '<div class="panel" style="border-width:1px"><div class="row sb"><span class="t-card">Resultado da leitura</span><button class="btn" data-act="fecharLeitura" data-arg="">Ok</button></div>' +
      '<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">' + caixas.map(function (c) { return '<div style="background:' + c[0] + ';color:' + c[1] + ';border-radius:10px;padding:12px 14px;font-size:13px">' + esc(c[2]) + '</div>'; }).join('') + '</div>' +
      (L.avisos.length ? '<div class="small muted">' + L.avisos.map(esc).join('<br>') + '</div>' : '') + '</div>';
  }

  // Escopo da exportação: tudo (menu Dados), um projeto ou uma escola. Só lê; nada é gravado no painel.
  function doEscopo(C) {
    var x = S.exportEscopo;
    if (!x) return C.todas;
    var es = C.escolas.filter(function (e) { return x.tipo === 'projeto' ? V.nomeProjeto(e.ultima) === x.nome : e.chave === x.chave; });
    var out = [];
    es.forEach(function (e) { e.serie.forEach(function (v) { out.push(v); }); });
    return out;
  }
  function tituloExport() {
    var x = S.exportEscopo;
    return !x ? 'Exportar painel em HTML' : x.tipo === 'projeto' ? 'Exportar o projeto ' + x.nome + ' em HTML' : 'Exportar a escola ' + x.nome + ' em HTML';
  }
  function estimativa(C) {
    var lista = doEscopo(C), bytes = 80000 + lista.length * 30000, mb = 0;
    lista.forEach(function (v) {
      var tam = function (rel) { var f = v.zipRef && v.zipRef.file((v.arquivos.base || '') + rel); return (f && f._data && f._data.uncompressedSize) || 0; };
      if (S.inc.pdf && v.arquivos.pdf) bytes += (v.embut && v.embut[v.arquivos.pdf] ? v.embut[v.arquivos.pdf].length : tam(v.arquivos.pdf) * 1.37);
      if (S.inc.fotos) bytes += V.listaFotos(v).length * 120000;
      if (S.inc.espectro) bytes += (v.arquivos.espectro || []).length * 80000;
    });
    mb = bytes / 1048576;
    return '≈ ' + mb.toFixed(1).replace('.', ',') + ' MB';
  }

  function painelExportar(C) {
    var op = [['pdf', 'PDF das vistorias'], ['fotos', 'Fotos'], ['espectro', 'Espectros'], ['tecnico', 'Nome e e-mail do técnico']];
    return '<div class="panel"><div class="t-card" style="font-size:18px">' + esc(tituloExport()) + '</div>' +
      '<div class="small muted" style="max-width:760px">Gera um único arquivo ' + (S.exportEscopo ? 'só com ' + (S.exportEscopo.tipo === 'projeto' ? 'as escolas deste projeto' : 'esta escola') + ', com os dados dentro.' : 'com os dados dentro.') + ' Quem receber abre com dois cliques, sem instalar nada e sem internet. As fotos vão reduzidas no HTML; os originais ficam no .zip. Escolha o que entra no arquivo:</div>' +
      '<div class="row wrap gap">' + op.map(function (o) { var on = S.inc[o[0]]; return '<button class="opt ' + (on ? 'on' : '') + '" data-act="inc" data-arg="' + o[0] + '" aria-pressed="' + on + '"><i></i><span>' + o[1] + '</span></button>'; }).join('') + '</div>' +
      '<div class="small">Tamanho estimado do arquivo: <b>' + estimativa(C) + '</b>. ' + (doEscopo(C).length === 1 ? 'Dados de 1 registro' : 'Dados dos ' + doEscopo(C).length + ' registros') + ' (inclui medições anteriores).</div>' +
      '<div class="row wrap gap"><button class="btn btn-p" data-act="gerarHtml" data-arg=""' + (S.ocupado ? ' disabled' : '') + '>' + (S.ocupado ? esc(S.ocupado) : 'Gerar arquivo') + '</button><button class="btn" data-act="toggleExportar" data-arg="">Cancelar</button></div></div>';
  }

  function nav(C) {
    var itens = [{ id: 'geral', l: 'Visão geral da companhia', on: S.view === 'geral' }].concat(C.projetos.map(function (p) { return { id: p, l: p, on: S.view === 'projeto' && S.projeto === p }; }));
    return '<div class="row wrap gap" id="nav">' + itens.map(function (n) {
      return '<button class="chip ' + (n.on ? 'on' : '') + '" data-act="' + (n.id === 'geral' ? 'verGeral' : 'abrirProjeto') + '" data-arg="' + esc(n.id) + '" aria-pressed="' + n.on + '">' + esc(n.l) + '</button>';
    }).join('') + '</div>';
  }

  function vazio() {
    return '<div class="panel empty" style="align-items:center;text-align:center"><div class="t-card" style="font-size:20px">Comece carregando os arquivos que o app enviou</div>' +
      '<div class="drop" id="drop" style="width:100%;max-width:720px">Arraste aqui os pacotes .zip, as planilhas .csv antigas ou a pasta Recebidos.<br><br>' +
      '<button class="btn btn-p" data-act="escolherArquivos" data-arg="">Escolher arquivos</button> <button class="btn" data-act="escolherPasta" data-arg="">Escolher pasta</button></div>' +
      '<div class="small muted" style="max-width:640px">Os dados ficam só na memória deste navegador enquanto a página estiver aberta. Para guardar ou enviar a alguém, use Exportar painel em HTML.</div></div>';
  }

  function render() {
    var C = contexto();
    var foco = document.activeElement && document.activeElement.id === 'busca' ? { s: document.activeElement.selectionStart, e: document.activeElement.selectionEnd } : null;
    var h;
    if (C.todas.length) {
      if (S.view === 'ficha' && (classico() || !C.escolas.some(function (x) { return x.chave === S.ficha; }))) S.view = S.projeto ? 'projeto' : 'geral';
      if (S.view === 'projeto' && C.projetos.indexOf(S.projeto) < 0) S.view = 'geral';
    }
    if (!classico()) {
      // visão gestão: faixa roxa no topo e conteúdo em uma coluna só (igual ao mockup aprovado)
      C.menuHtml = menuDados(C.todas.length);
      var tela = !C.todas.length ? VG.viewInicial(C, subtituloApp(C), vazio()) : S.view === 'geral' ? VG.viewHome(C) : S.view === 'ficha' ? VG.viewFicha(C) : VG.viewProjetoG(C);
      h = '<div class="gv">' + tela.band + '<div class="gv-main ' + tela.cls + '">';
      if (S.aviso) h += '<div class="gv-aviso"><span>' + esc(S.aviso) + '</span><button class="btn" data-act="fecharAviso" data-arg="">Ok</button></div>';
      var lp = linhaPasta(); if (lp) h += '<div class="gv-pasta">' + lp + '</div>';
      if (S.carregar) h += painelCarregar();
      if (S.view === 'projeto' && S.gAba === 'historico') h += painelLeitura(); // o resultado da leitura aparece só na aba Histórico
      if (S.exportar) h += painelExportar(C);
      h += tela.corpo + '</div></div>';
    } else {
      h = '<div class="wrap-app">' + cabecalho(C);
      if (S.aviso) h += '<div class="aviso"><span>' + esc(S.aviso) + '</span><button class="btn" data-act="fecharAviso" data-arg="">Ok</button></div>';
      if (S.carregar) h += painelCarregar();
      h += painelLeitura();
      if (S.exportar) h += painelExportar(C);
      if (!C.todas.length) h += vazio();
      else { h += nav(C); h += S.view === 'geral' ? V.viewGeral(C) : V.viewProjeto(C); }
      h += '</div>';
    }
    h += '<input type="file" id="arq" multiple accept=".zip,.csv,.json" hidden><input type="file" id="pasta" webkitdirectory multiple hidden>';
    app.innerHTML = h;
    if (foco) { var b = document.getElementById('busca'); if (b) { b.focus(); try { b.setSelectionRange(foco.s, foco.e); } catch (e) { /* ignora */ } } }
    hidratar();
    if (S.rolarTopo) {
      S.rolarTopo = false;
      var alvo = S.rolarFicha ? document.querySelector('[data-act="abrirFicha"][data-arg="' + String(S.rolarFicha).replace(/"/g, '') + '"]') : null;
      S.rolarFicha = null;
      if (alvo && alvo.scrollIntoView) alvo.scrollIntoView({ block: 'center' }); else window.scrollTo(0, 0);
    }
    if (S.rolar) { S.rolar = false; var ab = document.querySelector('.esc-row.open'); if (ab && ab.scrollIntoView) ab.scrollIntoView({ block: 'start' }); }
  }

  // imagens e PDF são carregados depois do desenho (vêm do .zip ou do HTML embutido)
  function hidratar() {
    Array.prototype.forEach.call(document.querySelectorAll('img[data-rel]'), function (img) {
      var v = vistoriaPorChave(img.getAttribute('data-ch')); if (!v) return;
      urlArquivo(v, img.getAttribute('data-rel')).then(function (u) { if (u) img.src = u; else img.alt = 'arquivo não encontrado'; });
    });
    Array.prototype.forEach.call(document.querySelectorAll('iframe[data-pdf]'), function (fr) {
      var v = vistoriaPorChave(fr.getAttribute('data-pdf')); if (!v || !v.arquivos.pdf) return;
      urlArquivo(v, v.arquivos.pdf, true).then(function (u) { if (u) fr.src = u; });
    });
  }

  // ── leitura de arquivos ──────────────────────────────────────────────────────
  async function carregarArquivos(files, opcoes) {
    opcoes = opcoes || {};
    var L = { novas: 0, duplicadas: 0, atualizadas: 0, substituidas: 0, parciais: 0, pacotes: 0, planilhas: 0, jsons: 0, repetidos: 0, ignorados: 0, nomesIgnorados: [], avisos: [] };
    S.ocupado = 'Lendo arquivos...'; S.aviso = ''; render();
    for (var i = 0; i < files.length; i++) {
      var f = files[i], nome = f.name || '', ext = nome.split('.').pop().toLowerCase();
      try {
        var r = null, lista = null, pid = null;
        if (ext === 'zip') {
          var z = await N.lerZip(f, window.JSZip, nome);
          lista = z.vistorias; pid = z.pacoteId; L.pacotes++; z.avisos.forEach(function (a) { L.avisos.push(a); });
          if (!lista.length) { L.ignorados++; f.__ign = true; L.nomesIgnorados.push(nome); continue; }
        } else if (ext === 'csv') {
          var t = await f.text();
          lista = N.lerCsvAntigo(t, nome);
          if (!lista.length) {
            L.ignorados++; f.__ign = true; L.nomesIgnorados.push(nome);
            if (/^﻿?uuid;escola;projeto/.test(t)) L.avisos.push(nome + ': este é o CSV longo do pacote (para Excel ou Power BI). Carregue o .zip, que traz tudo.');
            continue;
          }
          L.planilhas++;
        } else if (ext === 'json') {
          var j = JSON.parse(await f.text());
          if (!j.identificacao || !j.local) { L.ignorados++; f.__ign = true; L.nomesIgnorados.push(nome); continue; }
          lista = [N.normalizarJson(j, null, nome)]; L.jsons++;
        } else { L.ignorados++; f.__ign = true; L.nomesIgnorados.push(nome); continue; }
        r = banco.adicionar(lista, pid);
        L.novas += r.novas; L.duplicadas += r.duplicadas; L.atualizadas += r.atualizadas; L.substituidas += r.substituidasLegado;
        if (r.pacoteRepetido) L.repetidos++;
        if (r.novas) L.parciais += lista.filter(function (v) { return v.campos !== 'completa'; }).length;
      } catch (e) { L.ignorados++; f.__ign = true; L.nomesIgnorados.push(nome); L.avisos.push(nome + ': ' + e.message); }
    }
    S.ocupado = ''; S.carregar = false;
    if (!opcoes.silencioso || L.novas || L.atualizadas || L.substituidas) S.leitura = L;
    if (L.novas && S.view === 'geral' && !contexto().projetos.length) S.view = 'geral';
    render();
  }

  // pastas arrastadas: percorre os arquivos de dentro
  function lerEntrada(entry, saida) {
    return new Promise(function (resolve) {
      if (entry.isFile) { entry.file(function (f) { saida.push(f); resolve(); }, function () { resolve(); }); }
      else if (entry.isDirectory) {
        var leitor = entry.createReader(), todos = [];
        (function lote() {
          leitor.readEntries(async function (ents) {
            if (!ents.length) { for (var i = 0; i < todos.length; i++) await lerEntrada(todos[i], saida); resolve(); }
            else { todos = todos.concat(Array.prototype.slice.call(ents)); lote(); }
          }, function () { resolve(); });
        })();
      } else resolve();
    });
  }
  async function arquivosDoDrop(dt) {
    var out = [];
    if (dt.items && dt.items.length && dt.items[0].webkitGetAsEntry) {
      var ents = [];
      for (var i = 0; i < dt.items.length; i++) { var en = dt.items[i].webkitGetAsEntry(); if (en) ents.push(en); }
      for (var k = 0; k < ents.length; k++) await lerEntrada(ents[k], out);
    } else out = Array.prototype.slice.call(dt.files || []);
    return out;
  }

  // ── exportação do painel em HTML ─────────────────────────────────────────────
  function reduzirImagem(blob, max, qual) {
    return createImageBitmap(blob).then(function (bm) {
      var esc_ = Math.min(1, max / Math.max(bm.width, bm.height));
      var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(bm.width * esc_)); c.height = Math.max(1, Math.round(bm.height * esc_));
      var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bm, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', qual);
    });
  }
  function dataUri(blob) {
    return new Promise(function (res, rej) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.onerror = rej; fr.readAsDataURL(blob); });
  }

  async function montarHtmlExportado(json) {
    var raiz = document.documentElement.cloneNode(true);
    raiz.querySelector('#app').innerHTML = '';
    raiz.querySelector('#painel-dados').textContent = json;
    var scripts = raiz.querySelectorAll('script[src]');
    for (var i = 0; i < scripts.length; i++) {
      var s = scripts[i], src = s.getAttribute('src');
      var r = await fetch(src); if (!r.ok) throw new Error('Não consegui ler ' + src);
      var tx = await r.text(); s.removeAttribute('src'); s.textContent = tx.replace(/<\/script/gi, '<\\/script');
    }
    var links = raiz.querySelectorAll('link[rel="stylesheet"]');
    for (var j = 0; j < links.length; j++) {
      var l = links[j], href = l.getAttribute('href');
      var rr = await fetch(href); if (!rr.ok) throw new Error('Não consegui ler ' + href);
      var st = document.createElement('style'); st.textContent = await rr.text(); l.parentNode.replaceChild(st, l);
    }
    raiz.querySelector('body').removeAttribute('class');
    return '<!doctype html>\n' + raiz.outerHTML;
  }

  async function gerarHtml() {
    var C = contexto();
    S.ocupado = 'Preparando...'; render();
    try {
      var vs = doEscopo(C), saida = [], esc0 = S.exportEscopo;
      for (var i = 0; i < vs.length; i++) {
        S.ocupado = 'Reunindo ' + (i + 1) + ' de ' + vs.length + '...';
        var el = document.querySelector('[data-act="gerarHtml"]'); if (el) el.textContent = S.ocupado;
        var v = vs[i], c = limpo(v), emb = {};
        c.arquivos = JSON.parse(JSON.stringify(v.arquivos));
        var rels = [];
        if (S.inc.pdf && v.arquivos.pdf) rels.push({ rel: v.arquivos.pdf, tipo: 'pdf' });
        if (S.inc.fotos) V.listaFotos(v).forEach(function (f) { rels.push({ rel: f.rel, tipo: 'foto' }); });
        if (S.inc.espectro) (v.arquivos.espectro || []).forEach(function (r) { rels.push({ rel: r, tipo: 'foto' }); });
        for (var k = 0; k < rels.length; k++) {
          var it = rels[k];
          if (v.embut && v.embut[it.rel]) { emb[it.rel] = v.embut[it.rel]; continue; }
          var b = await blobDe(v, it.rel); if (!b) continue;
          try { emb[it.rel] = it.tipo === 'pdf' ? await dataUri(b) : await reduzirImagem(b, 900, 0.72); }
          catch (e) { try { emb[it.rel] = await dataUri(b); } catch (e2) { /* ignora arquivo ilegível */ } }
        }
        if (!S.inc.pdf) c.arquivos.pdf = null;
        if (!S.inc.fotos) { c.arquivos.fotos = {}; c.cabeada.redes.forEach(function (r) { r.fotos = {}; }); }
        if (!S.inc.espectro) c.arquivos.espectro = [];
        if (!S.inc.tecnico) c.tecnico = { nome: null, email: null };
        c.embut = emb;
        saida.push(c);
      }
      var abrir = !esc0 ? null : esc0.tipo === 'projeto' ? { view: 'projeto', projeto: esc0.nome } : { view: 'ficha', ficha: esc0.chave, projeto: esc0.projeto };
      var json = JSON.stringify({ formato: 1, geradoEm: Date.now(), total: saida.length, vistorias: saida, abrir: abrir }).replace(/</g, '\\u003c');
      var html = await montarHtmlExportado(json);
      var d = new Date(), nome = (!esc0 ? 'Painel_Vistorias_' : esc0.tipo === 'projeto' ? 'Painel_' + nomeArq(esc0.nome) + '_' : 'Escola_' + nomeArq(esc0.nome) + '_') + d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2) + '.html';
      salvar(new Blob([html], { type: 'text/html' }), nome);
      S.aviso = nome + ' gerado (' + (html.length / 1048576).toFixed(1).replace('.', ',') + ' MB), pronto para enviar.'; S.exportar = false; S.exportEscopo = null;
    } catch (e) { S.aviso = 'Não foi possível gerar o arquivo: ' + e.message; }
    S.ocupado = ''; render();
  }

  function carregarEmbutido() {
    var el = document.getElementById('painel-dados');
    if (!el || !el.textContent.trim()) return;
    try {
      var d = JSON.parse(el.textContent);
      banco.adicionar(d.vistorias);
      S.embutido = { geradoEm: d.geradoEm, total: d.total };
      // arquivo exportado de um projeto ou de uma escola abre direto nessa tela
      if (d.abrir && d.abrir.view === 'projeto' && d.abrir.projeto) { S.view = 'projeto'; S.projeto = d.abrir.projeto; S.gAba = 'visao'; }
      else if (d.abrir && d.abrir.view === 'ficha' && d.abrir.ficha) { S.view = 'ficha'; S.ficha = d.abrir.ficha; S.projeto = d.abrir.projeto || null; S.fichaOrigem = 'Escolas'; S.gAba = 'escolas'; }
    } catch (e) { S.aviso = 'Os dados embutidos neste arquivo estão ilegíveis: ' + e.message; }
  }

  // ── imagem da topologia ──────────────────────────────────────────────────────
  function svgTopologia(v) {
    var tiers = V.montarTopologia(v), W = 200, H = 78, G = 16, P = 24, LH = 44, COLS = 3, GB = 40;
    var cores = { b: ['#1E7B4B', '#E3F1E9', '#14693C'], r: ['#E0A100', '#FAF0D6', '#7A4B00'], f: ['#B3261E', '#F6E0DE', '#9B1C1C'], n: ['#9B94A8', '#FFFFFF', '#6B6479'], ap: ['#7E9486', '#ECF0ED', '#3A4D41'] };
    var corte = function (s, n) { s = String(s); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
    var soma = function (a, b) { return a + b; };
    var topo = tiers.filter(function (t) { return !t.ramo; });
    var ramos = [tiers.filter(function (t) { return t.ramo === 'cab'; }), tiers.filter(function (t) { return t.ramo === 'wifi'; })].filter(function (r) { return r.length; });
    var larg = function (ts) { var m = 1; ts.forEach(function (t) { m = Math.max(m, Math.min(t.nos.length, COLS)); }); return m * (W + G) - G; };
    var altT = function (t) { var r = Math.ceil(t.nos.length / COLS); return r * H + (r - 1) * G; };
    var wR = ramos.map(larg), wRamos = wR.reduce(soma, 0) + Math.max(0, ramos.length - 1) * GB;
    var largura = Math.max(480, larg(topo), wRamos) + P * 2, cxTopo = largura / 2;
    var out = '', yMax = 0;
    var ln = function (x1, y1, x2, y2) { return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="#5B2A86" stroke-width="2"/>'; };
    var rot = function (x, y, t) { return t ? '<text x="' + x + '" y="' + y + '" font-size="10" fill="#6B6479">' + esc(t) + '</text>' : ''; };
    var noSvg = function (no, x, y) {
      var c = no.apReg ? cores.ap : (cores[no.k] || cores.n), ic = V.ICONES[V.iconeDe(no.tipo)];
      return '<rect x="' + x + '" y="' + y + '" width="' + W + '" height="' + H + '" rx="10" fill="' + c[1] + '" stroke="' + c[0] + '" stroke-width="2"' + (no.miss ? ' stroke-dasharray="6 4"' : '') + '/>' +
        '<g transform="translate(' + (x + W - 28) + ',' + (y + 7) + ') scale(0.8)" fill="none" stroke="' + c[2] + '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' + ic + '</g>' +
        '<text x="' + (x + 10) + '" y="' + (y + 16) + '" font-size="9" font-weight="bold" fill="#6B6479">' + esc(no.tipo) + '</text>' +
        '<text x="' + (x + 10) + '" y="' + (y + 34) + '" font-size="13" font-weight="bold" fill="#1F1A2B">' + esc(corte(no.titulo, 26)) + '</text>' +
        '<text x="' + (x + 10) + '" y="' + (y + 50) + '" font-size="10.5" fill="#4A4458">' + esc(corte(no.det, 34)) + '</text>' +
        '<text x="' + (x + 10) + '" y="' + (y + 68) + '" font-size="10.5" font-weight="bold" fill="' + c[2] + '">' + esc(corte(no.ql, 34)) + '</text>';
    };
    // desenha um nível (até 3 por linha) centrado em cx; devolve os centros da primeira linha
    var tierSvg = function (t, cx, y) {
      var n = t.nos.length, rows = Math.ceil(n / COLS), first = [];
      for (var r = 0; r < rows; r++) {
        var ini = r * COLS, qtd = Math.min(COLS, n - ini), rowW = qtd * (W + G) - G, yy = y + r * (H + G), cs = [];
        for (var c = 0; c < qtd; c++) {
          var x = cx - rowW / 2 + c * (W + G);
          cs.push(x + W / 2);
          out += noSvg(t.nos[ini + c], x, yy);
        }
        if (r === 0) first = cs;
        else {
          out += ln(cx, yy - G, cx, yy - G / 2);
          if (cs.length > 1) out += ln(cs[0], yy - G / 2, cs[cs.length - 1], yy - G / 2);
          cs.forEach(function (x2) { out += ln(x2, yy - G / 2, x2, yy); });
        }
      }
      yMax = Math.max(yMax, y + altT(t));
      return first;
    };
    // liga o nível de cima (centro cxAnt, base yBase) ao próximo nível que começa em yTop
    var ligar = function (cxAnt, yBase, yTop, centros, rotulo) {
      var yb = yTop - 10, xs = centros.concat([cxAnt]);
      out += ln(cxAnt, yBase, cxAnt, yb);
      if (centros.length > 1 || centros[0] !== cxAnt) out += ln(Math.min.apply(null, xs), yb, Math.max.apply(null, xs), yb);
      centros.forEach(function (x) { out += ln(x, yb, x, yTop); });
      out += rot(cxAnt + 6, yBase + (yb - yBase) / 2 + 3, rotulo);
    };
    var y = P + 12, base = null;
    topo.forEach(function (t, ti) {
      if (ti > 0) { var yi = y + LH; var cs0 = tierCentros(t, cxTopo); ligar(cxTopo, base, yi, cs0, t.conn); y = yi; }
      tierSvg(t, cxTopo, y); base = y + altT(t); y = base;
    });
    function tierCentros(t, cx) {
      var qtd = Math.min(COLS, t.nos.length), rowW = qtd * (W + G) - G, cs = [];
      for (var c = 0; c < qtd; c++) cs.push(cx - rowW / 2 + c * (W + G) + W / 2);
      return cs;
    }
    // bifurcação: da distribuição saem a rede cabeada e o Wi-Fi, separados
    if (ramos.length) {
      var yr = y + LH + 24, x0 = cxTopo - wRamos / 2, cxs = [], acc = x0;
      wR.forEach(function (w) { cxs.push(acc + w / 2); acc += w + GB; });
      var yb2 = yr - 40, xs2 = cxs.concat([cxTopo]);
      out += ln(cxTopo, base, cxTopo, yb2) + ln(Math.min.apply(null, xs2), yb2, Math.max.apply(null, xs2), yb2);
      ramos.forEach(function (rm, ri) {
        var cx = cxs[ri], yy = yr, ant = null;
        rm.forEach(function (t, ti) {
          if (ti === 0) { var cs1 = tierCentros(t, cx); out += ln(cx, yb2, cx, yy - 8); cs1.forEach(function (x) { out += ln(x, yy - 8, x, yy); }); if (cs1.length > 1) out += ln(cs1[0], yy - 8, cs1[cs1.length - 1], yy - 8); out += rot(cx + 6, yb2 + 20, t.conn); }
          else { var yi2 = yy + LH; ligar(cx, ant, yi2, tierCentros(t, cx), t.conn); yy = yi2; }
          tierSvg(t, cx, yy); ant = yy + altT(t); yy = ant;
        });
      });
    }
    var altura = yMax + P;
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + largura + '" height="' + altura + '" viewBox="0 0 ' + largura + ' ' + altura + '" font-family="Arial, sans-serif">' +
      '<rect width="100%" height="100%" fill="#FFFFFF"/><text x="' + P + '" y="20" font-size="14" font-weight="bold" fill="#3F1D63">Topologia de rede: ' + esc(v.escola) + ' (' + V.dt(v.data) + ')</text>' + out + '</svg>';
  }

  function baixarTopologia(v) {
    var svg = svgTopologia(v), nome = 'Topologia_' + nomeArq(v.escola) + '_' + nomeArq(V.dt(v.data));
    var img = new Image();
    img.onload = function () {
      var c = document.createElement('canvas'); c.width = img.width * 2; c.height = img.height * 2;
      var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(function (b) { if (b) salvar(b, nome + '.png'); else salvar(new Blob([svg], { type: 'image/svg+xml' }), nome + '.svg'); }, 'image/png');
    };
    img.onerror = function () { salvar(new Blob([svg], { type: 'image/svg+xml' }), nome + '.svg'); };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    S.aviso = 'Imagem do esquema gerada: ' + nome; render();
  }

  // ── ações ────────────────────────────────────────────────────────────────────
  var ACOES = {
    toggleCarregar: function () { S.carregar = !S.carregar; S.exportar = false; S.exportEscopo = null; },
    toggleExportar: function () { S.exportar = !S.exportar; S.carregar = false; S.exportEscopo = null; },
    fecharAviso: function () { S.aviso = ''; },
    toggleMenuDados: function () { S.menuDados = !S.menuDados; },
    conectarPasta: function () { conectarPasta(); return 'semRender'; },
    atualizarPasta: function () { escanearPasta(false); return 'semRender'; },
    fecharLeitura: function () { S.leitura = null; },
    inc: function (a) { S.inc[a] = !S.inc[a]; },
    escolherArquivos: function () { var el = document.getElementById('arq'); if (el) el.click(); return 'semRender'; },
    escolherPasta: function () { var el = document.getElementById('pasta'); if (el) el.click(); return 'semRender'; },
    gerarHtml: function () { gerarHtml(); return 'semRender'; },
    verGeral: function () { S.view = 'geral'; S.aberto = null; },
    abrirProjeto: function (a) { S.view = 'projeto'; S.projeto = a; S.filtro = 'todos'; S.qual = 'todas'; S.busca = ''; S.aberto = null; S.aba = 'resumo'; },
    filtro: function (a) { S.filtro = a; },
    qual: function (a) { S.qual = a; },
    abrir: function (a) { S.aberto = S.aberto === a ? null : a; S.aba = 'resumo'; S.no = null; S.foto = null; S.pdf = false; S.pin = null; },
    aba: function (a) { S.aba = a; S.no = null; S.foto = null; S.pdf = false; },
    pin: function (a) { S.pin = S.pin === a ? null : a; },
    no: function (a) { S.no = S.no === a ? null : a; },
    foto: function (a) { S.foto = a; },
    fecharFoto: function () { S.foto = null; },
    fotoNav: function (a) {
      var e = contexto().escolas.filter(function (x) { return x.chave === S.aberto; })[0]; if (!e) return;
      var v = contexto().vistoriaSelecionada(e);
      var lista = S.aba === 'espectro' ? V.listaEspectro(v) : V.listaFotos(v), i = -1;
      lista.forEach(function (f, n) { if (f.rel === S.foto) i = n; });
      if (i >= 0 && lista.length) S.foto = lista[(i + (+a) + lista.length) % lista.length].rel;
    },
    abrirPdf: function () { S.pdf = !S.pdf; },
    avisar: function (a) { S.aviso = a; },
    verEscola: function (a) { S.filtro = 'todos'; S.qual = 'todas'; S.busca = ''; S.aberto = a; S.aba = 'resumo'; S.no = null; S.foto = null; S.pdf = false; S.pin = null; S.rolar = true; },
    abrirEscola: function (a) { var e = contexto().escolas.filter(function (x) { return x.chave === a; })[0]; if (!e) return; ACOES.abrirProjeto(V.nomeProjeto(e.ultima)); S.aberto = a; },
    criticoGeral: function (a) { var C = contexto(), c = V.criticos(C.escolas).filter(function (x) { return x.tit === a; })[0]; if (c) ACOES.abrirEscola(c.alvo[0].chave); },
    criticoProjeto: function (a) { var C = contexto(), base = C.escolas.filter(function (e) { return V.nomeProjeto(e.ultima) === S.projeto; }), c = V.criticos(base).filter(function (x) { return x.tit === a; })[0]; if (c) { S.aberto = c.alvo[0].chave; S.aba = 'resumo'; } },
    verMedicao: function (a) { var p = a.split('||'); S.sel[p[0]] = p[1]; S.aba = 'resumo'; S.no = null; S.foto = null; S.pdf = false; S.pin = null; },
    voltarUltima: function (a) { delete S.sel[a]; S.aba = 'hist'; },
    baixarTopo: function (a) { var v = vistoriaPorChave(a); if (v) baixarTopologia(v); return 'semRender'; },
    baixarJson: function (a) { var v = vistoriaPorChave(a); if (v) salvar(new Blob([JSON.stringify(limpo(v), null, 2)], { type: 'application/json' }), 'vistoria_' + nomeArq(v.escola) + '_' + nomeArq(V.dt(v.data)) + '.json'); return 'semRender'; },
    baixarPdf: function (a) { var v = vistoriaPorChave(a); if (v && v.arquivos.pdf) blobDe(v, v.arquivos.pdf).then(function (b) { if (b) salvar(b, 'Vistoria_' + nomeArq(v.escola) + '_' + nomeArq(V.dt(v.data)) + '.pdf'); }); return 'semRender'; },
    baixarPacote: function (a) {
      var v = vistoriaPorChave(a); if (!v || !v.zipRef) return 'semRender';
      var z = new window.JSZip(), base = v.arquivos.base || '', pend = [];
      v.zipRef.forEach(function (caminho, f) { if (!f.dir && caminho.indexOf(base) === 0) pend.push(f.async('arraybuffer').then(function (buf) { z.file(caminho.slice(base.length), buf); })); });
      Promise.all(pend).then(function () { return z.generateAsync({ type: 'blob' }); }).then(function (b) { salvar(b, 'Vistoria_' + nomeArq(v.escola) + '_' + nomeArq(V.dt(v.data)) + '.zip'); });
      return 'semRender';
    }
  };

  // ── ações da visão gestão (só mexem em estado de tela, nunca em dado) ─────────
  var abrirProjetoBase = ACOES.abrirProjeto, verGeralBase = ACOES.verGeral;
  ACOES.abrirProjeto = function (a) { abrirProjetoBase(a); resetGestao(); S.rolarTopo = true; };
  ACOES.verGeral = function (a) { verGeralBase(a); S.gVer = {}; S.rolarTopo = true; };
  ACOES.gAba = function (a) { S.gAba = a; S.gVer = {}; S.rolarTopo = true; };
  ACOES.gTipo = function (a) { S.gTipo = S.gTipo === a ? 'todas' : a; S.gVer.escolas = false; };
  ACOES.gOrdem = function (a) { S.gOrdem = a; };
  ACOES.gMelhoria = function (a) { S.gMelhoria = S.gMelhoria === a ? 'todas' : a; S.gVer.melhorias = false; };
  ACOES.gFiltro = function (a) { S.gFiltro = S.gFiltro === a ? 'todas' : a; S.gVer.escolas = false; };
  // Exportar só o projeto aberto ou só a escola aberta (o do menu Dados continua exportando tudo)
  ACOES.exportarEscopo = function (a) {
    var C = contexto();
    if (a === 'escola') {
      var e = C.escolas.filter(function (x) { return x.chave === S.ficha; })[0]; if (!e) return;
      S.exportEscopo = { tipo: 'escola', chave: e.chave, nome: window.PainelGestao.nomeEscola(e.ultima.escola), projeto: V.nomeProjeto(e.ultima) };
    } else {
      if (!S.projeto) return;
      S.exportEscopo = { tipo: 'projeto', nome: S.projeto };
    }
    S.exportar = true; S.carregar = false; S.menuDados = false; S.rolarTopo = true;
  };
  ACOES.gVer = function (a) { S.gVer[a] = !S.gVer[a]; };
  ACOES.abrirFicha = function (a) {
    var e = contexto().escolas.filter(function (x) { return x.chave === a; })[0]; if (!e) return;
    S.view = 'ficha'; S.ficha = a; S.projeto = V.nomeProjeto(e.ultima); S.fichaOrigem = S.gAba === 'escolas' ? 'Escolas' : S.gAba === 'melhorias' ? 'Melhorias' : 'Prioridade de intervenção';
    S.aberto = null; S.aba = 'resumo'; S.no = null; S.foto = null; S.pdf = false; S.pin = null; S.rolarTopo = true;
  };
  ACOES.voltarProjeto = function (a) { S.rolarFicha = S.ficha; if (a) S.gAba = a; S.view = 'projeto'; S.aberto = null; S.no = null; S.foto = null; S.pdf = false; S.rolarTopo = true; };

  // Copiar o texto da tela (resumo para diretoria, texto do projeto ou resumo da escola). Só lê, não grava nada.
  function copiarTexto(t) {
    var fim = function (okc) { S.aviso = okc ? 'Texto copiado. É só colar na apresentação ou na mensagem.' : 'Não consegui copiar sozinho. Selecione o texto na tela e copie com Ctrl+C.'; render(); };
    var alt = function () {
      var ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(ta); ta.select(); var r = false; try { r = document.execCommand('copy'); } catch (e) { r = false; } ta.remove(); fim(r);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { fim(true); }, alt); else alt();
  }
  ACOES.copiarTexto = function () { var t = VG.textoCopiavel(contexto()); if (t) copiarTexto(t); return 'semRender'; };
  // Abre o PDF da vistoria em outra aba (arquivo vem do .zip ou do HTML embutido)
  ACOES.verPdf = function (a) {
    var v = vistoriaPorChave(a); if (!v || !v.arquivos || !v.arquivos.pdf) return 'semRender';
    blobDe(v, v.arquivos.pdf).then(function (b) {
      if (!b) { S.aviso = 'Não encontrei o PDF desta vistoria.'; render(); return; }
      var url = URL.createObjectURL(b), w = window.open(url, '_blank');
      if (!w) salvar(b, 'Vistoria_' + nomeArq(v.escola) + '_' + nomeArq(V.dt(v.data)) + '.pdf');
      setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    });
    return 'semRender';
  };
  window.addEventListener('hashchange', function () { render(); });

  document.addEventListener('click', function (ev) {
    var alvo = ev.target.closest ? ev.target.closest('[data-act]') : null;
    if (S.menuDados && !(ev.target.closest && ev.target.closest('.menu-dados'))) { S.menuDados = false; if (!alvo) { render(); return; } }
    if (!alvo || alvo.disabled) return;
    var fn = ACOES[alvo.getAttribute('data-act')];
    if (!fn) return;
    var doMenu = alvo.classList.contains('md-item');
    if (doMenu) S.menuDados = false;
    var rr = fn(alvo.getAttribute('data-arg'));
    if (rr !== 'semRender' || doMenu) render();
  });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && S.foto) { S.foto = null; render(); }
    else if (ev.key === 'Escape' && S.menuDados) { S.menuDados = false; render(); }
    else if (S.foto && (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft')) { ACOES.fotoNav(ev.key === 'ArrowRight' ? '1' : '-1'); render(); } });
  document.addEventListener('input', function (ev) {
    if (ev.target && ev.target.id === 'busca') { S.busca = ev.target.value; render(); }
  });
  document.addEventListener('change', function (ev) {
    var sel = ev.target && ev.target.getAttribute && ev.target.getAttribute('data-sel');
    if (sel === 'gFiltro' || sel === 'gTipo' || sel === 'gOrdem') {
      S[sel] = ev.target.value; if (sel !== 'gOrdem') S.gVer.escolas = false; render(); return;
    }
    if (ev.target && (ev.target.id === 'arq' || ev.target.id === 'pasta')) {
      var fs = Array.prototype.slice.call(ev.target.files || []);
      ev.target.value = '';
      if (fs.length) carregarArquivos(fs);
    }
  });
  ['dragenter', 'dragover'].forEach(function (n) {
    document.addEventListener(n, function (ev) { ev.preventDefault(); document.body.classList.add('dragging'); });
  });
  document.addEventListener('dragleave', function (ev) { if (!ev.relatedTarget) document.body.classList.remove('dragging'); });
  document.addEventListener('drop', async function (ev) {
    ev.preventDefault(); document.body.classList.remove('dragging');
    var fs = await arquivosDoDrop(ev.dataTransfer);
    if (fs.length) carregarArquivos(fs);
  });

  // ── pasta conectada (OneDrive "aplicativos") ─────────────────────────────────
  async function conectarPasta() {
    try {
      var h = await PP.escolher();
      if (S.pasta) banco.limpar();                 // trocar de pasta recomeça do zero
      S.pasta = { handle: h, nome: h.name, lidoEm: 0, total: 0, permitido: true };
      S.lidos = {}; S.leitura = null;
      await escanearPasta(false);
    } catch (e) { if (e && e.name !== 'AbortError') { S.aviso = 'Não consegui abrir a pasta: ' + e.message; render(); } }
  }

  async function escanearPasta(silencioso) {
    var P = S.pasta; if (!P || S.lendoPasta) return;
    S.lendoPasta = true;
    try {
      var ok = await PP.permissao(P.handle, !silencioso);
      if (!ok) { P.permitido = false; return; }
      P.permitido = true;
      S.ocupado = 'Procurando arquivos novos na pasta...'; render();
      var ach = await PP.listar(P.handle, S.lidos);
      P.total = ach.total;
      if (ach.novos.length) {
        await carregarArquivos(ach.novos.map(function (x) { return x.file; }), { silencioso: silencioso });
        ach.novos.forEach(function (x) { if (!x.file.__ign) S.lidos[x.chave] = 1; });
      } else S.ocupado = '';
      P.lidoEm = Date.now();
      if (!silencioso && !ach.novos.length) S.aviso = 'Pasta lida: nenhum arquivo novo desde a última leitura.';
    } catch (e) {
      S.ocupado = '';
      S.aviso = 'Não consegui ler a pasta (' + (e && e.message ? e.message : e) + '). Clique em "Trocar pasta" e escolha de novo.';
    } finally { S.lendoPasta = false; render(); }
  }

  async function iniciarPasta() {
    if (!PP || !PP.suportado()) return;
    var h = await PP.recuperar();
    if (!h) return;
    S.pasta = { handle: h, nome: h.name, lidoEm: 0, total: 0, permitido: null };
    render();
    if (await PP.permissao(h, false)) await escanearPasta(true);
    else { S.pasta.permitido = false; render(); }
    // relê sozinho quando você volta para a aba e a cada 3 minutos com a aba aberta
    document.addEventListener('visibilitychange', function () { if (!document.hidden && S.pasta && S.pasta.permitido) escanearPasta(true); });
    setInterval(function () { if (!document.hidden && S.pasta && S.pasta.permitido) escanearPasta(true); }, 180000);
  }

  // gancho para testes e depuração
  window.__painel = { banco: banco, S: S, render: render, carregarArquivos: carregarArquivos, escanearPasta: escanearPasta, iniciarPasta: iniciarPasta };

  carregarEmbutido();
  render();
  iniciarPasta();
})();
