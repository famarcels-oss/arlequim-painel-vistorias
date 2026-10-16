# Regras pétreas do painel

Valem para qualquer mudança futura, em qualquer tela.

1. O painel só lê. Nada nele apaga, reescreve ou corrige uma vistoria carregada.
2. Estes arquivos não mudam sem decisão explícita: `normalizar.js`, `dados.js`, `regras.js`, `pasta.js`, `scripts/compilar-antigos.js`. A impressão digital deles está em `docs/protegidos.sha256` e o teste "arquivos protegidos" falha se mudarem. Mudança de propósito: atualizar o arquivo na mesma entrega, com a justificativa no commit.
3. Histórico não se perde. Medição antiga fica na série da escola.
4. Dado que falta continua faltando: aparece como "Não registrado", nunca vira zero e não entra em média, soma ou causa.
5. A nota e a faixa são as do app. O painel não recalcula nota.
6. Tela nova não pode exigir mudança na lógica do app. Se faltar dado, mostra "Não registrado" e o pedido vai para o app.
7. Exportar painel em HTML e o modo offline continuam funcionando.

Onde fica cada coisa:

- Contas da visão gestão: `gestao.js` (só leitura, sem efeito colateral).
- Telas da visão gestão: `views-gestao.js`. O Detalhar vem de `views.js`, sem reescrita.
- Tela anterior: abrir o painel com `#classico` no endereço.
- Testes de proteção: `tests/gestao.test.js` (arquivos protegidos, camada sem escrita, vistorias congeladas, banco igual antes e depois, telas sem lixo com dado faltando).
