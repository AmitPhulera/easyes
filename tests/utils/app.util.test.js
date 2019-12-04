/* eslint-disable import/no-extraneous-dependencies */
const { assert } = require('chai');
const util = require('../../util/app.util');
const mock = require('../mockData/esData');

function deepCopy(obj) {
  return JSON.parse(JSON.stringify(obj));
}

describe.only('app.util.test.js test suit', () => {
  describe('buildQueryBody', () => {
    it('when valid inputs are passed , testing for gte ', () => {
      const out = util.buildQueryBody({
        deviceId: '12',
        kw: {
          gte: 1,
        },
      });
      const correctOut = {
        query: {
          bool: {
            must: [{ term: { deviceId: '12' } }, { range: { kw: { gte: 1 } } }],
          },
        },
      };
      assert.deepEqual(out, correctOut);
    });
    it('when valid inputs are passed, testing for between', () => {
      const out = util.buildQueryBody({
        deviceId: '12',
        kw: {
          between: [1, 4],
        },
      });
      const correctOut = {
        query: {
          bool: {
            must: [
              { term: { deviceId: '12' } },
              { range: { kw: { lte: 4, gte: 1 } } },
            ],
          },
        },
      };
      assert.deepEqual(out, correctOut);
    });
    it('when valid inputs are passed, testing for between', () => {
      const out = util.buildQueryBody({
        deviceId: '12',
        kw: {
          between: [1, 4],
        },
      });
      const correctOut = {
        query: {
          bool: {
            must: [
              { term: { deviceId: '12' } },
              { range: { kw: { lte: 4, gte: 1 } } },
            ],
          },
        },
      };
      assert.deepEqual(out, correctOut);
    });
    it('when invalid input are passed', () => {
      assert.throws(util.buildQueryBody);
    });
  });
  describe('dataDeviceFormat', () => {
    it('should return a object with parameters wrapped in data key', () => {
      const out = util.dataDeviceFormat(
        deepCopy(mock.esQuerySingleOutput.body.hits.hits[0]),
      );
      const correctOut = {
        deviceId: 'gknmh_20',
        timestamp: '2019-06-16 22:02:00',
        siteId: 'gknmh',
        data: {
          outputfrequency: 49.3,
          status: 1,
          kva: 2.19,
          runminutes: 49322,
        },
      };
      assert.deepEqual(out, correctOut);
    });
    it('should return an empty object', () => {
      const out = util.dataDeviceFormat();
      assert.isNull(out);
    });
  });
  describe('tsDevParamMapFormat', () => {
    it('should return a map with ts as key', () => {
      const out = util.tsDevParamMapFormat(
        deepCopy(mock.esQuerySingleOutput.body.hits.hits),
      );
      const correctOut = {
        '2019-06-16 22:02:00': {
          gknmh_20: {
            outputfrequency: 49.3,
            status: 1,
            kva: 2.19,
            runminutes: 49322,
          },
        },
      };
      assert.deepEqual(out, correctOut);
    });
    it('should return an empty object', () => {
      const out = util.tsDevParamMapFormat();
      assert.isEmpty(out);
    });
  });
  describe('getDates', () => {
    it('will return an array with dates', () => {
      const out = util.getDates('2019-01-01', '2019-01-10');
      assert.isArray(out);
      const correctOut = [
        '2019-01-01',
        '2019-01-02',
        '2019-01-03',
        '2019-01-04',
        '2019-01-05',
        '2019-01-06',
        '2019-01-07',
        '2019-01-08',
        '2019-01-09',
        '2019-01-10',
      ];
      assert.deepEqual(out, correctOut);
    });
    it('will throw an Error as start time will be more than end time', () => {
      assert.throws(() => {
        util.getDates('2019-02-01', '2019-01-01');
      });
    });
  });
  describe('filterResponse', () => {
    it('will return data in flat format', () => {
      const out = util.filterResponse(mock.esQuerySingleOutput);
      const correctOut = [
        {
          outputfrequency: 49.3,
          status: 1,
          kva: 2.19,
          runminutes: 49322,
          siteId: 'gknmh',
          deviceId: 'gknmh_20',
          timestamp: '2019-06-16 22:02:00',
        },
      ];
      assert.deepEqual(out, correctOut);
    });
    it('should call tsDevParamMapFormat', () => {
      const out = util.filterResponse(mock.esQuerySingleOutput, {
        format: 'tsDevParamMap',
      });
      const correctOut = {
        '2019-06-16 22:02:00': {
          gknmh_20: {
            outputfrequency: 49.3,
            status: 1,
            kva: 2.19,
            runminutes: 49322,
          },
        },
      };
      assert.deepEqual(out, correctOut);
    });
  });
  describe('generateESObj', () => {
    it('will provide valid input to get valid output', () => {
      const out = util.generateESObj({
        timestamp: '2019-05-01 10:10:10',
        deviceId: 'gknmh_1',
        siteId: 'gknmh',
      });
      const output = [
        {
          index: {
            _id: 'gknmh_1_2019-05-01_10:10:10',
            _index: 'gknmh_data_2019-05-01',
            _type: '_doc',
          },
        },
        {
          timestamp: '2019-05-01 10:10:10',
          deviceId: 'gknmh_1',
          siteId: 'gknmh',
        },
      ];
      assert.deepEqual(out, output);
    });
  });
  describe('getRelevantIndexes', () => {
    it('will generate perfect index array when all parameters are provided', () => {
      const out = util.getRelevantIndexes({
        deviceId: 'abc',
        siteId: 'axy',
        timestamp: {
          between: ['2019-01-01', '2019-01-05'],
        },
      });
      const correctOut = [
        'axy_data_2019-01-01',
        'axy_data_2019-01-02',
        'axy_data_2019-01-03',
        'axy_data_2019-01-04',
        'axy_data_2019-01-05',
      ];
      assert.deepEqual(out, correctOut);
    });
    it('will generalize siteId when siteId is not provided', () => {
      const out = util.getRelevantIndexes({
        deviceId: 'abc',
        timestamp: {
          between: ['2019-01-01', '2019-01-05'],
        },
      });
      const correctOut = [
        '*_data_2019-01-01',
        '*_data_2019-01-02',
        '*_data_2019-01-03',
        '*_data_2019-01-04',
        '*_data_2019-01-05',
      ];
      assert.deepEqual(out, correctOut);
    });
    it('will genralize timestamp when timestamp is not provided', () => {
      const out = util.getRelevantIndexes({
        deviceId: 'abc',
        siteId: 'xyz',
      });
      const correctOut = [
        'xyz_data_*',
      ];
      assert.deepEqual(out, correctOut);
    });
  });
  describe('getMonths', () => {
    it('will return an array with months in format YYYY-MM', () => {
      const out = util.getMonths('2019-01-01', '2019-01-01');
      assert.isArray(out);
      const correctOut = ['2019-01'];
      assert.deepEqual(out, correctOut);
    });
    it('will throw an Error as start time will be more than end time', () => {
      assert.throws(() => {
        util.getDates('2019-02-01', '2019-01-01');
      });
    });
  });
  describe('getRelevantMonthIndexes', () => {
    it('will generate perfect index array when all parameters are provided', () => {
      const out = util.getRelevantMonthIndexes({
        deviceId: 'abc',
        siteId: 'axy',
        timestamp: {
          between: ['2019-01-01', '2019-01-05'],
        },
      });
      const correctOut = [
        'axy_data_2019-01'
      ];
      assert.deepEqual(out, correctOut);
    });
    it('will generalize siteId when siteId is not provided', () => {
      const out = util.getRelevantMonthIndexes({
        deviceId: 'abc',
        timestamp: {
          between: ['2019-01-01', '2019-01-05'],
        },
      });
      const correctOut = [
        '*_data_2019-01',
      ];
      assert.deepEqual(out, correctOut);
    });
    it('will genralize timestamp when timestamp is not provided', () => {
      const out = util.getRelevantMonthIndexes({
        deviceId: 'abc',
        siteId: 'xyz',
      });
      const correctOut = ['xyz_data_*'];
      assert.deepEqual(out, correctOut);
    });
  });
});
