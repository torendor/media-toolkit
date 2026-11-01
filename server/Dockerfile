# Media Toolkit Backend (Dockerfile)
FROM node:20-bookworm-slim

# Install system dependencies: ffmpeg, python3, and curl
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Deno to solve YouTube JS challenges seamlessly in Linux
RUN curl -fsSL https://deno.land/install.sh | sh \
    && mv /root/.deno/bin/deno /usr/local/bin/deno

# Install latest yt-dlp binary
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

# Install npm dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy source code
COPY . .

# Ensure downloads directory exists
RUN mkdir -p downloads

ENV PORT=3001
ENV NODE_ENV=production
ENV DOWNLOAD_DIR=/app/downloads

EXPOSE 3001

CMD ["node", "src/index.js"]

