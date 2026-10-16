# Publicar no Vercel

O painel está pronto para ir ao ar. Publicar é decisão do Fábio: hoje ele roda local, pelo endereço fixo no OneDrive.

## O que vai para o ar

Só a ferramenta vazia: HTML, CSS, JavaScript e a fonte. Nenhuma vistoria, foto ou PDF.
Quem abre o site carrega os próprios pacotes, e eles ficam só no navegador dessa pessoa. O painel não tem servidor, banco, login nem chamada de rede (há teste que garante isso).

## Passo a passo

1. **Importar.** No Vercel: Add New > Project > importar `famarcels-oss/arlequim-painel-vistorias`.
2. **Configurar.** Framework Preset: **Other**. Não mexer em Build, Output nem Install: o `vercel.json` já diz tudo (serve a pasta `public/`, sem build). Sem variáveis de ambiente.
3. **Proteger antes de divulgar o link.** Settings > Deployment Protection: ligar **Vercel Authentication** (só quem tem conta no time entra) ou **Password Protection** (senha única). O site vazio não tem dado, mas o HTML exportado que alguém gerar a partir dele terá.
4. **Deploy.** Cada `git push` na `main` publica sozinho a versão nova. Conferir o número no canto da tela.

## O que já vem configurado (`vercel.json`)

| Cabeçalho | Para quê |
|---|---|
| Content-Security-Policy | Só roda código do próprio site. Bloqueia script de fora, formulário e o site dentro de outro site. |
| X-Robots-Tag: noindex | Não aparece no Google. |
| Cache-Control: no-store | F5 sempre traz a versão nova. |
| Permissions-Policy | Câmera, microfone, localização, pagamento e USB desligados. |
| Cross-Origin-Opener-Policy, X-Frame-Options, Referrer-Policy, X-Content-Type-Options | Isolamento da aba e nada de endereço vazando para outro site. |

Testar igual ao Vercel, no próprio computador: `npm run serve` e abrir `http://localhost:8080`. O servidor local usa os mesmos cabeçalhos.

## O que muda em relação ao uso local

- **Conectar pasta do OneDrive** funciona no Chrome e no Edge, como hoje.
- **Exportar painel em HTML** continua gerando um arquivo único que abre offline.
- Quem usa o endereço fixo local não precisa mudar nada.

## Outras hospedagens

Netlify, Cloudflare Pages ou servidor interno da companhia: publicar a pasta `public/` e copiar os cabeçalhos da tabela acima.
