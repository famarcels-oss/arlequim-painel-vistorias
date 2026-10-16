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

// ── CSV antigo real do app (Score_Final_*, Lab1_*, Ponto{n}_*) e compilador ────
const CAB_REAL = 'ID_Vistoria;Escola;Tecnico;Email_Tecnico;Data_Vistoria;Qtd_Salas;Qtd_Alunos;Qtd_Professores;Possui_Chromebooks;Qtd_Chromebooks;Possui_Desktops;Qtd_Desktops;Possui_Projetores;Qtd_Projetores;Possui_Laboratorio;Switch_WiFi;Gateway_WiFi;Espectro;Densidade_APs;Nota_Professor;M1_Mbps;M1_Ping;M1_Jitter;M1_SSID;M1_Manual;Zona_de_Sombra;Capacidade_Estimada;Score_Final_WiFi;Status_WiFi;Switch_Lab_Legado;Score_Final_Lab;Status_Lab;Lab1_SO;Lab1_Switch;Lab1_Cabeamento;Lab1_Mbps;Lab1_Ping;Ponto1_Nome;Ponto1_Mbps;Ponto1_Ping;Ponto1_Jitter;Ponto1_SSID';
function linhaReal(o) {
  const d = Object.assign({
    id: '#0010', escola: 'E.M TESTE ', tec: 'Fulano', email: 'f@x.com', data: '09/06/2026 10:00', lab: 'Nao', sw: 'Selecione', espectro: 'Selecione',
    sw1: 'Selecione', wifi: '65,0', st: 'COM_RESSALVA', lscore: '0,0', lst: 'NAVEGABILIDADE_ZERO', lso: '', lsw: '', lcab: '', lmb: '', lping: '', p1: '50,0', m1: ''
  }, o);
  return [d.id, d.escola, d.tec, d.email, d.data, 10, 200, 20, 'Nao', 0, 'Sim', 5, 'Nao', 0, d.lab, d.sw, 'Selecione', d.espectro, 'Selecione', 'Selecione', d.m1, '', '', '', '', 'Nao', 'Desconhecida', d.wifi, d.st, d.sw1, d.lscore, d.lst, d.lso, d.lsw, d.lcab, d.lmb, d.lping, 'Sala 1', d.p1, '20,0', '2,0', 'REDE (5 GHz)'].join(';');
}

test('CSV antigo real: sem laboratório, "navegabilidade zero" do laboratório é ignorada e "Selecione" vira não registrado', () => {
  const [v] = N.lerCsvAntigo(CAB_REAL + '\n' + linhaReal({}) + '\n', 'x.csv');
  assert.strictEqual(v.idLocal, '0010');
  assert.strictEqual(v.calculado.nota, 65);
  assert.strictEqual(v.calculado.faixa, 're');
  assert.strictEqual(v.infra.switch, null);
  assert.strictEqual(v.infra.espectroWifi, null);
  assert.strictEqual(v.cabeada.redes.length, 0);
  assert.strictEqual(v.wifi.pontos[0].download, 50);
});

test('CSV antigo real: com laboratório a nota é a média de Wi-Fi e laboratório (regra do app)', () => {
  const l = linhaReal({ lab: 'Sim', wifi: '68,0', lscore: '95,0', lst: 'APROVADO', lso: 'Windows 10', lsw: 'Gigabit 10/100/1000', lcab: 'Cat6', lmb: '92,0', lping: '12,0' });
  const [v] = N.lerCsvAntigo(CAB_REAL + '\n' + l + '\n', 'x.csv');
  assert.strictEqual(v.calculado.nota, 81.5);
  assert.strictEqual(v.calculado.faixa, 'ap');
  assert.strictEqual(v.cabeada.redes.length, 1);
  assert.strictEqual(v.cabeada.redes[0].download, 92);
});

