# Plano de ação e desenvolvimento: painel de rede em versão gestão

Base: mockup "Painel de Vistorias, versão gestão" (tela de todos os projetos, projeto com abas, ficha da escola com Detalhar).
Código de partida: painel 1.0.0, 20 testes verdes.

## 1. Regras pétreas (valem até o fim)

1. O painel só lê. Nada que ele faça pode apagar, reescrever ou "corrigir" uma vistoria já carregada.
2. A leitura dos dados fica intocada: `normalizar.js` (formato do pacote, planilha antiga, notas), `dados.js` (duplicidade, histórico, agrupamento por escola), `regras.js` (réguas e sugestões do app), `pasta.js` (leitura da pasta) e `compilar-antigos.js`.
3. Histórico não se perde. Medição antiga continua na série da escola. A tela nova só escolhe o que mostrar, nunca o que guardar.
4. Dado que falta continua faltando. Campo que a vistoria antiga não tem aparece como "Não registrado", nunca vira zero e não entra em média, soma ou causa.
5. A nota é a do app (`calculado.nota`, que é a nota geral unificada). O painel não recalcula nota nem muda faixa.
6. Melhoria nova nunca exige mudar a lógica do app. Se uma tela nova precisar de um dado que não existe, a tela mostra "Não registrado" e o pedido vai para a lista de pendências do app (seção 9).
7. O arquivo de apresentação (Exportar painel em HTML) e o modo offline continuam funcionando como hoje.

Como isso é garantido, e não só prometido:

- **Trava de arquivos protegidos.** `docs/protegidos.sha256` guarda a impressão digital dos arquivos da regra 2. O teste `integridade` falha se qualquer um mudar. Mudar de propósito exige atualizar o arquivo na mesma entrega, com justificativa.
- **Camada nova só de leitura.** Toda conta nova fica em `gestao.js`, que recebe as escolas e devolve números. Um teste congela (`Object.freeze` profundo) todas as vistorias antes de rodar a camada: se ela tentar alterar algo, o teste quebra. Outro teste compara o banco inteiro antes e depois.
- **Teste com dado faltando.** Fixture com planilha antiga (sem aluno, sem switch, sem upload, sem dBm), pacote novo completo e escola mista. Toda conta tem de sair sem erro e sem zero inventado.
- **Volta fácil.** A tela clássica continua no código. Abrir o painel com `#classico` no endereço mostra a versão 1.0 sem tocar em nada.

## 2. O que muda e o que não muda

| Peça | Situação |
| --- | --- |
| `normalizar.js`, `dados.js`, `regras.js`, `pasta.js`, `compilar-antigos.js` | Não mudam (protegidos) |
| `views.js` | Só acréscimo: exporta o Detalhar atual e usa os nomes Pronta, Com ajustes e Bloqueada nas faixas |
| `app.js` | Acréscimo: novas telas e ações. Leitura de arquivos, pasta, exportação e ações existentes ficam como estão |
| `gestao.js` (novo) | Contas da visão gestão, sem efeito colateral |
| `views-gestao.js` (novo) | Tela de todos os projetos, projeto com abas e ficha da escola |
| `painel.css` | Só acréscimo, com prefixo `g-` |
| `index.html` | Dois scripts novos |
| Detalhar (Resumo, Pontos Wi-Fi, Rede cabeada, Topologia, Sugestões, Histórico, Espectro, Fotos, PDF) | Reaproveitado sem reescrever, dentro da ficha |

## 3. Do mockup para o painel

**Todos os projetos.** Uma visão só, sem separar por tipo de rede. Resumo escrito, barra de prontidão (Pronta 80 ou mais, Com ajustes 51 a 79, Bloqueada 50 ou menos), indicadores (projetos, escolas medidas, alunos em escolas bloqueadas, nota média, escolas com rede física), e os 3 projetos que mais pedem atenção, com botão para ver todos.

**Projeto, com abas.** Visão executiva, Escolas, Causas, Histórico (a aba Plano de ação foi retirada na 1.1.3). Toda lista mostra de 3 a 5 itens com "ver todos". Na aba Escolas, filtros de tipo de rede embaixo do título: todas, só Wi-Fi, híbridas (Wi-Fi e rede física) e só rede física, além do filtro por faixa.

**Ficha da escola.** Nota e faixa, situação (rede medida, rede física), bloco Wi-Fi, bloco rede física quando existe, causas e ações da escola, e o cartão "Medições por ambiente" com o botão **Detalhar**, que abre as abas originais da vistoria.

