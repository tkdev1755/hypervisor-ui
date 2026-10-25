# =============================================================================
# Image du front Angular, en trois étapes :
#   build  → compile l'application avec Node 22 (comme .nvmrc)
#   mock   → la fausse API (mock-api/server.mjs), pour essayer sans la vraie API
#   (fin)  → nginx sert les fichiers compilés et relaie /api et /ping vers l'API
#
#   docker build -t hypervisor-ui .                 # l'image du front (étape finale)
#   docker build -t hypervisor-ui-mock --target mock .
# Le plus simple reste docker compose (voir docker-compose.yml).
# =============================================================================

# ---------- Étape 1 : compilation ----------
FROM node:22-alpine AS build
WORKDIR /app

# D'abord les dépendances seules : Docker garde cette couche en cache tant que
# package.json et package-lock.json ne changent pas.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx ng build

# ---------- Étape 2 (facultative) : la fausse API ----------
FROM node:22-alpine AS mock
WORKDIR /app
COPY mock-api/server.mjs ./server.mjs
# 0.0.0.0 : joignable par les autres conteneurs (127.0.0.1 ne le serait que du conteneur lui-même).
ENV HOST=0.0.0.0 \
    PORT=3000
USER node
EXPOSE 3000
CMD ["node", "server.mjs"]

# ---------- Étape 3 : le serveur web ----------
# Version « unprivileged » de nginx : il tourne sans les droits root et écoute sur 8080.
FROM nginxinc/nginx-unprivileged:1.27-alpine AS web

# Adresse de l'API vue depuis le conteneur. Le fichier modèle ci-dessous est complété au
# démarrage par l'image nginx (envsubst) : ${API_UPSTREAM} y est remplacé par cette valeur.
ENV API_UPSTREAM=http://api-haproxy:8000

COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/hypervisor-ui/browser /usr/share/nginx/html

EXPOSE 8080
