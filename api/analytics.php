<?php
declare(strict_types=1);
require_once __DIR__ . '/../config/auth.php';
$user=require_any_role(['curator','admin']);
$pdo=db();
$students=(int)$pdo->query("SELECT COUNT(*) FROM users WHERE role='student' AND is_active=1")->fetchColumn();
$users=(int)$pdo->query("SELECT COUNT(*) FROM users WHERE is_active=1")->fetchColumn();
$courses=(int)$pdo->query("SELECT COUNT(*) FROM courses WHERE status <> 'archived'")->fetchColumn();
$modules=(int)$pdo->query("SELECT COUNT(*) FROM modules m JOIN courses c ON c.id=m.course_id WHERE c.status <> 'archived'")->fetchColumn();
$total_steps=(int)$pdo->query("SELECT COUNT(*) FROM steps s JOIN modules m ON m.id=s.module_id JOIN courses c ON c.id=m.course_id WHERE c.status <> 'archived'")->fetchColumn();
$review=(int)$pdo->query("SELECT COUNT(*) FROM submissions WHERE status='review'")->fetchColumn();
$done=(int)$pdo->query("SELECT COUNT(*) FROM step_progress WHERE status='done'")->fetchColumn();
$returned=(int)$pdo->query("SELECT COUNT(*) FROM step_progress WHERE status='returned'")->fetchColumn();
$byCourse=$pdo->query("SELECT c.id,c.title,COUNT(DISTINCT s.id) total_steps,COUNT(DISTINCT CASE WHEN sp.status='done' THEN CONCAT(sp.student_id,'-',sp.step_id) END) done_items FROM courses c JOIN modules m ON m.course_id=c.id JOIN steps s ON s.module_id=m.id LEFT JOIN step_progress sp ON sp.step_id=s.id GROUP BY c.id ORDER BY c.id")->fetchAll();
json_response(['ok'=>true,'metrics'=>compact('students','users','courses','modules','total_steps','review','done','returned'),'courses'=>$byCourse]);
