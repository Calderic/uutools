const { select, text, password, confirm, isCancel, cancel, spinner } = require('@clack/prompts');
const fs = require('fs');
const path = require('path');
const { theme, showBox } = require('../ui');

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
      { label: '🔑 配置 Google API Key', value: 'apikey' },
      { label: '⚙️  配置设置文件', value: 'settings' },
      { label: '🌐 配置代理设置', value: 'proxy' },
      { label: '↩️  返回', value: 'back' }
    ]
  });

  if (isCancel(configType)) return;

  switch (configType) {
    case 'apikey':
      await configureApiKey(osInfo);
      break;
    case 'settings':
      await configureSettings(configPath);
      break;
    case 'proxy':
      await configureProxy(osInfo);
      break;
    case 'back':
      return;
  }
}

/**
 * 配置 API Key
 */
async function configureApiKey(osInfo) {
  const apiKey = await password({
    message: '请输入 Google AI API Key:',
    mask: '*',
    validate: (input) => {
      if (!input || input.trim() === '') return '请输入有效的 API Key';
    }
  });

  if (isCancel(apiKey)) return;

  const s = spinner();
  s.start('正在配置环境变量...');

  try {
    const envVar = `GOOGLE_API_KEY=${apiKey}`;
    const shellConfig = getShellConfigFile(osInfo);

    if (shellConfig) {
      let content = '';
      if (fs.existsSync(shellConfig)) {
        content = fs.readFileSync(shellConfig, 'utf8');
      }

      if (content.includes('GOOGLE_API_KEY=')) {
        content = content.replace(/export GOOGLE_API_KEY=.*/g, `export ${envVar}`);
      } else {
        content += `\n# Gemini API Key\nexport ${envVar}\n`;
      }

      fs.writeFileSync(shellConfig, content);
      s.stop(`API Key 已保存到 ${shellConfig}`);

      showBox('配置成功', `
API Key 已保存。
请运行 'source ${shellConfig}' 或重新打开终端使配置生效
`, 'success');

    } else {
      s.stop('无法确定 shell 配置文件');
      showBox('手动配置', `
请手动添加: export ${envVar}
`, 'warning');
    }
  } catch (error) {
    s.stop('配置失败');
    console.error(theme.error(`配置失败: ${error.message}`));
  }
}

/**
 * 配置设置文件
 */
async function configureSettings(configPath) {
  const s = spinner();
  s.start('正在读取配置...');

  try {
    if (!fs.existsSync(configPath.config)) {
      fs.mkdirSync(configPath.config, { recursive: true });
    }

    let settings = {};
    if (fs.existsSync(configPath.settings)) {
      settings = JSON.parse(fs.readFileSync(configPath.settings, 'utf8'));
    }

    s.stop('配置已读取');

    const model = await select({
      message: '选择默认模型:',
      options: [
        { label: 'gemini-2.5-pro', value: 'gemini-2.5-pro' },
        { label: 'gemini-2.5-flash', value: 'gemini-2.5-flash' },
        { label: 'gemini-2.0-flash', value: 'gemini-2.0-flash' },
        { label: 'gemini-1.5-pro', value: 'gemini-1.5-pro' },
        { label: 'gemini-1.5-flash', value: 'gemini-1.5-flash' }
      ],
      initialValue: settings.model || 'gemini-2.5-pro'
    });

    if (isCancel(model)) return;

    const sandbox = await confirm({
      message: '启用沙箱模式?',
      initialValue: settings.sandbox !== false
    });

    if (isCancel(sandbox)) return;

    settings.model = model;
    settings.sandbox = sandbox;

    fs.writeFileSync(configPath.settings, JSON.stringify(settings, null, 2));
    console.log(theme.success(`\n✅ 设置已保存到 ${configPath.settings}`));
  } catch (error) {
    s.stop('配置失败');
    console.error(theme.error(`配置失败: ${error.message}`));
  }
}

/**
 * 配置代理
 */
async function configureProxy(osInfo) {
  const proxyUrl = await text({
    message: '请输入代理地址 (如 http://127.0.0.1:7890):',
    validate: (input) => {
      if (!input) return;
      try {
        new URL(input);
      } catch {
        return '请输入有效的 URL';
      }
    }
  });

  if (isCancel(proxyUrl)) return;

  if (!proxyUrl) {
    console.log(theme.warning('\n⚠️  未设置代理'));
    return;
  }

  const s = spinner();
  s.start('正在配置代理...');

  try {
    const shellConfig = getShellConfigFile(osInfo);

    if (shellConfig) {
      let content = '';
      if (fs.existsSync(shellConfig)) {
        content = fs.readFileSync(shellConfig, 'utf8');
      }

      const proxyConfig = `
# Gemini Proxy
export HTTP_PROXY=${proxyUrl}
export HTTPS_PROXY=${proxyUrl}
`;

      content = content.replace(/# Gemini Proxy[\s\S]*?export HTTPS_PROXY=.*\n/g, '');
      content += proxyConfig;

      fs.writeFileSync(shellConfig, content);
      s.stop(`代理已配置: ${proxyUrl}`);
    } else {
      s.stop('无法确定 shell 配置文件');
    }
  } catch (error) {
    s.stop('配置失败');
    console.error(theme.error(`配置失败: ${error.message}`));
  }
}

/**
 * 获取 shell 配置文件路径
 */
function getShellConfigFile(osInfo) {
  const home = require('os').homedir();
  const shell = process.env.SHELL || '';

  if (osInfo.type === 'windows') {
    return path.join(home, 'Documents', 'PowerShell', 'Microsoft.PowerShell_profile.ps1');
  }

  if (shell.includes('zsh')) {
    return path.join(home, '.zshrc');
  } else if (shell.includes('bash')) {
    return path.join(home, '.bashrc');
  }

  return path.join(home, '.bashrc');
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
