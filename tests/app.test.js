/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable no-throw-literal */
/* The rule is disabled for handling the error in await statements
The function call that are expected to throw error but did not are
being thrown in next line.
*/
const { assert } = require('chai');
const sinon = require('sinon');
const { Client } = require('@elastic/elasticsearch');
const app = require('../app.js');
const util = require('../util/app.util');
const mock = require('./mockData/esData');

describe('app.js Test Suite', () => {
  let esClient = {};
  let ez;
  before(() => {
    // $configUpdate = sinon.stub(AWS.config, 'update');
    ez = new app.EasyES('http://dummyurl.com', 'region');
    esClient = ez.client;
  });
  describe('Constructer Test cases', () => {
    it('With valid parameters', () => {
      assert.instanceOf(ez.client, Client);
    });
    it('With invalid parameters', () => {
      try {
        const obj = new app.EasyES();
        if (obj) throw { err: 'It should have thrown an error' };
      } catch (err) {
        assert.instanceOf(err, Error);
      }
    });
  });
  describe('test indexRecords', () => {
    it('valid parameters', async () => {
      const $genESObj = sinon.spy(util, 'generateESObj');
      const $bulk = sinon.stub(esClient, 'bulk').resolves(true);
      const x = await ez.indexRecords(mock.filteredData);
      assert.strictEqual($genESObj.callCount, mock.filteredData.length);
      assert.isTrue($bulk.called);
      assert.isTrue(x);
      $genESObj.restore();
      $bulk.restore();
    });
    it('invalid parameters', async () => {
      assert.throw(ez.indexRecords);
      assert.throws(() => {
        ez.indexRecords('blah');
      });
    });
  });
  describe('test: query ', () => {
    it('invalid arguments should throw an error', async () => {
      try {
        await ez.query();
        throw 'Should have thrown error but did not';
      } catch (e) {
        assert.instanceOf(e, Error);
      }
    });
    it('valid parameters', async () => {
      const searchObj = {
        deviceId: '123',
        timestamp: {
          between: ['2019-01-01', '2019-02-01'],
        },
      };
      const $search = sinon
        .stub(esClient, 'search')
        .resolves(mock.esQueryOutput);
      const $filterResponse = sinon.spy(util, 'filterResponse');
      const out = await ez.query(searchObj);
      assert.isArray(out);
      assert.equal(out.length, mock.esQueryOutput.body.hits.hits.length);
      assert.isTrue($search.called);
      assert.isTrue($filterResponse.called);
      $filterResponse.restore();
      $search.restore();
    });
  });
  describe('test: lastKnownParamValue', () => {
    it('with correct parameters', async () => {
      const $search = sinon
        .stub(esClient, 'search')
        .resolves(mock.esQuerySingleOutput);
      const res = await ez.lastKnownParamValue('gknmh', '2019-06-16 22:02:00', 'gknmh_20_', 'status');
      assert.strictEqual(res, 1);
      $search.restore();
    });
    it('invalid arguments should throw an error', async () => {
      try {
        await ez.lastKnownParamValue();
        throw 'Should have thrown error but did not';
      } catch (e) {
        assert.instanceOf(e, Error);
      }
    });
  });
});
