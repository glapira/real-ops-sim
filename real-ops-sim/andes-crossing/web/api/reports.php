<?php
// Crew turbulence reports. No login for now (open app): strict validation, size and rate limits.
// POST JSON → stores one line in store/reports.jsonl.  GET → the last 200 reports (no personal data kept).
header('Content-Type: application/json; charset=utf-8');
$store = __DIR__ . '/store'; if (!is_dir($store)) @mkdir($store, 0750, true);
if (!is_file($store . '/.htaccess')) file_put_contents($store . '/.htaccess', "Require all denied\n");
$file = $store . '/reports.jsonl';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  $lines = is_file($file) ? array_slice(file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES), -200) : [];
  echo '[' . implode(',', $lines) . ']'; exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); exit; }

// at most 30 reports an hour from one address
$ipKey = $store . '/rate-' . md5($_SERVER['REMOTE_ADDR'] ?? 'x');
$hits = is_file($ipKey) ? array_filter(explode("\n", file_get_contents($ipKey)), fn($t) => $t > time() - 3600) : [];
if (count($hits) >= 30) { http_response_code(429); echo '{"error":"too many reports"}'; exit; }

$raw = file_get_contents('php://input', false, null, 0, 8192);
$in = json_decode($raw, true);
if (!is_array($in)) { http_response_code(400); echo '{"error":"bad json"}'; exit; }
$int = ['nil', 'light', 'moderate', 'severe', 'extreme'];
$verdict = ['correct', 'partly', 'wrong'];
$r = [
  'id' => bin2hex(random_bytes(6)),
  'received' => gmdate('c'),
  'obs_time' => preg_match('/^\d{4}-\d\d-\d\dT\d\d:\d\d/', $in['obs_time'] ?? '') ? substr($in['obs_time'], 0, 20) : gmdate('c'),
  'aircraft' => in_array($in['aircraft'] ?? '', ['B788', 'GL8T', 'other'], true) ? $in['aircraft'] : 'other',
  'fl' => max(0, min(510, intval($in['fl'] ?? 0))),
  'lat' => isset($in['lat']) ? round(max(-90, min(90, floatval($in['lat']))), 3) : null,
  'lon' => isset($in['lon']) ? round(max(-180, min(180, floatval($in['lon']))), 3) : null,
  'route' => substr(preg_replace('/[^A-Z0-9 \/-]/', '', strtoupper($in['route'] ?? '')), 0, 80),
  'felt' => in_array($in['felt'] ?? '', $int, true) ? $in['felt'] : null,
  'forecast' => in_array($in['forecast'] ?? '', $int, true) ? $in['forecast'] : null,
  'verdict' => in_array($in['verdict'] ?? '', $verdict, true) ? $in['verdict'] : null,
  'cause' => in_array($in['cause'] ?? '', ['mountain_wave', 'cat', 'convective', 'rotor', 'unknown'], true) ? $in['cause'] : 'unknown',
  'note' => substr(strip_tags($in['note'] ?? ''), 0, 500),
  'model' => substr(preg_replace('/[^a-z0-9.\-]/', '', $in['model'] ?? ''), 0, 20),
];
if (!$r['felt'] || !$r['verdict']) { http_response_code(422); echo '{"error":"felt and verdict required"}'; exit; }
file_put_contents($file, json_encode($r, JSON_UNESCAPED_SLASHES) . "\n", FILE_APPEND | LOCK_EX);
$hits[] = time(); file_put_contents($ipKey, implode("\n", $hits));
echo json_encode(['ok' => true, 'id' => $r['id']]);
