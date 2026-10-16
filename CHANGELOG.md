# Novidades

Cada entrega sobe um número e vira uma tag no GitHub (`v1.5.6`, `v1.5.5`...).
Para ver o código de qualquer versão: `git checkout vX.Y.Z`.

## 1.5.6
- Documentação de produto: README novo, imagens de todas as telas (com dados fictícios), este histórico de versões e o passo a passo para sair uma versão.
- Documentos reorganizados: regras dos dados num arquivo só, com os nomes atuais das faixas.

## 1.5.5
- Pronto para publicar na web, sem publicar: novos cabeçalhos de segurança (câmera, microfone e localização desligados; aba isolada), licença da fonte Manrope e roteiro em `docs/publicar.md`.
- Testes de publicação: o painel só carrega arquivos próprios e nunca envia dado.

## 1.5.4
- Limpeza: código e estilos sem uso removidos. Pasta `dist/` e pacotes reais fora do repositório.
- Nomes das faixas num lugar só. Trocar um nome muda o painel inteiro, e há teste para isso.
- Telas idênticas à 1.5.3, pixel a pixel. Leitura das vistorias antigas idêntica, byte a byte.

## 1.5.3
- Escolas e Melhorias: escola apta com ressalva mostra a pílula em degradê, como nas demais telas.
- Teste: a mesma escola tem a mesma classificação em todas as telas.

## 1.5.2
- Escolas: os 12 botões de filtro viraram 3 seletores (Situação, Tipo de rede, Ordenar por). Abre pela vistoria mais recente.

## 1.5.1
- Endereço fixo: o painel em uso fica sempre no mesmo arquivo. Abrir pelo favorito e dar F5.

## 1.5.0
- "Apta com ressalva" virou categoria própria da Prontidão para VDI, com cor, filtro e contagem.
- Ficha da escola sem "Responsável" e "Próxima revistoria".
- Projeto passa a ser versionado no Git, com uma tag por entrega.

## 1.4.0
- "Bloqueada" virou "Severas restrições" em todas as telas.
- Escola apta com uma das redes em ressalva aparece como "Apta, com ressalva".
- Regras e bateria de testes obrigatória em `docs/REGRAS-E-TESTES.md`. Teste de que todo anexo do pacote aparece na tela.

## 1.3.0 e 1.3.1
- Teste de carga na aba Pontos Wi-Fi do detalhe. Informativo: não entra na nota.
- Plano de ação saiu da ficha.

## 1.2.0 a 1.2.3
- Visão executiva nova: resumo em tom positivo, "Pronta" virou "Apta", histórico do projeto com a curva de escolas aptas e o maior ofensor.
- A aba Causas virou Melhorias, com as sugestões do app agrupadas por tipo.
- 1.2.2 e 1.2.3: ajustes finos de tela, sem registro detalhado.

## 1.1.0 a 1.1.6
- Visão de gestão: todos os projetos, projeto com abas (Visão executiva, Escolas, Melhorias, Histórico) e ficha da escola, copiando o mockup aprovado.
- Exportar projeto ou escola em HTML, num arquivo único que abre offline.
- Número da versão discreto no canto da tela.
- Link de 10 Giga vale 10.000 Mbps na topologia.
- Desenho completo em `docs/historico/visao-de-gestao.md`.

## 1.0
- Primeiro painel: lê os pacotes do app e as planilhas antigas, sem servidor e sem internet.