test('compilador: último arquivo vence, nome completo, teste fora, técnico oculto, projeto e fuso de Brasília', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'antigos-'));
  const saida = path.join(dir, 'saida');
  fs.mkdirSync(path.join(dir, 'in'));
  const w = (nome, linhas) => fs.writeFileSync(path.join(dir, 'in', nome), CAB_REAL + '\n' + linhas.join('\n') + '\n', 'utf8');
  w('Todas_Vistorias_VDI.csv', [linhaReal({ id: '#0019', escola: 'EDUCAÇÃO INFANTIL ', tec: 'Técnico Oculto', email: 'tecnico@email.com' }), linhaReal({ id: '#0011', escola: 'ESCOLA ARLEQUIM', data: '03/06/2026 14:45' })]);
  w('RawData_Vistoria_ID_0019_X.csv', [linhaReal({ id: '#0019', escola: 'CEI NIZE CONCEIÇÃO', tec: 'Técnico Oculto', email: 'tecnico@email.com', wifi: '43,0', st: 'REPROVADO' })]);
  w('RawData_Vistoria_ID_0019_X_1.csv', [linhaReal({ id: '#0019', escola: 'CEI NIZE CONCEIÇÃO', tec: 'Técnico Oculto', email: 'tecnico@email.com', wifi: '45,0', st: 'REPROVADO' })]);
  execFileSync('node', [path.join(__dirname, '..', 'scripts', 'compilar-antigos.js'), path.join(dir, 'in'), '--saida', saida], { stdio: 'pipe' });
  const r = await N.lerZip(fs.readFileSync(path.join(saida, 'pacote_Nova_Lima_antigos_v1.zip')), JSZip, 'p.zip');
  assert.strictEqual(r.vistorias.length, 1);                  // o teste saiu, os 3 repetidos viraram 1
  const v = r.vistorias[0];
  assert.strictEqual(v.projeto, 'Nova Lima');
  assert.strictEqual(v.escola, 'CEI NIZE CONCEIÇÃO');         // nome mais completo
  assert.strictEqual(v.calculado.nota, 45);                   // sufixo _1 = download mais recente
  assert.strictEqual(v.tecnico.nome, null);
  assert.strictEqual(new Date(v.data).toISOString(), '2026-06-09T13:00:00.000Z'); // 10:00 em Brasília
  const rel = fs.readFileSync(path.join(saida, 'relatorio_compilacao.md'), 'utf8');
  assert.ok(/Retirados/.test(rel) && /ESCOLA ARLEQUIM/.test(rel));
  // mesmo pacote carregado duas vezes ou duas gerações: uuid estável
  const r2 = await N.lerZip(fs.readFileSync(path.join(saida, 'pacote_Nova_Lima_antigos_v1.zip')), JSZip, 'p.zip');
  assert.strictEqual(r2.vistorias[0].uuid, v.uuid);
});

test('compilador com --pdfs: vincula por ID, repetido fica o mais recente (sufixo 1) e o PDF vai no pacote', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'antigos-pdf-'));
  fs.mkdirSync(path.join(dir, 'in')); fs.mkdirSync(path.join(dir, 'pdf'));
  fs.writeFileSync(path.join(dir, 'in', 'Todas.csv'), CAB_REAL + '\n' + linhaReal({ id: '#0010' }) + '\n' + linhaReal({ id: '#0011', escola: 'E.M OUTRA', data: '09/06/2026 11:00' }) + '\n', 'utf8');
  fs.writeFileSync(path.join(dir, 'pdf', 'Vistoria_ID_0010_E.M_TESTE.pdf'), 'antigo');
  fs.writeFileSync(path.join(dir, 'pdf', 'Vistoria_ID_0010_E.M_TESTE1.pdf'), 'novo');
  fs.writeFileSync(path.join(dir, 'pdf', 'Vistoria_ID_0099_SEM_VISTORIA.pdf'), 'x');
  execFileSync('node', [path.join(__dirname, '..', 'scripts', 'compilar-antigos.js'), path.join(dir, 'in'), '--pdfs', path.join(dir, 'pdf'), '--versao', '2', '--saida', path.join(dir, 'saida')], { stdio: 'pipe' });
  const r = await N.lerZip(fs.readFileSync(path.join(dir, 'saida', 'pacote_Nova_Lima_antigos_v2.zip')), JSZip, 'p.zip');
  const com = r.vistorias.find((v) => v.idLocal === '0010');
  const sem = r.vistorias.find((v) => v.idLocal === '0011');
  assert.strictEqual(com.arquivos.pdf, 'relatorio.pdf');
  assert.strictEqual(await r.zip.file(com.arquivos.base + 'relatorio.pdf').async('string'), 'novo');
  assert.strictEqual(sem.arquivos.pdf, null);
  const rel = fs.readFileSync(path.join(dir, 'saida', 'relatorio_compilacao.md'), 'utf8');
  assert.ok(/#0099: PDF sem vistoria/.test(rel));
  // v2 substitui v1 no painel (mesmo uuid, atualizadoEm maior)
  execFileSync('node', [path.join(__dirname, '..', 'scripts', 'compilar-antigos.js'), path.join(dir, 'in'), '--saida', path.join(dir, 'saida1')], { stdio: 'pipe' });
  const r1 = await N.lerZip(fs.readFileSync(path.join(dir, 'saida1', 'pacote_Nova_Lima_antigos_v1.zip')), JSZip, 'p1.zip');
  const banco = D.criar();
  banco.adicionar(r1.vistorias, r1.pacoteId);
  const res = banco.adicionar(r.vistorias, r.pacoteId);
  assert.strictEqual(res.atualizadas, 2);
  assert.strictEqual(banco.total(), 2);
});

