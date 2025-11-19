const inquirer = require('inquirer');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const ora = require('ora');

/**
 * 配置 Gemini CLI
 */
async function configureGemini(osInfo, toolInfo, configPath) {
  if (!toolInfo.installed) {
    console.log(chalk.yellow('\n⚠️  Gemini CLI 未安装'));
    const { installNow } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'installNow',
        message: '是否显示安装指南?',
        default: true
      }
    ]);

    if (installNow) {
      showInstallGuide(osInfo);
    }
    return;
  }

  console.log(chalk.green('\n✓ Gemini CLI 已安装'));

  const { configType } = await inquirer.prompt([
    {
      type: 'list',
      name: 'configType',
      message: '选择配置类型:',
      choices: [
        { name: '🔑 配置 Google API Key', value: 'apikey' },
        { name: '⚙️  配置设置文件', value: 'settings' },
        { name: '🌐 配置代理设置', value: 'proxy' },
        { name: '↩️  返回', value: 'back' }
      ]
    }
  ]);

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
  const { apiKey } = await inquirer.prompt([
    {
      type: 'password',
      name: 'apiKey',
      message: '请输入 Google AI API Key:',
      mask: '*',
      validate: (input) => {
        if (!input || input.trim() === '') {
          return '请输入有效的 API Key';
        }
        return true;
      }
    }
  ]);

  const spinner = ora('正在配置环境变量...').start();

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
      spinner.succeed(`API Key 已保存到 ${shellConfig}`);
      console.log(chalk.gray(`   请运行 'source ${shellConfig}' 或重新打开终端使配置生效`));
    } else {
      spinner.warn('无法确定 shell 配置文件');
      console.log(chalk.yellow(`   请手动添加: export ${envVar}`));
    }
  } catch (error) {
    spinner.fail(`配置失败: ${error.message}`);
  }
}

/**
 * 配置设置文件
 */
async function configureSettings(configPath) {
  const spinner = ora('正在读取配置...').start();

  try {
    if (!fs.existsSync(configPath.config)) {
      fs.mkdirSync(configPath.config, { recursive: true });
    }

    let settings = {};
    if (fs.existsSync(configPath.settings)) {
      settings = JSON.parse(fs.readFileSync(configPath.settings, 'utf8'));
    }

    spinner.stop();

    const { model, sandbox } = await inquirer.prompt([
      {
        type: 'list',
        name: 'model',
        message: '选择默认模型:',
        choices: [
          'gemini-2.5-pro',
          'gemini-2.5-flash',
          'gemini-2.0-flash',
          'gemini-1.5-pro',
          'gemini-1.5-flash'
        ],
        default: settings.model || 'gemini-2.5-pro'
      },
      {
        type: 'confirm',
        name: 'sandbox',
        message: '启用沙箱模式?',
        default: settings.sandbox !== false
      }
    ]);

    settings.model = model;
    settings.sandbox = sandbox;

    fs.writeFileSync(configPath.settings, JSON.stringify(settings, null, 2));
    console.log(chalk.green(`\n✅ 设置已保存到 ${configPath.settings}`));
  } catch (error) {
    spinner.fail(`配置失败: ${error.message}`);
  }
}

/**
 * 配置代理
 */
async function configureProxy(osInfo) {
  const { proxyUrl } = await inquirer.prompt([
    {
      type: 'input',
      name: 'proxyUrl',
      message: '请输入代理地址 (如 http://127.0.0.1:7890):',
      validate: (input) => {
        if (!input) return true;
        try {
          new URL(input);
          return true;
        } catch {
          return '请输入有效的 URL';
        }
      }
    }
  ]);

  if (!proxyUrl) {
    console.log(chalk.yellow('\n⚠️  未设置代理'));
    return;
  }

  const spinner = ora('正在配置代理...').start();

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
      spinner.succeed(`代理已配置: ${proxyUrl}`);
    } else {
      spinner.warn('无法确定 shell 配置文件');
    }
  } catch (error) {
    spinner.fail(`配置失败: ${error.message}`);
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
  console.log(chalk.bold.cyan('\n📖 Gemini CLI 安装指南:\n'));

  console.log(chalk.white('使用 npm 安装:'));
  console.log(chalk.gray('   npm install -g @anthropic-ai/gemini-cli\n'));

  console.log(chalk.white('或访问:'));
  console.log(chalk.gray('   https://github.com/google-gemini/gemini-cli\n'));

  console.log(chalk.gray('安装完成后重新运行此工具进行配置。\n'));
}

module.exports = {
  configureGemini
};
