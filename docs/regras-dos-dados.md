# Regras dos dados

Como o painel lê o que o app grava. Vale para quem mexe no código.

## Dado que falta
- Campo que a vistoria não tem aparece como "Não registrado". Nunca vira zero.
- Médias e totais usam só as escolas que têm o dado.
- Escola sem nota fica fora da Prontidão para VDI, como "Sem nota".
- Coluna que nenhuma escola preencheu fica escondida até a primeira vistoria completa chegar.
- Vistoria completa de uma escola substitui a antiga (mesmo `uuid` ou mesma escola).
- Não há selo de "dado parcial" na tela.

## Como o app mede
- Fluxo: infraestrutura física, Wi-Fi e rede cabeada. Pode concluir com Wi-Fi, com rede cabeada ou com as duas.
- Notas: Wi-Fi, rede física (laboratório) e geral. Com rede física, a geral é a média das duas; sem, é só a do Wi-Fi.
- Régua do Wi-Fi: bom acima de 80 Mbps e até 50 ms; ruim até 40 Mbps ou acima de 100 ms.
- Régua da rede cabeada: boa acima de 90 Mbps e até 40 ms; ruim até 50 Mbps ou acima de 80 ms.
- Jitter acima de 30 ms é ruim nas duas.

## Faixas
| Nota | Nome |
|---|---|
| 80 ou mais | Apta |
| apta, com Wi-Fi e rede física medidos e uma das duas em ressalva | Apta com ressalva |
| 51 a 79 | Com ajustes |
| 50 ou menos | Severas restrições |
| sem nota | Sem nota |

A nota e a faixa são sempre as do app. O painel não recalcula. Os nomes moram no dicionário `FAIXAS` do `gestao.js`.

## Tipo de rede
Pela medição mais recente: só Wi-Fi, híbrida (Wi-Fi e rede física) ou só rede física. A aba Escolas filtra por tipo.

## Listas
Toda lista mostra os itens mais relevantes (3 a 8, conforme a tela) e um botão para ver todos.
