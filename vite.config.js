const fs = require("node:fs");
const path = require("node:path");

// Loomwright Shell.html uses <script type="text/babel" src="*.jsx">.
// Those files must be served as raw source for Babel Standalone; Vite's
// normal JSX transform rewrites them into module/runtime code that cannot run
// inside text/babel script tags.
module.exports = {
  plugins: [{
    name: "loomwright-raw-jsx-for-babel-standalone",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url || "/", "http://localhost");
        const pathname = decodeURIComponent(url.pathname);
        if (!pathname.endsWith(".jsx")) {
          next();
          return;
        }

        const root = server.config.root;
        const filePath = path.resolve(root, pathname.replace(/^\/+/, ""));
        if (!filePath.startsWith(root + path.sep)) {
          res.statusCode = 403;
          res.end("Forbidden");
          return;
        }

        fs.readFile(filePath, "utf8", (err, source) => {
          if (err) {
            next();
            return;
          }
          res.statusCode = 200;
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
          res.end(source);
        });
      });
    },
  }],
};
