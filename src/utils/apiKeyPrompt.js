const { password, select, isCancel } = require('@clack/prompts');

function isLikelyUucodeKey(key = '') {
  return key.trim().toLowerCase().startsWith('gr');
}

async function promptApiKey({ message, provider }) {
  while (true) {
    const apiKey = await password({
      message,
      mask: '*',
      validate: (input) => {
        if (!input || input.trim() === '') return '请输入有效的 API Key';
      }
    });

    if (isCancel(apiKey)) return null;

    if (provider === 'uucode' && !isLikelyUucodeKey(apiKey)) {
      const action = await select({
        message: '您输入的 API Key 可能不正确，请检查是否为 UUcode 提供的 Key',
        options: [
          { value: 'retry', label: '重新输入 (推荐)' },
          { value: 'force', label: '强制使用当前 API Key' }
        ],
        initialValue: 'retry'
      });

      if (isCancel(action)) return null;
      if (action === 'retry') continue;
    }

    return apiKey;
  }
}

module.exports = {
  promptApiKey
};
