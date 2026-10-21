# Regras e testes do Painel de Vistorias

Este arquivo manda. Toda modificação do painel passa por ele, do pedido à entrega.
Quem for mexer no projeto lê este arquivo antes de escrever a primeira linha.

---

## 1. Regra de ouro da modificação

**Mexer só no ponto pedido, e provar que o resto continua igual.**

1. Entender exatamente o que foi pedido e escrever em uma linha o que vai mudar na tela.
2. Mudar só isso. Não melhorar texto vizinho, não reordenar card, não trocar cor que ninguém pediu, não renomear função por gosto.
3. Rodar a bateria de testes (seção 4) antes de entregar. Isso é o backteste.
4. Comparar a tela com a versão anterior, com dado real, e conferir que só o ponto pedido mudou.
5. Entregar com a versão subindo e dizer, em uma linha, o que mudou.

Se durante a implementação aparecer algo errado fora do ponto pedido, **não corrigir junto**. Avisar e perguntar.

### Mockup
Tela nova só depois de mockup aprovado. Aprovado o mockup, copiar fielmente: layout, textos, ordem.
Não inventar desenho nem estrutura durante a implementação. Mudança de posição depois do aprovado é novo pedido.

---

## 1b. Versão e Git

**A versão sobe 1 a cada entrega.** A partir da 1.5.0: 1.5.1, 1.5.2, 1.5.3 e assim por diante.
O segundo número só muda quando o Fábio disser.

A versão aparece em dois lugares e os dois mudam juntos:
- `package.json`, campo `version`
- `public/assets/js/views.js`, constante `VERSAO` (é o que aparece no canto da tela)

**Git.** O projeto é um repositório Git. Cada entrega é um commit com a versão no título, mais uma tag `vX.Y.Z`:

```bash
git add -A
git commit -m "1.5.1: <o que mudou em uma linha>"
git tag -a v1.5.1 -m "versao 1.5.1"
git push origin main --tags
```

Ficam fora do versionamento (`.gitignore`): `node_modules/`, `dist/` e os `.zip`. O `dist/painel-vistorias.html` é gerado pelo build, não se guarda no repositório.

Para voltar atrás: `git log --oneline` acha a entrega, `git diff vX.Y.Z` mostra o que mudou desde ela, `git checkout vX.Y.Z` recupera a versão inteira.

**Como sair uma versão.** O ambiente onde o código é feito não consegue enviar ao GitHub, então a entrega chega pronta num zip e o envio sai do computador do Fábio:

1. Pedido em uma linha, plano e aprovação. Tela nova: mockup aprovado antes.
2. Código, bateria da seção 4, versão subida, `CHANGELOG.md`, commit e tag.
3. Entrega em `OneDrive - ARLEQUIM\Meus Projetos`: `painel-vistorias-vX.Y.Z.html`, `arlequim-painel-vistorias-vX.Y.Z.zip` e `repo-painel-vX.Y.Z-para-push.zip`. O endereço fixo é regravado.
4. Envio ao GitHub, no PowerShell, **numa linha só** (colar em várias linhas faz a primeira se perder):

```powershell
cd "$env:USERPROFILE\OneDrive - ARLEQUIM\Meus Projetos"; Expand-Archive ".\repo-painel-vX.Y.Z-para-push.zip" -DestinationPath ".\push-X.Y.Z" -Force; cd ".\push-X.Y.Z\arlequim-painel-vistorias"; git log --oneline -1; git push origin main --tags
```

5. O `git log` mostra o commit da versão antes do push. Depois, conferir no GitHub que a tag `vX.Y.Z` chegou.

**Endereço fixo.** O painel em uso fica sempre em um único arquivo, no mesmo lugar:
`OneDrive - ARLEQUIM\Meus Projetos\Painel de Vistorias (atual)\painel-vistorias.html`.
A cada entrega, o `dist/painel-vistorias.html` novo é gravado por cima desse arquivo. O Fábio abre pelo favorito do navegador e dá F5; o número no canto da tela confirma a versão. Os `.zip` e `.html` versionados continuam sendo gerados para histórico.

---

## 2. Regras pétreas do painel

