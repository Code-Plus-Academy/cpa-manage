/**
 * gRPC server bootstrap — registers SocialActions service.
 * Phase 0: stub handlers returning UNIMPLEMENTED.
 */
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

const PROTO_PATH = path.resolve(__dirname, '../../../../proto/cpaservices/v1/social_actions.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const proto = grpc.loadPackageDefinition(packageDefinition);
const socialActionsService = proto.cpaservices?.v1?.SocialActions?.service;

const handlers = require('./handlers/socialActions');

const server = new grpc.Server();

if (socialActionsService) {
  server.addService(socialActionsService, handlers);
}

module.exports = {
  start(port) {
    server.bindAsync(
      `0.0.0.0:${port}`,
      grpc.ServerCredentials.createInsecure(),
      (err, boundPort) => {
        if (err) {
          console.error('[gRPC] Failed to bind:', err.message);
          return;
        }
        console.log(`[gRPC] SocialActions server listening on port ${boundPort}`);
      }
    );
  },
  server,
};
