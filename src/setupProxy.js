const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/ads',
    createProxyMiddleware({
      target: 'https://pubads.g.doubleclick.net',
      changeOrigin: true,
      secure: false,
    })
  );
  
  app.use(
    '/ima',
    createProxyMiddleware({
      target: 'https://imasdk.googleapis.com',
      changeOrigin: true,
      secure: false,
    })
  );
};
