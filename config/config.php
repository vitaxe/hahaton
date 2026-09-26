<?php
declare(strict_types=1);

const APP_NAME = 'КодФормула';
const DB_HOST = '127.0.0.1';
const DB_PORT = '3306';
const DB_NAME = 'kodformula';
const DB_USER = 'root';
const DB_PASS = '';
const SESSION_NAME = 'kodformula_session';
const UPLOAD_DIR = __DIR__ . '/../storage/submissions/';

ini_set('session.use_strict_mode', '1');
session_name(SESSION_NAME);
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}
