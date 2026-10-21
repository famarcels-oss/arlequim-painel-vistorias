/* Leitura de arquivos e normalização.
 * Entradas aceitas:
 *  - pacote novo do app (.zip com manifest.json e vistorias/<uuid>/vistoria.json)
 *  - vistoria.json solto
 *  - planilha antiga do app (.csv com ID_Vistoria;Escola;...), sem uuid e sem vários campos
 * Tudo vira o mesmo formato interno. Campo que a vistoria não tem fica null (aparece como "não registrado").
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./regras.js'));
  else root.PainelNorm = factory(root.PainelRegras);
})(typeof self !== 'undefined' ? self : this, function (R) {
  'use strict';

  function ok(n) { return typeof n === 'number' && isFinite(n); }
  function numOuNull(x) {
    if (x === null || x === undefined || x === '') return null;
    if (typeof x === 'number') return isFinite(x) ? x : null;
    var n = parseFloat(String(x).replace(/\./g, '').replace(',', '.'));
    return isFinite(n) ? n : null;
  }
  function numPonto(x) { // "12,5" -> 12.5 (CSV do app usa vírgula decimal, sem milhar)
    if (x === null || x === undefined || String(x).trim() === '') return null;
    var n = parseFloat(String(x).trim().replace(',', '.'));
    return isFinite(n) ? n : null;
  }
  function str(x) { return x === null || x === undefined ? null : (String(x).trim() === '' ? null : String(x).trim()); }
  function sel(x) { var t = str(x); return (t === null || t.toLowerCase() === 'selecione') ? null : t; } // "Selecione" = campo não preenchido no app
  function media(arr) {
    var a = arr.filter(ok);
    return a.length ? a.reduce(function (s, x) { return s + x; }, 0) / a.length : null;
  }
  function mbpsDoLink(tamanho) {
    // "300 Mbps", "1 Gbps", "1Gb" -> Mbps
    if (!tamanho) return null;
    var t = String(tamanho).toLowerCase().replace(',', '.');
    var m = t.match(/([0-9]+(?:\.[0-9]+)?)\s*(g|m|k)?/);
    if (!m) return null;
    var n = parseFloat(m[1]);
    if (/g/.test(t)) return n * 1000;
    if (/k/.test(t)) return n / 1000;
    return n;
  }
  function hash(s) { // djb2, estável entre execuções
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(16);
  }
  function normNome(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  // Chave para comparar nomes de escola: vale o nome próprio, o final do nome. O tipo no começo ("E.M", "EM", "ESCOLA MUNICIPAL",
  // "CEI", "EDUCAÇÃO INFANTIL", "CMEI", "EMEI"...) e "de/da/do" são ignorados, assim como acento, pontuação e maiúscula.
  // Ex.: "ESCOLA MUNICIPAL HAROLD JONES" = "E.M HAROLD JONES". Só serve para achar a mesma escola; o nome exibido não muda.
  var TIPOS = [
    'escola municipal de educacao infantil', 'escola municipal de ensino fundamental', 'centro municipal de educacao infantil',
    'centro de educacao infantil', 'escola municipal', 'educacao infantil', 'e m e f', 'e m e i', 'emef', 'emei', 'cmei', 'cei',
    'e m', 'em', 'ei', 'escola', 'creche', 'colegio', 'tempo integral', 'integral', 'de', 'da', 'do', 'das', 'dos', 'e'
  ];
  function chaveEscola(nome) {
    var base = normNome(nome);
    var t = ' ' + base + ' ';
    for (var mudou = true; mudou;) {
      mudou = false;
      for (var i = 0; i < TIPOS.length; i++) {
        var pre = ' ' + TIPOS[i] + ' ';
        if (t.indexOf(pre) === 0) { t = t.slice(pre.length - 1); mudou = true; break; }
      }
    }
    t = t.replace(/ (de|da|do|das|dos) /g, ' ').replace(/ (de|da|do|das|dos) /g, ' ').replace(/\s+/g, ' ').trim();
    return t || base; // nome só com o tipo ("EDUCAÇÃO INFANTIL"): usa o nome inteiro para não juntar tudo
  }

  // ── CSV (parser que respeita aspas e quebras de linha dentro do campo) ──────────
  function parseCsv(texto, sep) {
    sep = sep || ';';
    if (texto.charCodeAt(0) === 0xFEFF) texto = texto.slice(1);
    var linhas = [], atual = [], campo = '', aspas = false;
    for (var i = 0; i < texto.length; i++) {
      var c = texto[i];
      if (aspas) {
        if (c === '"') {
          if (texto[i + 1] === '"') { campo += '"'; i++; } else aspas = false;
        } else campo += c;
      } else if (c === '"') aspas = true;
      else if (c === sep) { atual.push(campo); campo = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && texto[i + 1] === '\n') i++;
        atual.push(campo); campo = '';
        if (atual.length > 1 || atual[0] !== '') linhas.push(atual);
        atual = [];
      } else campo += c;
    }
    if (campo !== '' || atual.length) { atual.push(campo); linhas.push(atual); }
    return linhas;
  }

  function dataBr(txt) { // "dd/MM/yyyy HH:mm" -> ms (horário local)
    var m = String(txt || '').match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
    if (!m) return null;
    return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0)).getTime();
  }

  function simNao(x) {
    var t = String(x == null ? '' : x).trim().toLowerCase();
    if (t === 'sim') return true;
    if (t === 'nao' || t === 'não') return false;
    return null;
  }

  function ehCsvAntigo(linhas) {
    return linhas.length > 0 && linhas[0].indexOf('ID_Vistoria') >= 0 && linhas[0].indexOf('Escola') >= 0;
  }

  // ── CSV antigo -> vistorias ────────────────────────────────────────────────────
  function lerCsvAntigo(texto, nomeArquivo) {
    var linhas = parseCsv(texto, ';');
    if (!ehCsvAntigo(linhas)) return [];
    var cab = linhas[0];
    var out = [];
    for (var li = 1; li < linhas.length; li++) {
      var row = linhas[li];
      // aceita mais de um nome de coluna (o app mudou os nomes ao longo das versões)
      var get = function () {
        for (var a = 0; a < arguments.length; a++) {
          var i = cab.indexOf(arguments[a]);
          if (i >= 0 && row[i] !== undefined && String(row[i]).trim() !== '') return row[i];
        }
        return null;
      };
      var tem = function (nome) { return cab.indexOf(nome) >= 0; };
      var escola = str(get('Escola'));
      if (!escola) continue;

      var dataMs = dataBr(get('Data_Vistoria'));
      var dataTxt = str(get('Data_Vistoria')) || '';

      // links "Operadora: 300 Mbps | Outra: 1 Gbps"
      var linksTxt = str(get('Links_Internet'));
      var links = linksTxt ? linksTxt.split('|').map(function (p) {
        var par = p.split(':');
        var op = par.shift().trim();
        var tam = par.join(':').trim();
        return { operadora: op, tamanho: tam, mbps: mbpsDoLink(tam) };
      }) : [];

      // Wi-Fi: lista detalhada (Ponto{i}_*) ou 3 pontos fixos (M1..M3)
      var pontos = [];
      for (var p = 1; cab.indexOf('Ponto' + p + '_Mbps') >= 0; p++) {
        var dl = numPonto(get('Ponto' + p + '_Mbps'));
        var nome = str(get('Ponto' + p + '_Nome'));
        if (dl === null && !nome) continue;
        pontos.push({
          indice: pontos.length + 1, nome: nome || ('Ponto ' + p), download: dl, upload: null,
          ping: numPonto(get('Ponto' + p + '_Ping')), jitter: numPonto(get('Ponto' + p + '_Jitter')),
          ssid: str(get('Ponto' + p + '_SSID')), banda: null, sinalDbm: null, capacidade: null, manual: null
        });
      }
      if (!pontos.length) {
        for (var m = 1; m <= 3; m++) {
          var d = numPonto(get('M' + m + '_Mbps'));
          if (d === null) continue;
          pontos.push({
            indice: m, nome: 'Ponto ' + m, download: d, upload: null, ping: numPonto(get('M' + m + '_Ping')),
            jitter: numPonto(get('M' + m + '_Jitter')), ssid: str(get('M' + m + '_SSID')), banda: null,
            sinalDbm: null, capacidade: null, manual: simNao(get('M' + m + '_Manual'))
          });
        }
      }
      var statusWifi = str(get('Status_WiFi'));
      var wifiNaoMedido = statusWifi === 'NAO_MEDIDO' || (pontos.length === 0);

      // redes cabeadas: "Lab1_*" (export atual) ou "RedeFisica1_*" (nome usado em versões intermediárias)
      var redes = [];
      [['Lab', 'Laboratório de informática'], ['RedeFisica', null]].forEach(function (pref) {
        for (var r = 1; tem(pref[0] + r + '_Mbps'); r++) {
          var rn = str(get(pref[0] + r + '_NomeLocal')) || pref[1];
          var rd = numPonto(get(pref[0] + r + '_Mbps'));
          var so = sel(get(pref[0] + r + '_SO'));
          if (rd === null && !so && !sel(get(pref[0] + r + '_Switch'))) continue;
          redes.push({
            nome: rn || ('Rede ' + r), sistemaOperacional: so, switch: sel(get(pref[0] + r + '_Switch')),
            cabeamento: sel(get(pref[0] + r + '_Cabeamento')), desktops: null, download: rd, ping: numPonto(get(pref[0] + r + '_Ping')), jitter: null
          });
        }
      });
      var possuiRede = simNao(get('Possui_Laboratorio', 'Possui_Rede_Fisica'));
      if (possuiRede === null && redes.length) possuiRede = true;

      var scoreWifi = numPonto(get('Score_Final_WiFi', 'Score_WiFi'));
      var scoreCab = numPonto(get('Score_Final_Lab', 'Score_RedeFisica'));
      var statusCab = str(get('Status_Lab', 'Status_RedeFisica'));
      // nota geral: coluna do app, ou a mesma regra do app (com laboratório: média Wi-Fi e laboratório; sem: só Wi-Fi)
      var nota = numPonto(get('Score_Geral_Unificado', 'Score_Geral'));
      if (nota === null && scoreWifi !== null) {
        if (possuiRede && scoreCab !== null) nota = wifiNaoMedido ? scoreCab : Math.round(((scoreWifi + scoreCab) / 2) * 10) / 10;
        else nota = scoreWifi;
      }
      // "Navegabilidade zero" do laboratório só vale quando a escola tem laboratório (sem laboratório o app grava 0,0 e esse status)
      var navZero = statusWifi === 'NAVEGABILIDADE_ZERO' || (possuiRede === true && statusCab === 'NAVEGABILIDADE_ZERO');
      var faixa = (wifiNaoMedido && !possuiRede) ? 'nm' : R.faixaDaNota(nota, wifiNaoMedido, navZero);

      var idTxt = str(get('ID_Vistoria')); if (idTxt) idTxt = idTxt.replace(/^#/, '');
      var tecnico = str(get('Tecnico')), email = str(get('Email_Tecnico'));
      var chave = 'legado:' + hash([chaveEscola(escola), dataTxt, normNome(tecnico), normNome(email), idTxt || ''].join('|'));

      out.push({
        chave: chave, uuid: null, origem: 'planilha', arquivoOrigem: nomeArquivo || null, idLocal: idTxt,
        escola: escola, projeto: str(get('Projeto')), endereco: null, placeId: null,
        tecnico: { nome: tecnico, email: email },
        data: dataMs, criadoEm: dataMs, atualizadoEm: dataMs, versaoApp: null, aparelho: null, schemaVersion: 0,
        censo: {
          salas: numPonto(get('Qtd_Salas')), alunos: numPonto(get('Qtd_Alunos')), professores: numPonto(get('Qtd_Professores')),
          possuiChromebooks: simNao(get('Possui_Chromebooks')), chromebooks: numPonto(get('Qtd_Chromebooks')),
          possuiDesktops: simNao(get('Possui_Desktops')), desktops: numPonto(get('Qtd_Desktops')),
          possuiProjetores: simNao(get('Possui_Projetores')), projetores: numPonto(get('Qtd_Projetores')),
          nivelInformatica: numPonto(get('Nivel_digital', 'Nível_digital'))
        },
        infra: {
          switch: sel(get('Switch_WiFi')), cabeamento: null, gateway: sel(get('Gateway_WiFi')), espectroWifi: sel(get('Espectro')),
          densidadeAps: sel(get('Densidade_APs')), accessPoints: null, notaProfessor: sel(get('Nota_Professor')),
          possuiZonaSombra: simNao(get('Zona_de_Sombra')), salasSemSinal: sel(get('Salas_Sem_Sinal'))
        },
        links: links,
        wifi: {
          medido: !wifiNaoMedido, modo: pontos.length && cab.indexOf('Ponto1_Mbps') >= 0 ? 'detalhado' : 'tres_pontos',
          capacidadeEstimada: sel(get('Capacidade_Estimada')), pontos: pontos,
          mediaDownload: media(pontos.map(function (x) { return x.download; })), mediaPing: media(pontos.map(function (x) { return x.ping; })),
          mediaUpload: null
        },
        cabeada: {
          possui: possuiRede, redes: redes,
          legadoSwitch: sel(get('Switch_Lab_Legado', 'Switch_RedeFisica_Legado')), legadoCabeamento: sel(get('Cabo_Lab_Legado', 'Cabo_RedeFisica_Legado')), legadoGateway: sel(get('Gateway_Lab_Legado', 'Gateway_RedeFisica_Legado')),
          legadoDownload: null, legadoPing: null, legadoJitter: null
        },
        conclusao: {
          possuiImpeditivo: simNao(get('Possui_Impeditivo')), observacoesImpeditivo: str(get('Obs_Impeditivo')),
          possuiDificuldade: simNao(get('Possui_Dificuldade')), observacoesDificuldade: str(get('Obs_Dificuldade'))
        },
        calculado: { nota: nota, status: ({ ap: 'APROVADA', re: 'RESSALVA', rp: 'REPROVADA' })[faixa] || statusWifi, faixa: faixa, notaWifi: scoreWifi, notaCabeada: scoreCab, statusWifi: statusWifi, statusCabeada: statusCab },
        arquivos: { base: null, pdf: null, fotos: {}, espectro: [], fotosAusentes: [] },
        campos: 'parcial'
      });
    }
    return out;
  }

  // ── vistoria.json (pacote novo) -> vistoria interna ────────────────────────────
  function jnum(x) { return (typeof x === 'number' && isFinite(x)) ? x : null; }
  function jstr(x) { return (x === null || x === undefined || x === '' || String(x).toLowerCase() === 'selecione') ? null : String(x); }

  // Teste de carga (app 1.1.40): só leitura do campo, null quando não há teste.
  // A partir do app 1.2.0, Regular e Ruim descontam da nota Wi-Fi; a nota já chega descontada em "calculado" e o painel não recalcula.
  function lerTesteCarga(t) {
    if (!t || typeof t !== 'object') return null;
    return {
      usuarios: jnum(t.usuarios), download: jnum(t.download), upload: jnum(t.upload), ping: jnum(t.ping), jitter: jnum(t.jitter), sinalDbm: jnum(t.sinalDbm),
      ssid: jstr(t.ssid), banda: jstr(t.banda), dataMedicao: jnum(t.dataMedicao), resultado: jstr(t.resultado), motivo: jstr(t.motivo),
      descontoNotaWifi: jnum(t.descontoNotaWifi), editado: t.editadoManual === true
    };
  }

  // Rede e caminho até o VDI por ponto (app 1.2.0): só leitura, informativo. Campo ausente fica null ("Não registrado").
  function lerRedePonto(p) {
    var d = (p.diagnosticoVdi && typeof p.diagnosticoVdi === 'object') ? p.diagnosticoVdi : {};
    var r = {
      txNegociadaMbps: jnum(p.txNegociadaMbps),
      canal: jnum(p.canal) != null ? jnum(p.canal) : jnum(d.canal),
      larguraMhz: jnum(p.larguraMhz) != null ? jnum(p.larguraMhz) : jnum(d.larguraMhz),
      redesNoCanal: jnum(p.redesNoCanal), redesNoCanalFortes: jnum(p.redesNoCanalFortes),
      dnsMs: jnum(d.dnsMs), tcp443Ms: jnum(d.tcp443Ms), destino: jstr(d.destino) || jstr(d.host) || jstr(d.alvo)
    };
    var tem = Object.keys(r).some(function (k) { return r[k] != null; });
    return tem ? r : null;
  }

  function normalizarJson(j, pastaNoZip, origemNome) {
    var id = j.identificacao || {}, loc = j.local || {}, tec = j.tecnico || {}, cen = j.censo || {};
    var inf = j.infraestrutura || {}, wf = j.wifi || {}, cb = j.cabeada || {}, con = j.conclusao || {}, calc = j.calculado || {};
    var arq = j.arquivos || {};
    var uuid = jstr(id.uuid);
    var dataMs = jnum(id.dataVistoria);
    var schema = jnum(id.schemaVersion) || 0;
    var pontos = (wf.pontos || []).map(function (p, i) {
      return {
        indice: p.indice || (i + 1), nome: jstr(p.nome) || ('Ponto ' + (i + 1)), download: jnum(p.download), upload: jnum(p.upload) > 0 ? jnum(p.upload) : null,
        ping: jnum(p.ping), jitter: jnum(p.jitter), ssid: jstr(p.ssid), banda: jstr(p.banda), sinalDbm: jnum(p.sinalDbm), capacidade: jstr(p.capacidade),
        manual: typeof p.manual === 'boolean' ? p.manual : null, rede: lerRedePonto(p)
      };
    });
    var redes = (cb.redes || []).map(function (r) {
      return {
        nome: jstr(r.nome) || 'Rede cabeada', sistemaOperacional: jstr(r.sistemaOperacional), switch: jstr(r.switch), cabeamento: jstr(r.cabeamento),
        desktops: jnum(r.desktops), download: jnum(r.download), ping: jnum(r.ping), jitter: jnum(r.jitter) > 0 ? jnum(r.jitter) : null,
        fotos: { laboratorio: jstr(r.fotoLaboratorio), teste: jstr(r.fotoTesteInternet), switch: jstr(r.fotoSwitch), extra: jstr(r.fotoExtra) }
      };
    });
    var links = (j.links || []).map(function (l) {
      return { operadora: jstr(l.operadora), tamanho: jstr(l.tamanho), mbps: jnum(l.mbps) != null ? jnum(l.mbps) : mbpsDoLink(l.tamanho) };
    });
    var faixaTxt = calc.faixa;
    var faixa = faixaTxt === 'APROVADA' ? 'ap' : faixaTxt === 'RESSALVA' ? 're' : faixaTxt === 'REPROVADA' ? 'rp' : 'nm';
    var fotos = j.fotos || {};
    var v = {
      chave: uuid || ('legado:' + hash([chaveEscola(loc.escola), String(dataMs), normNome(tec.email)].join('|'))),
      uuid: uuid, origem: 'pacote', arquivoOrigem: origemNome || null, idLocal: id.idLocal != null ? String(id.idLocal) : null,
      escola: jstr(loc.escola) || '(sem nome)', projeto: jstr(loc.projeto), endereco: jstr(loc.endereco), placeId: jstr(loc.placeId),
      tecnico: { nome: jstr(tec.nome), email: jstr(tec.email) },
      data: dataMs, criadoEm: jnum(id.criadoEm) || dataMs, atualizadoEm: jnum(id.atualizadoEm) || dataMs,
      versaoApp: jstr(id.versaoApp), aparelho: jstr(id.modeloAparelho), schemaVersion: schema,
      censo: {
        salas: jnum(cen.salas), alunos: jnum(cen.alunos), professores: jnum(cen.professores),
        possuiChromebooks: typeof cen.possuiChromebooks === 'boolean' ? cen.possuiChromebooks : null, chromebooks: jnum(cen.chromebooks),
        possuiDesktops: typeof cen.possuiDesktops === 'boolean' ? cen.possuiDesktops : null, desktops: jnum(cen.desktops),
        possuiProjetores: typeof cen.possuiProjetores === 'boolean' ? cen.possuiProjetores : null, projetores: jnum(cen.projetores),
        nivelInformatica: jnum(cen.nivelInformatica)
      },
      infra: {
        switch: jstr(inf.switch), cabeamento: jstr(inf.cabeamento), gateway: jstr(inf.gateway), espectroWifi: jstr(inf.espectroWifi),
        densidadeAps: jstr(inf.densidadeAps), accessPoints: jnum(inf.accessPoints), notaProfessor: jstr(inf.notaProfessor),
        possuiZonaSombra: typeof inf.possuiZonaSombra === 'boolean' ? inf.possuiZonaSombra : null, salasSemSinal: jstr(inf.salasSemSinal)
      },
      links: links,
      wifi: {
        medido: wf.medido !== false && pontos.length > 0, modo: wf.modo || null, capacidadeEstimada: jstr(wf.capacidadeEstimada), pontos: pontos,
        mediaDownload: jnum(wf.mediaDownload) != null ? jnum(wf.mediaDownload) : media(pontos.map(function (x) { return x.download; })),
        mediaPing: jnum(wf.mediaPing) != null ? jnum(wf.mediaPing) : media(pontos.map(function (x) { return x.ping; })),
        mediaUpload: media(pontos.map(function (x) { return x.upload; }))
      },
      cabeada: {
        possui: typeof cb.possui === 'boolean' ? cb.possui : null, redes: redes,
        legadoSwitch: jstr(cb.legadoSwitch), legadoCabeamento: jstr(cb.legadoCabeamento), legadoGateway: jstr(cb.legadoGateway),
        legadoDownload: jnum(cb.legadoDownload), legadoPing: jnum(cb.legadoPing), legadoJitter: jnum(cb.legadoJitter)
      },
      conclusao: {
        possuiImpeditivo: typeof con.possuiImpeditivo === 'boolean' ? con.possuiImpeditivo : null, observacoesImpeditivo: jstr(con.observacoesImpeditivo),
        possuiDificuldade: typeof con.possuiDificuldade === 'boolean' ? con.possuiDificuldade : null, observacoesDificuldade: jstr(con.observacoesDificuldade)
      },
      calculado: {
        nota: jnum(calc.nota), status: jstr(calc.status), faixa: faixa, notaWifi: jnum(calc.notaWifi), notaCabeada: jnum(calc.notaCabeada),
        statusWifi: jstr(calc.statusWifi), statusCabeada: jstr(calc.statusCabeada)
      },
      arquivos: {
        base: pastaNoZip || null, pdf: jstr(arq.pdf),
        fotos: {
          local: jstr(fotos.local), switch: jstr(fotos.switch), ambiente: jstr(fotos.ambiente), modem: jstr(fotos.modem), antenas: jstr(fotos.antenas),
          switchEvidencias: (fotos.switchEvidencias || []), fibraEvidencias: (fotos.fibraEvidencias || []), antenasEvidencias: (fotos.antenasEvidencias || [])
        },
        espectro: (j.espectro || []), fotosAusentes: arq.fotosAusentes || []
      },
      campos: schema >= 25 ? 'completa' : 'parcial',
      testeCarga: lerTesteCarga(j.testeCarga)
    };
    // vistoria antiga que passou por um pacote novo: dados sem pontos ou sem upload continuam "não registrados"
    return v;
  }

  // ── Zip ────────────────────────────────────────────────────────────────────────
  async function lerZip(arquivoOuBuffer, JSZipLib, nomeOrigem) {
    var zip = await JSZipLib.loadAsync(arquivoOuBuffer);
    var res = { vistorias: [], zip: zip, pacoteId: null, manifest: null, avisos: [], ignorados: 0 };
    var manifestF = zip.file('manifest.json');
    if (manifestF) {
      try { res.manifest = JSON.parse(await manifestF.async('string')); res.pacoteId = res.manifest.pacoteId || null; } catch (e) { res.avisos.push('manifest.json ilegível em ' + nomeOrigem); }
    }
    var nomes = Object.keys(zip.files).filter(function (n) { return !zip.files[n].dir; });
    for (var i = 0; i < nomes.length; i++) {
      var n = nomes[i];
      var base = n.split('/').pop().toLowerCase();
      if (base === 'vistoria.json') {
        try {
          var j = JSON.parse(await zip.file(n).async('string'));
          var pasta = n.slice(0, n.length - 'vistoria.json'.length);
          var v = normalizarJson(j, pasta, nomeOrigem);
          v.zipRef = zip;
          if (res.manifest && jnum(res.manifest.geradoEm) != null) v.pacoteGeradoEm = res.manifest.geradoEm;
          res.vistorias.push(v);
        } catch (e) { res.avisos.push('Vistoria ilegível em ' + n + ': ' + e.message); res.ignorados++; }
      } else if (/\.csv$/i.test(n) && !/vistorias_longo\.csv$/i.test(n)) {
        var t = await zip.file(n).async('string');
        var lst = lerCsvAntigo(t, n);
        lst.forEach(function (x) { res.vistorias.push(x); });
        if (!lst.length) res.ignorados++;
      }
    }
    return res;
  }

  // ── Resumo numérico por vistoria (usado em listas, filtros e histórico) ────────
  function resumoNumerico(v) {
    var sinais = v.wifi.pontos.map(function (p) { return p.sinalDbm; }).filter(function (x) { return ok(x) && x !== 0; });
    var cabDl = v.cabeada.redes.map(function (r) { return r.download; });
    if (!cabDl.some(ok) && ok(v.cabeada.legadoDownload) && v.cabeada.legadoDownload > 0) cabDl = [v.cabeada.legadoDownload];
    return {
      nota: v.calculado.nota,
      dl: v.wifi.mediaDownload,
      ul: v.wifi.mediaUpload,
      ping: v.wifi.mediaPing,
      sinal: media(sinais),
      cab: media(cabDl)
    };
  }

  return {
    ok: ok, media: media, hash: hash, normNome: normNome, chaveEscola: chaveEscola, mbpsDoLink: mbpsDoLink, parseCsv: parseCsv,
    lerCsvAntigo: lerCsvAntigo, normalizarJson: normalizarJson, lerZip: lerZip, resumoNumerico: resumoNumerico, ehCsvAntigo: ehCsvAntigo
  };
});
