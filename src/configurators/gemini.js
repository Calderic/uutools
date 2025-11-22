const { select, text, confirm, isCancel, spinner } = require('@clack/prompts');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { theme, showBox } = require('../ui');
const { promptApiKey } = require('../utils/apiKeyPrompt');

/**
 * API 提供商列表
 */
const API_PROVIDERS = [
  {
    label: 'UUcode',
    value: 'uucode',
    baseUrl: 'https://api.uucode.org'
  },
  {
    label: 'Google (官方)',
    value: 'google',
    baseUrl: 'https://generativelanguage.googleapis.com'
  },
  {
    label: '其他第三方',
    value: 'custom',
    baseUrl: ''
  }
];

/**
 * 配置 Gemini CLI
 */
async function configureGemini(osInfo, toolInfo, configPath) {
  if (!toolInfo.installed) {
    console.log(theme.warning('\n⚠️  Gemini CLI 未安装'));
    const installNow = await confirm({
      message: '是否显示安装指南?',
      initialValue: true
    });

    if (isCancel(installNow)) return;

    if (installNow) {
      showInstallGuide(osInfo);
    }
    return;
  }

  console.log(theme.success('\n✓ Gemini CLI 已安装'));

  const configType = await select({
    message: '选择配置类型:',
    options: [
      { label: '📁 配置 API (配置文件)', value: 'api-config' },
      { label: '↩️  返回', value: 'back' }
    ]
  });

  if (isCancel(configType)) return;

  switch (configType) {
    case 'api-config':
      await configureApi(osInfo, configPath);
      break;
    case 'back':
      return;
  }
}

/**
 * 配置 API (配置文件)
 */
async function configureApi(osInfo, configPath) {
  // 选择 API 提供商
  const provider = await select({
    message: '选择 API 提供商:',
    options: API_PROVIDERS
  });

  if (isCancel(provider)) return;

  // 获取 base URL
  let baseUrl = '';
  const selectedProvider = API_PROVIDERS.find(p => p.value === provider);

  if (provider === 'custom') {
    const customUrl = await text({
      message: '请输入 API Base URL:',
      validate: (input) => {
        if (!input || input.trim() === '') return '请输入有效的 URL';
        try {
          new URL(input);
        } catch {
          return '请输入有效的 URL';
        }
      }
    });
    if (isCancel(customUrl)) return;
    baseUrl = customUrl;
  } else {
    baseUrl = selectedProvider.baseUrl;
  }

  // 输入 API Key
  const apiKeyMessage = provider === 'uucode'
    ? '请输入 UUcode API Key:'
    : provider === 'google'
      ? '请输入 Google AI API Key:'
      : '请输入 API Key:';

  const apiKey = await promptApiKey({ provider, message: apiKeyMessage });
  if (!apiKey) return;

  const s = spinner();
  s.start('正在配置 Gemini...');

  try {
    // 确保配置目录存在
    if (!fs.existsSync(configPath.config)) {
      fs.mkdirSync(configPath.config, { recursive: true });
    }

    // 创建 .env 文件
    const envFilePath = path.join(configPath.config, '.env');
    const envContent = `GOOGLE_GEMINI_BASE_URL=${baseUrl}
GEMINI_API_KEY=${apiKey}
GEMINI_MODEL=gemini-3-pro-preview
`;
    fs.writeFileSync(envFilePath, envContent);

    // 创建 settings.json 文件
    const settingsPath = path.join(configPath.config, 'settings.json');
    const settingsContent = {
      ide: {
        enabled: true
      },
      security: {
        auth: {
          selectedType: 'gemini-api-key'
        }
      }
    };
    fs.writeFileSync(settingsPath, JSON.stringify(settingsContent, null, 2));

    s.stop('Gemini 配置完成');

    showBox('配置成功', `
配置文件目录: ${configPath.config}
.env: 已创建
settings.json: 已创建

配置内容:
  Provider: ${selectedProvider ? selectedProvider.label : '自定义'}
  Base URL: ${baseUrl}
  Model: gemini-3-pro-preview
  API Key: ${'*'.repeat(8)}...

现在可以在终端运行 'gemini' 命令开始使用
`, 'success');

  } catch (error) {
    s.stop('配置失败');
    console.error(theme.error(`配置失败: ${error.message}`));
  }
}

/**
 * 显示安装指南
 */
function showInstallGuide(osInfo) {
  showBox('Gemini CLI 安装指南', `
使用 npm 安装:
npm install -g @anthropic-ai/gemini-cli

或访问:
https://github.com/google-gemini/gemini-cli

安装完成后重新运行此工具进行配置。
`, 'info');
}

module.exports = {
  configureGemini
};
