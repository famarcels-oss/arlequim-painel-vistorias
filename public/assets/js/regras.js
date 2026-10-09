/* Regras de qualidade e sugestões de melhoria.
 * Espelham o app (MedicaoScreen.kt, MatrizConfig.kt, MatrizCalculo.kt e DiagnosticoHelper.kt).
 * Os limites abaixo são os valores padrão do app; se mudarem no app, ajuste aqui.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PainelRegras = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LIM = {
    wifi: { dlRuim: 40, dlRegular: 80, pingRuim: 100, pingRegular: 50, jitter: 30 },
    cabeada: { dlRuim: 50, dlRegular: 90, pingRuim: 80, pingRegular: 40, jitter: 30 },
    nota: { aprovada: 80, ressalva: 51 }
  };

  // k: b = bom (verde), r = regular (amarelo), f = ruim (vermelho), n = sem dado
  var NOMES = { b: 'Bom', r: 'Regular', f: 'Ruim', n: 'não registrado' };

  function ok(n) { return typeof n === 'number' && isFinite(n); }

  function qualidadeWifi(dl, ping, jit) {
    var L = LIM.wifi;
    if (!ok(dl) || !ok(ping)) return { k: 'n', l: NOMES.n, motivo: 'O Wi-Fi não foi medido nesta vistoria.' };
    var j = ok(jit) ? jit : 0;
    var m = [];
    if (dl <= L.dlRuim || ping > L.pingRuim || j > L.jitter) {
      if (dl <= L.dlRuim) m.push('download até ' + L.dlRuim + ' Mbps');
      if (ping > L.pingRuim) m.push('ping acima de ' + L.pingRuim + ' ms');
      if (j > L.jitter) m.push('jitter acima de ' + L.jitter + ' ms');
      return { k: 'f', l: 'Ruim', motivo: 'Ruim por: ' + m.join(', ') + '.' };
    }
    if (dl <= L.dlRegular || ping > L.pingRegular) {
      if (dl <= L.dlRegular) m.push('download até ' + L.dlRegular + ' Mbps');
      if (ping > L.pingRegular) m.push('ping acima de ' + L.pingRegular + ' ms');
      return { k: 'r', l: 'Regular', motivo: 'Regular por: ' + m.join(', ') + '.' };
    }
    return { k: 'b', l: 'Bom', motivo: 'Download acima de ' + L.dlRegular + ' Mbps, ping até ' + L.pingRegular + ' ms e jitter até ' + L.jitter + ' ms.' };
  }

  function qualidadeCabeada(dl, ping, jit) {
    var L = LIM.cabeada;
    if (!ok(dl)) return { k: 'n', l: NOMES.n, motivo: 'Rede cabeada não medida.' };
    var m = [];
    var pOk = ok(ping), jOk = ok(jit);
    if (dl <= L.dlRuim || (pOk && ping > L.pingRuim) || (jOk && jit > L.jitter)) {
      if (dl <= L.dlRuim) m.push('download até ' + L.dlRuim + ' Mbps');
      if (pOk && ping > L.pingRuim) m.push('ping acima de ' + L.pingRuim + ' ms');
      if (jOk && jit > L.jitter) m.push('jitter acima de ' + L.jitter + ' ms');
      return { k: 'f', l: 'Ruim', motivo: 'Ruim por: ' + m.join(', ') + '.' };
    }
    if (dl <= L.dlRegular || (pOk && ping > L.pingRegular)) {
      if (dl <= L.dlRegular) m.push('download até ' + L.dlRegular + ' Mbps');
      if (pOk && ping > L.pingRegular) m.push('ping acima de ' + L.pingRegular + ' ms');
      return { k: 'r', l: 'Regular', motivo: 'Regular por: ' + m.join(', ') + '.' };
    }
    return { k: 'b', l: 'Bom', motivo: 'Download acima de ' + L.dlRegular + ' Mbps e ping até ' + L.pingRegular + ' ms.' };
  }

  // Nível do sinal em dBm (mesma régua do app)
  function qualidadeSinal(dbm) {
    if (!ok(dbm) || dbm === 0) return { k: 'n', l: NOMES.n, nivel: 'não registrado' };
    if (dbm >= -50) return { k: 'b', l: 'Excelente', nivel: 'excelente' };
    if (dbm >= -60) return { k: 'b', l: 'Muito bom', nivel: 'muito bom' };
    if (dbm >= -70) return { k: 'r', l: 'Bom', nivel: 'bom' };
    if (dbm >= -80) return { k: 'f', l: 'Ruim', nivel: 'ruim' };
    return { k: 'f', l: 'Inutilizável', nivel: 'inutilizável' };
  }

  function txt(s) { return (s == null ? '' : String(s)).trim(); }
  function vazio(s) { var t = txt(s); return t === '' || t.toLowerCase() === 'selecione'; }

  // ── Hardware (penalidades do app: 0 = bom, intermediária = regular, maior = ruim) ──
  function qualidadeSwitch(t) {
    if (vazio(t)) return { k: 'n', l: NOMES.n };
    if (/fast\s*10\/100/i.test(t)) return { k: 'f', l: 'Ruim, limita a rede a 100 Mbps' };
    if (/gigabit/i.test(t)) return { k: 'b', l: 'Bom' };
    return { k: 'r', l: 'Regular, modelo não identificado' };
  }
  function qualidadeGateway(t) {
    if (vazio(t)) return { k: 'n', l: NOMES.n };
    if (/modem da operadora/i.test(t)) return { k: 'f', l: 'Ruim, uso residencial' };
    if (/profissional/i.test(t)) return { k: 'b', l: 'Bom' };
    return { k: 'r', l: 'Regular, não identificado' };
  }
  function qualidadeCabos(t) {
    if (vazio(t)) return { k: 'n', l: NOMES.n };
    if (/danificad/i.test(t)) return { k: 'f', l: 'Ruim, cabos danificados' };
    return { k: 'b', l: 'Bom' };
  }
  function qualidadeDensidade(t) {
    if (vazio(t)) return { k: 'n', l: NOMES.n };
    if (/corredor\s*\/\s*distante/i.test(t)) return { k: 'f', l: 'Ruim, antenas só nos corredores' };
    if (/misto/i.test(t)) return { k: 'r', l: 'Regular, antenas mistas' };
    return { k: 'b', l: 'Bom' };
  }
  function qualidadeEspectro(t) {
    if (vazio(t)) return { k: 'n', l: NOMES.n };
    if (/apenas\s*2[.,]4/i.test(t)) return { k: 'f', l: 'Ruim, só 2,4 GHz' };
    if (/5\s*ghz/i.test(t)) return { k: 'b', l: 'Bom' };
    return { k: 'r', l: 'Regular, não identificado' };
  }
  function qualidadeLink(mbps) {
    if (!ok(mbps) || mbps <= 0) return { k: 'n', l: NOMES.n };
    if (mbps >= 1000) return { k: 'b', l: 'Bom' };
    return { k: 'r', l: 'Regular, abaixo de 1 Gbps' };
  }

  // Nota geral -> faixa: ap, re, rp, nm
  function faixaDaNota(nota, wifiNaoMedido, navegabilidadeZero) {
    if (!ok(nota)) return 'nm';
    if (navegabilidadeZero) return 'rp';
    if (nota >= LIM.nota.aprovada) return 'ap';
    if (nota >= LIM.nota.ressalva) return 're';
    return 'rp';
  }

  var FAIXAS = {
    ap: { l: 'Aprovada', bg: '#DDF3E5', fg: '#14693C' },
    re: { l: 'Com ressalva', bg: '#FCEBC5', fg: '#7A4B00' },
    rp: { l: 'Reprovada', bg: '#FAD9D9', fg: '#9B1C1C' },
    nm: { l: 'Wi-Fi não medido', bg: '#E8E5EE', fg: '#4A4458' }
  };

  // ── Sugestões de melhoria: mesmos textos do app (DiagnosticoHelper) ───────────
  function opcoes(a, b, c) {
    return [
      { k: 'Performance Premium', v: a, fg: '#14693C' },
      { k: 'Equilíbrio Técnico/Financeiro', v: b, fg: '#2A4F7A' },
      { k: 'Viabilidade Básica', v: c, fg: '#7A4B00' }
    ];
  }

  function gerarSugestoes(v) {
    var riscos = [], recs = [], naoAvaliado = [];
    var infra = v.infra || {};
    var links = v.links || [];
    var redes = (v.cabeada && v.cabeada.redes) || [];
    var wifi = v.wifi || {};

    // Link de internet
    if (links.length) {
      var todosAbaixo = links.every(function (l) { return ok(l.mbps) && l.mbps < 1000; });
      if (todosAbaixo) riscos.push({ tag: 'LINK', t: 'Nenhum dos links de internet contratados atinge 1 Gbps. Para extrair o melhor desempenho do ambiente de DaaS, recomendamos o upgrade do link para 1 Gbps.' });
    } else naoAvaliado.push('links de internet');

    // Zona de sombra
    if (infra.possuiZonaSombra === true) riscos.push({ tag: 'WI-FI', t: 'Existem salas com zonas mortas de conectividade, o que inviabiliza o acesso e a operação das Máquinas Virtuais (VMs).' });
    else if (infra.possuiZonaSombra == null) naoAvaliado.push('zonas sem sinal');

    // Switch Fast (Wi-Fi ou rede cabeada)
    var fastWifi = /fast\s*10\/100/i.test(txt(infra.switch));
    var fastCab = redes.some(function (r) { return /fast\s*10\/100/i.test(txt(r.switch)); }) || /fast\s*10\/100/i.test(txt(v.cabeada && v.cabeada.legadoSwitch));
    if (fastWifi || fastCab) {
      riscos.push({ tag: 'SWITCH', t: 'A infraestrutura de rede apresenta limitações físicas nos ativos (switches), cujo subdimensionamento impede a operação simultânea em múltiplas salas.' });
      recs.push({ tit: 'Switch 10/100', corpo: "A tecnologia atual dos aparelhos de rede limita a velocidade da internet. Recomendamos a atualização para aparelhos 'Gigabit' para que as atividades digitais fluam sem travamentos.", ops: opcoes('Ubiquiti UniFi Switch Standard (24 ou 48 portas)', 'TP-Link JetStream (Série TL-SG3400)', 'Intelbras SG 2404 MR') });
    }

    // Cabos danificados
    var cabosRuins = /danificad/i.test(txt(infra.cabeamento)) || redes.some(function (r) { return /danificad/i.test(txt(r.cabeamento)); }) || /danificad/i.test(txt(v.cabeada && v.cabeada.legadoCabeamento));
    if (cabosRuins) {
      riscos.push({ tag: 'CABOS', t: 'Foram identificados cabos danificados, soltos ou com emendas visíveis na rede. Isso pode causar quedas de sinal intermitentes e instabilidade nas conexões.' });
      recs.push({ tit: 'Cabos Danificados', corpo: 'Identificamos desgastes na fiação que podem causar quedas de sinal. Recomendamos a renovação dos cabos para garantir a segurança e a continuidade das aulas sem interrupções.', ops: opcoes('Furukawa GigaLan Cat6', 'Nexans Essential Cat6', 'Furukawa SOHOplus Cat6') });
    }

    // Gateway
    if (/modem da operadora/i.test(txt(infra.gateway))) {
      riscos.push({ tag: 'GATEWAY', t: 'O hardware de padrão residencial fornecido pela operadora é insuficiente para suportar a densidade de conexões exigida, gerando latência excessiva e desconexões nas máquinas virtuais.' });
      recs.push({ tit: 'Modem da Operadora (Gateway)', corpo: 'O modem da operadora é de uso doméstico e fica sobrecarregado com muitos alunos. Recomendamos um roteador profissional para garantir uma conexão segura e organizada para todos.', ops: opcoes('Ubiquiti Dream Machine Pro (UDM-Pro)', 'MikroTik RB5009 ou hEX (RB750Gr3)', 'TP-Link Omada ER605') });
    }

    // Densidade de APs
    if (/corredor\s*\/\s*distante/i.test(txt(infra.densidadeAps))) {
      riscos.push({ tag: 'WI-FI', t: 'Antenas apenas nos corredores comprometem a cobertura dentro das salas, gerando um sinal fraco e instável. Isso cria uma disputa por conexão entre salas vizinhas.' });
      recs.push({ tit: 'APs no Corredor / Distante', corpo: 'O sinal de Wi-Fi encontra dificuldades para chegar às salas. Para que todos os alunos se conectem com estabilidade, o ideal é a instalação de uma antena dentro de cada sala de aula.', ops: opcoes('Ubiquiti UniFi 6 Plus (U6+)', 'TP-Link Omada EAP610', 'TP-Link Omada EAP225') });
    } else if (vazio(infra.densidadeAps)) naoAvaliado.push('densidade de APs');

    // Desempenho medido
    var ping = wifi.mediaPing, dl = wifi.mediaDownload;
    if (ok(ping) && ping > 100) riscos.push({ tag: 'DESEMPENHO', t: 'Alta latência (ping acima de 100 ms) pode causar atrasos significativos na resposta do mouse e teclado, além de degradação na qualidade da imagem (tela pixelada).' });
    if (ok(dl) && dl > 0) {
      if (dl <= 30) riscos.push({ tag: 'DESEMPENHO', t: 'Inviável o uso de DaaS com a conexão atual: 30 Mbps não comportam 20 acessos simultâneos. A baixa capacidade de rede causa lentidão extrema e travamentos imediatos para todos os usuários.' });
      else if (dl <= 40) riscos.push({ tag: 'DESEMPENHO', t: 'Rede comporta no máximo 1 turma em simultâneo.' });
      else if (dl <= 80) riscos.push({ tag: 'DESEMPENHO', t: 'Rede comporta no máximo 2 turmas em simultâneo.' });
    }
    return { riscos: riscos, recs: recs, naoAvaliado: naoAvaliado, total: riscos.length + recs.length };
  }

  return {
    LIM: LIM, FAIXAS: FAIXAS, NOMES: NOMES,
    qualidadeWifi: qualidadeWifi, qualidadeCabeada: qualidadeCabeada, qualidadeSinal: qualidadeSinal,
    qualidadeSwitch: qualidadeSwitch, qualidadeGateway: qualidadeGateway, qualidadeCabos: qualidadeCabos,
    qualidadeDensidade: qualidadeDensidade, qualidadeEspectro: qualidadeEspectro, qualidadeLink: qualidadeLink,
    faixaDaNota: faixaDaNota, gerarSugestoes: gerarSugestoes
  };
});