## 4. Dados derivados (tudo calculado na hora, nada gravado)

- **Tipo de rede da escola**, pela medição mais recente: híbrida (Wi-Fi e rede física medidos), só Wi-Fi, só rede física, sem medição.
- **Faixa**: a que já vem em `calculado.faixa`. Sem nota (ex.: SEMED) fica fora da prontidão e das médias.
- **Alunos**: `censo.alunos` quando registrado. Escola sem esse dado fica fora das somas de alunos, nunca conta como zero.
- **Causas** (8, as do mockup), cada uma com teste sobre campos reais: gateway é modem da operadora, nota 5 ou menos dos professores, latência acima de 50 ms, APs no corredor, download médio abaixo de 25 Mbps, switch 10/100 ou não identificado, impeditivo registrado, Wi-Fi só em 2,4 GHz. Campo ausente não conta como causa.
- **Plano de ação**: uma ação por causa, na ordem de quantas escolas alcança. Responsável e prazo aparecem como "[Definir]". Nesta entrega o plano é só leitura (seção 9).
- **Prioridade de intervenção**: escolas abaixo de 80 ordenadas por alunos vezes distância até 100.
- **Rodadas e histórico**: medições de um projeto agrupadas por proximidade de data (corte de 21 dias sem medição). Nota média por rodada. "Evolução desde a última rodada" só aparece com 2 ou mais medições da mesma escola.

## 5. Fases e critérios de aceite

**Fase 0, rede de segurança.** Cópia de base do painel 1.0, travas de integridade, fixture com dado faltando. Aceite: 20 testes antigos verdes e testes de integridade verdes antes de qualquer tela.

**Fase 1, camada `gestao.js`.** Todas as contas da seção 4 com testes. Aceite: contas conferidas em teste com dados de amostra e sintéticos, e nenhum erro com dado faltando. Conferência com o pacote real de Nova Lima (5 prontas, 11 com ajustes, 9 bloqueadas, nota média 62) fica para quando o pacote v3 estiver na pasta do OneDrive.

**Fase 2, telas.** Todos os projetos, projeto com abas, ficha com Detalhar. Aceite: cada lista com no máximo 5 itens e "ver todos"; filtros de tipo de rede somam o total; Detalhar abre as 8 abas e os cartões expandem como na versão original.

**Fase 3, integração.** Roteamento no `app.js`, CSS, `index.html`, rótulos. Aceite: carregar pasta, arrastar arquivo, exportar HTML e abrir o HTML exportado funcionam; `#classico` abre a tela antiga.

**Fase 4, conferência em navegador.** Painel aberto com os dados de amostra em Chromium, percorrendo home, projeto, abas, ficha, Detalhar e HTML exportado, com capturas. Aceite: sem erro no console, nenhum "undefined" ou "NaN" na tela, nenhum travessão.

**Fase 5, entrega.** `npm run build`, README e versão 1.1.0, registro das regras (`docs/regras-petreas.md`). Aceite: `dist/painel-vistorias.html` abre com dois cliques.

## 6. Testes novos

- Integridade: arquivos protegidos iguais ao registro; `gestao.js` e `views-gestao.js` não chamam `adicionar`, `limpar` nem alteram objetos recebidos.
- Imutabilidade: camada gestão rodando sobre vistorias congeladas.
- Antes e depois: banco idêntico após calcular tudo, e após carregar o mesmo pacote de novo.
- Dado faltando: planilha antiga sozinha, pacote novo sozinho, os dois juntos.
- Contas: tipo de rede, causas, prioridade, rodadas, evolução, soma de alunos sem dado.
- Telas: HTML gerado sem "undefined", "NaN" ou travessão; listas com no máximo 5 itens fechadas.

## 7. Riscos e como tratamos

- **Escola sem aluno registrado distorce a soma.** Fica fora da soma e a ficha dela mostra "Não registrado".
- **Projeto vazio nas planilhas antigas.** Continua agrupado como "Sem projeto" (comportamento atual). Para Nova Lima o compilador já grava o projeto.
- **Nome Pronta/Bloqueada diferente do app (Aprovada/Reprovada).** Só o texto muda na tela. A régua é a mesma.
- **Arquivo exportado antigo.** O HTML exportado pela versão 1.0 continua abrindo, porque o formato dos dados embutidos não muda.

## 8. Rollback

A cópia de base fica em `baseline/` fora da pasta de entrega. Dentro do painel, `#classico` volta à tela 1.0. Como os arquivos de leitura não mudam, voltar nunca perde dado.

## 9. Fica para depois (não entra nesta entrega)

