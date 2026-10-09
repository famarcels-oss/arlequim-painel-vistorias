const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const JSZip = require('../public/assets/vendor/jszip.min.js');
const R = require('../public/assets/js/regras.js');
const N = require('../public/assets/js/normalizar.js');
const D = require('../public/assets/js/dados.js');

const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'amostra-'));
execFileSync('node', [path.join(__dirname, '..', 'scripts', 'gerar-amostra.js'), pasta], { stdio: 'pipe' });

async function carregar(banco, arquivo) {
  const buf = fs.readFileSync(path.join(pasta, arquivo));
  if (arquivo.endsWith('.zip')) {
    const r = await N.lerZip(buf, JSZip, arquivo);
    return banco.adicionar(r.vistorias, r.pacoteId);
  }
  return banco.adicionar(N.lerCsvAntigo(buf.toString('utf8'), arquivo));
}

test('regras de qualidade do Wi-Fi seguem o app', () => {
  assert.strictEqual(R.qualidadeWifi(184, 11, 2).k, 'b');
  assert.strictEqual(R.qualidadeWifi(80, 11, 2).k, 'r');   // até 80 Mbps é regular
  assert.strictEqual(R.qualidadeWifi(81, 51, 2).k, 'r');   // ping acima de 50
  assert.strictEqual(R.qualidadeWifi(40, 11, 2).k, 'f');   // até 40 Mbps é ruim
  assert.strictEqual(R.qualidadeWifi(120, 101, 2).k, 'f'); // ping acima de 100
  assert.strictEqual(R.qualidadeWifi(120, 10, 31).k, 'f'); // jitter acima de 30
  assert.strictEqual(R.qualidadeWifi(null, null, null).k, 'n');
});

test('regras da rede cabeada seguem a régua do laboratório', () => {
  assert.strictEqual(R.qualidadeCabeada(941, 1, 0.4).k, 'b');
  assert.strictEqual(R.qualidadeCabeada(90, 10, 0).k, 'r');
  assert.strictEqual(R.qualidadeCabeada(95, 41, 0).k, 'r');
  assert.strictEqual(R.qualidadeCabeada(50, 10, 0).k, 'f');
  assert.strictEqual(R.qualidadeCabeada(300, 81, 0).k, 'f');
});

test('sinal em dBm', () => {
  assert.strictEqual(R.qualidadeSinal(-50).l, 'Excelente');
  assert.strictEqual(R.qualidadeSinal(-60).l, 'Muito bom');
  assert.strictEqual(R.qualidadeSinal(-70).l, 'Bom');
  assert.strictEqual(R.qualidadeSinal(-80).l, 'Ruim');
  assert.strictEqual(R.qualidadeSinal(-81).l, 'Inutilizável');
  assert.strictEqual(R.qualidadeSinal(null).k, 'n');
});

test('pacote A carrega sem descartar nada', async () => {
  const banco = D.criar();
  const r = await carregar(banco, 'pacote_tecnico_A.zip');
  assert.strictEqual(r.novas, 7);
  assert.strictEqual(r.duplicadas, 0);
  assert.strictEqual(banco.total(), 7);
});

test('arquivo duplicado é descartado por uuid', async () => {
  const banco = D.criar();
  await carregar(banco, 'pacote_tecnico_A.zip');
  const outra = await carregar(banco, 'pacote_tecnico_A.zip'); // mesmo pacote de novo
  assert.strictEqual(outra.pacoteRepetido, true);
  assert.strictEqual(banco.total(), 7);
});

test('pacote B repete vistorias do A: duplicadas descartadas, reeditada atualizada', async () => {
  const banco = D.criar();
  await carregar(banco, 'pacote_tecnico_A.zip');
  const r = await carregar(banco, 'pacote_tecnico_B.zip');
  assert.strictEqual(r.duplicadas, 2, 'Aurora e Ipê (novo) já existiam');
  assert.strictEqual(r.atualizadas, 1, 'Girassol foi reeditado com atualizadoEm maior');
  assert.strictEqual(r.novas, 5);
  assert.strictEqual(banco.total(), 12);
  const gir = banco.todas().filter((v) => v.escola === 'CMEI Girassol')[0];
  assert.strictEqual(gir.calculado.nota, 91);
});

test('planilha antiga é tolerante: campos ausentes ficam null', async () => {
  const banco = D.criar();
  const r = await carregar(banco, 'planilha_antiga.csv');
  assert.strictEqual(r.novas, 4);
  const v = banco.todas().filter((x) => x.escola === 'E.M. Pinheiral')[0];
  assert.strictEqual(v.uuid, null);
  assert.strictEqual(v.projeto, null);
  assert.strictEqual(v.wifi.pontos[0].upload, null);
  assert.strictEqual(v.wifi.pontos[0].sinalDbm, null);
  assert.strictEqual(v.schemaVersion, 0);
  assert.strictEqual(v.calculado.faixa, 're');
  assert.strictEqual(v.links[0].mbps, 100);
  assert.strictEqual(v.cabeada.redes.length, 1);
  assert.strictEqual(v.cabeada.redes[0].download, 88.4);
  const jac = banco.todas().filter((x) => x.escola === 'E.M. Jacarandá')[0];
  assert.strictEqual(jac.calculado.faixa, 'rp');
});

