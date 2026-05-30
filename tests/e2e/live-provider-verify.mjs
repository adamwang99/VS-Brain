import puppeteer from 'puppeteer-core';

const chromePath = process.env.CHROME_PATH || '/usr/bin/google-chrome';
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

async function hasLikelyChatUI(page, selectors) {
  for (const sel of selectors) {
    if (await page.$(sel)) return true;
  }
  return false;
}

const browser = await puppeteer.launch({ headless: false, executablePath: chromePath, args: ['--no-first-run','--no-default-browser-check'] });
try {
  const chatgpt = await browser.newPage();
  const gemini = await browser.newPage();
  await chatgpt.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded' });
  await gemini.goto('https://gemini.google.com/', { waitUntil: 'domcontentloaded' });
  await sleep(5000);

  const state = {
    chatgpt: {
      url: chatgpt.url(),
      title: await chatgpt.title(),
      ready: await hasLikelyChatUI(chatgpt, ['textarea', '[data-message-author-role]', '[data-testid^="conversation-turn-"]'])
    },
    gemini: {
      url: gemini.url(),
      title: await gemini.title(),
      ready: await hasLikelyChatUI(gemini, ['textarea', 'rich-textarea', 'message-content', 'model-response'])
    }
  };

  console.log(JSON.stringify(state, null, 2));

  if (!state.chatgpt.ready || !state.gemini.ready) {
    throw new Error('live provider session not ready');
  }
} finally {
  await browser.close();
}
