FROM node:20-slim

# better-sqlite3 needs build tools to compile its native binding
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY . .

# Persist the SQLite DB file outside the container image
VOLUME ["/app/data"]

EXPOSE 4000
CMD ["node", "server.js"]
