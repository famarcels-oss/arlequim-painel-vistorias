#!/usr/bin/env node
/* Compila os CSVs antigos do app (Todas_Vistorias_*.csv e RawData_Vistoria_ID_*.csv) em um conjunto limpo.
 *
 * Uso:
 *   node scripts/compilar-antigos.js <pasta-com-os-csvs> [--projeto "Nova Lima"] [--saida pasta] [--versao 1] [--pdfs pasta] [--incluir-testes]
 *
 * O que faz:
 *  1. Lê todos os CSVs da pasta (formato antigo do app, separador ;).
 *  2. Agrupa por ID + data/hora. Repetido: vale o arquivo mais recente (nome com data/hora, senão data de modificação;
 *     empate: RawData vale mais que Todas_Vistorias, depois sufixo _1, _2 do navegador, depois ordem alfabética).
 *     Se o nome da escola difere entre as cópias, fica o nome mais completo.
 *  3. Higieniza: espaços, "Selecione", técnico oculto, registros de teste, Wi-Fi não medido (SEMED).
 *  4. Grava o projeto em todas as linhas.
 *  5. Com --pdfs: vincula cada Vistoria_ID_NNNN_*.pdf à vistoria de mesmo ID (repetido: vale o mais recente).
 *  6. Gera: CSV consolidado, pacote .zip no formato do painel (sem PDFs) e relatório com todas as decisões.
 */
process.env.TZ = 'America/Sao_Paulo'; // horários do app são locais (Brasil, sem horário de verão)

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const JSZip = require('../public/assets/vendor/jszip.min.js');
const N = require('../public/assets/js/normalizar.js');

// ── argumentos ───────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const opt = { projeto: 'Nova Lima', saida: 'saida-antigos', versao: 1, incluirTestes: false, pdfs: null };
let pastaEntrada = null;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--projeto') opt.projeto = args[++i];
  else if (a === '--saida') opt.saida = args[++i];
  else if (a === '--versao') opt.versao = parseInt(args[++i], 10) || 1;
  else if (a === '--pdfs') opt.pdfs = args[++i];
  else if (a === '--incluir-testes') opt.incluirTestes = true;
  else if (!a.startsWith('--')) pastaEntrada = a;
}
if (!pastaEntrada) { console.error('Uso: node scripts/compilar-antigos.js <pasta-com-os-csvs> [--projeto "Nova Lima"] [--saida pasta]'); process.exit(1); }

// ── regras configuráveis ─────────────────────────────────────────────────────
const TESTES = ['arlequim', 'escola arlequim'];   // nomes (sem acento/maiúscula) de vistorias de teste do próprio app
const NAO_MEDIDO = ['semed'];                      // unidades administrativas: sem medição de Wi-Fi válida
const TECNICO_OCULTO = { nomes: ['tecnico oculto'], emails: ['tecnico@email.com'] };

