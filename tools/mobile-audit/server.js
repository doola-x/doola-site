// Tiny static server that mimics the production layout:
// /*.html is served from html/, /img /css /js /php from the repo root.
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const PORT = process.env.PORT || 8732;

const MIME = {
	'.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
	'.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
	'.svg': 'image/svg+xml', '.json': 'application/json',
};

const server = http.createServer((req, res) => {
	let urlPath = decodeURIComponent(req.url.split('?')[0]);
	if (urlPath === '/') urlPath = '/home.html';

	let filePath;
	if (urlPath.endsWith('.html')) {
		filePath = path.join(ROOT, 'html', urlPath);
	} else {
		filePath = path.join(ROOT, urlPath);
	}

	if (!filePath.startsWith(ROOT)) {
		res.writeHead(403); res.end('forbidden'); return;
	}

	fs.readFile(filePath, (err, data) => {
		if (err) { res.writeHead(404); res.end('not found: ' + urlPath); return; }
		res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
		res.end(data);
	});
});

server.listen(PORT, () => console.log(`serving ${ROOT} on http://localhost:${PORT}`));

module.exports = server;