test('planilha antiga carregada duas vezes não duplica', async () => {
  const banco = D.criar();
  await carregar(banco, 'planilha_antiga.csv');
  const r = await carregar(banco, 'planilha_antiga.csv');
  assert.strictEqual(r.novas, 0);
  assert.strictEqual(r.duplicadas, 4);
  assert.strictEqual(banco.total(), 4);
});

test('histórico: última medição é a exibida e as anteriores ficam na série', async () => {
  const banco = D.criar();
  await carregar(banco, 'pacote_tecnico_A.zip');
  await carregar(banco, 'pacote_tecnico_B.zip');
  const esc = banco.escolas();
  const ipe = esc.filter((e) => e.ultima.escola === 'CMEI Ipê')[0];
  assert.strictEqual(ipe.serie.length, 3);
  assert.strictEqual(ipe.ultima.calculado.nota, 84);
  assert.deepStrictEqual(ipe.serie.map((v) => v.calculado.nota), [62, 74, 84]);
  const bv = esc.filter((e) => e.ultima.escola === 'E.M. Boa Vista')[0];
  assert.strictEqual(bv.serie.length, 2);
  assert.strictEqual(bv.ultima.calculado.nota, 41);
});

test('planilha antiga + pacote: medições de datas diferentes viram histórico (não são duplicadas)', async () => {
  const banco = D.criar();
  await carregar(banco, 'pacote_tecnico_B.zip');
  await carregar(banco, 'planilha_antiga.csv');
  const bv = banco.escolas().filter((e) => e.ultima.escola === 'E.M. Boa Vista')[0];
  assert.strictEqual(bv.serie.length, 3);
  assert.strictEqual(bv.serie[0].uuid, null);
});

test('vistoria da planilha antiga é substituída pela do pacote quando é a mesma (escola e data iguais)', async () => {
  const banco = D.criar();
  const antiga = N.lerCsvAntigo(fs.readFileSync(path.join(pasta, 'planilha_antiga.csv'), 'utf8'), 'x.csv')[0];
  banco.adicionar([antiga]);
  const novo = JSON.parse(JSON.stringify(antiga));
  novo.uuid = 'abc'; novo.chave = 'abc'; novo.origem = 'pacote';
  const r = banco.adicionar([novo]);
  assert.strictEqual(r.substituidasLegado, 1);
  assert.strictEqual(banco.total(), 1);
  const inversa = D.criar();
  inversa.adicionar([novo]);
  const r2 = inversa.adicionar([antiga]);
  assert.strictEqual(r2.duplicadas, 1);
  assert.strictEqual(inversa.total(), 1);
});

test('sugestões repetem as regras do app', async () => {
  const banco = D.criar();
  await carregar(banco, 'pacote_tecnico_B.zip');
  const bv = banco.todas().filter((v) => v.escola === 'E.M. Boa Vista' && v.calculado.nota === 41)[0];
  const s = R.gerarSugestoes(bv);
  const tits = s.recs.map((r) => r.tit);
  assert.ok(tits.indexOf('Switch 10/100') >= 0);
  assert.ok(tits.indexOf('Cabos Danificados') >= 0);
  assert.ok(tits.indexOf('Modem da Operadora (Gateway)') >= 0);
  assert.ok(tits.indexOf('APs no Corredor / Distante') >= 0);
  assert.ok(s.riscos.length >= 5);
});

test('pacote traz arquivos: PDF, fotos e espectro', async () => {
  const buf = fs.readFileSync(path.join(pasta, 'pacote_tecnico_A.zip'));
  const r = await N.lerZip(buf, JSZip, 'a.zip');
  const v = r.vistorias[0];
  assert.ok(v.arquivos.base.startsWith('vistorias/'));
  assert.ok(r.zip.file(v.arquivos.base + v.arquivos.pdf));
  assert.ok(r.zip.file(v.arquivos.base + v.arquivos.fotos.local));
  assert.ok(r.zip.file(v.arquivos.base + v.arquivos.espectro[0]));
});

test('CSV com aspas, ponto e vírgula e quebra de linha dentro do campo', () => {
  const linhas = N.parseCsv('a;b;c\n"x;y";"linha1\nlinha2";"com ""aspas"""\n', ';');
  assert.deepStrictEqual(linhas[1], ['x;y', 'linha1\nlinha2', 'com "aspas"']);
});
