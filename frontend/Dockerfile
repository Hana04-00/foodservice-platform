FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
# NEXT_PUBLIC_API_BASE is inlined into the client bundle; BACKEND_ORIGIN is baked
# into the /api/* rewrite (next.config.mjs). Both are read at build time.
# Defaults keep `npm run dev` working; compose passes compose-network values.
ARG NEXT_PUBLIC_API_BASE=/api/v1
ARG BACKEND_ORIGIN=http://localhost:8000
ENV NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE
ENV BACKEND_ORIGIN=$BACKEND_ORIGIN
RUN npm run build

FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.mjs ./next.config.mjs
EXPOSE 3000
CMD ["npm", "run", "start"]
