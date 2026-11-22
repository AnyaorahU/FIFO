// Vercel serverless entry point: every non-static request is handled by the Express app.
let getApp;

// Vercel's Node runtime attaches its own helpers to each request (res.redirect defaulting to 307, res.status,
// res.send, res.json, and lazily parsed req.query / req.body / req.cookies). As own properties they shadow
// Express's versions: redirects became 307 (so browsers re-POSTed the login form to /dashboard) and requests
// skipped the app's own strict query/body parsing. Removing them makes Express behave exactly as it does locally.
const VERCEL_RES_HELPERS = ['redirect', 'status', 'send', 'json'];
const VERCEL_REQ_HELPERS = ['query', 'body', 'cookies'];

function stripVercelHelpers(req, res) {
  for (const key of VERCEL_RES_HELPERS) {
    if (Object.prototype.hasOwnProperty.call(res, key)) Reflect.deleteProperty(res, key);
  }
  for (const key of VERCEL_REQ_HELPERS) {
    if (Object.prototype.hasOwnProperty.call(req, key)) Reflect.deleteProperty(req, key);
  }
}

module.exports = async (req, res) => {
  try {
    stripVercelHelpers(req, res);
    // Loaded here (not at the top) so configuration errors are caught and logged instead of crashing the function.
    getApp = getApp || require('../server/index').getApp;
    const app = await getApp();
    return app(req, res);
  } catch (err) {
    console.error('[fatal] Could not start:', err.message);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end('The site is temporarily unavailable. Please try again shortly.');
  }
};