1. **O painel só lê.** Não apaga, não corrige, não grava nada na vistoria carregada.
2. **O painel não calcula nota nem faixa.** Nota, nota Wi-Fi, nota da rede física e status vêm do `calculado` do app. A faixa vem do status do app. Única exceção, já existente: planilha antiga `.csv` sem a coluna `Score_Geral_Unificado`, onde o painel reproduz a mesma regra do app para não perder o histórico.
3. **Arquivos protegidos:** `normalizar.js`, `dados.js`, `regras.js`, `pasta.js` e `scripts/compilar-antigos.js`. Não mudam sem decisão do Fábio. Se mudarem com autorização, atualizar `docs/protegidos.sha256` na mesma entrega, com a justificativa escrita.

   Mudanças autorizadas:
   - **1.5.7 (21/10/2026):** `normalizar.js` passa a ler os campos do app 1.2.0 (rede por ponto, jitter da rede cabeada, desconto e edição do teste de carga, data do pacote). `dados.js` guarda a nota anterior do mesmo uuid na série da escola. Leitura das vistorias antigas sem mudança nos campos que já existiam.
4. **O histórico não se perde.** Medição antiga continua na série da escola.
5. **O que falta continua faltando.** Campo ausente aparece como "Não registrado". Nunca vira zero, nunca entra em média.
6. **Funciona offline.** Arquivo único, JavaScript puro, sem servidor, sem chamada externa. "Exportar painel em HTML" e "Exportar escola em HTML" continuam funcionando.
7. **Anexo não some.** Tudo que o `vistoria.json` lista em `espectro`, `fotos` e `arquivos.pdf` tem que aparecer no painel e sobreviver à exportação.
8. **O teste de carga desconta, mas não pelo painel.** A partir do app 1.2.0, Regular e Ruim descontam da nota Wi-Fi. A nota já chega com o desconto em `calculado`, e o painel nunca soma nem subtrai. A rede por ponto (TX negociada, canal, redes no canal, DNS e TCP/443 até o VDI) e o assessment são informativos: não entram na nota, na faixa nem nas contagens.
9. **Mesmo uuid, nota diferente.** Vale a versão editada por último (empate: a do pacote gerado por último). A outra não some: fica na série da escola como medição anterior.

---

## 3. Vocabulário na tela

| Faixa | Nome na tela |
|---|---|
| nota 80 ou mais | Apta |
| apta, mas Wi-Fi e rede física medidos e uma das duas com ressalva | Apta com ressalva (pílula e nota em degradê verde e âmbar) |
| 51 a 79 | Com ajustes |
| 50 ou menos | Severas restrições |
| sem nota | Sem nota |

No painel, "Apta com ressalva" é uma categoria própria da Prontidão para VDI, com filtro e contagem separada. Ela não sai do total de aptas: a escola é apta, a ressalva é um aviso.

Regra do "Apta com ressalva": só quando a escola tem as duas notas, o app dá o geral como aprovado e uma das duas partes veio com ressalva. Se o app diz ressalva no geral, continua "Com ajustes". Se uma das partes veio reprovada, não é ressalva.

**Os nomes moram num lugar só:** o dicionário `FAIXAS`, no topo do `gestao.js` (singular, plural e como cabe numa frase). Para renomear uma faixa, troca-se só ali. Nenhuma tela escreve "Apta", "Aptas", "Com ajustes" ou "Severas restrições" por conta própria: o teste "nomes das faixas só são escritos no dicionário" falha se alguém fizer isso, e o teste "trocar o nome de uma faixa muda o painel inteiro" renomeia tudo e confere todas as telas. A tela antiga (`#classico`) usa os termos do app (aprovadas, com ressalva, reprovadas) e fica fora.

---

## 4. Bateria obrigatória a cada modificação

Rodar nesta ordem. Falhou, não entrega.

```bash
npm test                                   # 1. testes automáticos
sha256sum -c docs/protegidos.sha256        # 2. arquivos protegidos intactos
node scripts/build-single.js               # 3. arquivo único reconstruído
```

