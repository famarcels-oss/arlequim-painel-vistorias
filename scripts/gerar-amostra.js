#!/usr/bin/env node
/* Gera pacotes de exemplo (dados fictícios) no mesmo formato que o app exporta.
 * Uso: node scripts/gerar-amostra.js [pasta-de-saida]
 * Cria: pacote_tecnico_A.zip, pacote_tecnico_B.zip (com duplicados de propósito) e planilha_antiga.csv
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const JSZip = require('../public/assets/vendor/jszip.min.js');

const saida = path.resolve(process.argv[2] || path.join(__dirname, '..', 'amostra'));
fs.mkdirSync(saida, { recursive: true });

// ── PNG simples (sem dependências) ───────────────────────────────────────────
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(tipo, dados) {
  const len = Buffer.alloc(4); len.writeUInt32BE(dados.length);
  const td = Buffer.concat([Buffer.from(tipo), dados]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, cor) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const [r, g, b] = cor(x, y, w, h);
      const o = y * (w * 3 + 1) + 1 + x * 3;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const fotoA = png(640, 420, (x, y, w, h) => [90 + (x / w) * 120, 42 + (y / h) * 90, 134 + (x / w) * 60]);
const fotoB = png(640, 420, (x, y, w, h) => [220 - (y / h) * 80, 160 + (x / w) * 50, 60 + (y / h) * 80]);
const espec = png(700, 300, (x, y, w, h) => { const barra = Math.floor(x / 70); const alt = 60 + ((barra * 53) % 200); return y > h - alt ? [91, 42, 134] : [239, 231, 247]; });

function pdfFalso(titulo) {
  const t = String(titulo).replace(/[()\\]/g, '');
  const corpo = `BT /F1 18 Tf 60 760 Td (Relatorio de vistoria - ${t}) Tj ET`;
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${corpo.length} >>\nstream\n${corpo}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  ];
  let out = '%PDF-1.4\n'; const off = [];
  objs.forEach((o, i) => { off.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + off.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out, 'latin1');
}

let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const uuidDe = (n) => `00000000-0000-4000-a000-${String(n).padStart(12, '0')}`;
const r1 = (x) => Math.round(x * 10) / 10;

// nivel: g = bom, y = regular, r = ruim
function vistoria(n, escola, projeto, dataIso, nivel, opts = {}) {
  const t = new Date(dataIso).getTime();
  const f = { g: 1, y: 0.5, r: 0.12 }[nivel];
  const nPontos = opts.pontos || 3;
  const pontos = [];
  for (let i = 1; i <= nPontos; i++) {
    const k = 1 - (i - 1) * 0.1;
    const dl = r1((200 * f + 10) * k * (0.9 + rnd() * 0.2));
    const ping = r1(Math.max(4, (nivel === 'g' ? 10 : nivel === 'y' ? 34 : 72) / k * (0.9 + rnd() * 0.2)));
    pontos.push({
      indice: i, nome: `Sala ${i}`, download: dl, upload: r1(dl * 0.55), ping, jitter: r1(ping / (nivel === 'r' ? 2 : 5)), ssid: `${escola.split(' ').pop().toUpperCase()}_WIFI`,
      banda: i === 3 && nivel !== 'g' ? '2.4 GHz' : '5 GHz', sinalDbm: Math.round(-48 - (nivel === 'g' ? 4 : nivel === 'y' ? 14 : 26) - (i - 1) * 5),
      capacidade: dl > 80 ? 'Alta (>100 dispositivos)' : 'Média', manual: false, qualidade: ''
    });
  }
  const mediaDl = pontos.reduce((s, p) => s + p.download, 0) / pontos.length;
  const mediaPing = pontos.reduce((s, p) => s + p.ping, 0) / pontos.length;
  const nota = opts.nota != null ? opts.nota : ({ g: 90, y: 66, r: 38 }[nivel] + Math.round(rnd() * 8));
  const faixa = nota >= 80 ? 'APROVADA' : nota >= 51 ? 'RESSALVA' : 'REPROVADA';
  const labMbps = { g: 941, y: 86.5, r: 42 }[nivel];
  const redes = [{
    nome: 'Laboratório de informática', sistemaOperacional: 'Windows 11', switch: nivel === 'r' ? 'Fast 10/100' : nivel === 'y' ? 'Hub / Não Identificado' : 'Gigabit 10/100/1000',
    cabeamento: nivel === 'r' ? 'Cabos danificados / emendas' : 'Cabos em bom estado', desktops: 30, download: labMbps, ping: { g: 1, y: 46, r: 85 }[nivel],
    fotoLaboratorio: 'fotos/rede_lab_local.png', fotoTesteInternet: null, fotoSwitch: null, fotoExtra: null
  }];
  if (nivel !== 'r') redes.push({
    nome: 'Sala da secretaria', sistemaOperacional: 'Windows 10', switch: 'Gigabit 10/100/1000', cabeamento: 'Cabos em bom estado', desktops: 4,
    download: nivel === 'g' ? 412.3 : 120.4, ping: 2, fotoLaboratorio: null, fotoTesteInternet: null, fotoSwitch: null, fotoExtra: null
  });
  return {
    identificacao: {
      uuid: opts.uuid || uuidDe(n), idLocal: n, dataVistoria: t, dataVistoriaIso: dataIso, criadoEm: t, atualizadoEm: opts.atualizadoEm || t + 3600e3,
      versaoApp: '1.1.34', modeloAparelho: opts.aparelho || 'SM-A546E', schemaVersion: 25, exportadoPelaVersao: '1.1.34'
    },
    local: { escola, projeto, endereco: `Rua das Flores, ${100 + n}`, placeId: opts.placeId || '' },
    tecnico: { nome: opts.tecnico || 'Técnico A', email: opts.email || 'tecnico.a@exemplo.com' },
    censo: { salas: 12, alunos: 340, professores: 28, possuiChromebooks: true, chromebooks: 120, possuiDesktops: true, desktops: 34, possuiProjetores: true, projetores: 6, nivelInformatica: 3 },
    infraestrutura: {
      switch: nivel === 'r' ? 'Fast 10/100' : nivel === 'y' ? 'Hub / Não Identificado' : 'Gigabit 10/100/1000', cabeamento: nivel === 'r' ? 'Cabos danificados / emendas' : 'Cabos em bom estado',
      gateway: nivel === 'g' ? 'Solução Profissional' : nivel === 'y' ? 'Não Identificado' : 'Modem da Operadora',
      espectroWifi: nivel === 'r' ? 'Apenas 2.4GHz' : '5GHz + 2.4GHz', densidadeAps: nivel === 'g' ? 'Um por Sala de Aula' : nivel === 'y' ? 'Misto Corredor Sala de Aula' : 'Corredor / Distante',
      accessPoints: nivel === 'g' ? 12 : 6, notaProfessor: nivel === 'g' ? 'Nota 8 a 10' : 'Nota 4 a 7', possuiZonaSombra: nivel === 'r', salasSemSinal: nivel === 'r' ? 'Sala 7, Sala 9' : ''
    },
    links: [{ operadora: 'Operadora X', tamanho: nivel === 'g' ? '1 Gbps' : '300 Mbps', mbps: nivel === 'g' ? 1000 : 300 }],
    wifi: { medido: true, modo: 'detalhado', capacidadeEstimada: 'Média', mediaDownload: r1(mediaDl), mediaPing: r1(mediaPing), pontos },
    cabeada: { possui: true, redes, legadoSwitch: '', legadoCabeamento: '', legadoGateway: '', legadoDownload: 0, legadoPing: 0, legadoJitter: 0 },
    conclusao: { possuiImpeditivo: nivel === 'r', observacoesImpeditivo: nivel === 'r' ? 'Sala de servidores sem ventilação' : '', possuiDificuldade: false, observacoesDificuldade: '' },
    calculado: { nota, status: faixa, faixa, notaWifi: nota, statusWifi: faixa === 'APROVADA' ? 'APROVADO' : faixa === 'RESSALVA' ? 'COM_RESSALVA' : 'REPROVADO', notaCabeada: nota, statusCabeada: 'APROVADO' },
    fotos: {
      local: 'fotos/local.png', switch: 'fotos/switch.png', ambiente: 'fotos/ambiente.png', modem: null, antenas: 'fotos/antenas.png',
      switchEvidencias: [], fibraEvidencias: [], antenasEvidencias: []
    },
    espectro: ['espectro/espectro_1.png', 'espectro/espectro_2.png'],
    arquivos: { pdf: 'relatorio.pdf', fotosAusentes: [] }
  };
}

async function pacote(nome, lista, tecnico, pacoteId) {
  const zip = new JSZip();
  const itens = [];
  for (const j of lista) {
    const chave = j.identificacao.uuid;
    const pasta = `vistorias/${chave}/`;
    zip.file(pasta + 'vistoria.json', JSON.stringify(j, null, 2));
    zip.file(pasta + 'relatorio.pdf', pdfFalso(j.local.escola));
    zip.file(pasta + 'fotos/local.png', fotoA);
    zip.file(pasta + 'fotos/switch.png', fotoB);
    zip.file(pasta + 'fotos/ambiente.png', fotoA);
    zip.file(pasta + 'fotos/antenas.png', fotoB);
    zip.file(pasta + 'fotos/rede_lab_local.png', fotoA);
    zip.file(pasta + 'espectro/espectro_1.png', espec);
    zip.file(pasta + 'espectro/espectro_2.png', espec);
    itens.push({ uuid: chave, idLocal: j.identificacao.idLocal, escola: j.local.escola, projeto: j.local.projeto, dataVistoria: j.identificacao.dataVistoria, atualizadoEm: j.identificacao.atualizadoEm, pasta });
  }
  zip.file('vistorias_longo.csv', 'uuid;escola;projeto;data;secao;item;campo;valor\n');
  zip.file('manifest.json', JSON.stringify({ formato: 1, pacoteId, geradoEm: Date.now(), appVersao: '1.1.34', aparelho: 'SM-A546E', tecnicoNome: tecnico.nome, tecnicoEmail: tecnico.email, total: lista.length, avisos: [], vistorias: itens }, null, 2));
  const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.writeFileSync(path.join(saida, nome), buf);
  return buf.length;
}

(async () => {
  const A = { nome: 'Técnico A', email: 'tecnico.a@exemplo.com' };
  const B = { nome: 'Técnico B', email: 'tecnico.b@exemplo.com' };
  const v = (...a) => vistoria(...a);

  const lista = {
    aurora: v(1024, 'E.M. Aurora', 'Projeto Alfa', '2026-10-08T10:30:00-03:00', 'g', { nota: 92, placeId: 'pl_aurora' }),
    ipeNovo: v(1023, 'CMEI Ipê', 'Projeto Alfa', '2026-10-07T09:10:00-03:00', 'g', { nota: 84, placeId: 'pl_ipe' }),
    ipeMeio: v(1010, 'CMEI Ipê', 'Projeto Alfa', '2026-07-20T09:00:00-03:00', 'y', { nota: 74, placeId: 'pl_ipe' }),
    ipeVelho: v(1004, 'CMEI Ipê', 'Projeto Alfa', '2026-04-10T09:00:00-03:00', 'y', { nota: 62, placeId: 'pl_ipe' }),
    girassol: v(1020, 'CMEI Girassol', 'Projeto Alfa', '2026-10-02T14:00:00-03:00', 'g', { nota: 88 }),
    horizonteNovo: v(1022, 'E.E. Horizonte', 'Projeto Beta', '2026-10-06T08:40:00-03:00', 'y', { nota: 67, tecnico: 'Técnico B', email: 'tecnico.b@exemplo.com' }),
    horizonteVelho: v(1008, 'E.E. Horizonte', 'Projeto Beta', '2026-08-20T08:40:00-03:00', 'y', { nota: 72, tecnico: 'Técnico B', email: 'tecnico.b@exemplo.com' }),
    boaVistaNovo: v(1021, 'E.M. Boa Vista', 'Projeto Beta', '2026-10-05T13:00:00-03:00', 'r', { nota: 41, tecnico: 'Técnico B', email: 'tecnico.b@exemplo.com' }),
    boaVistaVelho: v(1007, 'E.M. Boa Vista', 'Projeto Beta', '2026-08-18T13:00:00-03:00', 'r', { nota: 36, tecnico: 'Técnico B', email: 'tecnico.b@exemplo.com' }),
    sabia: v(1019, 'E.M. Sabiá', 'Projeto Gama', '2026-09-29T11:00:00-03:00', 'y', { nota: 73 }),
    palmeira: v(1012, 'E.E. Palmeira', 'Projeto Épsilon', '2026-09-27T15:20:00-03:00', 'r', { nota: 47, pontos: 2 }),
    buriti: v(1013, 'CMEI Buriti', 'Projeto Delta', '2026-10-01T10:00:00-03:00', 'g', { nota: 90 })
  };
  const L = lista;
  // pacote A: Alfa + Gama + Delta
  const tA = await pacote('pacote_tecnico_A.zip', [L.aurora, L.ipeNovo, L.ipeMeio, L.ipeVelho, L.girassol, L.sabia, L.buriti], A, 'pacote-a-0001');
  // pacote B: Beta + Épsilon + repete 2 vistorias do A (duplicadas) + uma do A reeditada (atualizadoEm maior)
  const girassolEditado = JSON.parse(JSON.stringify(L.girassol));
  girassolEditado.identificacao.atualizadoEm = girassolEditado.identificacao.atualizadoEm + 86400e3;
  girassolEditado.calculado.nota = 91; girassolEditado.calculado.status = 'APROVADA';
  const tB = await pacote('pacote_tecnico_B.zip', [L.horizonteNovo, L.horizonteVelho, L.boaVistaNovo, L.boaVistaVelho, L.palmeira, L.aurora, L.ipeNovo, girassolEditado], B, 'pacote-b-0001');

  // Planilha antiga (formato do app anterior à v25): sem uuid, sem projeto, sem upload, sem dBm
  const cab = 'ID_Vistoria;Escola;Tecnico;Email_Tecnico;Data_Vistoria;Qtd_Salas;Qtd_Alunos;Qtd_Professores;Possui_Chromebooks;Qtd_Chromebooks;Possui_Desktops;Qtd_Desktops;Possui_Projetores;Qtd_Projetores;Links_Internet;Possui_Rede_Fisica;Switch_WiFi;Gateway_WiFi;Espectro;Densidade_APs;Nota_Professor;M1_Mbps;M1_Ping;M1_Jitter;M1_SSID;M1_Manual;M2_Mbps;M2_Ping;M2_Jitter;M2_SSID;M2_Manual;M3_Mbps;M3_Ping;M3_Jitter;M3_SSID;M3_Manual;Zona_de_Sombra;Salas_Sem_Sinal;Capacidade_Estimada;Score_WiFi;Status_WiFi;Possui_Impeditivo;Obs_Impeditivo;Possui_Dificuldade;Obs_Dificuldade;Switch_RedeFisica_Legado;Cabo_RedeFisica_Legado;Gateway_RedeFisica_Legado;Score_RedeFisica;Status_RedeFisica;RedeFisica1_NomeLocal;RedeFisica1_SO;RedeFisica1_Switch;RedeFisica1_Cabeamento;RedeFisica1_Mbps;RedeFisica1_Ping;Resumo_Medicoes_Detalhadas;Velocidade_media;Nivel_digital;Velocidade_RedeFisica_Mbps;Media_Latencia_wifi;Qtd_usuarios;Score_Geral';
  const q = (s) => `"${s}"`;
  const linha = (id, escola, data, mbps, ping, nota, sw, status, rede) => [
    `#${id}`, q(escola), q('Técnico C'), q('tecnico.c@exemplo.com'), q(data), '12', '300', '24', 'Sim', '80', 'Sim', '20', 'Nao', '0', q('Operadora Y: 100 Mbps'),
    rede ? 'Sim' : 'Nao', q(sw), q('Modem da Operadora'), q('Apenas 2.4GHz'), q('Corredor / Distante'), q('Nota 4 a 7'),
    String(mbps).replace('.', ','), String(ping).replace('.', ','), '4,0', q('REDE_ESCOLA'), 'Nao', String(mbps * 1.1).replace('.', ','), String(ping).replace('.', ','), '5,0', q('REDE_ESCOLA'), 'Nao',
    String(mbps * 0.9).replace('.', ','), String(ping).replace('.', ','), '6,0', q('REDE_ESCOLA'), 'Nao', 'Nao', q(''), q('Média'), String(nota).replace('.', ','), q(status), 'Nao', q(''), 'Nao', q(''),
    q(sw), q('Cat5e'), q(''), '50,0', q('COM_RESSALVA'), rede ? q('Laboratório') : '', rede ? q('Windows 10') : '', rede ? q(sw) : '', rede ? q('Cat5e') : '', rede ? '88,4' : '', rede ? '31,0' : '', q(''), String(mbps).replace('.', ','), '2', '88,4', String(ping).replace('.', ','), '30', String(nota).replace('.', ',')
  ].join(';');
  const csv = '﻿' + cab + '\n' + [
    linha('0017', 'E.M. Pinheiral', '14/03/2025 10:00', 69, 31, 58.0, 'Fast 10/100', 'COM_RESSALVA', true),
    linha('0016', 'CMEI Araçá', '12/03/2025 15:30', 49.3, 40, 52.0, 'Fast 10/100', 'COM_RESSALVA', true),
    linha('0015', 'E.M. Jacarandá', '11/03/2025 09:00', 8.1, 88, 35.0, 'Fast 10/100', 'REPROVADO', false),
    // mesma escola do pacote B, em data anterior: vira histórico
    linha('0009', 'E.M. Boa Vista', '10/03/2025 08:00', 6.2, 92, 30.0, 'Fast 10/100', 'REPROVADO', true)
  ].join('\n') + '\n';
  fs.writeFileSync(path.join(saida, 'planilha_antiga.csv'), csv, 'utf8');
  console.log('Pacote A:', (tA / 1024).toFixed(0), 'KB | Pacote B:', (tB / 1024).toFixed(0), 'KB | planilha_antiga.csv');
  console.log('Pasta:', saida);
})();
