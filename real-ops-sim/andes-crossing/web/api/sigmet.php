<?php
// International SIGMETs for the South American FIRs, cached 10 minutes. GET → aviationweather.gov isigmet JSON,
// filtered to South American FIRs (ICAO prefix S).
header('Content-Type: application/json; charset=utf-8');
$dir = __DIR__ . '/cache'; if (!is_dir($dir)) @mkdir($dir, 0750, true);
$file = $dir . '/isigmet.json';
if (!is_file($file) || time() - filemtime($file) > 600) {
  $ctx = stream_context_create(['http' => ['timeout' => 15, 'header' => "User-Agent: andes-crossing/0.1\r\n"]]);
  $body = @file_get_contents('https://aviationweather.gov/api/data/isigmet?format=json', false, $ctx);
  if ($body !== false && $body !== '') {
    $all = json_decode($body, true) ?: [];
    $keep = array_values(array_filter($all, function ($s) {
      $fir = strtoupper($s['firId'] ?? ($s['icaoId'] ?? ''));
      return preg_match('/^S/', $fir);   // every South American FIR
    }));
    file_put_contents($file, json_encode($keep), LOCK_EX);
  }
}
if (is_file($file)) readfile($file); else echo '[]';
