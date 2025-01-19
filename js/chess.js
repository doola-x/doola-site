import { Chess } from 'https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.13.4/chess.min.js';

function parseFEN(fen) {
    let parts = fen.split(' ');
    return {
        position: parts[0],
        turn: parts[1],
        castling: parts[2],
        enPassant: parts[3],
        halfMove: parts[4],
        fullMove: parts[5]
    };
}

function expandFEN(fenPosition) {
    let rows = fenPosition.split('/');
    let fullLayout = {};
    let currentFile = 'a', currentRank = '8';

    rows.forEach(row => {
        currentFile = 'a';
        for (let char of row) {
            if (isNaN(char)) {
                fullLayout[currentFile + currentRank] = char;
                currentFile = String.fromCharCode(currentFile.charCodeAt(0) + 1);
            } else {
                // Skip over empty squares
                for (let i = 0; i < parseInt(char); i++) {
                    currentFile = String.fromCharCode(currentFile.charCodeAt(0) + 1);
                }
            }
        }
        currentRank = String.fromCharCode(currentRank.charCodeAt(0) - 1);
    });

    return fullLayout;
}

function updateCastling(fen, move) {
    if (move.includes('e1') || move.includes('h1')) {
        fen.castling = fen.castling.replace('K', '');
    }
    if (move.includes('e1') || move.includes('a1')) {
        fen.castling = fen.castling.replace('Q', '');
    }
    return `${fen.position} ${fen.turn} ${fen.castling} ${fen.enPassant} ${fen.halfMove} ${fen.fullMove}`;
}

function toggleTurn(fen) {
    let fenParts = parseFEN(fen);
    fenParts.turn = fenParts.turn === 'w' ? 'b' : 'w';
    return `${fenParts.position} ${fenParts.turn} ${fenParts.castling} ${fenParts.enPassant} ${fenParts.halfMove} ${fenParts.fullMove}`;
}

function updateFullMove(fen, lastMoveColor) {
    let fenParts = parseFEN(fen);
    if (lastMoveColor === 'b') {  // Increment after black moves
        fenParts.fullMove = parseInt(fenParts.fullMove) + 1;
    }
    return `${fenParts.position} ${fenParts.turn} ${fenParts.castling} ${fenParts.enPassant} ${fenParts.halfMove} ${fenParts.fullMove}`;
}

function updateHalfMove(fen, move, isCapture, isPawnMove) {
    let fenParts = parseFEN(fen);
    if (isCapture || isPawnMove) {
        fenParts.halfMove = '0';
    } else {
        fenParts.halfMove = parseInt(fenParts.halfMove) + 1;
    }
    return `${fenParts.position} ${fenParts.turn} ${fenParts.castling} ${fenParts.enPassant} ${fenParts.halfMove} ${fenParts.fullMove}`;
}

function processMove(fen, from, to, playerColor) {
    let board = expandFEN(parseFEN(fen).position);
    let isCapture = board[to] && board[to] !== ' '; // Assumes non-empty square is a capture
    let isPawnMove = board[from] === 'p'; // Assumes 'p' or 'P' is a pawn

    fen = parseFEN(fen);
    let updatedFEN = updateCastling(fen, (to+from));
    console.log(updatedFEN);
    updatedFEN = updateHalfMove(updatedFEN, (to+from), isCapture, isPawnMove);
    console.log(updatedFEN);
    updatedFEN = toggleTurn(updatedFEN);
    console.log(updatedFEN);
    updatedFEN = updateFullMove(updatedFEN, playerColor);

    return updatedFEN;
}

function onDrop (source, target, piece, newPos) {
	var move = game.move({
		from: source,
		to: target,
		promotion: 'q' // NOTE: always promote to a queen for example simplicity
	})
	// illegal move
	if (move === null) return 'snapback'
        if (piece.startsWith('w')) {
		if (move.flags === 'k') {
			//do kingside castle
			board.move('h1-f1');
		} else if (move.flags === 'q') {
			// do queenside castle
			board.move('a1-d1');
		}
                // show spinner on black king
                const spinner = document.getElementById("loader");
		const resigns = document.getElementById("resigns");
                spinner.style.display = "block";
		const fen = game.fen();
		console.log(fen);
                fetch('https://doola.dev/inference', {
                        method: 'POST',
                        headers: {
                                'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ fen: fen })
                })
                .then(response => {
                        spinner.style.display = "none";
                        if (!response.ok){
				resigns.style.display = "block";
                                throw new Error('Network response was not ok: ' + response.statusText);
                        }
                        return response.json();
                })
                .then(data => {
			const arr = data;
			/*const arr = data.result.
                                replace("('", '').
                                replace("')", '').
                                split("', '");*/
                        const move = arr[0] + '-' + arr[1];
                        board.move(move);
			var move2 = game.move({
				from: arr[0],
				to: arr[1],
				promotion: 'q'
			});
			if (move2.flags === 'k') {
				//do kingside castle
				board.move('h8-f8');
			} else if (move2.flags === 'q') {
				// do queenside castle
				board.move('a8-d8');
			}
			//console.log(second_fen);
                        spinner.style.display = "none";
                })
                .catch(error => console.error('Error: ', error));
        }
}
var board = Chessboard('board', {
        draggable: true,
        onDrop,
        position: 'start',
        dropOffBoard: 'snapback'
});
var game = new Chess();
$(window).resize(board.resize);
