<?php
declare(strict_types=1);
require_once __DIR__ . '/../config/auth.php';
require_any_role(['curator', 'admin']);

$sql = "
    SELECT
        u.id,
        u.name,
        u.login,
        u.grade,
        GROUP_CONCAT(DISTINCT c.title ORDER BY c.id SEPARATOR ', ') AS courses,
        COUNT(DISTINCT s.id) AS total_steps,
        COUNT(DISTINCT CASE WHEN sp.status = 'done' THEN sp.step_id END) AS done_steps,
        CASE
            WHEN SUM(sp.status = 'returned') > 0 THEN 'returned'
            WHEN SUM(sp.status = 'review') > 0 THEN 'review'
            WHEN SUM(sp.status = 'done') > 0 THEN 'progressing'
            ELSE 'idle'
        END AS status
    FROM users u
    LEFT JOIN course_assignments ca ON ca.student_id = u.id
    LEFT JOIN courses c ON c.id = ca.course_id
    LEFT JOIN modules m ON m.course_id = c.id
    LEFT JOIN steps s ON s.module_id = m.id
    LEFT JOIN step_progress sp ON sp.student_id = u.id AND sp.step_id = s.id
    WHERE u.role = 'student' AND u.is_active = 1
    GROUP BY u.id, u.name, u.login, u.grade
    ORDER BY u.name
";

$rows = db()->query($sql)->fetchAll();
foreach ($rows as &$row) {
    $row['total_steps'] = (int)$row['total_steps'];
    $row['done_steps'] = (int)$row['done_steps'];
    $row['percent'] = $row['total_steps'] ? (int)round($row['done_steps'] / $row['total_steps'] * 100) : 0;
}
unset($row);

json_response(['ok' => true, 'students' => $rows]);
