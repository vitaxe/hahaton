<?php
declare(strict_types=1);
require_once __DIR__ . '/../config/auth.php';
require_auth('admin');

$pdo = db();
$pdo->exec("CREATE TABLE IF NOT EXISTS app_settings (
    setting_key VARCHAR(80) PRIMARY KEY,
    setting_value TEXT NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

$defaults = [
    'app_name' => 'КодФормула',
    'timezone' => 'Europe/Prague',
    'auto_save_progress' => '1'
];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $settings = $defaults;
    foreach ($pdo->query('SELECT setting_key, setting_value FROM app_settings')->fetchAll() as $row) {
        $settings[$row['setting_key']] = $row['setting_value'];
    }
    json_response(['ok' => true, 'settings' => $settings]);
}

$data = input_json();
$appName = trim((string)($data['app_name'] ?? ''));
$timezone = (string)($data['timezone'] ?? 'Europe/Prague');
$autoSave = !empty($data['auto_save_progress']) ? '1' : '0';
if ($appName === '' || !in_array($timezone, ['Europe/Prague', 'Europe/Moscow'], true)) {
    json_response(['ok' => false, 'error' => 'VALIDATION'], 422);
}

$statement = $pdo->prepare('INSERT INTO app_settings(setting_key,setting_value) VALUES(?,?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value),updated_at=NOW()');
foreach (['app_name' => $appName, 'timezone' => $timezone, 'auto_save_progress' => $autoSave] as $key => $value) {
    $statement->execute([$key, $value]);
}
json_response(['ok' => true, 'settings' => ['app_name' => $appName, 'timezone' => $timezone, 'auto_save_progress' => $autoSave]]);
