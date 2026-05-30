import puppeteer from 'puppeteer-core';

const chromePath = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const userDataDir = '/home/phuong/.config/google-chrome';
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

async function hasChat(page) {
  return await page.evaluate(() => {
    const txt = document.body.innerText || '';
    const hasLoginGate = /log in|sign up for free|get responses tailored to you/i.test(txt);
    const hasConversation = /you said|gemini said|chatgpt can make mistakes|chat history|new chat/i.test(txt);
    const hasComposer = !!document.querySelector('textarea, [contenteditable="true"], rich-textarea');
    return { hasLoginGate, hasConversation, hasComposer, preview: txt.slice(0,1200) };
  });
}

const browser = await puppeteer.launch({
  headless: false,
  executablePath: chromePath,
  userDataDir,
  args: ['--no-first-run','--no-default-browser-check']
});
try {
  const c = await browser.newPage();
  await c.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded' });
  await sleep(8000);
  const g = await browser.newPage();
  await g.goto('https://gemini.google.com/app', { waitUntil: 'domcontentloaded' });
  await sleep(8000);
  const state = { chatgpt: { url: c.url(), title: await c.title(), ...(await hasChat(c)) }, gemini: { url: g.url(), title: await g.title(), ...(await hasChat(g)) } };
  console.log(JSON.stringify(state, null, 2));
} finally {
  await browser.close();
}
