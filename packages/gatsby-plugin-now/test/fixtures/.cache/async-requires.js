// prefer default export if available
const preferDefault = m => (m && m.default) || m;

exports.components = {
  'component---src-pages-index-js': () =>
    import(
      '/Users/comus/Desktop/now/packages/gatsby-plugin-now/test/fixtures/src/pages/index.js' /* webpackChunkName: "component---src-pages-index-js" */
    ),
};
