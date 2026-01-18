chrome.webRequest.onHeadersReceived.addListener(
  function(details) {
    // Remove CORS headers from iframe responses
    return {
      responseHeaders: details.responseHeaders.filter(header => 
        !['content-security-policy', 'x-frame-options'].includes(header.name.toLowerCase())
      )
    };
  },
  { urls: ["*://net20.cc/*"] },
  ["blocking", "responseHeaders"]
);
