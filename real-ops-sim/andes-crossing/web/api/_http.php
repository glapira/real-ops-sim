<?php
// One GET helper for the endpoints: curl when the extension is there (it follows the standard proxy and CA settings),
// else PHP streams. Returns the body or false.
function ac_get(string $url, int $timeout = 15) {
  if (function_exists('curl_init')) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => $timeout, CURLOPT_FOLLOWLOCATION => true,
      CURLOPT_USERAGENT => 'andes-crossing/0.1', CURLOPT_ENCODING => '']);
    if ($ca = getenv('SSL_CERT_FILE') ?: getenv('CURL_CA_BUNDLE')) curl_setopt($ch, CURLOPT_CAINFO, $ca);
    $body = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
    return ($body !== false && $code >= 200 && $code < 300) ? $body : false;
  }
  $ctx = stream_context_create(['http' => ['timeout' => $timeout, 'header' => "User-Agent: andes-crossing/0.1\r\n"]]);
  return @file_get_contents($url, false, $ctx);
}
