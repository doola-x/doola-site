<?php
$postData = json_decode(file_get_contents("php://input"), true);

function sanitize_input($data) {
    return htmlspecialchars(strip_tags(trim($data)));
}

if ($postData) {
    $lichessElo = isset($postData['lichess_elo']) ? sanitize_input($postData['lichess_elo']) : '';
    $chessComElo = isset($postData['chess_com_elo']) ? sanitize_input($postData['chess_com_elo']) : '';
    $lichessUsername = isset($postData['lichess_username']) ? sanitize_input($postData['lichess_username']) : '';
    $chessComUsername = isset($postData['chess_com_username']) ? sanitize_input($postData['chess_com_username']) : '';
    $whiteOpening = isset($postData['white_opening']) ? sanitize_input($postData['white_opening']) : '';
    $blackOpening = isset($postData['black_opening']) ? sanitize_input($postData['black_opening']) : '';

    $filePath = '/data/tpot/player_list.csv'; // Change the path as needed
    if (!file_exists($filePath)) {
        $headers = "Lichess Elo,Chess.com Elo,Lichess Username,Chess.com Username,White Opening,Black Opening\n";
        file_put_contents($filePath, $headers, FILE_APPEND);
    }
    $csvData = "$lichessElo,$chessComElo,$lichessUsername,$chessComUsername,$whiteOpening,$blackOpening\n";
    file_put_contents($filePath, $csvData, FILE_APPEND);
} 
?>
