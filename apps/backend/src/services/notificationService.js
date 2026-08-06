/**
 * STUB: Notification service — logs only.
 * Replace with real email integration later.
 */
async function notifyCandidateStatusChange(applicationId, newStatus) {
  console.log(`[STUB] Would email candidate about application ${applicationId} status change to ${newStatus}`);
}

async function notifyCandidateNewMessage(applicationId) {
  console.log(`[STUB] Would email candidate about new admin message on application ${applicationId}`);
}

module.exports = { notifyCandidateStatusChange, notifyCandidateNewMessage };
