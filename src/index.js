const { showSystemInfo, detectOS, detectTools, getConfigPaths } = require('./system');
const { startInteractiveMenu } = require('./menu');

module.exports = {
  showSystemInfo,
  detectOS,
  detectTools,
  getConfigPaths,
  startInteractiveMenu
};
