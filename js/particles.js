// shared background particle field. drops a fixed canvas behind the page,
// drifts a bunch of slate dots around, and lets the pointer stir them up.
// include with <script defer src="/js/particles.js"></script>
(function () {
	// home page previews load these pages in an iframe -- one particle field
	// per thumbnail is noisy and not free, so only run in the top window
	if (window.self !== window.top) return;

	const style = document.createElement('style');
	style.textContent = '#particle-canvas{position:fixed;top:0;left:0;background:white;display:block;z-index:-1;overflow:hidden;}';
	document.head.appendChild(style);

	let canvas = document.getElementById('particle-canvas');
	if (!canvas) {
		canvas = document.createElement('canvas');
		canvas.id = 'particle-canvas';
		document.body.insertBefore(canvas, document.body.firstChild);
	}
	const ctx = canvas.getContext('2d');
	function resizeCanvas() {
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
		ctx.lineCap = 'round'; // resizing resets canvas state
	}
	const mouse = { x: -9999, y: -9999 };
	window.addEventListener('pointermove', (event) => {
		mouse.x = event.clientX;
		mouse.y = event.clientY;
	});
	window.addEventListener('pointerdown', (event) => {
		mouse.x = event.clientX;
		mouse.y = event.clientY;
		flares.push(new CrossFlare(event.clientX, event.clientY));
	});
	resizeCanvas();

	// earthy, understated palette: moss and sage greens, ochre, terracotta,
	// with the occasional splash of vermilion red
	const EVA_COLORS = [
		{ rgb: '116, 142, 102', weight: 4 },
		{ rgb: '143, 151, 121', weight: 3 },
		{ rgb: '178, 134, 74',  weight: 3 },
		{ rgb: '150, 95, 62',   weight: 2 },
		{ rgb: '196, 59, 40',   weight: 1 },
	];
	function pickColor() {
		const total = EVA_COLORS.reduce((sum, c) => sum + c.weight, 0);
		let roll = Math.random() * total;
		for (const c of EVA_COLORS) {
			roll -= c.weight;
			if (roll <= 0) return c.rgb;
		}
		return EVA_COLORS[0].rgb;
	}

	// pre-built rgba strings so the hot loop never does string work
	const ALPHA_STEPS = 16;
	function buildLUT(rgb, maxAlpha) {
		const lut = [];
		for (let i = 0; i < ALPHA_STEPS; i++) {
			lut.push(`rgba(${rgb}, ${(maxAlpha * i / (ALPHA_STEPS - 1)).toFixed(3)})`);
		}
		return lut;
	}
	const SLATE_LUT = buildLUT('112, 148, 144', 1);
	const TRAIL_LUTS = {};
	EVA_COLORS.forEach(c => TRAIL_LUTS[c.rgb] = buildLUT(c.rgb, 0.7));
	const TWO_PI = Math.PI * 2;
	// scale particle count to screen area so phones don't melt
	function targetCount() {
		return Math.max(120, Math.min(400, Math.round(window.innerWidth * window.innerHeight / 2500)));
	}

	let particles = [];
	let flares = [];
	class Particle {
		constructor(x, y, vx, vy, size, rgb) {
			this.x = x;
			this.y = y;
			this.vx = vx; // velocity x
			this.vy = vy; // velocity y
			this.size = size;
			this.trail = TRAIL_LUTS[rgb]; // color shows only in the wake left behind
			this.energy = 0; // how recently the pointer stirred this particle
			this.alpha = Math.random() * 0.6 + 0.3;
			this.angle = Math.random() * Math.PI * 2;
			this.flicker = Math.random() * 0.03 + 0.005;
		}

		update() {
			const dx = this.x - mouse.x;
			const dy = this.y - mouse.y;
			const d2 = dx * dx + dy * dy;

			if (d2 < 40000) { // within the 200px interaction radius
				const distance = Math.sqrt(d2);
				const force = (200 - distance) / 200; // stronger force closer to the pointer
				const angle = Math.atan2(dy, dx * 1.5);
				this.vx += Math.cos(angle) * force * 2;
				this.vy += Math.sin(angle) * force * 2;
				this.energy = 1;
			} else if (this.vx * this.vx + this.vy * this.vy > 0.36) {
				// ease back toward idle drift speed instead of stopping dead
				this.vx *= 0.98;
				this.vy *= 0.98;
			}
			const sp2 = this.vx * this.vx + this.vy * this.vy;
			if (sp2 > 64) { // cap speed at 8
				const scale = 8 / Math.sqrt(sp2);
				this.vx *= scale;
				this.vy *= scale;
			}
			this.energy *= 0.96;
			this.angle += this.flicker;
			const prevX = this.x;
			const prevY = this.y;
			const sinA = Math.sin(this.angle);
			this.x += sinA * this.vx;
			this.y += sinA * this.vy;

			// fading wake behind stirred particles; no shadows here, they wreck framerate
			if (this.energy > 0.06) {
				ctx.strokeStyle = this.trail[(this.energy * (ALPHA_STEPS - 1)) | 0];
				ctx.lineWidth = this.size;
				ctx.beginPath();
				ctx.moveTo(prevX, prevY);
				ctx.lineTo(this.x, this.y);
				ctx.stroke();
			}
			this.draw(sinA);
		}

		draw(sinA) {
			const pulse = this.alpha * (0.75 + 0.25 * sinA);
			ctx.fillStyle = SLATE_LUT[(pulse * (ALPHA_STEPS - 1)) | 0];
			ctx.beginPath();
			ctx.arc(this.x, this.y, this.size, 0, TWO_PI);
			ctx.fill();
		}
	}

	// the iconic eva cross-shaped energy burst
	class CrossFlare {
		constructor(x, y) {
			this.x = x;
			this.y = y;
			this.life = 0;
			this.maxLife = 45; // frames
			// moss green or vermilion, matching the particle wake palette
			this.rgb = Math.random() < 0.5 ? '116, 142, 102' : '196, 59, 40';
		}

		update() {
			this.life++;
			const t = this.life / this.maxLife;
			const fade = 1 - t;
			const reach = 30 + t * 160;
			ctx.save();
			ctx.strokeStyle = `rgba(${this.rgb}, ${fade * 0.9})`;
			ctx.shadowColor = `rgb(${this.rgb})`;
			ctx.shadowBlur = 25 * fade;
			ctx.lineWidth = 3 * fade + 0.5;
			ctx.beginPath();
			ctx.moveTo(this.x, this.y - reach);
			ctx.lineTo(this.x, this.y + reach * 0.6);
			ctx.moveTo(this.x - reach * 0.55, this.y - reach * 0.35);
			ctx.lineTo(this.x + reach * 0.55, this.y - reach * 0.35);
			ctx.stroke();
			ctx.restore();
		}

		get dead() {
			return this.life >= this.maxLife;
		}
	}

	function initParticles(count) {
		for (let i = 0; i < count; i++) {
			const size = Math.random() * 3 + 1; // random size between 1 and 4
			const x = Math.random() * canvas.width;
			const y = Math.random() * canvas.height;
			const vx = (Math.random() - 0.5); // velocity x between -1 and 1
			const vy = (Math.random() - 0.5); // velocity y between -1 and 1
			particles.push(new Particle(x, y, vx, vy, size, pickColor()));
		}
	}

	function replenishParticles() {
		particles = particles.filter(p => p.x > 0 && p.x < canvas.width && p.y > 0 && p.y < canvas.height);
		if (particles.length < targetCount()) {
			initParticles(targetCount() - particles.length);
		}
	}

	function drawStatic() {
		ctx.fillStyle = 'white';
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		particles.forEach(p => p.draw(Math.sin(p.angle)));
	}

	function animate() {
		if (!running) return;
		// translucent wipe instead of a clear, so particles leave trails
		ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		// compact in place: drop off-screen particles without allocating a new array
		let w = 0;
		for (let i = 0; i < particles.length; i++) {
			const p = particles[i];
			if (p.x > -50 && p.x < canvas.width + 50 && p.y > -50 && p.y < canvas.height + 50) {
				particles[w++] = p;
				p.update();
			}
		}
		particles.length = w;
		w = 0;
		for (let i = 0; i < flares.length; i++) {
			if (!flares[i].dead) {
				flares[w++] = flares[i];
				flares[i].update();
			}
		}
		flares.length = w;
		requestAnimationFrame(animate);
	}

	window.addEventListener('resize', () => {
		resizeCanvas();
		particles.length = 0; // clear existing particles
		initParticles(targetCount());
		if (!running) drawStatic();
	});

	// sitting still is the whole ask here, so draw one frame and stop
	const still = window.matchMedia('(prefers-reduced-motion: reduce)');
	let running = !still.matches;
	initParticles(targetCount());
	if (running) {
		animate();
	} else {
		drawStatic();
	}

	// don't burn frames on a tab nobody is looking at
	document.addEventListener('visibilitychange', () => {
		if (still.matches) return;
		if (document.hidden) {
			running = false;
		} else if (!running) {
			running = true;
			animate();
		}
	});

	// home page's button pokes this
	window.replenishParticles = replenishParticles;
})();
