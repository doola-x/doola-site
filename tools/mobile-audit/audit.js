// Mobile-compatibility audit. Loads each page in headless Chrome at several
// mobile viewports, screenshots them, and reports layout problems:
//   - horizontal overflow (page wider than viewport)
//   - elements that stick out past the viewport edge
//   - tap targets smaller than 40x40
//   - font sizes under 12px
//   - console/page errors
// Usage: node audit.js   (screenshots land in tools/mobile-audit/shots/)
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

require('./server');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = `http://localhost:${process.env.PORT || 8732}`;
const PAGES = ['/home.html', '/blog.html', '/chess.html'];
const VIEWPORTS = [
	{ name: 'iphone-se', width: 375, height: 667, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
	{ name: 'iphone-14', width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
	{ name: 'pixel-7', width: 412, height: 915, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true },
	{ name: 'ipad-mini', width: 768, height: 1024, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
];

const SHOTS = path.join(__dirname, 'shots');

function inspectPage(expectedWidth) {
	const vw = window.innerWidth;
	const issues = [];

	// With a proper viewport meta, innerWidth should equal the device width.
	// If it's larger, content overflow forced the browser to zoom the page out.
	if (vw > expectedWidth + 1) {
		issues.push({ type: 'forced-zoom-out', detail: `layout viewport ${vw}px > device width ${expectedWidth}px — content forced the page to shrink-to-fit` });
	}

	const docWidth = Math.max(
		document.documentElement.scrollWidth,
		document.body ? document.body.scrollWidth : 0
	);
	if (docWidth > vw + 1) {
		issues.push({ type: 'horizontal-overflow', detail: `page scrollWidth ${docWidth}px > viewport ${vw}px` });
	}

	const seen = new Set();
	for (const el of document.querySelectorAll('body *')) {
		const r = el.getBoundingClientRect();
		if (r.width === 0 && r.height === 0) continue;
		const style = getComputedStyle(el);
		if (style.position === 'fixed' || style.display === 'none') continue;

		if ((r.right > vw + 5 || r.left < -5) && !seen.has(el)) {
			// only report the outermost offender in a chain
			if (!el.parentElement || !seen.has(el.parentElement)) {
				issues.push({
					type: 'element-overflow',
					detail: `<${el.tagName.toLowerCase()} class="${el.className && el.className.baseVal !== undefined ? '' : el.className}"> spans ${Math.round(r.left)}..${Math.round(r.right)}px (viewport ${vw}px)`,
				});
			}
			seen.add(el);
		}

		if ((el.onclick || el.tagName === 'A' || el.tagName === 'BUTTON' || style.cursor === 'pointer')
			&& r.width > 0 && (r.width < 40 || r.height < 24)
			&& el.children.length === 0) {
			issues.push({
				type: 'small-tap-target',
				detail: `<${el.tagName.toLowerCase()} class="${el.className}"> is ${Math.round(r.width)}x${Math.round(r.height)}px`,
			});
		}

		const fs = parseFloat(style.fontSize);
		if (el.innerText && el.innerText.trim() && el.children.length === 0 && fs && fs < 12) {
			issues.push({
				type: 'tiny-font',
				detail: `<${el.tagName.toLowerCase()} class="${el.className}"> font-size ${fs}px: "${el.innerText.trim().slice(0, 40)}"`,
			});
		}
	}

	// dedupe
	const out = [];
	const keys = new Set();
	for (const i of issues) {
		const k = i.type + i.detail;
		if (!keys.has(k)) { keys.add(k); out.push(i); }
	}
	return out;
}

(async () => {
	fs.mkdirSync(SHOTS, { recursive: true });
	const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
	let totalIssues = 0;

	for (const pagePath of PAGES) {
		for (const vp of VIEWPORTS) {
			const page = await browser.newPage();
			const errors = [];
			page.on('pageerror', e => errors.push(String(e.message || e)));
			page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

			await page.setViewport(vp);
			await page.goto(BASE + pagePath, { waitUntil: 'networkidle0', timeout: 20000 });
			await new Promise(r => setTimeout(r, 800)); // let animations/canvas settle

			const issues = await page.evaluate(inspectPage, vp.width);
			for (const e of errors) issues.push({ type: 'js-error', detail: e });

			const shot = path.join(SHOTS, `${pagePath.replace(/[/.]/g, '_')}-${vp.name}.png`);
			await page.screenshot({ path: shot, fullPage: true });

			const label = `${pagePath} @ ${vp.name} (${vp.width}px)`;
			if (issues.length) {
				totalIssues += issues.length;
				console.log(`\n✗ ${label}`);
				for (const i of issues) console.log(`   [${i.type}] ${i.detail}`);
			} else {
				console.log(`\n✓ ${label} — clean`);
			}
			await page.close();
		}
	}

	await browser.close();
	console.log(`\n${totalIssues === 0 ? 'PASS — no issues found' : `FAIL — ${totalIssues} issue(s) found`}`);
	process.exit(totalIssues === 0 ? 0 : 1);
})();
