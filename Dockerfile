FROM node:22.23.4-alpine3.24@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 AS build

ARG REACT_APP_SERVICES_HOST=/services/m

# Copy the project once so the reviewed npm policy cannot be overridden later.
WORKDIR /app/src
COPY . /app

# Node 22.23.4 bundles npm 10; verify and install the reviewed npm 11.10.0 bootstrap.
RUN sh /app/scripts/install-pinned-npm.sh

# Install dependencies
RUN npm install

# Build the application
RUN npm run build

# Use a specific version of nginx
# https://hub.docker.com/r/nginxinc/nginx-unprivileged
FROM nginxinc/nginx-unprivileged:stable-alpine

# Copy built assets from the build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Set a non-root user
USER nginx
