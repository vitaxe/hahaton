<?php
declare(strict_types=1);
require_once __DIR__ . '/../config/auth.php';
$user=require_any_role(['student','curator','admin']);

function normalize_answer(string $v): string {
    return mb_strtolower(trim(preg_replace('/\s+/u',' ', $v)));
}
function run_python_tests(string $code, array $tests, int $timeMs=1000): array {
    $tmpDir=sys_get_temp_dir().'/kodformula_'.bin2hex(random_bytes(8)); if(!mkdir($tmpDir,0700,true)) return ['ok'=>false,'message'=>'Не удалось подготовить среду проверки.'];
    $file=$tmpDir.'/main.py'; file_put_contents($file,$code);
    $results=[]; $all=true;
    foreach($tests as $i=>$test){
        $input=(string)($test['input']??''); $expected=trim((string)($test['output']??''));
        $cmd='timeout 2s python3 -I '.escapeshellarg($file);
        $des=[0=>['pipe','r'],1=>['pipe','w'],2=>['pipe','w']];
        $p=proc_open($cmd,$des,$pipes,$tmpDir);
        if(!is_resource($p)){ $all=false; $results[]=['index'=>$i,'ok'=>false,'message'=>'Не удалось запустить Python 3.']; continue; }
        fwrite($pipes[0],$input); fclose($pipes[0]);
        $stdout=stream_get_contents($pipes[1]); fclose($pipes[1]); $stderr=stream_get_contents($pipes[2]); fclose($pipes[2]);
        $exit=proc_close($p); $actual=trim($stdout); $ok=$exit===0 && $actual===$expected;
        $all=$all && $ok; $results[]=['index'=>$i,'ok'=>$ok,'message'=>$ok?'':'Неверный ответ или ошибка выполнения.'];
        if(!$ok && $exit!==0) $results[count($results)-1]['message']='Ошибка выполнения программы.';
    }
    @unlink($file); @rmdir($tmpDir);
    return ['ok'=>$all,'results'=>$results];
}

if($_SERVER['REQUEST_METHOD']==='GET'){
    if($user['role']==='student'){ $stmt=db()->prepare('SELECT s.id,s.step_id,s.status,s.payload_json AS payload,s.score,s.curator_comment,s.submitted_at,s.reviewed_at,st.code AS step_code,st.title AS step_title FROM submissions s JOIN steps st ON st.id=s.step_id WHERE s.student_id=? ORDER BY s.submitted_at DESC'); $stmt->execute([$user['id']]); $rows=$stmt->fetchAll(); }
    else { $stmt=db()->query("SELECT s.id,s.step_id,s.status,s.payload_json AS payload,s.score,s.curator_comment,s.submitted_at,s.reviewed_at,u.id student_id,u.name student_name,st.code step_code,st.title step_title FROM submissions s JOIN users u ON u.id=s.student_id JOIN steps st ON st.id=s.step_id WHERE s.status='review' ORDER BY s.submitted_at ASC"); $rows=$stmt->fetchAll(); }
    foreach($rows as &$r)$r['payload']=json_decode($r['payload'],true); unset($r); json_response(['ok'=>true,'submissions'=>$rows]);
}
if($user['role']!=='student') json_response(['ok'=>false,'error'=>'FORBIDDEN'],403);
$data=input_json(); $stepId=(int)($data['step_id']??0); $stepCode=trim((string)($data['step_code']??'')); $type=(string)($data['type']??''); $value=(string)($data['value']??'');
if(!$stepId && $stepCode!==''){ $q=db()->prepare('SELECT s.id FROM steps s WHERE s.code=? LIMIT 1'); $q->execute([$stepCode]); $stepId=(int)($q->fetchColumn()?:0); }
if(!$stepId||$value==='') json_response(['ok'=>false,'error'=>'VALIDATION'],422);
$stmt=db()->prepare('SELECT s.id,st.grading,st.code,s.validation_json,s.teacher_only_json FROM steps s JOIN step_types st ON st.id=s.step_type_id WHERE s.id=?'); $stmt->execute([$stepId]); $step=$stmt->fetch(); if(!$step) json_response(['ok'=>false,'error'=>'STEP_NOT_FOUND'],404);
$validation=json_decode($step['validation_json'],true)?:[]; $teacher=json_decode($step['teacher_only_json'],true)?:[]; $status='review'; $score=null; $comment=null;
if($step['grading']==='auto' && $step['code']!=='') {
 if($step['code'] && isset($teacher['tests']) && is_array($teacher['tests']) && $type==='code'){
   $run=run_python_tests($value,$teacher['tests'],(int)($teacher['limits']['time_ms']??1000)); $status=$run['ok']?'accepted':'failed'; $score=$run['ok']?100:0; $comment=$run['ok']?'Все тесты пройдены.':'Решение не прошло автоматическую проверку.';
 } elseif(isset($validation['answer']) && is_array($validation['answer'])) {
   $got=array_values(array_filter(array_map('normalize_answer',preg_split('/\R/u',$value)))); $exp=array_values(array_map('normalize_answer',$validation['answer'])); sort($got); sort($exp); $correct=$got===$exp; $status=$correct?'accepted':'failed'; $score=$correct?100:0; $comment=$correct?'Ответ принят.':'Выбраны не все правильные варианты.';
 } else {
   $expected=(string)($validation['answer']??''); $correct=$expected!=='' && normalize_answer($value)===normalize_answer($expected); $status=$correct?'accepted':'failed'; $score=$correct?100:0; $comment=$correct?'Ответ принят.':'Ответ не совпал с правильным.';
 }
} elseif($step['grading']==='read') { $status='accepted'; $score=100; $comment='Шаг засчитан после прочтения.'; }
$payload=json_encode(['type'=>$type,'value'=>$value],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES); $pdo=db(); $pdo->beginTransaction();
try{ $stmt=$pdo->prepare('INSERT INTO submissions(step_id,student_id,status,payload_json,score,curator_comment,submitted_at) VALUES(?,?,?,?,?,?,NOW())'); $stmt->execute([$stepId,$user['id'],$status,$payload,$score,$comment]); $stmt=$pdo->prepare('INSERT INTO step_progress(student_id,step_id,status,completed_at) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE status=VALUES(status),completed_at=VALUES(completed_at),updated_at=NOW()'); $stmt->execute([$user['id'],$stepId,$status==='accepted'?'done':($status==='failed'?'failed':'review'),$status==='accepted'?date('Y-m-d H:i:s'):null]); $pdo->commit(); }catch(Throwable $e){$pdo->rollBack(); json_response(['ok'=>false,'error'=>'DB_ERROR'],500);}
json_response(['ok'=>true,'status'=>$status,'score'=>$score,'comment'=>$comment]);
