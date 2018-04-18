// use this to overwrite winston's default timestamp.js
const fecha = require('fecha');
const { format } = require('winston');
const moment = require('moment');

const timeFormat = 'YYYY-MM-DD HH:mm:ss.SSS';

module.exports = format(function (info, opts) {
  if (opts.format) {
    info.timestamp = typeof opts.format === 'function'
        ? opts.format()
        : fecha.format(moment().format(timeFormat), opts.format);
  }

  if (!info.timestamp) {
    info.timestamp = moment().format(timeFormat);
  }

  if (opts.alias) {
    info[opts.alias] = info.timestamp;
  }

  return info;
});