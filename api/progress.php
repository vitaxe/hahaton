<?php
declare(strict_types=1);
require_once __DIR__ . '/../config/auth.php';
$user=require_auth('student');
$data=input_json(); $stepId=(int)($data['step_id']??0); $status=(string)($data['status']??'idle');
$allowed=['idle','progressing','done','review','returned','failed'];
if(!$stepId||!in_array($status,$allowed,true)) json_response(['ok'=>false,'error'=>'VALIDATION'],422);
$stmt=db()->prepare('INSERT INTO step_progress(student_id,step_id,status,opened_at,completed_at) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE status=VALUES(status), opened_at=COALESCE(opened_at,VALUES(opened_at)), completed_at=VALUES(completed_at), updated_at=NOW()');
$stmt->execute([$user['id'],$stepId,$status,date('Y-m-d H:i:s'),$status==='done'?date('Y-m-d H:i:s'):null]);
json_response(['ok'=>true]);
