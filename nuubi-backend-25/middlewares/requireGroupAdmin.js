/**
 * Require requester to be a group admin for the current request.
 *
 * Expects loadGroupRole to have run before this middleware:
 * - req.isGroupAdmin
 */
function requireGroupAdmin(req, res, next) {
  if (!req.isGroupAdmin) {
    return res.status(403).json({
      error: "Access denied. Only professors and TAs can view this analytics.",
    });
  }
  return next();
}

module.exports = { requireGroupAdmin };

