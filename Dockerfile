# сборка: tsc + vite build — это и есть вся «CI»
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# раздача статики + авто-HTTPS (Let's Encrypt) под duckdns-домен
FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
