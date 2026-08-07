/**
 * gRPC client to cpa-main-backend's ContentActions service.
 * Wraps calls with deadline + error mapping (BACKEND_SPEC §5.2).
 */
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const { AppError } = require('../utils/errors');

const PROTO_PATH = path.resolve(__dirname, '../../../../proto/cpaservices/v1/content_actions.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const proto = grpc.loadPackageDefinition(packageDefinition);
const ContentActionsClient = proto.cpaservices?.v1?.ContentActions;

let client = null;

function getClient() {
  if (!client && ContentActionsClient) {
    const config = require('../config');
    client = new ContentActionsClient(
      config.MAIN_BACKEND_GRPC_ADDR,
      grpc.credentials.createInsecure()
    );
  }
  return client;
}

function wrapCall(method, payload, deadlineMs = 5000) {
  return new Promise((resolve, reject) => {
    const c = getClient();
    if (!c) return reject(new AppError('UPSTREAM_UNAVAILABLE', 502, { reason: 'gRPC client not initialized' }));
    const deadline = new Date(Date.now() + deadlineMs);
    c[method](payload, { deadline }, (err, response) => {
      if (err) {
        return reject(new AppError('UPSTREAM_UNAVAILABLE', 502, { grpcCode: err.code, message: err.details }));
      }
      resolve(response);
    });
  });
}

module.exports = {
  getContentSummary: (ref) => wrapCall('getContentSummary', ref, 2000),
  setContentStatus: (req) => wrapCall('setContentStatus', req, 2000),
  transferOwnership: (req) => wrapCall('transferOwnership', req, 2000),
  findContentBySourceUrl: (query) => wrapCall('findContentBySourceUrl', query, 2000),
  sendEmail: (req) => wrapCall('sendEmail', req, 2000),
};
