# Official Playwright image — includes Chromium + OS libs (libglib, etc.)
FROM mcr.microsoft.com/playwright:v1.61.1-jammy

WORKDIR /app

ENV NODE_ENV=production \
    HEADLESS=true \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

COPY package.json package-lock.json* ./
RUN npm install --omit=dev \
  && npx playwright install chromium

COPY . .

# Drop project-local browser cache if copied from host — always use image browsers.
RUN rm -rf /app/.playwright-browsers

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
