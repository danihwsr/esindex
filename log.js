const { ina } = require('./helper');
const { createLogger, format, transports, Logger } = require('winston');
const { combine, label, printf } = format;
// overwrite default format.timestamp()
Object.defineProperty(format, 'timestamp', {
  get: function(){ return require('./timestamp') },
  configurable: true
});
const { timestamp } = format;
// exceptions
function UnknownLevelException(level){
  this.level    = 'ShowStopper';
  this.message  = `Unknown level: ${level}`;
}
function NoLogfilePathException(){
  this.level    = 'ShowStopper';
  this.message  = 'No file specified for output.type file';
}
function NoOutputTypeException(){
  this.level    = 'ShowStopper';
  this.message  = 'No output type specified';
}
function UnknownOutputTypeException(type){
  this.level    = 'ShowStopper';
  this.message  = `Unknown output type: ${type}`;
}
function NoOptionsProvidedException(){
  this.level    = 'ShowStopper';
  this.message  = 'No options for logger provided';
}

const exceptions = {
  'UnknownLevelException': UnknownLevelException,
  'NoLogfilePathException': NoLogfilePathException,
  'NoOutputTypeException': NoOutputTypeException,
  'UnknownOutputTypeException': UnknownOutputTypeException,
  'NoOptionsProvidedException': NoOptionsProvidedException,
};

const validLevels = [
    'error', // 0
    'warn', // 1
    'info', // 2
    'verbose', // 3
    'debug', // 4
    'silly' // 5
];

const validOutputTypes = [
    'file'
];

function logger(options){
  if (options === undefined){
    throw new NoOptionsProvidedException();
  }
  return loggerSettings(options);
}

/**
 * Sets different options for a new winston logger instance and returns it
 *
 * @param {Object} options - Holds options for the logger instance
 * @param {string} options.level - Holds the log level for the logger instance
 * @param {Object[]} options.outputs - Holds additional output channels for the logger instance
 * @param {string} options.outputs.type - Output type
 * @param {string} [options.outputs.name=filename] - Holds output destination, e.i. when setting output to file
 * @returns {winston.logger} logger - The configured winston logger instance
 */
function loggerSettings(options) {
  let format = printf(msg => {
      let message = msg.message;
      if (typeof message === 'object'){
        message = objToKVPairs(msg.message);
      }
      return `${msg.timestamp} [${msg.label}] ${msg.level.toUpperCase()} ${message}`;
  });
  // set logger log level
  let logLevel;
  try {
    logLevel = parseLevel(options.level);
  } catch (err) {
    switch (err.constructor) {
      case UnknownLevelException:
        throw new err.constructor(options.level);
      default:
        console.error(err);
    }
  }
  let outputs = [
    new transports.Console({level: logLevel})
  ];
  // set additional log outputs
  if (options.outputs){
    for (let i = 0; i < options.outputs.length; i++){
      let output = options.outputs[i];
      if (!output.hasOwnProperty('type')){
        throw new NoOutputTypeException();
      }
      if (!ina(validOutputTypes, output.type)){
        throw new UnknownOutputTypeException(output.type);
      }
      switch (output.type){
        case "file":
          if (!output.hasOwnProperty('file')){
            throw new NoLogfilePathException();
          }
          transports.push(new transports.File({
            filename: output.name,
            level: logLevel
          }));
      }
    }
  }
  return createLogger({
    level: logLevel,
    format: combine(
        label({label:'Mongo'}),
        timestamp(),
        format,
    ),
    transports: outputs
  });
}

function objToKVPairs(input){
  let output = '';
  for (let key of Object.keys(input)){
    if (typeof input[key] === 'object'){
      output += `${key}=` + JSON.stringify(input[key]) + ' ';
      continue;
    }
    output += `${key}=${input[key]} `;
  }
  return output;
}

function parseLevel(level){
  if (ina(validLevels, level)){
    return level;
  }
  throw new UnknownLevelException();
}

module.exports = { logger, exceptions };



