document.body.textContent = chrome.runtime?.id || 'no-extension-id';
console.log('VS_BRAIN_EXTENSION_ID=' + (chrome.runtime?.id || 'no-extension-id'));
