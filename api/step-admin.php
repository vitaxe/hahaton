<?php
declare(strict_types=1);
require_once __DIR__ . '/../config/auth.php';
require_auth('admin');
$data=input_json(); $action=$_GET['action']??'create'; $pdo=db();
if($action==='types'){
 $rows=$pdo->query("SELECT id,code,title,grading,icon_code,schema_json FROM step_types ORDER BY id")->fetchAll();
 foreach($rows as &$r){$r['schema_json']=json_decode((string)$r['schema_json'],true)?:[];} unset($r);
 json_response(['ok'=>true,'types'=>$rows]);
}
if($action==='create'){
 foreach(['module_id','code','title','step_type_id'] as $f) if(!isset($data[$f]) || $data[$f]==='') json_response(['ok'=>false,'error'=>'VALIDATION'],422);
 $content=json_encode($data['content']??[],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
 $validation=json_encode($data['validation']??[],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
 $teacher=json_encode($data['teacher_only']??[],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
 $stmt=$pdo->prepare('INSERT INTO steps(module_id,code,title,step_type_id,position,content_json,validation_json,teacher_only_json) VALUES(?,?,?,?,?,?,?,?)');
 $stmt->execute([(int)$data['module_id'],(string)$data['code'],(string)$data['title'],(int)$data['step_type_id'],(int)($data['position']??1),$content,$validation,$teacher]);
 json_response(['ok'=>true,'id'=>(int)$pdo->lastInsertId()]);
}
if($action==='update'){
 $id=(int)($data['id']??0); if(!$id) json_response(['ok'=>false,'error'=>'VALIDATION'],422);
 $content=json_encode($data['content']??[],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
 $validation=json_encode($data['validation']??[],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
 $teacher=json_encode($data['teacher_only']??[],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
 $stmt=$pdo->prepare('UPDATE steps SET title=?,step_type_id=?,position=?,content_json=?,validation_json=?,teacher_only_json=? WHERE id=?');
 $stmt->execute([(string)($data['title']??''),(int)($data['step_type_id']??1),(int)($data['position']??1),$content,$validation,$teacher,$id]);
 json_response(['ok'=>true]);
}
json_response(['ok'=>false,'error'=>'UNKNOWN_ACTION'],400);
