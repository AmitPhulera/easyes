/**
 * @class AwsConnector
 * @description creates a signed request for every query that goes to AWS elasticsearch
 * Inspired from the following gist
 * https://gist.github.com/parthdesai93/1bd3a25ad4cf788d49ce4a00a1bb3268#comments
 * Currently built to pick up AWS credentials from .aws/config or from the role where
 * if application is deployed on AWS. 
 * Support for custom access key and secret key will be added in very near future. 
 */

const AWS = require('aws-sdk');
const { Connection } = require('@elastic/elasticsearch');

async function getAWSCredentials() {
  return new Promise((resolve, reject) => {
    AWS.config.getCredentials((err, creds) => {
      if (err) {
        reject(err);
      }

      resolve(creds);
    });
  });
}

function signRequest(request, creds) {
  const signer = new AWS.Signers.V4(request, 'es');
  signer.addAuthorization(creds, new Date());
  return signer;
}

class AwsConnector extends Connection {
  async request(params, callback) {
    try {
      const creds = await getAWSCredentials();
      const req = this.createRequest(params);
      const { request: signedRequest } = signRequest(req, creds);
      super.request(signedRequest, callback);
    } catch (error) {
      throw error;
    }
  }

  createRequest(params) {
    const endpoint = new AWS.Endpoint(this.url.href);
    const req = new AWS.HttpRequest(endpoint);

    Object.assign(req, params);
    req.region = AWS.config.region;

    if (!req.headers) {
      req.headers = {};
    }
    const { body } = params;
    if (body) {
      const contentLength = Buffer.isBuffer(body)
        ? body.length
        : Buffer.byteLength(body);
      req.headers['Content-Length'] = contentLength;// +params.querystring.length;
      req.body = body;
    }
    req.headers.Host = endpoint.host;
    req.path += `?${req.querystring}`;
    delete req.querystring;
    return req;
  }
}

module.exports = { AwsConnector };
