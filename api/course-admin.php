<?php
declare(strict_types=1);
require_once __DIR__ . '/../config/auth.php';
require_auth('admin');
$data=input_json();$action=$_GET['action']??'list';$pdo=db();
if($action==='list'){json_response(['ok'=>true,'courses'=>$pdo->query('SELECT * FROM courses ORDER BY id')->fetchAll()]);}
if($action==='create'){foreach(['code','title','classes_label','tool','goal'] as $f)if(trim((string)($data[$f]??''))==='')json_response(['ok'=>false,'error'=>'VALIDATION'],422);$stmt=$pdo->prepare('INSERT INTO courses(code,title,classes_label,tool,duration_label,goal,status) VALUES(?,?,?,?,?,?,?)');$stmt->execute([$data['code'],$data['title'],$data['classes_label'],$data['tool'],$data['duration_label']??null,$data['goal'],'draft']);json_response(['ok'=>true,'id'=>(int)$pdo->lastInsertId()]);}
if($action==='publish'){ $id=(int)($data['id']??0);$stmt=$pdo->prepare("UPDATE courses SET status='published',version=version+1 WHERE id=?");$stmt->execute([$id]);json_response(['ok'=>true]);}
if($action==='archive'){ $id=(int)($data['id']??0);$stmt=$pdo->prepare("UPDATE courses SET status='archived',version=version+1 WHERE id=?");$stmt->execute([$id]);json_response(['ok'=>true]);}
json_response(['ok'=>false,'error'=>'UNKNOWN_ACTION'],400);