- Responsável, prazo e situação das ações do plano gravados. Exige um lugar para escrever, e o painel hoje só lê. Proposta: arquivo `plano.json` exportado e importado, sem gravar na pasta do OneDrive.
- Metas de prontidão e de nota (hoje aparecem como "Meta: [definir]").
- Dado de rede física por escola ainda pouco medido: depende de os técnicos medirem o laboratório no app.
- Confirmar se #0005 e #0006, e #0017 e #0018, são a mesma escola (afeta contagem).

## 10. Situação da entrega (versão 1.1.5)

Fases 0 a 5 feitas. 47 testes verdes. Painel aberto em Chromium com dados de amostra, sem erro no console, percorrendo home, abas do projeto, filtros de tipo de rede, ficha, Detalhar com as 9 abas e `#classico`.

### Fidelidade ao mockup (correção da 1.1.1)

A versão 1.1.0 saiu com telas que seguiam a ideia do mockup, mas não o desenho. A 1.1.1 refaz as telas copiando o mockup aprovado: faixa roxa no topo com título, botão "Todos os projetos", "Resumo para diretoria", "Dados" e as abas dentro da faixa; tabela de Escolas com cabeçalho em caixa alta, nomes em Nome Próprio, botão "Abrir" e filtros em pílula; cartões, números e textos no mesmo tamanho e ordem. A ficha da escola ficou em uma coluna só, sem barra lateral: nota e diagnóstico, Wi-Fi e rede física (quando as duas existem), Medições por ambiente com Detalhar, Causas identificadas, Plano de ação, Situação, Evolução da nota, Arquivos e Vistoria, nessa ordem, de cima para baixo. A fonte do mockup (Manrope) vai embutida no arquivo, então o painel continua funcionando sem internet.

Regra daqui para frente: tela nova só entra depois de aprovada em mockup, e a programação copia o mockup, sem inventar desenho.

Dado que o mockup trata de forma própria e o painel agora também: ponto de Wi-Fi com 0 Mbps é "sem rede na visita", não entra em média, latência nem causa.

### Ajustes da 1.1.2

Todos os projetos sem o botão "Copiar texto" (o resumo fica). Na visão do projeto, escolas de referência e "Como a nota geral é formada" sobem para cima de Prioridade de intervenção. Na aba Escolas, gráfico de barras de prontidão e de tipo de rede: passar o mouse mostra os números, clicar filtra a lista abaixo (os dois filtros se combinam, clicar de novo limpa). A ficha da escola tem o botão "Voltar" na faixa roxa e volta para a aba de onde veio, na posição da escola.

### Ajuste da 1.1.3

A aba "Plano de ação" saiu do projeto. As abas ficam Visão executiva, Escolas, Causas e Histórico. As ações sugeridas continuam na aba Causas (coluna Ação sugerida) e no Plano de ação de cada ficha de escola.

### Ajustes da 1.1.4

O botão "Copiar texto" saiu também do resumo executivo do projeto (ficam "Resumo para diretoria" na faixa e "Copiar resumo" na ficha). Na ficha, o Detalhar deixou de ser botão: as nove abas (Resumo, Pontos Wi-Fi, Rede cabeada, Topologia, Sugestões, Histórico, Espectro, Fotos, PDF e arquivos) ficam sempre abertas dentro de "Medições por ambiente".

Exportadores em HTML por escopo: "Exportar projeto em HTML" na faixa do projeto e "Exportar escola em HTML" na faixa da ficha. Cada um gera um arquivo único só com as vistorias daquele projeto (ou daquela escola, com o histórico dela), com as mesmas opções de PDF, fotos, espectros e técnico. Quem recebe abre com dois cliques e o arquivo já abre na tela do projeto ou da escola. O "Exportar painel em HTML" do menu Dados continua exportando tudo. O arquivo exportado só lê: não altera nem apaga nada no painel de origem.

### Ajuste da 1.1.5