test('mesma escola com nome escrito de formas diferentes ("E.M" x "ESCOLA MUNICIPAL") entra no mesmo grupo', () => {
  assert.strictEqual(N.chaveEscola('ESCOLA MUNICIPAL HAROLD JONES'), N.chaveEscola('E.M HAROLD JONES'));
  assert.strictEqual(N.chaveEscola('E.M EMÍLIA DE LIMA'), N.chaveEscola('Escola Municipal Emilia de Lima '));
  // o que vale é o final do nome: o tipo no começo não separa escolas
  assert.strictEqual(N.chaveEscola('E.M FLORIE DIAS'), N.chaveEscola('EDUCAÇÃO INFANTIL FLORIE DIAS'));
  assert.strictEqual(N.chaveEscola('CEI CASSIO MAGNANI'), N.chaveEscola('E.M CASSIO MAGNANI'));
  assert.strictEqual(N.chaveEscola('EDUCAÇÃO INFANTIL/TEMPO INTEGRAL DA DULCE JONES'), N.chaveEscola('E.M DULCE JONES'));
  // nome diferente no final continua separado
  assert.notStrictEqual(N.chaveEscola('E.M DULCE SANTOS JONES'), N.chaveEscola('E.M DULCE JONES'));
  // só o tipo: não junta com nada
  assert.notStrictEqual(N.chaveEscola('EDUCAÇÃO INFANTIL'), N.chaveEscola('E.M'));
  const banco = D.criar();
  const [a] = N.lerCsvAntigo(CAB_REAL + '\n' + linhaReal({ id: '#0004', escola: 'E.M HAROLD JONES', data: '09/06/2026 09:36' }) + '\n', 'a.csv');
  const b = JSON.parse(JSON.stringify(a));
  b.escola = 'ESCOLA MUNICIPAL HAROLD JONES'; b.uuid = 'u-novo'; b.chave = 'u-novo'; b.origem = 'pacote'; b.data = a.data + 90 * 86400e3;
  banco.adicionar([a]); banco.adicionar([b]);
  const esc = banco.escolas();
  assert.strictEqual(esc.length, 1);
  assert.strictEqual(esc[0].serie.length, 2);
  assert.strictEqual(esc[0].ultima.escola, 'ESCOLA MUNICIPAL HAROLD JONES');
});

test('compilador: mesmo ID e data com nome escrito diferente não vira conflito', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'antigos-nome-'));
  fs.mkdirSync(path.join(dir, 'in'));
  fs.writeFileSync(path.join(dir, 'in', 'A.csv'), CAB_REAL + '\n' + linhaReal({ id: '#0004', escola: 'E.M HAROLD JONES' }) + '\n', 'utf8');
  fs.writeFileSync(path.join(dir, 'in', 'RawData_B.csv'), CAB_REAL + '\n' + linhaReal({ id: '#0004', escola: 'ESCOLA MUNICIPAL HAROLD JONES' }) + '\n', 'utf8');
  execFileSync('node', [path.join(__dirname, '..', 'scripts', 'compilar-antigos.js'), path.join(dir, 'in'), '--saida', path.join(dir, 'saida')], { stdio: 'pipe' });
  const rel = fs.readFileSync(path.join(dir, 'saida', 'relatorio_compilacao.md'), 'utf8');
  assert.ok(/Repetidos com diferença: 0/.test(rel));
  assert.ok(/ESCOLA MUNICIPAL HAROLD JONES/.test(fs.readFileSync(path.join(dir, 'saida', 'Nova_Lima_antigos_consolidado.csv'), 'utf8')));
});

test('access point Regular sai em cinza esverdeado, e só ele', () => {
  const V = require('../public/assets/js/views.js');
  const base = (dens) => ({
    chave: 'ap-reg', links: [], cabeada: { possui: false, redes: [] }, wifi: { pontos: [], mediaDownload: null, mediaPing: null },
    infra: { densidadeAps: dens, espectroWifi: '5GHz + 2.4GHz', accessPoints: 6, switch: 'Switch sem modelo', gateway: 'Solução Profissional', cabeamento: 'Padrão Cat5e/Cat6 estruturado' }
  });
  const nos = (v) => V.montarTopologia(v).reduce((a, t) => a.concat(t.nos), []);
  const ap = (v) => nos(v).find((n) => n.id === 'ap');
  // Regular (antenas mistas): marcado
  assert.strictEqual(ap(base('Misto Corredor Sala de Aula')).k, 'r');
  assert.strictEqual(ap(base('Misto Corredor Sala de Aula')).apReg, true);
  // outro item Regular (switch não identificado) continua amarelo, sem a marca
  const sw = nos(base('Misto Corredor Sala de Aula')).find((n) => n.id === 'sw');
  assert.strictEqual(sw.k, 'r'); assert.ok(!sw.apReg);
  // Bom e Ruim não ganham a cor nova
  assert.ok(!ap(base('Uma antena por sala')).apReg);
  assert.ok(!ap(base('Corredor / Distante')).apReg);
  // não registrado também não
  const sem = base(null); sem.infra.espectroWifi = null; sem.infra.accessPoints = null;
  assert.ok(!ap(sem).apReg);
});

