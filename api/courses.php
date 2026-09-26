<?php
declare(strict_types=1);
require_once __DIR__ . '/../config/auth.php';
$user = require_auth();

$code = trim((string)($_GET['code'] ?? ''));
$id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
$full = (($_GET['full'] ?? '') === '1');

function load_course(int $courseId): array {
    $stmt = db()->prepare("SELECT c.id,c.code,c.title,c.classes_label AS classes,c.tool,c.duration_label AS duration,c.goal,c.status FROM courses c WHERE c.id=? LIMIT 1");
    $stmt->execute([$courseId]);
    $course = $stmt->fetch();
    if (!$course) json_response(['ok'=>false,'error'=>'NOT_FOUND'],404);

    $stmt = db()->prepare('SELECT id,code,title,position FROM modules WHERE course_id=? ORDER BY position');
    $stmt->execute([$courseId]);
    $modules = $stmt->fetchAll();

    foreach ($modules as &$module) {
        $s = db()->prepare('SELECT s.id,s.code,s.title,st.code AS type,st.title AS type_title,st.grading,s.position,s.content_json AS content,s.validation_json AS validation FROM steps s JOIN step_types st ON st.id=s.step_type_id WHERE s.module_id=? ORDER BY s.position');
        $s->execute([$module['id']]);
        $module['steps'] = array_map(static function(array $step): array {
            $step['content'] = json_decode((string)$step['content'], true) ?: [];
            $step['validation'] = json_decode((string)$step['validation'], true) ?: [];
            return $step;
        }, $s->fetchAll());
    }
    unset($module);
    $course['modules'] = $modules;
    return $course;
}

if ($code !== '' || $id > 0) {
    $where = $code !== '' ? 'c.code=?' : 'c.id=?';
    $param = $code !== '' ? $code : $id;
    $stmt = db()->prepare("SELECT c.id FROM courses c WHERE $where LIMIT 1");
    $stmt->execute([$param]);
    $courseId = (int)($stmt->fetchColumn() ?: 0);
    if (!$courseId) json_response(['ok'=>false,'error'=>'NOT_FOUND'],404);
    json_response(['ok'=>true,'course'=>load_course($courseId)]);
}

$sql = $user['role']==='student'
    ? "SELECT c.id,c.code,c.title,c.classes_label AS classes,c.tool,c.duration_label AS duration,c.goal,c.status, COUNT(DISTINCT s.id) total_steps, COUNT(DISTINCT CASE WHEN sp.status='done' THEN sp.step_id END) done_steps FROM courses c JOIN modules m ON m.course_id=c.id JOIN steps s ON s.module_id=m.id LEFT JOIN step_progress sp ON sp.step_id=s.id AND sp.student_id=? WHERE c.status='published' GROUP BY c.id ORDER BY c.id"
    : "SELECT c.id,c.code,c.title,c.classes_label AS classes,c.tool,c.duration_label AS duration,c.goal,c.status, COUNT(DISTINCT s.id) total_steps FROM courses c JOIN modules m ON m.course_id=c.id JOIN steps s ON s.module_id=m.id WHERE c.status <> 'archived' GROUP BY c.id ORDER BY c.id";
$stmt=db()->prepare($sql);
$stmt->execute($user['role']==='student'?[$user['id']]:[]);
$rows=$stmt->fetchAll();
foreach($rows as &$row){
    $row['percent']=(int)$row['total_steps']?round(((int)($row['done_steps']??0)/(int)$row['total_steps'])*100):0;
    if ($full) {
        $row = load_course((int)$row['id']);
    }
}
unset($row);
json_response(['ok'=>true,'courses'=>$rows]);
