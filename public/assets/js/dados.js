/* Banco em memória do painel: junta tudo que for carregado, descarta duplicados e agrupa por escola.
 *
 * Regras de duplicidade:
 *  1. Mesmo uuid: é a mesma vistoria. Fica a de maior "atualizadoEm"; igual ou mais velha é descartada.
 *  2. Registro sem uuid (planilha antiga) já existente com a mesma chave: descartado.
 *  3. Planilha antiga e pacote novo da mesma vistoria (mesma escola e mesmo dia/hora): vale o do pacote novo.
 *  4. Mesmo pacote (pacoteId) carregado duas vezes: ignorado inteiro.
 * Duas medições da mesma escola em datas diferentes NÃO são duplicadas: a mais recente aparece no painel
 * e as anteriores ficam no Histórico.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./normalizar.js'));
  else root.PainelDados = factory(root.PainelNorm);
})(typeof self !== 'undefined' ? self : this, function (N) {
  'use strict';

  function criar() {
    var porChave = {};
    var pacotes = {};

    function minutoEscola(v) {
      return N.normNome(v.escola) + '|' + (v.data ? Math.floor(v.data / 60000) : '');
    }

    function adicionar(lista, pacoteId) {
      var r = { novas: 0, duplicadas: 0, atualizadas: 0, substituidasLegado: 0, pacoteRepetido: false };
      if (pacoteId) {
        if (pacotes[pacoteId]) { r.pacoteRepetido = true; r.duplicadas = lista.length; return r; }
        pacotes[pacoteId] = true;
      }
      lista.forEach(function (v) {
        var atual = porChave[v.chave];
        if (atual) {
          if ((v.atualizadoEm || 0) > (atual.atualizadoEm || 0)) { porChave[v.chave] = v; r.atualizadas++; }
          else r.duplicadas++;
          return;
        }
        // regra 3
        var chaves = Object.keys(porChave);
        if (v.uuid) {
          var alvo = chaves.filter(function (k) { return !porChave[k].uuid && minutoEscola(porChave[k]) === minutoEscola(v); })[0];
          if (alvo) { delete porChave[alvo]; r.substituidasLegado++; }
        } else {
          var existeNovo = chaves.some(function (k) { return porChave[k].uuid && minutoEscola(porChave[k]) === minutoEscola(v); });
          if (existeNovo) { r.duplicadas++; return; }
        }
        porChave[v.chave] = v;
        r.novas++;
      });
      return r;
    }

    function todas() {
      return Object.keys(porChave).map(function (k) { return porChave[k]; });
    }

    function chaveEscola(v) {
      return (v.placeId ? 'p:' + v.placeId : 'n:' + N.normNome(v.escola)) + '|' + N.normNome(v.projeto || '');
    }

    // Uma linha por escola: a medição mais recente + histórico (da mais antiga para a mais nova).
    // Mesma escola = mesmo nome; só separa se projeto ou placeId forem diferentes nos dois lados
    // (vistorias antigas não têm projeto nem placeId e entram no grupo do nome).
    function escolas() {
      var grupos = [];
      todas().sort(function (a, b) { return (b.data || 0) - (a.data || 0); }).forEach(function (v) {
        var nome = N.normNome(v.escola);
        var alvo = grupos.filter(function (g) {
          return g.nome === nome &&
            (!g.placeId || !v.placeId || g.placeId === v.placeId) &&
            (!g.projeto || !v.projeto || N.normNome(g.projeto) === N.normNome(v.projeto));
        })[0];
        if (!alvo) {
          alvo = { nome: nome, placeId: v.placeId || null, projeto: v.projeto || null, itens: [] };
          grupos.push(alvo);
        }
        if (!alvo.placeId && v.placeId) alvo.placeId = v.placeId;
        if (!alvo.projeto && v.projeto) alvo.projeto = v.projeto;
        alvo.itens.push(v);
      });
      return grupos.map(function (g) {
        var serie = g.itens.slice().sort(function (a, b) { return (a.data || 0) - (b.data || 0); });
        return { chave: g.nome + '|' + (g.placeId || '') + '|' + N.normNome(g.projeto || ''), ultima: serie[serie.length - 1], serie: serie, projeto: g.projeto };
      }).sort(function (a, b) { return (b.ultima.data || 0) - (a.ultima.data || 0); });
    }

    function limpar() { porChave = {}; pacotes = {}; }
    function total() { return Object.keys(porChave).length; }

    return { adicionar: adicionar, todas: todas, escolas: escolas, limpar: limpar, total: total, chaveEscola: chaveEscola };
  }

  return { criar: criar };
});
