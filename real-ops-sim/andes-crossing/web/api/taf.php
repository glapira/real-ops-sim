<?php
require __DIR__ . '/_http.php';
// TAF proxy with a 10-minute file cache. GET ?ids=SAEZ  →  aviationweather.gov TAF JSON (decoded periods + raw text).
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=300');
$ids = strtoupper(preg_replace('/[^A-Za-z0-9,]/', '', $_GET['ids'] ?? ''));
$list = array_slice(array_filter(explode(',', $ids), fn($i) => preg_match('/^[A-Z]{4}$/', $i)), 0, 10);
if (!$list) { http_response_code(400); echo '{"error":"ids required"}'; exit; }
sort($list);
$dir = __DIR__ . '/cache'; if (!is_dir($dir)) @mkdir($dir, 0750, true);
$file = $dir . '/taf-' . md5(implode(',', $list)) . '.json';
if (is_file($file) && time() - filemtime($file) < 600) { readfile($file); exit; }
$body = ac_get('https://aviationweather.gov/api/data/taf?format=json&ids=' . implode(',', $list), 12);
if ($body === false || $body === '') {
  if (is_file($file)) { header('X-Stale: 1'); readfile($file); exit; }
  http_response_code(502); echo '{"error":"upstream unavailable"}'; exit;
}
file_put_contents($file, $body, LOCK_EX);
echo $body;
