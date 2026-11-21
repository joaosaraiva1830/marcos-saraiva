# Pai Marcos das Sete Encruzilhadas — landing page

Site estático (HTML/CSS/JS puro, sem build), feito para celular. Todo contato vai para o WhatsApp.

## Arquivos
- `index.html` — página completa (estilos e scripts embutidos)
- `hero-bg.jpg` / `hero-bg-mobile.jpg` — imagem do topo (desktop / celular)
- `og-image.jpg` — prévia ao compartilhar o link (1200×630)
- `favicon.ico`, `favicon.png`, `robots.txt`, `sitemap.xml`

## Rastreamento (Meta Pixel + API de Conversões)
- Pixel `3622083471297526`
- Clique nos botões do WhatsApp: `Lead` + `Contact` (com o nome do botão)
- `ViewContent` (seção de serviços), `Rolagem`, `TempoNaPagina`, `AbriuFAQ`
- **API de Conversões:** `PageView`, `ViewContent`, `Lead` e `Contact` também são enviados pelo servidor (`server.js`, rota `POST /api/evento`), com o mesmo `event_id` do Pixel. A Meta junta os dois e não conta duas vezes.
- Modo teste: abra o site com `?pixel_debug=1` — nada é enviado à Meta, os eventos aparecem no console.

### Variáveis de ambiente (Easypanel → Ambiente)
| Variável | Para quê |
|---|---|
| `META_CAPI_TOKEN` | **Obrigatória** para a API funcionar. Token gerado no Gerenciador de Eventos. Sem ela o site funciona, só a API fica desligada. |
| `META_TEST_EVENT_CODE` | Opcional. Código da aba "Testar eventos". Apague depois de testar. |
| `META_PIXEL_ID` | Opcional (padrão `3622083471297526`). |
| `META_API_VERSION` | Opcional (padrão `v23.0`). |

Os logs do serviço no Easypanel mostram `[CAPI] ok Lead (...)` a cada envio, ou `[CAPI] ERRO ...` com o motivo.

## Publicar (Easypanel)
- Fonte: GitHub `joaosaraiva1830/marcos-saraiva`, ramo `main`, caminho `/`
- Build: **Dockerfile** (Node.js, porta **80**). O `server.js` serve o site (gzip, HTML sem cache, imagens com cache de 30 dias, www → domínio principal) e a API de Conversões.
