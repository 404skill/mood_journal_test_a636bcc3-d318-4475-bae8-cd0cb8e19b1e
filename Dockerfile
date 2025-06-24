FROM node:24

WORKDIR /usr/src/app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN mkdir -p test-reports

CMD ["npm", "test"]
