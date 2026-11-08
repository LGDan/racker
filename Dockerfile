FROM node:20-alpine

RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .
ENV DATABASE_URL=postgresql://racker:racker@db:5432/racker?schema=public
RUN npx prisma generate && npm run build

RUN chmod +x docker-entrypoint.sh

ENV NODE_ENV=production
ENV OIDC_ISSUER_URL="" \
    OIDC_CLIENT_ID="" \
    OIDC_CLIENT_SECRET="" \
    OIDC_REDIRECT_URI="" \
    OIDC_PROVIDER_NAME="Single Sign-On" \
    OIDC_SCOPES="openid profile email" \
    OIDC_ROLE_CLAIM="groups" \
    OIDC_ADMIN_GROUP="racker-admins" \
    OIDC_DEFAULT_ROLE="STANDARD" \
    OIDC_AUTHORIZATION_ENDPOINT="" \
    OIDC_TOKEN_ENDPOINT="" \
    OIDC_USERINFO_ENDPOINT="" \
    OIDC_JWKS_URI=""
EXPOSE 3000

CMD ["./docker-entrypoint.sh"]
