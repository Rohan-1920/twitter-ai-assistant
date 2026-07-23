# Official Playwright image includes Chromium OS libraries (libglib, etc.)
# Required on Railway — plain Node images fail with missing shared libs.
FROM mcr.microsoft.com/playwright:v1.61.1-jammy

WORKDIR /app

ENV NODE_ENV=production
ENV HEADLESS=true
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Ensure Chromium version matches the installed Playwright package.
RUN npx playwright install chromium

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
