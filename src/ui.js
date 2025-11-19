const figlet = require('figlet');
const gradient = require('gradient-string');
const boxen = require('boxen');
const chalk = require('chalk');

// Theme colors
const theme = {
  primary: chalk.hex('#00D8FF'), // Cyan
  secondary: chalk.hex('#BD34FE'), // Purple
  success: chalk.hex('#42E66C'), // Green
  warning: chalk.hex('#FFB020'), // Yellow
  error: chalk.hex('#FF4444'), // Red
  dim: chalk.gray
};

/**
 * Show the application banner
 */
function showBanner() {
  console.clear();
  const title = figlet.textSync('UUTools', {
    font: 'Standard',
    horizontalLayout: 'fitted'
  });
  
  const gradientTitle = gradient(['#00D8FF', '#BD34FE'])(title);
  console.log(gradientTitle);
  console.log(theme.dim('  AI Coding Assistant Configuration Tool\n'));
}

/**
 * Show a boxed message
 * @param {string} title Title of the box
 * @param {string} content Content of the box
 * @param {'info'|'success'|'warning'|'error'} type Type of the box
 */
function showBox(title, content, type = 'info') {
  let borderColor;
  let titleColor;

  switch (type) {
    case 'success':
      borderColor = '#42E66C';
      titleColor = theme.success;
      break;
    case 'warning':
      borderColor = '#FFB020';
      titleColor = theme.warning;
      break;
    case 'error':
      borderColor = '#FF4444';
      titleColor = theme.error;
      break;
    default:
      borderColor = '#00D8FF';
      titleColor = theme.primary;
  }

  console.log(boxen(content, {
    title: title,
    titleAlignment: 'center',
    padding: 1,
    margin: 1,
    borderStyle: 'round',
    borderColor: borderColor
  }));
}

module.exports = {
  theme,
  showBanner,
  showBox
};
