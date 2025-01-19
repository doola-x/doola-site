document.querySelector('button').addEventListener('click', function() {
    const eloLichess = document.getElementById('elolichess').value;
    const eloCC = document.getElementById('elocc').value;
    const lichessUser = document.getElementById('lichessuser').value;
    const ccUser = document.getElementById('ccuser').value;
    const openingWhite = document.getElementById('owhite').value;
    const openingBlack = document.getElementById('oblack').value;
    let isUser = false;
    if (ccUser || lichessUser) {
	isUser = true;
    }
    let isElo = false;
    if (eloCC || eloLichess) {
	isElo = true;
    }
    if (!isElo || !isUser) {
        alert('Please fill out user/elo fields before submitting.');
        return;
    }
    const formData = {
        lichess_elo: eloLichess,
        chess_com_elo: eloCC,
        lichess_username: lichessUser,
        chess_com_username: ccUser,
        white_opening: openingWhite,
        black_opening: openingBlack
    };

    fetch('/submit.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
    })
    .then(data => {
	alert('thnx!');
        console.log('Success:', data);
    })
    .catch((error) => {
	alert('err, try again later.');
        console.error('Error:', error);
    });
});

