import { Chess } from 'https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.13.4/chess.min.js';

const ENGINE_URL = 'https://doola.dev/inference';

var game = new Chess();

// You play white, the engine answers as black. Set while a request is in
// flight so you can't move for the engine while it is still thinking.
let waitingForEngine = false;

function showSpinner(on) {
	const spinner = document.getElementById("loader");
	if (spinner) spinner.style.display = on ? "block" : "none";
}

function showResigns() {
	const resigns = document.getElementById("resigns");
	if (resigns) resigns.style.display = "block";
}

function reportGameOver() {
	console.log(game.in_checkmate() ? 'checkmate' : 'draw');
}

function askEngine() {
	waitingForEngine = true;
	showSpinner(true);

	fetch(ENGINE_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ fen: game.fen() })
	})
	.then(response => {
		if (!response.ok) {
			showResigns();
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
			else showResigns();
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
			showResigns();
			return;
		}

		board.position(game.fen());
		if (game.game_over()) reportGameOver();
	})
	.catch(error => console.error('Error: ', error))
	.finally(() => {
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

	if (game.game_over()) {
		reportGameOver();
		return;
	}
	askEngine();
}

function onSnapEnd() {
	// Resync from game state here rather than in onDrop — doing it mid-drop
	// fights the snap animation. Covers castling's rook, promotion and en
	// passant, all of which a plain drag renders wrong.
	board.position(game.fen());
}

var board = Chessboard('board', {
	draggable: true,
	onDragStart,
	onDrop,
	onSnapEnd,
	position: 'start',
	dropOffBoard: 'snapback'
});

$(window).resize(board.resize);
