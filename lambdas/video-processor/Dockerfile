FROM node:24-alpine

# AWS Lambda Web Adapter — HTTP リクエストを Lambda イベントに変換
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:1.0.0 /lambda-adapter /opt/extensions/lambda-adapter

RUN apk add --no-cache ffmpeg

ENV PORT=8080

WORKDIR /app

RUN corepack enable pnpm

COPY package.json ./
RUN pnpm install --prod

COPY dist/ ./dist/

CMD ["node", "dist/index.js"]
