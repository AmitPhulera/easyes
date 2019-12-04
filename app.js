/**
 * @module EasyES
 * @description Exports functions to interact with AWS Elastic Cluster.
 * @exports easyES
 * @author Amit Phulera <amitp@smartjoules.in>
 */

const AWS = require('aws-sdk');
const { Client } = require('@elastic/elasticsearch');
const moment = require('moment-timezone');
const util = require('./util/app.util');

moment.tz.setDefault('Asia/Kolkata');
const { AwsConnector } = require('./lib/aws_es_connector');

class EasyES {
  constructor(cluster, region) {
    if (!cluster || !region) {
      const error = { err: 'No cluster or region info' };
      throw Error(error);
    }
    AWS.config.update({
      region,
    });
    this.client = new Client({
      node: cluster,
      Connection: AwsConnector,
    });
  }

  /**
   * @function indexRecords
   * @param {array} records A array of flattened datadevice entries
   * @description Takes an array of records and indexes them in elasticsearch using bulk API call.
   * @returns {Promise} A Promise of the bulk API call of ElasticSearch which tries to index all
   * the records in ES
   */
  indexRecords(records) {
    if (!records || !Array.isArray(records)) {
      throw Error({ err: 'Records should be array' });
    }
    const bulkRecords = records.map(util.generateESObj);
    const body = [];
    bulkRecords.map((arr) => {
      body.push(arr[0]);
      body.push(arr[1]);
      return arr;
    });
    const params = {
      body,
    };
    return this.client.bulk(params);
  }

  /**
   * @function query
   * @param {object} searchObj sails-dynamo like query object
   * @param {object} filters other options to pass to elastic search for the query
   * The following filters are avaialable as of present
   * @param {number} filters.size defaults to 10000
   * @param {string} filters.sort defaults to asc
   * @param {Boolean} filters.format defaults to 'datadevice'.
   * raw|flatten|dataDevice|tsDevParamMap
   * dataDevice : The results are structured like datadevice output
   * which basically is all the parameters will be wrapped in data key by default, if
   * you need flattened response set it to true.
   * raw : If you want raw elastic search response then set this
   * variable to true. This will dominate over flatten, and flatten will be ignored if
   *  this parameter is set to true
   * flatten : Will return you flattened results
   * tsDevParamMap : A map containing timestamp as primary key then indexed by deviceId
   * then by parameter
   *
   * {
   * <timestamp>:
   *    <deviceId>:{
   *      <paramA>:<val>,
   *      <paramB>:<val>
   * }
   * }
   * @description Queries elastic search on the basis of search object provided
   * Will return upto 10k matching results by default, if size is not specified.
   * If you want to get all the results then set size to -1 and please mind that
   * only 10lac elements can be returned after setting to -1. If more elements exists
   * that match your criteria a cursor key will be returned which can be used to further
   * query this object
   */
  async query(searchObj, options = {}) {
    if (!searchObj) throw Error({ message: 'No search Object specified' });
    try {
      const body = util.buildQueryBody(searchObj);
      const dayIndexes = util.getRelevantIndexes(searchObj);
      const monthIndexes = util.getRelevantMonthIndexes(searchObj);
      const index = [...(new Set(...dayIndexes, ...monthIndexes))];
      let { size, sort } = options;
      const { format } = options;
      if (!size || size === -1) {
        size = 10000;
        // TODO: to be changed later
      }
      sort = sort || 'asc';
      const queryObj = {
        index,
        body,
        size,
        allow_no_indices: true,
        ignore_unavailable: true,
        sort: `_id:${sort}`,
        filter_path: 'hits.hits._source.*,hits.total,hits.hits.sort',
      };
      if (searchObj.cursor) queryObj.search_after = searchObj.cursor;
      if (format === 'raw') delete queryObj.filter_path;
      const d = await this.client.search(queryObj);
      return format === 'raw' ? d : util.filterResponse(d, options);
    } catch (e) {
      console.error('Error', JSON.stringify(e));
      throw Error(e);
    }
  }

  /**
   * @function lastKnownParamValue
   * @param {string} siteId
   * @param {string} timestamp
   * @param {string} deviceId
   * @param {string} field
   * @description Queries elastic serach to get the last known value of parameter
   * specified in field before the timestamp.
   * Let say we want to get the last kvah value before 10th august 2019 of
   * a particular deviceId then this function can be used.
   */
  async lastKnownParamValue(siteId, timestamp, deviceId, field) {
    if (!siteId || !timestamp || !deviceId || !field) {
      throw Error({ err: 'Incomplete parameters at lastknownParamValues' });
    }
    const day = moment(timestamp).format('YYYY-MM-DD');
    const prevDay = moment(timestamp)
      .subtract(1, 'day')
      .format('YYYY-MM-DD');
    const index = [`${siteId}_data_${day}`, `${siteId}_data_${prevDay}`];
    const body = {
      query: {
        bool: {
          must: [
            {
              exists: {
                field,
              },
            },
            {
              term: {
                deviceId,
              },
            },
            {
              range: {
                timestamp: {
                  lte: timestamp,
                },
              },
            },
          ],
        },
      },
    };
    const queryObj = {
      index,
      body,
      size: 1,
      allow_no_indices: true,
      ignore_unavailable: true,
      sort: '_id:desc',
      filter_path: 'hits.hits._source.*,hits.total,hits.hits.sort',
    };
    const d = await this.client.search(queryObj);
    const res = util.filterResponse(d);
    if (res.length === 0) return null;
    return res[0][field];
  }
}

module.exports = {
  EasyES,
};
