// Docs: https://github.com/Azure/iisnode/blob/master/src/samples/advanced/interceptor/interceptor.js
// This script is executed by iisnode for each incoming request and is used to
// dynamically configure iisnode options.

module.exports.onPostExecute = function (req, res, data, callback) {
  // If the response is a 404 and the path does not have an extension,
  // it's likely a client-side route. We return a 200 OK with the original
  // content, allowing the Next.js client-side router to handle it.
  // This is a common pattern for SPAs on IIS.
  if (res.statusCode === 404 && req.url.indexOf('.') === -1) {
    res.statusCode = 200;
  }
  
  callback(null, data);
};
