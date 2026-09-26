<?php
declare(strict_types=1);
require_once __DIR__ . '/../config/auth.php';
require_auth('admin');
if($_SERVER['REQUEST_METHOD']==='GET'){ $rows=db()->query('SELECT id,login,name,role,grade,is_active,created_at,last_login_at FROM users ORDER BY role,name')->fetchAll(); json_response(['ok'=>true,'users'=>$rows]); }
$data=input_json();$login=strtolower(trim((string)($data['login']??'')));$name=trim((string)($data['name']??''));$role=(string)($data['role']??'student');$grade=$data['grade']??null;$password=(string)($data['password']??'1234');
if(!$login||!$name||!in_array($role,['student','curator','admin'],true))json_response(['ok'=>false,'error'=>'VALIDATION'],422);
if(isset($data['id'])){$id=(int)$data['id'];$active=(int)($data['is_active']??1);if($password!=='1234'||!empty($data['password_changed'])){$stmt=db()->prepare('UPDATE users SET login=?,name=?,role=?,grade=?,is_active=?,password_hash=? WHERE id=?');$stmt->execute([$login,$name,$role,$grade,$active,password_hash($password,PASSWORD_DEFAULT),$id]);}else{$stmt=db()->prepare('UPDATE users SET login=?,name=?,role=?,grade=?,is_active=? WHERE id=?');$stmt->execute([$login,$name,$role,$grade,$active,$id]);}if(!$stmt->rowCount())json_response(['ok'=>false,'error'=>'NOT_FOUND'],404);json_response(['ok'=>true]);}
$stmt=db()->prepare('INSERT INTO users(login,password_hash,name,role,grade) VALUES(?,?,?,?,?)');$stmt->execute([$login,password_hash($password,PASSWORD_DEFAULT),$name,$role,$grade]);json_response(['ok'=>true,'id'=>(int)db()->lastInsertId()]);
