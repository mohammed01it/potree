
# Multi-stage Dockerfile for Potree
# Build stage: use node:18.18.0-alpine to match local Node v18.18.0
FROM node:18.18.0-alpine AS builder

WORKDIR /app

# Copy package manifests first for better caching
COPY package*.json ./

# Install minimal build tools (in case native modules are required) and install deps
# Use `npm install` instead of `npm ci` because this repo doesn't have a package-lock.json
RUN apk add --no-cache git build-base python3 && \
	# ignore lifecycle scripts during initial install because source files (gulpfile etc.) are copied later
	npm install --silent --ignore-scripts

# Copy project files
COPY . .

# If package.json has a build script, run it. Then normalise output into /app/dist
RUN if grep -q '"build"' package.json; then \
			npm run build; \
		else \
			echo "no build script found, will serve repository files"; \
		fi && \
		if [ -d build ]; then \
			rm -rf /app/dist || true && cp -r build /app/dist; \
		elif [ -d dist ]; then \
			rm -rf /app/dist || true && cp -r dist /app/dist; \
		else \
			mkdir -p /app/dist && cp -r . /app/dist; \
		fi

# Runtime stage: nginx serving static files with CORS for pointclouds
FROM nginx:stable-alpine

# Replace nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built/static files
COPY --from=builder /app/dist/ /usr/share/nginx/html/

# Also copy any top-level pages (e.g. page/login) that are not included in the build output
COPY --from=builder /app/page/ /usr/share/nginx/html/page/

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
	CMD wget -qO- http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]

