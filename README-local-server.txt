Run locally without CORS errors:

1) Using Python (installed by default on macOS):
   cd rsvp-suite
   python3 -m http.server 5173

   Then open: http://localhost:5173/index.html

2) Using Node:
   npm i -g serve
   serve . -l 5173

Opening files directly via file:// will block ES module scripts (CORS). Always use http://localhost.
