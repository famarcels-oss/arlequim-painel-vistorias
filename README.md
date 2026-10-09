# Painel de Vistorias Arlequim

Painel de consulta das vistorias feitas pelo app Arlequim VDI. Estático: roda inteiro no navegador, sem backend, sem banco, sem login e sem credenciais. Os dados nunca saem do computador de quem abre.

## Como usar (offline)

1. Abra `dist/painel-vistorias.html` com dois cliques (ou `public/index.html`).
2. Arraste os arquivos recebidos dos técnicos: pacotes `.zip` gerados pelo botão "Gerar pacote completo" do app (tela inicial), planilhas `.csv` antigas ou `.json`. Pode soltar uma pasta inteira (por exemplo a pasta `aplicativos` do OneDrive).
3. Para apresentar: use "Exportar painel em HTML". Gera um único arquivo com os dados embutidos (fotos reduzidas, PDFs incluídos) que abre em qualquer computador.

## Regras de duplicidade

- Cada vistoria tem um `uuid` criado no app. Mesmo `uuid` carregado de novo: fica a versão com maior `atualizadoEm`, a outra é descartada.
- O mesmo pacote (`pacoteId`) carregado duas vezes é ignorado.
- Planilha antiga (sem `uuid`) igual a outra já carregada é descartada. Se o pacote novo traz a mesma vistoria (mesma escola e mesmo minuto), vale o pacote novo.
- Medições da mesma escola em datas diferentes são histórico, não duplicadas. O painel mostra a mais recente e a aba Histórico compara a evolução.

## Formato do pacote (formato 1)

```
manifest.json            pacoteId, formato, técnico, avisos
vistorias_longo.csv      uuid;escola;projeto;data;secao;item;campo;valor  (UTF-8, BOM, ;)
vistorias/<uuid>/vistoria.json
vistorias/<uuid>/relatorio.pdf
vistorias/<uuid>/fotos/...
vistorias/<uuid>/espectro/...
```

Campos ausentes (vistorias antigas) aparecem como "não registrado".

## Desenvolvimento

```
npm test          # 14 testes (regras, duplicidade, planilha antiga, histórico)
npm run build     # gera dist/painel-vistorias.html (arquivo único)
npm run amostra   # recria os dados fictícios em amostra/
npm run serve     # servidor local em http://localhost:8080 com os mesmos cabeçalhos do Vercel
```

Sem dependências de execução. `public/assets/vendor/jszip.min.js` está incluído (licença em `JSZIP-LICENSE.txt`).

## Publicar no Vercel (ou similar)

O projeto já está pronto: `vercel.json` aponta `public` como saída, sem build, com CSP restritiva, `noindex` e sem cache.

1. Importe o repositório no Vercel (Framework: Other). Sem variáveis de ambiente.
2. **Antes de publicar, ative proteção de acesso** (Vercel Authentication ou senha em Settings > Deployment Protection). O painel em si não contém dados, mas os arquivos que você carrega e o HTML exportado contêm dados de escolas.
3. Em outras plataformas estáticas (Netlify, Cloudflare Pages, GitHub Pages) use `public` como diretório e reproduza os cabeçalhos do `vercel.json` quando possível.

O painel nunca envia dados para servidor algum. Publicar o site só publica a ferramenta vazia.

## Dados reais

Não faça commit de pacotes reais. O `.gitignore` bloqueia `*.zip` (exceto `amostra/`) e a pasta `dados/`.
