/* eslint-disable arrow-parens */
/* eslint-disable object-curly-newline */
/* eslint-disable no-underscore-dangle */
const TS_FORMAT = 'YYYY-MM-DD HH:mm:ss';
const moment = require('moment-timezone');

moment.tz.setDefault('Asia/Kolkata');

/**
 * @function buildQueryObj
 * @param {object} obj A sails-dynamo like search object
 * @description Build the body key of elastic search query,
 * Currently supports lte, gte,gt,lt,between,beginsWith filters.
 * It basically creates a search object with 'must' array with
 * the given conditions
 * @returns {object}
 */

function buildQueryBody(obj) {
  const must = [];
  if (!obj) throw Error({ err: 'No parameters passed to buildQueryBody' });
  Object.keys(obj).forEach(param => {
    const value = obj[param];
    switch (typeof value) {
      case 'undefined':
        return;
      case 'object': {
        let { gte, lte } = value;
        const { between, gt, beginsWith, lt } = value;
        if (typeof beginsWith !== 'undefined') {
          const prefix = {};
          prefix[param] = value.beginsWith;
          must.push({
            prefix,
          });
          return;
        }
        if (between && Array.isArray(between)) {
          if (!moment(between[1]).isAfter(moment(between[0]))) {
            throw Error('Invalid format of between');
          }

          gte = param === 'timestamp'
            ? moment(between[0]).format(TS_FORMAT)
            : between[0];
          lte = param === 'timestamp'
            ? moment(between[1]).format(TS_FORMAT)
            : between[1];
        }
        const condition = {
          lte,
          gte,
          gt,
          lt,
        };
        // for (const k in condition) {
        Object.keys(condition).forEach(k => {
          const val = condition[k];
          if (typeof val === 'undefined') delete condition[k];
          else if (param === 'timestamp') {
            condition[k] = moment(val).format(TS_FORMAT);
          }
        });

        const range = {};
        range[param] = condition;
        must.push({
          range,
        });
        break;
      }
      case 'string':
      case 'number': {
        const term = {};
        term[param] = value;
        must.push({
          term,
        });
        break;
      }
      default:
        break;
    }
  });
  return { query: { bool: { must } } };
}
/**
 * @function dataDeviceFormat
 * @param {object} record elastic search individual record
 * @description Filters elastic search packet into data device
 * format which will have all parameters wrapped in data key
 * @returns {object}
 */
function dataDeviceFormat(record) {
  if (!record) return null;
  const data = record._source;
  const { deviceId, siteId, timestamp } = data;
  delete data.deviceId;
  delete data.siteId;
  delete data.timestamp;
  return {
    deviceId,
    timestamp,
    siteId,
    data,
  };
}
/**
 * @function tsDevParamMapFormat
 * @param {object} data Elastic search individual record
 * @description Filters elastic search packet and returns a map
 * of the format <timestamp> => <deviceId> => <param> : <val>
 * @returns {object}
 */
function tsDevParamMapFormat(data) {
  const output = {};
  if (!data || !Array.isArray(data)) return output;
  data.map(record => {
    const dataObj = record._source;
    const { deviceId, timestamp } = dataObj;
    if (!output[timestamp]) output[timestamp] = {};
    if (!output[timestamp][deviceId]) output[timestamp][deviceId] = dataObj;
    delete dataObj.timestamp;
    delete dataObj.siteId;
    delete dataObj.deviceId;
    delete dataObj.captured_at;
    return null;
  });
  return output;
}
/**
 * @function getDates
 * @param {string} startTime
 * @param {string} endTime
 * @description given two timestamps the functions returns dates
 * between them.
 * @returns {array} an array of dates is returned
 */
function getDates(startTime, endTime) {
  let start = moment(startTime).startOf('day');
  const end = moment(endTime).startOf('day');
  if (start.isAfter(end)) throw Error('Start time greater than end time');
  const acc = [];
  while (start.isSameOrBefore(end)) {
    acc.push(start.format('YYYY-MM-DD'));
    start = start.add(1, 'day');
  }
  if (acc.length === 0) acc.push('*');
  return acc;
}
/**
 * @function filterResponse
 * @param {object} esdata elasticsearch raw response
 * @param {object} options filter options
 * @default {}
 * @param {string} options.format which format should be used to filter data
 */
