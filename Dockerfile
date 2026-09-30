# сборка: tsc + vite build — это и есть вся «CI»
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# статика; TLS терминирует общий Caddy на хосте
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
