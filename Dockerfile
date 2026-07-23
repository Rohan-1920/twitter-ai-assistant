# Playwright image already has Chromium + OS libs (libglib, etc.)
FROM mcr.microsoft.com/playwright:v1.61.1-jammy

WORKDIR /app

ENV NODE_ENV=production \
    HEADLESS=true \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

COPY package.json package-lock.json* ./

# Image may ship Node 22/24; our engines field says 20.x — ignore that here.
RUN npm install --omit=dev --ignore-engines

COPY . .

# Never use host/project browser cache inside the container.
RUN rm -rf /app/.playwright-browsers

EXPOSE 3000

CMD ["node", "server.js"]
