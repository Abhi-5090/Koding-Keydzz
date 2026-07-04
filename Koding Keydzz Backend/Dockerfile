# ─────────────────────────────────────────────────────────────────────────────
# Koding Keydzz backend — production image.
# The app is plain ESM Node (no compile step), so the multi-stage split is used
# only to install production-only dependencies in a clean layer and copy them
# into a minimal runtime image that runs as a non-root user.
# ─────────────────────────────────────────────────────────────────────────────

# ---- deps stage: install ONLY production dependencies ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- runtime stage ----
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
# Backend listens on this port; overridable via the PORT env var at runtime.
ENV PORT=5000

# Bring in the pre-installed production node_modules and the application source.
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY src ./src

# Run as the built-in unprivileged "node" user (uid 1000), never root.
RUN chown -R node:node /app
USER node

EXPOSE 5000

# Container health: hit the API health endpoint. Uses node (no extra tooling)
# so it works on the slim alpine image regardless of busybox/curl availability.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5000)+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Plain node — NOT --watch. Production entrypoint.
CMD ["node", "src/server.js"]
