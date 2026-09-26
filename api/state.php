<?php
declare(strict_types=1);
require_once __DIR__ . '/../config/auth.php';
$user=require_auth();
if($user['role']!=='student') json_response(['ok'=>true,'progress'=>[],'feedback'=>[]]);
$stmt=db()->prepare("SELECT sp.step_id,s.code,sp.status FROM step_progress sp JOIN steps s ON s.id=sp.step_id WHERE sp.student_id=?");$stmt->execute([$user['id']]);$progress=[];foreach($stmt->fetchAll() as $r)$progress[$r['code']]=$r['status'];
$stmt=db()->prepare("SELECT s.code,sub.curator_comment FROM submissions sub JOIN steps s ON s.id=sub.step_id WHERE sub.student_id=? AND sub.curator_comment IS NOT NULL AND sub.curator_comment<>'' ORDER BY sub.submitted_at DESC");$stmt->execute([$user['id']]);$feedback=[];foreach($stmt->fetchAll() as $r){if(!isset($feedback[$r['code']]))$feedback[$r['code']]=$r['curator_comment'];}
json_response(['ok'=>true,'progress'=>$progress,'feedback'=>$feedback]);
