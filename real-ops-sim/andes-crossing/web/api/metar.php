<?php
// METAR proxy with a 5-minute file cache. GET ?ids=SCEL,SAME  →  aviationweather.gov JSON (decoded).
// Same-origin for the app, so the browser needs no CORS from NOAA, and NOAA sees one request per 5 minutes.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=120');
$ids = strtoupper(preg_replace('/[^A-Za-z0-9,]/', '', $_GET['ids'] ?? ''));
$list = array_slice(array_filter(explode(',', $ids), fn($i) => preg_match('/^[A-Z]{4}$/', $i)), 0, 40);
if (!$list) { http_response_code(400); echo '{"error":"ids required"}'; exit; }
sort($list);
$dir = __DIR__ . '/cache'; if (!is_dir($dir)) @mkdir($dir, 0750, true);
$file = $dir . '/metar-' . md5(implode(',', $list)) . '.json';
if (is_file($file) && time() - filemtime($file) < 300) { readfile($file); exit; }
$url = 'https://aviationweather.gov/api/data/metar?format=json&hours=3&ids=' . implode(',', $list);
$ctx = stream_context_create(['http' => ['timeout' => 12, 'header' => "User-Agent: andes-crossing/0.1\r\n"]]);
$body = @file_get_contents($url, false, $ctx);
if ($body === false || $body === '') {
  if (is_file($file)) { header('X-Stale: 1'); readfile($file); exit; }
  http_response_code(502); echo '{"error":"upstream unavailable"}'; exit;
}
file_put_contents($file, $body, LOCK_EX);
echo $body;
