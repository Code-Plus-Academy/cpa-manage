/**
 * SocialActions gRPC handler implementations.
 * Phase 0: stub handlers — full implementations added in Phase 1.
 */
const grpc = require('@grpc/grpc-js');

const socialActionsHandlers = {
  createTicket(call, callback) {
    callback({
      code: grpc.status.UNIMPLEMENTED,
      message: 'CreateTicket not yet implemented (Phase 1)',
    });
  },

  getUserStanding(call, callback) {
    callback({
      code: grpc.status.UNIMPLEMENTED,
      message: 'GetUserStanding not yet implemented (Phase 1)',
    });
  },

  reportContent(call, callback) {
    callback({
      code: grpc.status.UNIMPLEMENTED,
      message: 'ReportContent not yet implemented (Phase 1)',
    });
  },
};

module.exports = socialActionsHandlers;
