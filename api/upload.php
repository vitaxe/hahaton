<?php
declare(strict_types=1);
require_once __DIR__ . '/../config/auth.php';
$user=require_auth('student');
if($_SERVER['REQUEST_METHOD']!=='POST') json_response(['ok'=>false,'error'=>'METHOD_NOT_ALLOWED'],405);
$stepCode=trim((string)($_POST['step_code']??''));
if($stepCode===''||empty($_FILES['file'])) json_response(['ok'=>false,'error'=>'VALIDATION'],422);
$step=db()->prepare('SELECT id FROM steps WHERE code=? LIMIT 1');$step->execute([$stepCode]);$stepId=(int)($step->fetchColumn()?:0);if(!$stepId)json_response(['ok'=>false,'error'=>'STEP_NOT_FOUND'],404);
$file=$_FILES['file']; if($file['error']!==UPLOAD_ERR_OK)json_response(['ok'=>false,'error'=>'UPLOAD_ERROR'],422);
if($file['size']>8*1024*1024)json_response(['ok'=>false,'error'=>'FILE_TOO_LARGE'],422);
$allowed=['image/png','image/jpeg','application/pdf','text/plain','application/zip'];$mime=(new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);if(!in_array($mime,$allowed,true))json_response(['ok'=>false,'error'=>'FILE_TYPE'],422);
if(!is_dir(UPLOAD_DIR))mkdir(UPLOAD_DIR,0775,true);$ext=pathinfo($file['name'],PATHINFO_EXTENSION);$name=bin2hex(random_bytes(12)).($ext?'.'.preg_replace('/[^a-zA-Z0-9]/','',$ext):'');$target=UPLOAD_DIR.$name;if(!move_uploaded_file($file['tmp_name'],$target))json_response(['ok'=>false,'error'=>'SAVE_ERROR'],500);
$payload=json_encode(['type'=>'file','original_name'=>$file['name'],'mime'=>$mime,'size'=>$file['size'],'path'=>'storage/submissions/'.$name],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
$stmt=db()->prepare("INSERT INTO submissions(step_id,student_id,status,payload_json) VALUES(?,?, 'review', ?)");$stmt->execute([$stepId,$user['id'],$payload]);
$stmt=db()->prepare("INSERT INTO step_progress(student_id,step_id,status) VALUES(?,?, 'review') ON DUPLICATE KEY UPDATE status='review',updated_at=NOW()");$stmt->execute([$user['id'],$stepId]);
json_response(['ok'=>true,'submission_id'=>(int)db()->lastInsertId()]);
