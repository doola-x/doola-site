import { Chess } from 'https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.13.4/chess.min.js';

const ENGINE_URL = 'https://doola.dev/inference';

// The library default is the RELATIVE path "img/chesspieces/wikipedia/...",
// which resolves against the page URL rather than the site root. Every other
// asset in chess.html is absolute, so pin this the same way.
const PIECE_THEME = '/img/chesspieces/wikipedia/{piece}.png';

// chessboard.js redraws by destroying every piece <img> and rebuilding them
// (drawPositionInstant). That happens twice a turn — once when your drop
// settles, once when the engine's move animation finishes. Recreated <img>
// elements have to be decoded before they paint, and a cold cache means a
// frame of empty board each time, which is the flicker. Warm all twelve once
// at startup so the rebuild is instant.
function preloadPieces() {
	['wK', 'wQ', 'wR', 'wB', 'wN', 'wP',
	 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP'].forEach(function (piece) {
		const img = new Image();
		img.src = PIECE_THEME.replace('{piece}', piece);
	});
}
preloadPieces();

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

// After your own drag, chessboard.js has already placed the piece on the target
// square, so a normal move needs no redraw at all. Three move types do, because
// the drag only moved one piece: castling also moves a rook, promotion swaps
// the piece for a different one, and en passant removes a pawn that is not on
// the target square. chess.js flags: k/q castle, p promotion, e en passant.
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

		// board.move() is just board.position() with the target computed from
		// the move, so there is nothing cheaper about it. Drive from game
		// state instead — that way the board can never drift from the rules
		// engine, and castling/promotion/en passant need no special case.
		board.position(game.fen());
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
	pieceTheme: PIECE_THEME,
	onDragStart,
	onDrop,
	onSnapEnd,
	position: 'start',
	dropOffBoard: 'snapback'
});

$(window).resize(board.resize);
