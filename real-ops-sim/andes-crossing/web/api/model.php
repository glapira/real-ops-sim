<?php
require __DIR__ . '/_http.php';
// Fallback for the model winds: the same Open-Meteo GFS query the device makes, fetched by the server and cached for an
// hour, so one request serves every crew device. Only api.open-meteo.com /v1/gfs with the app's own variables is allowed.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=900');
$q = $_SERVER['QUERY_STRING'] ?? '';
parse_str($q, $p);
$okVar = fn($v) => preg_match('/^(wind_speed|wind_direction|temperature|geopotential_height)_(700|500|300|250|200)hPa$/', $v);
$vars = array_filter(explode(',', $p['hourly'] ?? ''), $okVar);
$num = fn($s) => preg_match('/^-?\d{1,3}(\.\d{1,4})?(,-?\d{1,3}(\.\d{1,4})?){0,80}$/', $s ?? '');
if (!$vars || !$num($p['latitude'] ?? '') || !$num($p['longitude'] ?? '')) { http_response_code(400); echo '{"error":"bad query"}'; exit; }
$query = http_build_query(['latitude' => $p['latitude'], 'longitude' => $p['longitude'], 'hourly' => implode(',', $vars),
  'wind_speed_unit' => 'kn', 'forecast_hours' => min(72, max(1, intval($p['forecast_hours'] ?? 48))), 'timezone' => 'UTC']);
$dir = __DIR__ . '/cache'; if (!is_dir($dir)) @mkdir($dir, 0750, true);
$file = $dir . '/gfs-' . md5($query) . '.json';
if (is_file($file) && time() - filemtime($file) < 3600) { readfile($file); exit; }
$body = ac_get('https://api.open-meteo.com/v1/gfs?' . $query, 20);
if ($body === false || $body === '' || strpos($body, '"error":true') !== false) {
  if (is_file($file)) { header('X-Stale: 1'); readfile($file); exit; }
  http_response_code(502); echo '{"error":"model unavailable"}'; exit;
}
file_put_contents($file, $body, LOCK_EX);
echo $body;
