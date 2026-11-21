# Site estático servido pelo nginx (porta 80)
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY index.html robots.txt sitemap.xml favicon.ico favicon.png \
     hero-bg.jpg hero-bg-mobile.jpg og-image.jpg \
     /usr/share/nginx/html/

EXPOSE 80
