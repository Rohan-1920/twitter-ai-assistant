# Playwright image already has Chromium + OS libs (libglib, etc.)
FROM mcr.microsoft.com/playwright:v1.61.1-jammy

WORKDIR /app

ENV NODE_ENV=production \
    HEADLESS=true \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    NPM_CONFIG_ENGINE_STRICT=false

COPY package.json package-lock.json* ./

# --ignore-scripts: postinstall needs ./scripts which are not copied yet.
# Browsers already exist in this image under /ms-playwright.
RUN npm install --omit=dev --ignore-scripts

COPY . .

# Never use a project-local browser cache inside the container.
RUN rm -rf /app/.playwright-browsers

EXPOSE 3000

# Skip ensure-* scripts — image already has Chromium + system libs.
CMD ["node", "server.js"]
