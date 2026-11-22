// Vercel serverless entry point: every non-static request is handled by the Express app.
const { getApp } = require('../server/index');

module.exports = async (req, res) => {
  try {
    const app = await getApp();
    return app(req, res);
  } catch (err) {
    console.error('[fatal] Could not start:', err.message);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('The site is temporarily unavailable. Please try again shortly.');
  }
};
