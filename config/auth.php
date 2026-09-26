<?php
declare(strict_types=1);
require_once __DIR__ . '/db.php';

function json_response(array $data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function input_json(): array {
    $raw = file_get_contents('php://input');
    if (!$raw) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function current_user(): ?array {
    if (empty($_SESSION['user_id'])) return null;
    $stmt = db()->prepare('SELECT id, login, name, role, grade FROM users WHERE id = ? AND is_active = 1');
    $stmt->execute([$_SESSION['user_id']]);
    return $stmt->fetch() ?: null;
}

function require_auth(?string $role = null): array {
    $user = current_user();
    if (!$user) json_response(['ok' => false, 'error' => 'AUTH_REQUIRED'], 401);
    if ($role !== null && $user['role'] !== $role) json_response(['ok' => false, 'error' => 'FORBIDDEN'], 403);
    return $user;
}

function require_any_role(array $roles): array {
    $user = require_auth();
    if (!in_array($user['role'], $roles, true)) json_response(['ok' => false, 'error' => 'FORBIDDEN'], 403);
    return $user;
}

function public_user(array $user): array {
    return ['id' => (int)$user['id'], 'login' => $user['login'], 'name' => $user['name'], 'role' => $user['role'], 'grade' => $user['grade'] === null ? null : (int)$user['grade']];
}
