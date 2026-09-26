<?php
declare(strict_types=1);
require_once __DIR__ . '/../config/auth.php';

$action = $_GET['action'] ?? $_POST['action'] ?? 'me';

if ($action === 'login') {
    $data = input_json();
    $login = strtolower(trim((string)($data['login'] ?? '')));
    $password = (string)($data['password'] ?? '');
    if ($login === '' || $password === '') json_response(['ok'=>false,'error'=>'VALIDATION'],422);

    $stmt = db()->prepare('SELECT * FROM users WHERE login = ? AND is_active = 1 LIMIT 1');
    $stmt->execute([$login]);
    $user = $stmt->fetch();
    if (!$user || !password_verify($password, $user['password_hash'])) {
        json_response(['ok'=>false,'error'=>'INVALID_CREDENTIALS'],401);
    }
    session_regenerate_id(true);
    $_SESSION['user_id'] = (int)$user['id'];
    $_SESSION['csrf'] = bin2hex(random_bytes(24));
    $stmt = db()->prepare('UPDATE users SET last_login_at = NOW() WHERE id = ?');
    $stmt->execute([$user['id']]);
    json_response(['ok'=>true,'user'=>public_user($user),'csrf'=>$_SESSION['csrf']]);
}

if ($action === 'logout') {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time()-42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();
    json_response(['ok'=>true]);
}

if ($action === 'me') {
    $user = current_user();
    json_response(['ok'=>true,'authenticated'=>(bool)$user,'user'=>$user?public_user($user):null,'csrf'=>$_SESSION['csrf']??null]);
}

json_response(['ok'=>false,'error'=>'UNKNOWN_ACTION'],400);
