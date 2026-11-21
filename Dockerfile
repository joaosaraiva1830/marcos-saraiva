# Site + API de Conversões da Meta (Node.js, sem dependências externas)
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production \
    PORT=80

COPY server.js ./
COPY index.html robots.txt sitemap.xml favicon.ico favicon.png \
     hero-bg.jpg hero-bg-mobile.jpg og-image.jpg \
     ./public/

EXPOSE 80
CMD ["node", "server.js"]
