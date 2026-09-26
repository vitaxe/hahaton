<?php
declare(strict_types=1);
require_once __DIR__ . '/../config/auth.php';
$user=require_any_role(['curator','admin']);
$data=input_json();$submissionId=(int)($data['submission_id']??0);$accepted=(bool)($data['accepted']??false);$comment=trim((string)($data['comment']??''));$score=$data['score']??null;
if(!$submissionId||(!$accepted&&!$comment)) json_response(['ok'=>false,'error'=>'VALIDATION'],422);
$stmt=db()->prepare('SELECT * FROM submissions WHERE id=?');$stmt->execute([$submissionId]);$sub=$stmt->fetch();if(!$sub)json_response(['ok'=>false,'error'=>'NOT_FOUND'],404);
$status=$accepted?'accepted':'returned';
$pdo=db();$pdo->beginTransaction();
try{
 $stmt=$pdo->prepare('UPDATE submissions SET status=?,score=?,curator_comment=?,reviewed_at=NOW(),reviewer_id=? WHERE id=?');$stmt->execute([$status,$score===null?($accepted?100:0):(float)$score,$comment,$user['id'],$submissionId]);
 $stmt=$pdo->prepare('INSERT INTO step_progress(student_id,step_id,status,completed_at) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE status=VALUES(status),completed_at=VALUES(completed_at),updated_at=NOW()');$stmt->execute([$sub['student_id'],$sub['step_id'],$accepted?'done':'returned',$accepted?date('Y-m-d H:i:s'):null]);
 $pdo->commit();
}catch(Throwable $e){$pdo->rollBack();json_response(['ok'=>false,'error'=>'DB_ERROR'],500);}
json_response(['ok'=>true,'status'=>$status]);
