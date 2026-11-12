FROM node:24-alpine AS build

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .
RUN yarn build

FROM node:24-alpine AS runtime

ENV NODE_ENV=production \
    PORT=8080

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production && yarn cache clean

COPY --from=build /app/dist ./dist

RUN mkdir storage && chown node:node storage
USER node

EXPOSE 8080

# Run node directly: `npm start` would trigger the `prestart` build, which needs devDependencies.
CMD ["node", "dist/server.js"]