function filterResponse(esdata, options = {}) {
  const { body } = esdata;
  const { format } = options;
  const { hits } = body;
  if (hits.total <= 0) return [];
  switch (format) {
    case 'dataDevice':
      return hits.hits.map(dataDeviceFormat);
    case 'tsDevParamMap':
      return tsDevParamMapFormat(hits.hits);
    default:
      return hits.hits.map(record => record._source);
  }
}
/**
 * @function generateESObj
 * @param {object} record A flattened entry of datadevices.
 * @description Takes a record and creates it's id and index based on it's timestamp and
 * generates objects that are suitable for bulk API call of ElasticSearch
 * @returns {array} An array containing two objects, first containing index meta and second
 *  the record itself
 */
function generateESObj(record) {
  const { timestamp, deviceId, siteId } = record;
  const [day, time] = timestamp.split(' ');
  const id = `${deviceId}_${day}_${time}`;
  const index = `${siteId}_data_${day}`;
  return [{ index: { _id: id, _index: index, _type: '_doc' } }, record];
}
/**
 * @function getMonths
 * @param {string} startTime
 * @param {string} endTime
 * @description given two timestamps the functions returns dates
 * between them.
 * @returns {array} an array of dates is returned
 */
function getMonths(startTime, endTime) {
  let start = moment(startTime).startOf('month');
  const end = moment(endTime).startOf('month');
  if (start.isAfter(end)) throw Error('Start time greater than end time');
  const acc = [];
  while (start.isSameOrBefore(end)) {
    acc.push(start.format('YYYY-MM'));
    start = start.add(1, 'month');
  }
  if (acc.length === 0) acc.push('*');
  return acc;
}
/**
 * @function getRelevantIndexes
 * @param {Object} obj sails-dynamo like query object
 * @description based on search object figures out relevant indexes that should
 * be queried. It optimized the query performace
 */
function getRelevantIndexes(obj) {
  let indexList = '';
  let prefix = '';
  if (obj.siteId) prefix = `${obj.siteId}_data_`;
  else prefix = '*_data_';
  if (!obj.timestamp) indexList = `${prefix}*`;
  else {
    const { timestamp } = obj;
    let daysArr = [];
    if (timestamp.gte || timestamp.gt) {
      daysArr = getDates(timestamp.gte, moment().format('YYYY-MM-DD'));
    } else if (timestamp.between) {
      daysArr = getDates(timestamp.between[0], timestamp.between[1]);
    } else {
      daysArr = ['*'];
    }
    indexList = daysArr.reduce((prev, curr) => {
      let str = '';
      if (!prev) str = `${prefix}${curr}`;
      else str = `${prev},${prefix}${curr}`;
      return str;
    }, '');
  }
  return indexList.split(',');
}
/**
 * @function getRelevantMonthIndexes
 * @param {Object} obj sails-dynamo like query object
 * @description based on search object figures out relevant indexes that should be queried
 */
function getRelevantMonthIndexes(obj) {
  let indexList = '';
  let prefix = '';
  if (obj.siteId) prefix = `${obj.siteId}_data_`;
  else prefix = '*_data_';
  if (!obj.timestamp) indexList = `${prefix}*`;
  else {
    const { timestamp } = obj;
    let monthsArr = [];
    if (timestamp.gte || timestamp.gt) {
      monthsArr = getMonths(timestamp.gte, moment().format('YYYY-MM-DD'));
    } else if (timestamp.between) {
      monthsArr = getMonths(timestamp.between[0], timestamp.between[1]);
    } else {
      monthsArr = ['*'];
    }
    indexList = monthsArr.reduce((prev, curr) => {
      let str = '';
      if (!prev) str = `${prefix}${curr}`;
      else str = `${prev},${prefix}${curr}`;
      return str;
    }, '');
  }
  return indexList.split(',');
}

module.exports = {
  getRelevantIndexes,
  getMonths,
  getRelevantMonthIndexes,
  generateESObj,
  filterResponse,
  dataDeviceFormat,
  getDates,
  tsDevParamMapFormat,
  buildQueryBody,
};
