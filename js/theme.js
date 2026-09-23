// light/dark switch. load it *blocking* in <head> -- it stamps
// html[data-theme] before first paint so a dark reload never flashes white.
// include with <script src="/js/theme.js"></script>
(function () {
	const KEY = 'doola-theme';
	const root = document.documentElement;

	function read() {
		try {
			return localStorage.getItem(KEY);
		} catch (e) {
			return null; // private mode / blocked site data
		}
	}

	// stored choice wins; otherwise the site stays the light thing it was built as
	let theme = read() === 'dark' ? 'dark' : 'light';
	root.setAttribute('data-theme', theme);

	function apply(next) {
		theme = next;
		root.setAttribute('data-theme', next);
		window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: next } }));
	}

	// home page previews are same-origin iframes: they pick up the theme above
	// and follow the parent through the storage event, but get no button
	window.addEventListener('storage', (event) => {
		if (event.key === KEY) apply(event.newValue === 'dark' ? 'dark' : 'light');
	});

	if (window.self !== window.top) return;

	const SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"' +
		' stroke-linecap="round" aria-hidden="true">' +
		'<g class="sun"><circle cx="12" cy="12" r="4.5"/>' +
		'<path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3' +
		'M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M19.4 4.6l-2.1 2.1M6.7 17.3l-2.1 2.1"/></g>' +
		'<path class="moon" d="M20.5 14.8A8.6 8.6 0 0 1 9.2 3.5a8.6 8.6 0 1 0 11.3 11.3z"/>' +
		'</svg>';

	function mount() {
		if (document.getElementById('theme-toggle')) return;
		const button = document.createElement('button');
		button.id = 'theme-toggle';
		button.type = 'button';
		button.title = 'toggle dark mode';
		button.setAttribute('aria-label', 'toggle dark mode');
		button.innerHTML = SVG;
		button.addEventListener('click', () => {
			const next = theme === 'dark' ? 'light' : 'dark';
			try {
				localStorage.setItem(KEY, next);
			} catch (e) {
				// no persistence available; the flip still holds for this page
			}
			apply(next);
		});
		document.body.insertBefore(button, document.body.firstChild);
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', mount);
	} else {
		mount();
	}
})();