4. **Abrir com dado real.** Carregar os pacotes de Nova Lima e o pacote mais recente do app. Conferir, sem erro no console:
   - Visão executiva, Escolas, Melhorias e Histórico abrem.
   - Uma ficha abre, e todas as abas do detalhe abrem: Resumo, Pontos Wi-Fi, Rede cabeada, Topologia, Sugestões, Histórico, Espectro, Fotos, PDF.
   - Os prints de espectro aparecem na aba Espectro, na mesma quantidade do `vistoria.json`.
   - As fotos aparecem, inclusive as listas de evidências de switch, fibra e antenas.
   - O PDF abre.
   - Nenhum número virou zero onde antes dizia "Não registrado".
5. **Exportar e reabrir.** "Exportar painel em HTML", abrir o arquivo gerado e conferir que espectro, fotos e PDF continuam lá.
6. **Comparar com a versão anterior**, lado a lado, nas telas que o pedido tocou.
7. **Leitura do legado igual.** Carregar o legado real (`pacote_Nova_Lima_antigos_v4.zip`) e a amostra, nas duas versões, e conferir que as vistorias lidas, escolas, notas, faixas e datas saem idênticas. Mudança que não mexe em leitura não pode mudar uma linha.

---

## 5. O que os testes automáticos cobrem

`tests/painel.test.js`
- Leitura de pacote `.zip`, planilha antiga `.csv` e HTML exportado.
- Deduplicação por uuid e data de atualização.
- **Anexos:** todo item de `espectro` e toda foto listada existe no zip, e a aba Espectro lista todos. Vale também para nome com espaço, parêntese e ponto.
- Campo ausente continua "Não registrado" e fica fora das médias.
- Topologia: link escrito com Gb, Giga ou Gbps vale n x 1000 Mbps.

`tests/gestao.test.js`
- Arquivos protegidos iguais ao registro.
- O painel não altera o objeto da vistoria nem chama gravação.
- Faixas, rótulos e textos das telas de gestão.
- Apta com ressalva: só no caso certo.
- Severas restrições: o rótulo antigo não sobrou em nenhuma tela.
- Teste de carga: lê o campo, mostra na aba Pontos Wi-Fi, e o painel não altera a nota que veio do app.
- App 1.2.0: rede por ponto dentro do cartão (ao passar o mouse, cada linha só com dado), jitter da cabeada (0 continua "Não registrado"), "(editado)" no teste de carga, sem texto de apoio e sem linha de desconto.
- Mesmo uuid com nota diferente: a anterior fica na série, recarregar não duplica, e o anexo que faltar no pacote dela vem da outra versão.
- Melhorias: "Teste de carga Regular ou Ruim" conta só escolas com teste e nunca vira o maior ofensor da visão executiva.
- Assessment carregado fica de fora com aviso, até a aba Workload Assessment.
- A mesma escola tem a mesma classificação em todas as telas.
- Nomes das faixas: só no dicionário, e renomear muda todas as telas.
- Código limpo: sem `console.log`, `debugger`, TODO, e sem classe CSS órfã.

`tests/painel.test.js`, publicação
- `index.html` só carrega arquivos do próprio site, todos existentes, sem script inline executável.
- `vercel.json` serve `public/` sem build, com os cabeçalhos de segurança.
- O painel nunca envia dado: só três leituras conhecidas (anexo embutido e os próprios arquivos ao exportar), sem XHR, beacon ou socket.

---

## 6. Antes de dizer "pronto"

- [ ] Só o ponto pedido mudou.
- [ ] `npm test` verde.
- [ ] `sha256sum -c docs/protegidos.sha256` sem diferença, ou mudança autorizada e registrada.
- [ ] Conferido com dado real, incluindo espectro, fotos e PDF.
- [ ] Versão subiu 1 em `package.json` e em `VERSAO` no `views.js`.
- [ ] Commit e tag `vX.Y.Z` feitos.
- [ ] `CHANGELOG.md` com a linha do que mudou.
- [ ] Painel gravado no endereço fixo; aberto, F5, e a versão no canto subiu.
- [ ] Entrega: o `.html` único e o `.zip` do projeto.
- [ ] Mexeu em `vercel.json` ou `index.html`: `npm run serve`, abrir `http://localhost:8080` com dado real e conferir console limpo. Roteiro em `docs/publicar.md`.
- [ ] Mudou tela: imagens de `docs/telas/` refeitas com os dados fictícios da `amostra/`, nunca com escola real.
