<?php
declare(strict_types=1);
require_once __DIR__ . '/../config/auth.php';
$user = require_auth('student');

$sql = "
    SELECT event_type, status, step_code, step_title, course_title, event_at, score, curator_comment
    FROM (
        SELECT
            'progress' AS event_type,
            sp.status,
            s.code AS step_code,
            s.title AS step_title,
            c.title AS course_title,
            COALESCE(sp.completed_at, sp.updated_at, sp.opened_at) AS event_at,
            NULL AS score,
            NULL AS curator_comment
        FROM step_progress sp
        JOIN steps s ON s.id = sp.step_id
        JOIN modules m ON m.id = s.module_id
        JOIN courses c ON c.id = m.course_id
        WHERE sp.student_id = ?

        UNION ALL

        SELECT
            'submission' AS event_type,
            sub.status,
            s.code AS step_code,
            s.title AS step_title,
            c.title AS course_title,
            sub.submitted_at AS event_at,
            sub.score,
            sub.curator_comment
        FROM submissions sub
        JOIN steps s ON s.id = sub.step_id
        JOIN modules m ON m.id = s.module_id
        JOIN courses c ON c.id = m.course_id
        WHERE sub.student_id = ?
    ) history
    WHERE event_at IS NOT NULL
    ORDER BY event_at DESC
";

$stmt = db()->prepare($sql);
$stmt->execute([$user['id'], $user['id']]);
json_response(['ok' => true, 'history' => $stmt->fetchAll()]);
