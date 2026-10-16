/* Pasta conectada: o painel lembra a pasta "aplicativos" do OneDrive e lê os arquivos novos dela.
 * Usa a API de pastas do Chrome/Edge (File System Access). O navegador guarda só uma referência à pasta;
 * nada é enviado para a internet e o painel nunca escreve na pasta (somente leitura).
 */
(function (root) {
  'use strict';
  var DB = 'painel-vistorias', ST = 'pasta', EXT = /\.(zip|csv|json)$/i, PROFUNDIDADE = 8;

  function abrirDb() {
    return new Promise(function (res, rej) {
      var r = root.indexedDB.open(DB, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore(ST); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function tx(modo, fn) {
    return abrirDb().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction(ST, modo), req = fn(t.objectStore(ST));
        t.oncomplete = function () { db.close(); res(req && req.result); };
        t.onerror = function () { db.close(); rej(t.error); };
      });
    });
  }
  function suportado() { return typeof root.showDirectoryPicker === 'function' && !!root.indexedDB; }
  function guardar(h) { return tx('readwrite', function (s) { return s.put(h, 'handle'); }); }
  function recuperar() { return tx('readonly', function (s) { return s.get('handle'); }).catch(function () { return null; }); }
  function esquecer() { return tx('readwrite', function (s) { return s.delete('handle'); }).catch(function () {}); }

  async function escolher() {
    var h = await root.showDirectoryPicker({ id: 'painel-aplicativos', mode: 'read' });
    try { await guardar(h); } catch (e) { /* sem memória: funciona só nesta sessão */ }
    return h;
  }

  async function permissao(h, pedir) {
    var o = { mode: 'read' };
    if (h.queryPermission && (await h.queryPermission(o)) === 'granted') return true;
    if (!pedir || !h.requestPermission) return false;
    return (await h.requestPermission(o)) === 'granted';
  }

  // Percorre a pasta e subpastas. Devolve { total, novos: [{file, chave}] }; já lidos (mesmo caminho, tamanho e data) são pulados.
  async function listar(h, jaLidos) {
    var total = 0, novos = [];
    async function andar(dir, caminho, nivel) {
      for await (var par of dir.entries()) {
        var nome = par[0], item = par[1];
        if (nome.charAt(0) === '.' || nome.indexOf('~$') === 0) continue;
        if (item.kind === 'directory') { if (nivel < PROFUNDIDADE) await andar(item, caminho + nome + '/', nivel + 1); continue; }
        if (!EXT.test(nome)) continue;
        total++;
        var f = await item.getFile();
        if (!f.size) continue;                       // arquivo ainda sincronizando
        var chave = caminho + nome + '|' + f.size + '|' + f.lastModified;
        if (jaLidos && jaLidos[chave]) continue;
        novos.push({ file: f, chave: chave });
      }
    }
    await andar(h, '', 0);
    return { total: total, novos: novos };
  }

  root.PainelPasta = { suportado: suportado, escolher: escolher, recuperar: recuperar, esquecer: esquecer, permissao: permissao, listar: listar, guardar: guardar };
})(typeof self !== 'undefined' ? self : this);
