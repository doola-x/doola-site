import { Chess } from 'https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.13.4/chess.min.js';

const ENGINE_URL = 'https://doola.dev/inference';

// Give up on the engine after this long and show the resign modal. The server
// answers in well under a second when healthy, so anything near this means it
// is wedged, restarting, or unreachable.
const ENGINE_TIMEOUT_MS = 10000;

var game = new Chess();

// You play white, the engine answers as black. Set while a request is in
// flight so you can't move for the engine while it is still thinking.
let waitingForEngine = false;

// Set by onDrop, consumed by onSnapEnd — see needsFullResync.
let resyncOnSnap = false;

function showSpinner(on) {
	const spinner = document.getElementById("loader");
	if (spinner) spinner.style.display = on ? "block" : "none";
}

function setResigns(on) {
	const resigns = document.getElementById("resigns");
	if (resigns) resigns.style.display = on ? "block" : "none";
}

// board.position() re-renders every piece on the board. board.move() animates
// only the piece that moved. Prefer the latter — a full re-render on every
// half-move is what makes the board flicker.
//
// Three move types can't be expressed as a single animated move, so they still
// need the full resync: castling moves a rook too, promotion swaps the piece
// for a different one, and en passant removes a pawn that isn't on the target
// square. chess.js flags: k/q castle, p promotion, e en passant.
function needsFullResync(move) {
	return /[epkq]/.test(move.flags);
}

function reportGameOver() {
	if (!game.in_checkmate()) {
		console.log('draw');
		return;
	}
	// game.turn() is the side that has been mated. "i resign!" is the engine
	// talking, so only show it when the engine is the one that lost — popping
	// it when you get mated would have it conceding a game it just won.
	const engineMated = game.turn() === 'b';
	console.log(engineMated ? 'engine checkmated' : 'you were checkmated');
	if (engineMated) setResigns(true);
}

function askEngine() {
	waitingForEngine = true;
	setResigns(false);          // clear any modal left over from a prior game
	showSpinner(true);

	// fetch has no native timeout — without this a wedged or unreachable
	// server just hangs the spinner forever instead of resigning.
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), ENGINE_TIMEOUT_MS);

	fetch(ENGINE_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ fen: game.fen() }),
		signal: controller.signal
	})
	.then(response => {
		if (!response.ok) {
			throw new Error('Network response was not ok: ' + response.statusText);
		}
		return response.json();
	})
	.then(data => {
		// The server sends "" when the game is over, it has no legal move,
		// or the FEN was rejected. Without this we build
		// "undefined-undefined", game.move() returns null, and reading
		// .flags off it throws — so checkmate looked like a frozen board.
		if (!data || data.length < 2) {
			if (game.game_over()) reportGameOver();
			else setResigns(true);
			return;
		}

		// data[2] is the promotion piece, present only on promotions.
		const move = game.move({
			from: data[0],
			to: data[1],
			promotion: data[2] || 'q'
		});
		if (move === null) {
			console.error('engine sent an illegal move:', data, 'for', game.fen());
			setResigns(true);
			return;
		}

		if (needsFullResync(move)) {
			board.position(game.fen());
		} else {
			board.move(data[0] + '-' + data[1]);
		}
		if (game.game_over()) reportGameOver();
	})
	.catch(error => {
		if (error.name === 'AbortError') {
			console.warn('engine timed out after ' + ENGINE_TIMEOUT_MS + 'ms');
		} else {
			console.error('Error: ', error);
		}
		setResigns(true);
	})
	.finally(() => {
		clearTimeout(timer);
		waitingForEngine = false;
		showSpinner(false);
	});
}

function onDragStart(source, piece) {
	// Replaces the old `if (piece.startsWith('w'))` wrapper around the fetch.
	// That accepted a black drag and then quietly declined to answer it,
	// leaving the game a move out of step; refusing the drag is clearer.
	if (game.game_over()) return false;
	if (waitingForEngine) return false;
	if (piece.startsWith('b')) return false;
}

function onDrop(source, target, piece) {
	const move = game.move({
		from: source,
		to: target,
		promotion: 'q' // always promote to a queen
	});
	// illegal move
	if (move === null) return 'snapback';

	// onSnapEnd fires after the drag animation settles; tell it whether this
	// move needs a redraw at all.
	resyncOnSnap = needsFullResync(move);

	if (game.game_over()) {
		reportGameOver();
		return;
	}
	askEngine();
}

function onSnapEnd() {
	// The drag already put your piece on the target square, so a normal move
	// needs no redraw — repainting all 32 pieces here was the flicker. Only
	// castling, promotion and en passant actually need the board resynced,
	// and onSnapEnd is the right place for it (doing it inside onDrop fights
	// the snap animation).
	if (!resyncOnSnap) return;
	resyncOnSnap = false;
	board.position(game.fen());
}

var board = Chessboard('board', {
	draggable: true,
	// The library's default pieceTheme is the RELATIVE path
	// "img/chesspieces/wikipedia/{piece}.png", which resolves against the page
	// URL rather than the site root. Every other asset in chess.html is
	// absolute, so pin this the same way — a 404 here means pieces re-request
	// on each redraw, which reads as flicker.
	pieceTheme: '/img/chesspieces/wikipedia/{piece}.png',
	onDragStart,
	onDrop,
	onSnapEnd,
	position: 'start',
	dropOffBoard: 'snapback'
});

$(window).resize(board.resize);
