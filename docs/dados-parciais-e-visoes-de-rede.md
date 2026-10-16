# Dados parciais e visões de rede (registro interno)

Este texto é para a equipe. Não aparece na tela do painel.

## Dados parciais (vistorias do app antigo)
- Campo que a planilha antiga não tem aparece como "Não registrado" (cinza, itálico). Nunca vira zero.
- Médias e totais usam só as escolas que têm o dado.
- Escola sem nota fica fora da prontidão ("Sem nota"), nunca como bloqueada.
- Coluna que nenhuma escola preencheu fica escondida até a primeira vistoria completa chegar.
- Vistoria completa de uma escola substitui a antiga (mesma regra de uuid e chaveEscola).
- O painel não mostra selo nem aviso de "parcial" ao usuário.

## Visões de rede (como o app mede)
- Fluxo do app: Infraestrutura física, Análise Wi-Fi e Rede local cabeada. Concluir libera com Wi-Fi, cabeada ou ambos.
- Notas: Score_Final_WiFi, Score_Final_Lab (rede cabeada), Score_Geral_Unificado.
- Nota geral: com rede física, média de Wi-Fi e rede física; sem, só Wi-Fi.
- Réguas: Wi-Fi bom acima de 80 Mbps e até 50 ms (ruim até 40 Mbps ou acima de 100 ms). Cabeada boa acima de 90 Mbps e até 40 ms (ruim até 50 Mbps ou acima de 80 ms). Jitter acima de 30 ms é ruim nas duas.
- Faixas: Pronta 80 ou mais, Com ajustes 51 a 79, Bloqueada 50 ou menos.
- O painel usa uma visão única, a híbrida (nota geral), na tela de todos os projetos e dentro de cada projeto. Não há seletor de três visões.
- Dentro do projeto, a aba Escolas tem filtros de tipo de rede: todas, só Wi-Fi, híbridas (Wi-Fi e rede física) e só rede física.
- Na ficha da escola, o botão Detalhar (dentro de Medições por ambiente) abre todas as abas da vistoria original: Resumo, Pontos Wi-Fi, Rede cabeada, Topologia de rede, Sugestões de melhorias, Espectro, Fotos e PDF e arquivos.
- Nova Lima: 4 escolas com laboratório (0008, 0014, 0015, 0024), todas com nota de rede física 95.

## Listas
- Toda lista na tela mostra 3 a 5 itens relevantes, com botão para ver todos.