Access point com qualidade "Regular" aparece em cinza esverdeado (borda #7E9486, fundo #ECF0ED, texto #3A4D41) na aba Topologia, no ponto de "Densidade de APs" do Resumo e na imagem exportada da topologia. Os demais itens Regular continuam amarelos. Nenhuma regra de nota ou faixa mudou, e os arquivos protegidos ficaram intactos. 48 testes verdes.

A 1.1.5 também mostra o número da versão, em letra pequena e discreta, no canto superior direito da faixa roxa de todas as telas (e ao lado do título quando ainda não há dados). O número vem de uma única constante (`VERSAO` em `views.js`) e um teste confere que ela bate com o `package.json`. 49 testes verdes.

## Ajustes da 1.1.6

- Saiu o botão "Resumo para diretoria" da faixa (home e projeto). A ação interna de copiar texto continua no código, sem botão.
- Topologia: link escrito com Gb, Giga ou Gbps (ex.: "10 Giga") vale n x 1000 Mbps e fica verde. Só a topologia muda; a regra de risco da ficha (regras.js, protegido) segue lendo o número gravado pelo app.
- 50 testes verdes, hashes dos arquivos protegidos conferidos.

## Visão executiva da 1.2.0 (mockup aprovado)

- Resumo executivo em tom positivo (aptas primeiro), sem a observação sobre escola fora da conta.
- "Pronta" virou "Apta" nas telas de gestão (régua do app inalterada: 80 ou mais).
- Fileira de indicadores com 4 cartões; "Evolução desde a última medição" saiu dela.
- "O que mais pesa" saiu da Visão executiva (continua na aba Causas). No lugar, o quadrante "Histórico do projeto": melhoraram/pioraram, medições, curva das escolas aptas (começa ao fim da 1ª rodada) e o maior ofensor das sugestões de melhoria.
- Maior ofensor: entre as sugestões do app (regras.js, só leitura), a que atinge a maior proporção das escolas com o dado registrado, desempate por volume. Link escrito em Gb/Giga vale n x 1000 Mbps.
- "Resultado da leitura" aparece só na aba Histórico, que não mudou.
- Pendente (precisa de mockup antes): aba Sugestões, ficha da escola sem plano de ação e com as vistorias mais recentes primeiro.
- 52 testes verdes, hashes dos arquivos protegidos conferidos.

## Melhorias da 1.2.1
A aba Causas virou Melhorias: soma por tipo as sugestões do motor do app (regras.js, só leitura), com contagem sobre as escolas com o dado registrado, por que importa e ação sugerida. Clicar no tipo filtra a lista de escolas; clicar na escola abre a ficha, com volta para Melhorias. Pendente: ficha sem Plano de ação e com as últimas vistorias primeiro.

## Teste de carga da 1.3.0
Bloco "Teste de carga" no fim da aba "Pontos Wi-Fi" do detalhe da vistoria (1.3.1; na 1.3.0 era um card da ficha), mostrando só o teste da vistoria exibida (a mais recente por padrão). Sem teste: "Não registrado". Informativo: não entra na nota nem na faixa, e o resultado (Bom, Regular, Ruim) vem pronto do app. Nada entra na visão executiva. O Plano de ação saiu da ficha.
Mudança em arquivo protegido, com justificativa: `normalizar.js` ganhou a função `lerTesteCarga` e a chave `testeCarga` no objeto da vistoria. É só leitura do campo, sem tocar em nenhuma regra, e `docs/protegidos.sha256` foi atualizado na mesma entrega. As outras vistorias, sem o campo, ficam com `testeCarga: null`.

## 1.4.0
- "Bloqueada" virou "Severas restrições" em todas as telas de gestão e no detalhe clássico.
- Escola com Wi-Fi e rede física medidos, aprovada no geral pelo app e com uma das duas partes em ressalva aparece como "Apta, com ressalva": pílula com ponto meio verde meio âmbar e a nota com o mesmo degradê. Nada muda na contagem: ela segue contando como apta, porque o veredito do app é aprovado.
- `docs/REGRAS-E-TESTES.md`: regras do projeto e bateria obrigatória a cada modificação.
- Testes novos de anexos: todo espectro e toda foto listada no `vistoria.json` existe no zip e aparece na tela, inclusive com nome fora do padrão.

## 1.5.0
- "Apta com ressalva" virou categoria própria da Prontidão para VDI, com cor em degradê, filtro e contagem separada das aptas puras. O total de aptas não muda: `p = pp + pr`.
- O mesmo conceito visual (pílula com ponto meio verde meio âmbar) aparece em toda tela onde a escola apta com ressalva é mostrada: visão executiva, lista de escolas, melhorias, prioridade e ficha.
- Ficha: saíram "Responsável" e "Próxima revistoria" do card Situação.
- Projeto virou repositório Git, com tag por entrega. A versão sobe 1 a cada entrega a partir da 1.5.0.

## 1.5.1
- Endereço fixo do painel: `Meus Projetos\Painel de Vistorias (atual)\painel-vistorias.html`, regravado a cada entrega. Abrir pelo favorito e dar F5. Nenhuma tela mudou.
