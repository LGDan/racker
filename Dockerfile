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
EXPOSE 3000

CMD ["./docker-entrypoint.sh"]
