# Pai Marcos das Sete Encruzilhadas — landing page

Site estático (HTML/CSS/JS puro, sem build), feito para celular. Todo contato vai para o WhatsApp.

## Arquivos
- `index.html` — página completa (estilos e scripts embutidos)
- `hero-bg.jpg` / `hero-bg-mobile.jpg` — imagem do topo (desktop / celular)
- `og-image.jpg` — prévia ao compartilhar o link (1200×630)
- `favicon.ico`, `favicon.png`, `robots.txt`, `sitemap.xml`

## Rastreamento (Meta Pixel)
- Pixel `3622083471297526`
- Clique nos botões do WhatsApp: `Lead` + `Contact` (com o nome do botão)
- `ViewContent` (seção de serviços), `Rolagem`, `TempoNaPagina`, `AbriuFAQ`
- Modo teste: abra o site com `?pixel_debug=1` — nada é enviado à Meta, os eventos aparecem no console.

## Publicar
Basta servir a pasta como site estático (qualquer servidor web). Se mudar o domínio, atualize o endereço em `index.html` (canonical / og), `robots.txt` e `sitemap.xml`.
