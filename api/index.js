// Vercel serverless entry point: every non-static request is handled by the Express app.
let getApp;

module.exports = async (req, res) => {
  try {
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
