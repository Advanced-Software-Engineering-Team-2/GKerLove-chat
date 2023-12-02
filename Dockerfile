FROM node:20

WORKDIR /app

COPY package*.json ./

RUN npm config set registry https://registry.npm.taobao.org

RUN npm install

COPY . .

RUN npm run build

ENV NODE_ENV prod

EXPOSE 8080

ENTRYPOINT [ "node",  "build/index.js"]