// ── utilidades ───────────────────────────────────────────────────────────────
const limpaEsp = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const norm = N.normNome;
function nomeLimpoArquivo(f) { return f.replace(/^[0-9a-f]{8}-\d+_/, ''); } // tira o prefixo que o envio acrescenta
function csvCampo(v) {
  const s = String(v == null ? '' : v);
  return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function csvTexto(cab, linhas) {
  return '﻿' + [cab.map(csvCampo).join(';')].concat(linhas.map((l) => cab.map((c) => csvCampo(l[c])).join(';'))).join('\n') + '\n';
}
function uuidEstavel(chave) { // uuid v5-like, sempre o mesmo para a mesma vistoria
  const h = crypto.createHash('sha1').update('arlequim-antigos|' + chave).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
function dataMsBr(txt) { // "dd/MM/yyyy HH:mm" -> ms, fixo em -03:00
  const m = String(txt).match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
  if (!m) return null;
  return Date.UTC(+m[3], +m[2] - 1, +m[1], +m[4] + 3, +m[5]);
}
function isoBr(ms) {
  const d = new Date(ms - 3 * 3600e3);
  return d.toISOString().slice(0, 19) + '-03:00';
}
function f1(n) { return n == null ? '' : String(Math.round(n * 10) / 10).replace('.', ','); }

// ── 1. leitura ───────────────────────────────────────────────────────────────
const arquivos = fs.readdirSync(pastaEntrada).filter((f) => /\.csv$/i.test(f)).sort();
const fontes = [];
for (const f of arquivos) {
  const caminho = path.join(pastaEntrada, f);
  const texto = fs.readFileSync(caminho, 'utf8');
  const linhas = N.parseCsv(texto, ';');
  if (!N.ehCsvAntigo(linhas)) continue;
  const nome = nomeLimpoArquivo(f);
  const mStamp = nome.match(/_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
  const stamp = mStamp ? Date.UTC(+mStamp[1], +mStamp[2] - 1, +mStamp[3], +mStamp[4] + 3, +mStamp[5], +mStamp[6]) : null;
  const mtime = Math.floor(fs.statSync(caminho).mtimeMs / 60000) * 60000;
  const sufixo = (nome.match(/_(\d)\.csv$/i) || [0, 0])[1] | 0;
  const cab = linhas[0];
  const registros = linhas.slice(1).filter((r) => r.length > 1).map((r) => {
    const d = {};
    cab.forEach((c, i) => { d[c] = r[i] === undefined ? '' : r[i]; });
    return d;
  });
  fontes.push({ arquivo: nome, cab, registros, tempo: stamp != null ? stamp : mtime, porNome: stamp != null, tipo: /^RawData_/i.test(nome) ? 1 : 0, sufixo });
}
// do mais antigo para o mais novo: o último vence
fontes.sort((a, b) => a.tempo - b.tempo || a.tipo - b.tipo || a.sufixo - b.sufixo || (a.arquivo < b.arquivo ? -1 : 1));

// ── 2. agrupar por ID + data ─────────────────────────────────────────────────
const grupos = new Map();
fontes.forEach((fonte, ordem) => {
  fonte.registros.forEach((r) => {
    const chave = limpaEsp(r.ID_Vistoria) + '|' + limpaEsp(r.Data_Vistoria);
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push({ fonte, ordem, r });
  });
});

const relat = { conflitos: [], repetidosIguais: 0, excluidos: [], ajustes: [], avisos: [] };
const colunas = []; // união das colunas, na ordem da exportação mais completa
const maior = fontes.reduce((m, f) => (f.cab.length > m.length ? f.cab : m), []);
maior.forEach((c) => colunas.push(c));
fontes.forEach((f) => f.cab.forEach((c) => { if (colunas.indexOf(c) < 0) colunas.push(c); }));

const escolhidos = [];
for (const [chave, copias] of grupos) {
  const vencedora = copias[copias.length - 1];
  const linha = {};
  colunas.forEach((c) => { linha[c] = limpaEsp(c === 'Resumo_Medicoes_Detalhadas' ? String(vencedora.r[c] == null ? '' : vencedora.r[c]).trim() : vencedora.r[c]); });

  // diferenças entre as cópias (ignora coluna que só existe em uma versão do arquivo e está vazia)
  const dif = [];
  colunas.forEach((c) => {
    const vals = copias.map((x) => limpaEsp(x.r[c]));
    if (new Set(vals).size > 1) dif.push({ coluna: c, valores: copias.map((x, i) => ({ arquivo: x.fonte.arquivo, valor: vals[i] })) });
  });
  if (copias.length > 1 && !dif.length) relat.repetidosIguais++;

  const notas = [];
  const difEscola = dif.find((d) => d.coluna === 'Escola');
  if (difEscola) {
    const chaves = new Set(difEscola.valores.map((x) => N.chaveEscola(x.valor)));
    if (chaves.size === 1) {
      // só muda a forma de escrever ("E.M" x "ESCOLA MUNICIPAL"): não é conflito, vale o nome do arquivo mais recente
      dif.splice(dif.indexOf(difEscola), 1);
    } else {
      // nomes realmente diferentes (ex.: "E.M" e "EDUCAÇÃO INFANTIL CARLOS ..."): fica o mais completo
      linha.Escola = difEscola.valores.map((x) => x.valor).sort((a, b) => b.length - a.length)[0];
      notas.push('nome da escola: ficou o mais completo');
    }
  }
  if (dif.length) {
    relat.conflitos.push({
      id: limpaEsp(vencedora.r.ID_Vistoria), data: limpaEsp(vencedora.r.Data_Vistoria),
      escolaFinal: linha.Escola, vencedor: vencedora.fonte.arquivo,
      difs: dif.map((d) => ({ coluna: d.coluna, valores: d.valores, escolhido: d.coluna === 'Escola' ? linha.Escola : limpaEsp(vencedora.r[d.coluna]) }))
    });
  }

  // higiene
  colunas.forEach((c) => { if (linha[c].toLowerCase() === 'selecione') linha[c] = ''; });
  const emailRuim = TECNICO_OCULTO.emails.indexOf(linha.Email_Tecnico.toLowerCase()) >= 0;
  const nomeRuim = TECNICO_OCULTO.nomes.indexOf(norm(linha.Tecnico)) >= 0;
  if (emailRuim || nomeRuim) {
    linha.Tecnico = ''; linha.Email_Tecnico = '';
    notas.push('técnico oculto no app (não registrado)');
  }
  if (NAO_MEDIDO.indexOf(norm(linha.Escola)) >= 0) {
    ['M1', 'M2', 'M3'].forEach((m) => ['Mbps', 'Ping', 'Jitter', 'SSID', 'Manual'].forEach((k) => { if (colunas.indexOf(m + '_' + k) >= 0) linha[m + '_' + k] = ''; }));
    linha.Score_Final_WiFi = ''; linha.Status_WiFi = 'NAO_MEDIDO'; linha.Capacidade_Estimada = '';
    linha.Score_Final_Lab = ''; linha.Status_Lab = '';
    notas.push('Wi-Fi não medido (unidade administrativa, todas as medições zeradas)');
    relat.ajustes.push({ id: linha.ID_Vistoria, escola: linha.Escola, texto: 'Wi-Fi marcado como não medido. As 3 medições vieram zeradas e o app gravou nota 58; a nota foi retirada para não entrar em média nem em ranking.' });
  }
  if (emailRuim || nomeRuim) relat.ajustes.push({ id: linha.ID_Vistoria, escola: linha.Escola, texto: 'Técnico gravado como "Técnico Oculto" (tecnico@email.com). Ficou em branco.' });

  const ehTeste = TESTES.indexOf(norm(linha.Escola)) >= 0;
  linha.__copias = copias.map((x) => x.fonte.arquivo);
  linha.__vencedor = vencedora.fonte.arquivo;
  linha.__notas = notas;
  linha.__teste = ehTeste;
  escolhidos.push(linha);
}

const incluidos = [];
escolhidos.forEach((l) => {
  if (l.__teste && !opt.incluirTestes) relat.excluidos.push(l); else incluidos.push(l);
});
incluidos.sort((a, b) => dataMsBr(a.Data_Vistoria) - dataMsBr(b.Data_Vistoria) || a.ID_Vistoria.localeCompare(b.ID_Vistoria));

// ── 3. projeto + nota unificada (mesma regra do app) ─────────────────────────
const cabFinal = ['ID_Vistoria', 'Projeto'].concat(colunas.filter((c) => c !== 'ID_Vistoria'));
if (cabFinal.indexOf('Score_Geral_Unificado') < 0) cabFinal.push('Score_Geral_Unificado');
cabFinal.push('Arquivo_Origem', 'Obs_Compilacao');
incluidos.forEach((l) => { l.Projeto = opt.projeto; });

// 1ª leitura (sem nota unificada) para calcular a nota pela regra do app
let textoTmp = csvTexto(cabFinal, incluidos);
let vs = N.lerCsvAntigo(textoTmp, 'tmp.csv');
incluidos.forEach((l, i) => {
  const v = vs[i];
  if (!l.Score_Geral_Unificado) l.Score_Geral_Unificado = v.calculado.nota == null ? '' : f1(v.calculado.nota);
  l.Arquivo_Origem = l.__vencedor;
  l.Obs_Compilacao = l.__notas.join('; ');
});
const csvFinal = csvTexto(cabFinal, incluidos);
vs = N.lerCsvAntigo(csvFinal, 'Nova_Lima_antigos_consolidado.csv');

// ── 4. vistoria.json no formato do painel ────────────────────────────────────
const FAIXA_TXT = { ap: 'APROVADA', re: 'RESSALVA', rp: 'REPROVADA', nm: 'NAO_MEDIDA' };
function paraJson(v, uuid, dataTxt) {
  const ms = dataMsBr(dataTxt);
  const atualizado = ms + opt.versao * 60000;
  return {
    identificacao: {
      uuid, idLocal: v.idLocal, dataVistoria: ms, dataVistoriaIso: isoBr(ms), criadoEm: ms, atualizadoEm: atualizado,
      versaoApp: 'planilha-antiga', modeloAparelho: null, schemaVersion: 0, exportadoPelaVersao: 'compilar-antigos'
    },
    local: { escola: v.escola, projeto: v.projeto, endereco: '', placeId: '' },
    tecnico: { nome: v.tecnico.nome || '', email: v.tecnico.email || '' },
    censo: v.censo,
    infraestrutura: v.infra,
    links: v.links,
    wifi: { medido: v.wifi.medido, modo: v.wifi.modo, capacidadeEstimada: v.wifi.capacidadeEstimada, mediaDownload: v.wifi.mediaDownload, mediaPing: v.wifi.mediaPing, pontos: v.wifi.pontos },
    cabeada: v.cabeada,
    conclusao: v.conclusao,
    calculado: {
      nota: v.calculado.nota, status: FAIXA_TXT[v.calculado.faixa], faixa: FAIXA_TXT[v.calculado.faixa],
      notaWifi: v.calculado.notaWifi, notaCabeada: v.calculado.notaCabeada, statusWifi: v.calculado.statusWifi, statusCabeada: v.calculado.statusCabeada
    },
    fotos: {}, espectro: [], arquivos: { pdf: null, fotosAusentes: [] }
  };
}

// ── PDFs: Vistoria_ID_NNNN_*.pdf ───────────────────────────────────────────
const pdfPorId = {};    // id (4 dígitos) -> arquivo vencedor
const pdfDescartados = [];
if (opt.pdfs) {
  const porId = {};
  fs.readdirSync(opt.pdfs).filter((f) => /\.pdf$/i.test(f)).forEach((f) => {
    const nome = nomeLimpoArquivo(f);
    const m = nome.match(/Vistoria_ID_(\d{4})_/i);
    if (!m) return;
    const caminho = path.join(opt.pdfs, f);
    const sufixo = (nome.match(/(\d)\.pdf$/i) || [0, 0])[1] | 0; // "...DIAS1.pdf": cópia baixada depois
    const item = { id: m[1], caminho, nome, mtime: Math.floor(fs.statSync(caminho).mtimeMs / 60000) * 60000, sufixo, tamanho: fs.statSync(caminho).size };
    (porId[m[1]] = porId[m[1]] || []).push(item);
  });
  Object.keys(porId).forEach((id) => {
    const l = porId[id].sort((a, b) => a.mtime - b.mtime || a.sufixo - b.sufixo || (a.nome < b.nome ? -1 : 1));
    pdfPorId[id] = l[l.length - 1];
    l.slice(0, -1).forEach((x) => pdfDescartados.push({ id, descartado: x.nome, ficou: l[l.length - 1].nome }));
  });
}

const SEC = {
  censo: 'Censo', infra: 'Infraestrutura', conclusao: 'Conclusão', calculado: 'Resultado'
};
function linhasLongas(j) {
  const out = [];
  const base = [j.identificacao.uuid, j.local.escola, j.local.projeto, j.identificacao.dataVistoriaIso];
  const add = (secao, item, campo, valor) => { if (valor !== null && valor !== undefined && valor !== '') out.push(base.concat([secao, item, campo, valor])); };
  add('Identificação', '', 'ID', j.identificacao.idLocal);
  add('Identificação', '', 'Técnico', j.tecnico.nome);
  Object.keys(j.censo).forEach((k) => add(SEC.censo, '', k, j.censo[k]));
  Object.keys(j.infraestrutura).forEach((k) => add(SEC.infra, '', k, j.infraestrutura[k]));
  add('Wi-Fi', '', 'medido', j.wifi.medido ? 'Sim' : 'Não');
  add('Wi-Fi', '', 'capacidadeEstimada', j.wifi.capacidadeEstimada);
  j.wifi.pontos.forEach((p) => ['download', 'ping', 'jitter', 'ssid'].forEach((k) => add('Wi-Fi', p.nome, k, p[k])));
  add('Rede cabeada', '', 'possui', j.cabeada.possui === null ? '' : j.cabeada.possui ? 'Sim' : 'Não');
  j.cabeada.redes.forEach((r) => ['sistemaOperacional', 'switch', 'cabeamento', 'download', 'ping'].forEach((k) => add('Rede cabeada', r.nome, k, r[k])));
  Object.keys(j.conclusao).forEach((k) => add(SEC.conclusao, '', k, j.conclusao[k]));
  Object.keys(j.calculado).forEach((k) => add(SEC.calculado, '', k, j.calculado[k]));
  return out;
}

const pdfUsados = {};
(async () => {
  const saida = path.resolve(opt.saida);
  fs.mkdirSync(saida, { recursive: true });

  const zip = new JSZip();
  const itens = [];
  const longas = [];
  vs.forEach((v, i) => {
    const l = incluidos[i];
    const uuid = uuidEstavel(opt.projeto + '|' + l.ID_Vistoria + '|' + l.Data_Vistoria);
    const j = paraJson(v, uuid, l.Data_Vistoria);
    const pasta = `vistorias/${uuid}/`;
    const pdf = pdfPorId[String(l.ID_Vistoria).replace(/\D/g, '').padStart(4, '0')];
    if (pdf) { j.arquivos.pdf = 'relatorio.pdf'; zip.file(pasta + 'relatorio.pdf', fs.readFileSync(pdf.caminho)); l.__pdf = pdf.nome; pdfUsados[pdf.id] = true; }
    zip.file(pasta + 'vistoria.json', JSON.stringify(j, null, 2));
    itens.push({ uuid, idLocal: j.identificacao.idLocal, escola: j.local.escola, projeto: j.local.projeto, dataVistoria: j.identificacao.dataVistoria, atualizadoEm: j.identificacao.atualizadoEm, pasta });
    linhasLongas(j).forEach((x) => longas.push(x));
    l.__uuid = uuid;
    l.__faixa = v.calculado.faixa;
    l.__nota = v.calculado.nota;
  });
  const cabLongo = ['uuid', 'escola', 'projeto', 'data', 'secao', 'item', 'campo', 'valor'];
  zip.file('vistorias_longo.csv', '﻿' + cabLongo.join(';') + '\n' + longas.map((r) => r.map(csvCampo).join(';')).join('\n') + '\n');
  const conteudoHash = crypto.createHash('sha1').update(itens.map((x) => x.uuid + x.atualizadoEm).join('|')).digest('hex').slice(0, 10);
  const avisosPacote = ['Pacote compilado a partir de planilhas antigas (sem fotos e espectro; PDF só nas vistorias que tinham).'];
  zip.file('manifest.json', JSON.stringify({
    formato: 1, pacoteId: `antigos-${norm(opt.projeto).replace(/ /g, '-')}-v${opt.versao}-${conteudoHash}`, geradoEm: Date.now(), appVersao: 'compilar-antigos',
    aparelho: null, tecnicoNome: 'Compilação de planilhas antigas', tecnicoEmail: '', total: itens.length, avisos: avisosPacote, vistorias: itens
  }, null, 2));
  const nomeBase = `${opt.projeto.replace(/\s+/g, '_')}`;
  const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.writeFileSync(path.join(saida, `pacote_${nomeBase}_antigos_v${opt.versao}.zip`), buf);
  fs.writeFileSync(path.join(saida, `${nomeBase}_antigos_consolidado.csv`), csvFinal, 'utf8');

  // ── 5. relatório ───────────────────────────────────────────────────────────
  const totalLinhas = fontes.reduce((s, f) => s + f.registros.length, 0);
  const L = [];
  L.push(`# Compilação dos CSVs antigos: projeto ${opt.projeto}`, '');
  L.push(`- Arquivos lidos: ${fontes.length}`);
  L.push(`- Linhas lidas (somando todos os arquivos): ${totalLinhas}`);
  L.push(`- Vistorias distintas (ID + data): ${escolhidos.length}`);
  L.push(`- Repetidos idênticos descartados: ${relat.repetidosIguais} vistorias aparecem em mais de um arquivo sem diferença`);
  L.push(`- Repetidos com diferença: ${relat.conflitos.length} (detalhe abaixo)`);
  L.push(`- Registros de teste retirados: ${relat.excluidos.length}`);
  L.push(`- **Vistorias no resultado final: ${incluidos.length}**`, '');

  L.push('## Como foi decidido qual arquivo vale', '');
  L.push('Do mais antigo para o mais novo (o último vence):', '');
  fontes.forEach((f, i) => L.push(`${i + 1}. ${f.arquivo} (${f.registros.length} linha${f.registros.length === 1 ? '' : 's'}; ${f.porNome ? 'data no nome do arquivo' : 'data de modificação do arquivo'})`));
  L.push('', 'Empate de data: RawData vale mais que Todas_Vistorias, depois o sufixo _1, _2 do navegador (download mais recente), depois ordem alfabética.', '');

  L.push('## Repetidos com diferença', '');
  if (!relat.conflitos.length) L.push('Nenhum.');
  relat.conflitos.forEach((c) => {
    L.push(`### ${c.id}, ${c.escolaFinal} (${c.data})`, '');
    c.difs.forEach((d) => {
      L.push(`- ${d.coluna}: ` + d.valores.map((x) => `"${x.valor}" em ${x.arquivo}`).join('; ') + `. Ficou: "${d.escolhido}".`);
    });
    L.push('');
  });

  L.push('## Retirados', '');
  if (!relat.excluidos.length) L.push('Nenhum.');
  relat.excluidos.forEach((l) => L.push(`- ${l.ID_Vistoria}, ${l.Escola} (${l.Data_Vistoria}), técnico ${l.Tecnico || 'não registrado'}: registro de teste do app. Use --incluir-testes para manter.`));
  L.push('');

  L.push('## Ajustes aplicados', '');
  L.push('- Projeto "' + opt.projeto + '" gravado em todas as vistorias.');
  L.push('- Espaços extras removidos e "Selecione" trocado por vazio.');
  L.push('- Nota geral calculada pela regra do app quando a coluna não existe: com laboratório, média de Wi-Fi e laboratório; sem laboratório, só o Wi-Fi.');
  L.push('- Horários gravados no fuso de Brasília (-03:00).');
  const tecOculto = relat.ajustes.filter((a) => /Técnico Oculto/.test(a.texto));
  relat.ajustes.filter((a) => !/Técnico Oculto/.test(a.texto)).forEach((a) => L.push(`- ${a.id} ${a.escola}: ${a.texto}`));
  if (tecOculto.length) L.push(`- Técnico gravado como "Técnico Oculto" (tecnico@email.com) em ${tecOculto.length} vistorias (${tecOculto.map((a) => a.id).sort().join(', ')}). Ficou em branco, aparece como "não registrado".`);
  L.push('');

  const ids = escolhidos.map((l) => parseInt(String(l.ID_Vistoria).replace(/\D/g, ''), 10)).filter((n) => isFinite(n));
  const faltam = [];
  for (let n = Math.min.apply(null, ids); n <= Math.max.apply(null, ids); n++) if (ids.indexOf(n) < 0) faltam.push('#' + String(n).padStart(4, '0'));
  if (opt.pdfs) {
    L.push('## PDFs', '');
    const com = incluidos.filter((l) => l.__pdf);
    L.push(`- Vinculados: ${com.length} de ${incluidos.length} vistorias.`);
    pdfDescartados.forEach((d) => L.push(`- #${d.id}: PDF repetido. Ficou ${d.ficou}; descartado ${d.descartado}.`));
    Object.keys(pdfPorId).filter((id) => !pdfUsados[id]).forEach((id) => L.push(`- #${id}: PDF sem vistoria correspondente (${pdfPorId[id].nome}). Não entrou no pacote.`));
    const sem = incluidos.filter((l) => !l.__pdf).map((l) => l.ID_Vistoria);
    L.push(`- Vistorias ainda sem PDF: ${sem.length ? sem.join(', ') : 'nenhuma'}.`, '');
  }
  const porEscola = {};
  incluidos.forEach((l) => { (porEscola[N.chaveEscola(l.Escola)] = porEscola[N.chaveEscola(l.Escola)] || []).push(l); });
  const mesmas = Object.keys(porEscola).filter((k) => porEscola[k].length > 1);
  L.push('## Mesma escola em mais de uma vistoria', '');
  L.push('Vale o final do nome: o tipo no começo ("E.M", "ESCOLA MUNICIPAL", "CEI", "EDUCAÇÃO INFANTIL"...), acento, pontuação e "de/da/do" não contam.');
  if (!mesmas.length) L.push('Nenhuma: cada escola aparece uma vez.');
  mesmas.forEach((k) => L.push(`- ${porEscola[k].map((l) => `${l.ID_Vistoria} "${l.Escola}" (${l.Data_Vistoria})`).join('; ')}`));
  L.push('');
  // nomes parecidos que NÃO foram juntados (uma letra de diferença ou um nome contido no outro): para o Fábio conferir
  const lev = (a, b) => { const d = []; for (let i = 0; i <= a.length; i++) { d[i] = [i]; } for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; };
  const chs = Object.keys(porEscola).filter((k) => k.indexOf(' ') > 0);
  const parecidos = [];
  for (let i = 0; i < chs.length; i++) for (let j = i + 1; j < chs.length; j++) {
    const a = chs[i], b = chs[j];
    if (lev(a, b) <= 2 || (' ' + a + ' ').indexOf(' ' + b + ' ') >= 0 || (' ' + b + ' ').indexOf(' ' + a + ' ') >= 0) parecidos.push([a, b]);
  }
  L.push('## Nomes parecidos que ficaram separados', '');
  if (!parecidos.length) L.push('Nenhum.');
  parecidos.forEach(([a, b]) => L.push(`- ${porEscola[a].concat(porEscola[b]).map((l) => `${l.ID_Vistoria} "${l.Escola}"`).join(' e ')}. Se for a mesma escola, me avise.`));
  L.push('');
  L.push('## Atenção', '');
  L.push(`- IDs sem nenhum registro nos arquivos: ${faltam.length ? faltam.join(', ') : 'nenhum'}.`);
  L.push('- Vistorias antigas não têm fotos, espectro, upload nem sinal em dBm; no painel aparecem como "não registrado".', '');

  L.push('## Resultado final', '');
  L.push('| ID | Escola | Data | Nota | Faixa | Cópias | Observação |', '|---|---|---|---|---|---|---|');
  const NOME_FAIXA = { ap: 'Aprovada', re: 'Com ressalva', rp: 'Reprovada', nm: 'Wi-Fi não medido' };
  incluidos.forEach((l) => {
    L.push(`| ${l.ID_Vistoria} | ${l.Escola} | ${l.Data_Vistoria} | ${l.__nota == null ? '' : f1(l.__nota)} | ${NOME_FAIXA[l.__faixa]} | ${l.__copias.length} | ${l.__notas.concat(l.__pdf ? ['PDF vinculado'] : []).join('; ')} |`);
  });
  L.push('');
  fs.writeFileSync(path.join(saida, 'relatorio_compilacao.md'), L.join('\n'), 'utf8');

  console.log(`Vistorias no resultado: ${incluidos.length} (retiradas ${relat.excluidos.length} de teste; ${relat.conflitos.length} repetidos com diferença)`);
  console.log('Saída:', saida);
})();
