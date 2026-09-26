<?php
declare(strict_types=1);
require_once __DIR__ . '/../config/auth.php';
$user=require_any_role(['admin','curator']);
if($_SERVER['REQUEST_METHOD']==='GET'){
 $sql='SELECT ca.id,ca.course_id,ca.student_id,ca.curator_id,ca.assigned_at,c.title course_title,u.name student_name FROM course_assignments ca JOIN courses c ON c.id=ca.course_id JOIN users u ON u.id=ca.student_id ORDER BY ca.assigned_at DESC';
 $rows=db()->query($sql)->fetchAll();json_response(['ok'=>true,'assignments'=>$rows]);
}
$data=input_json();$course=(int)($data['course_id']??0);$student=(int)($data['student_id']??0);$curator=$user['role']==='curator'?$user['id']:($data['curator_id']??null);if(!$course||!$student)json_response(['ok'=>false,'error'=>'VALIDATION'],422);
$stmt=db()->prepare('INSERT INTO course_assignments(course_id,student_id,curator_id) VALUES(?,?,?) ON DUPLICATE KEY UPDATE curator_id=VALUES(curator_id)');$stmt->execute([$course,$student,$curator]);
$stmt=db()->prepare('INSERT INTO enrollments(course_id,student_id,curator_id) VALUES(?,?,?) ON DUPLICATE KEY UPDATE curator_id=VALUES(curator_id)');$stmt->execute([$course,$student,$curator]);json_response(['ok'=>true]);
