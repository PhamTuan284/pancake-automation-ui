# Use the Node alpine official image
# https://hub.docker.com/_/node
FROM node:lts-alpine AS build

# Set config
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV NPM_CONFIG_FUND=false

# Create and change to the app directory.
WORKDIR /app

# Copy the files to the container image
COPY package*.json ./

# Install packages
RUN npm ci

# Copy local code to the container image.
COPY . ./

# Baked at build time (Vite). Set in Railway as a service variable used at build, or:
#   docker build --build-arg VITE_API_BASE_URL=https://your-api.example.com .
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Build the app.
RUN npm run build

# Use the Caddy image
FROM caddy

# Create and change to the app directory.
WORKDIR /app

# Copy Caddyfile to the container image.
COPY Caddyfile ./

# Copy local code to the container image.
RUN caddy fmt Caddyfile --overwrite

# Copy files to the container image.
COPY --from=build /app/dist ./dist

# Use Caddy to run/serve the app
CMD ["caddy", "run", "--config", "Caddyfile", "--adapter", "caddyfile"]