test('link escrito com Gb ou Giga vale 1 Gbps ou mais e fica verde na topologia', () => {
  const V = require('../public/assets/js/views.js');
  const base = (tam, mbps) => ({
    chave: 'lk', links: [{ operadora: 'Op', tamanho: tam, mbps }], cabeada: { possui: false, redes: [] }, wifi: { pontos: [], mediaDownload: null, mediaPing: null },
    infra: { densidadeAps: 'Uma antena por sala', espectroWifi: '5GHz + 2.4GHz', accessPoints: 6, switch: 'Gigabit', gateway: 'Solução Profissional', cabeamento: 'Padrão Cat5e/Cat6 estruturado' }
  });
  const lk = (v) => V.montarTopologia(v)[0].nos[0];
  assert.strictEqual(lk(base('10 Giga ', 10)).k, 'b');   // o app gravou 10, o texto diz Giga
  assert.strictEqual(lk(base('1 Gb', 1)).k, 'b');
  assert.strictEqual(lk(base('2Gbps', 2)).k, 'b');
  assert.strictEqual(lk(base('1,5 Giga', 1.5)).k, 'b');
  assert.strictEqual(lk(base('500 Mbps', 500)).k, 'r');  // Mbps segue a regra de sempre
  assert.strictEqual(lk(base('1000 Mbps', 1000)).k, 'b');
  assert.strictEqual(lk(base(null, null)).k, 'n');
});

const VV = require('../public/assets/js/views.js');

test('anexos do pacote: todo espectro e toda foto listada no vistoria.json existe no zip', async () => {
  const buf = fs.readFileSync(path.join(pasta, 'pacote_tecnico_A.zip'));
  const r = await N.lerZip(buf, JSZip, 'a.zip');
  r.vistorias.forEach((v) => {
    const esp = v.arquivos.espectro || [];
    assert.ok(esp.length > 0, v.escola + ' ficou sem espectro');
    esp.forEach((rel) => assert.ok(r.zip.file(v.arquivos.base + rel), 'espectro some do zip: ' + rel));
    assert.strictEqual(VV.listaEspectro(v).length, esp.length, 'a aba Espectro não lista todos os arquivos');
    const f = v.arquivos.fotos || {};
    ['switchEvidencias', 'fibraEvidencias', 'antenasEvidencias'].forEach((k) => {
      (f[k] || []).forEach((rel) => assert.ok(r.zip.file(v.arquivos.base + rel), 'foto some do zip: ' + rel));
    });
    ['local', 'switch', 'ambiente', 'modem', 'antenas'].forEach((k) => {
      if (f[k]) assert.ok(r.zip.file(v.arquivos.base + f[k]), 'foto some do zip: ' + f[k]);
    });
    assert.ok(VV.listaFotos(v).length >= Object.keys(f).filter((k) => typeof f[k] === 'string' && f[k]).length);
  });
});

test('anexos: lista do vistoria.json é respeitada mesmo com nomes fora do padrão', async () => {
  const z = new JSZip();
  const base = 'vistorias/uuid-x/';
  const j = {
    identificacao: { uuid: 'uuid-x', dataVistoria: 1760000000000, schemaVersion: 26 },
    local: { escola: 'E', projeto: 'P' }, wifi: { pontos: [] }, calculado: {},
    espectro: ['espectro/analise 2.4 GHz.png', 'espectro/analise 5 GHz.png'],
    fotos: { local: 'fotos/local (1).jpg', switchEvidencias: [] }, arquivos: { pdf: 'relatorio.pdf' }
  };
  z.file(base + 'vistoria.json', JSON.stringify(j));
  z.file(base + 'espectro/analise 2.4 GHz.png', 'x'); z.file(base + 'espectro/analise 5 GHz.png', 'x');
  z.file(base + 'fotos/local (1).jpg', 'x'); z.file(base + 'relatorio.pdf', 'x');
  z.file('manifest.json', JSON.stringify({ pacoteId: 'p1' }));
  const r = await N.lerZip(await z.generateAsync({ type: 'nodebuffer' }), JSZip, 'b.zip');
  const v = r.vistorias[0];
  assert.deepStrictEqual(v.arquivos.espectro, j.espectro);
  assert.strictEqual(VV.listaEspectro(v).length, 2);
  v.arquivos.espectro.forEach((rel) => assert.ok(r.zip.file(v.arquivos.base + rel)));
});
