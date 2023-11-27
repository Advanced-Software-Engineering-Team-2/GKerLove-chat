import log4js from 'log4js';

log4js.configure({
  appenders: {
    consoleAppender: {
      type: 'stdout',
      layout: {
        type: 'pattern',
        pattern: '%[[%d{yyyy-MM-dd hh:mm:ss}] [%p] -%] %m',
      },
    },
    fileAppender: {
      type: 'dateFile',
      filename: 'logs/server.log',
      layout: {
        type: 'pattern',
        pattern: '%[[%d{yyyy-MM-dd hh:mm:ss}] [%p] -%] %m',
      },
    },
  },
  categories: {
    default: {
      appenders: ['consoleAppender', 'fileAppender'],
      level: 'info',
    },
  },
});

const logger = log4js.getLogger();

export default logger;
